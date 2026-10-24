"use client"

import { useEffect, useState } from "react"
import { ApiError } from "@/lib/community-api"
import { apiFetch } from "@/lib/api"

// 홈 'SNS 핫클립' 자리 1~4 (backend site-notices 서비스 hot-clips.ts, 표 notices.hot_clips)
// 관리자 센터 › 컨텐츠 관리 › 핫클립 관리에서 하나씩 등록·수정

export type HotClipPlatform = "youtube" | "chzzk" | "tiktok" | "soop" | "instagram" | "etc"
export const HOT_CLIP_SLOTS = [1, 2, 3, 4] as const

export const HOT_CLIP_PLATFORMS: Record<HotClipPlatform, { label: string; tone: string }> = {
  youtube: { label: "YouTube", tone: "bg-rose-600" },
  chzzk: { label: "CHZZK", tone: "bg-emerald-600" },
  tiktok: { label: "TikTok", tone: "bg-pink-600" },
  soop: { label: "SOOP", tone: "bg-sky-600" },
  instagram: { label: "Instagram", tone: "bg-fuchsia-600" },
  etc: { label: "영상", tone: "bg-zinc-600" },
}

export interface HotClip {
  slot: number
  platform: HotClipPlatform
  title: string
  creator: string
  thumbnailUrl: string
  linkUrl: string
  updatedAt: string
}

export type HotClipInput = Omit<HotClip, "slot" | "updatedAt">

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  let res: Response
  try {
    res = await apiFetch(path, {
      cache: "no-store",
      ...rest,
      headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new ApiError(data.error || data.errors?.[0] || "요청을 처리하지 못했습니다.", res.status)
  }
  return data as T
}

export const fetchHotClips = () => request<{ clips: HotClip[] }>("/api/notices/hot-clips").then((d) => d.clips)
export const fetchAdminHotClips = () => request<{ clips: HotClip[] }>("/api/notices/admin/hot-clips").then((d) => d.clips)
export const saveHotClip = (slot: number, input: HotClipInput) =>
  request<{ clip: HotClip }>(`/api/notices/admin/hot-clips/${slot}`, { method: "PUT", json: input }).then((d) => d.clip)
export const deleteHotClip = (slot: number) => request(`/api/notices/admin/hot-clips/${slot}`, { method: "DELETE" })

export function useHotClips() {
  const [clips, setClips] = useState<HotClip[] | null>(null)
  useEffect(() => {
    let alive = true
    fetchHotClips()
      .then((c) => alive && setClips(c))
      .catch(() => alive && setClips([]))
    return () => {
      alive = false
    }
  }, [])
  return clips
}

// 링크 주소로 플랫폼 짐작 (관리자 화면에서 링크를 넣으면 플랫폼을 미리 골라 줌)
export function guessPlatform(url: string): HotClipPlatform | null {
  let host = ""
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, "")
  } catch {
    return null
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube"
  if (host.endsWith("chzzk.naver.com")) return "chzzk"
  if (host.endsWith("tiktok.com")) return "tiktok"
  if (host.endsWith("sooplive.co.kr") || host.endsWith("afreecatv.com")) return "soop"
  if (host.endsWith("instagram.com")) return "instagram"
  return null
}

// 유튜브 링크면 썸네일 주소를 바로 만들 수 있음 (watch?v=, youtu.be/, shorts/, live/)
export function youtubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, "")
    let id = ""
    if (host === "youtu.be") id = u.pathname.slice(1)
    else if (host.endsWith("youtube.com")) id = u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/)?.[1] || ""
    return /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
  } catch {
    return null
  }
}

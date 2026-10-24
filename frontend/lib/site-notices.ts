"use client"

import { useEffect, useState } from "react"
import { ApiError } from "@/lib/community-api"
import { apiFetch } from "@/lib/api"
import { uploadImageFile } from "@/lib/image-upload"

// 사이트 공지 팝업·배너 (backend site-notices 서비스)
// 화면 규칙 (피로도 줄이기):
//   · 레이어 팝업은 한 번에 하나만: 조건에 맞는 것 중 우선순위가 가장 높은 것
//   · 같은 방문(브라우저 탭) 안에서는 한 번 띄운 팝업을 다시 띄우지 않음 (sessionStorage)
//   · 띠 배너도 하나만. 닫으면 같은 방문 안에서는 다시 안 보임
//   · "보지 않기"(오늘 하루·7일·다시 보지 않기)는 localStorage 에 기한을 저장

// modal·bar: 사이트 공지 팝업·띠 배너, ad_*: 홈 왼쪽·오른쪽·아래 광고 자리 (이미지형만, components/home/home-ad-slot.tsx)
export type NoticePlacement = "modal" | "bar" | "ad_left" | "ad_right" | "ad_bottom"
export type AdPlacement = "ad_left" | "ad_right" | "ad_bottom"
export const AD_PLACEMENTS: AdPlacement[] = ["ad_left", "ad_right", "ad_bottom"]
export const isAdPlacement = (p: string): p is AdPlacement => (AD_PLACEMENTS as string[]).includes(p)
export type NoticeTemplate = "image" | "basic"
export type NoticePages = "home" | "all"
export type NoticeAudience = "all" | "guest" | "member"
export type NoticeDevice = "all" | "mobile" | "desktop"
export type NoticeDismiss = "none" | "today" | "week" | "forever"
export type NoticeStatus = "draft" | "published" | "hidden"

export const NOTICE_PLACEMENT_LABELS: Record<"modal" | "bar", string> = {
  modal: "레이어 팝업 (화면 가운데)",
  bar: "띠 배너 (화면 아래)",
}
export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  ad_left: "좌측 배너",
  ad_right: "우측 배너",
  ad_bottom: "하단 배너",
}
export const NOTICE_TEMPLATE_LABELS: Record<NoticeTemplate, string> = {
  image: "이미지형 (디자인한 이미지를 그대로 올림, 추천)",
  basic: "텍스트형 (제목·본문·버튼을 입력, 시안 없을 때)",
}
export const NOTICE_PAGES_LABELS: Record<NoticePages, string> = {
  home: "홈 화면만",
  all: "모든 화면",
}
export const NOTICE_AUDIENCE_LABELS: Record<NoticeAudience, string> = {
  all: "전체",
  guest: "비회원만",
  member: "로그인 회원만",
}
export const NOTICE_DEVICE_LABELS: Record<NoticeDevice, string> = {
  all: "PC·모바일",
  mobile: "모바일만",
  desktop: "PC만",
}
export const NOTICE_DISMISS_LABELS: Record<NoticeDismiss, string> = {
  none: "보지 않기 없음 (닫기만)",
  today: "오늘 하루 보지 않기",
  week: "7일간 보지 않기",
  forever: "다시 보지 않기",
}
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  draft: "작성 중",
  published: "게시",
  hidden: "숨김",
}

export interface SiteNoticeInput {
  name: string
  placement: NoticePlacement
  template: NoticeTemplate
  title: string
  body: string
  imageUrl: string | null
  mobileImageUrl: string | null
  linkUrl: string | null
  linkLabel: string
  linkNewTab: boolean
  pages: NoticePages
  audience: NoticeAudience
  device: NoticeDevice
  dismiss: NoticeDismiss
  priority: number
  startsAt: string | null
  endsAt: string | null
  status: NoticeStatus
  contractId: number | null // 어느 계약(관리자 B2B 제휴 관리 › 계약·광고 기간)으로 건 것인지
}

export interface SiteNotice extends SiteNoticeInput {
  id: number
  viewCount: number
  clickCount: number
  createdAt: string
  updatedAt: string
}

export type PublicSiteNotice = Omit<SiteNotice, "name" | "status" | "contractId" | "viewCount" | "clickCount" | "createdAt" | "updatedAt">

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

// ---------- 관리자 ----------
export const fetchAdminSiteNotices = () =>
  request<{ notices: SiteNotice[] }>("/api/notices/admin/items").then((d) => d.notices)
export const createSiteNotice = (input: SiteNoticeInput) =>
  request<{ notice: SiteNotice }>("/api/notices/admin/items", { method: "POST", json: input }).then((d) => d.notice)
export const updateSiteNotice = (id: number, input: Partial<SiteNoticeInput>) =>
  request<{ notice: SiteNotice }>(`/api/notices/admin/items/${id}`, { method: "PATCH", json: input }).then((d) => d.notice)
export const deleteSiteNotice = (id: number) =>
  request(`/api/notices/admin/items/${id}`, { method: "DELETE" })
// 계약 기간을 바꾸거나 취소하면 그 계약으로 건 공지·광고 기간을 맞춤 (취소면 숨김)
export const syncNoticesWithContract = (contractId: number, period: { startsAt: string; endsAt: string } | null) =>
  request<{ updated: number }>(`/api/notices/admin/contracts/${contractId}/sync`, {
    method: "POST",
    json: period ?? { cancelled: true },
  }).then((d) => d.updated)

// 계약 날짜(한국 시간, YYYY-MM-DD) → 광고 노출 기간: 시작일 0시 ~ 종료일 다음 날 0시 (종료일 밤 12시에 내려감)
export function contractPeriod(startsOn: string, endsOn: string) {
  const end = new Date(`${endsOn}T00:00:00+09:00`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { startsAt: new Date(`${startsOn}T00:00:00+09:00`).toISOString(), endsAt: end.toISOString() }
}

// 이미지 업로드: 1) 서버에서 업로드 주소 발급 → 2) 브라우저가 S3(운영)·backend(로컬)에 직접 PUT → 3) 공개 주소를 공지에 저장
export const NOTICE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const NOTICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export async function uploadNoticeImage(file: File): Promise<string> {
  if (!NOTICE_IMAGE_TYPES.includes(file.type)) throw new ApiError("JPG, PNG, WEBP, GIF 이미지만 올릴 수 있습니다.", 400)
  if (file.size > NOTICE_IMAGE_MAX_BYTES) throw new ApiError("이미지는 5MB 이하만 올릴 수 있습니다.", 400)
  return uploadImageFile("notices", file)
}

// ---------- 공개 ----------
export function recordNoticeEvent(id: number, type: "view" | "click") {
  request(`/api/notices/${id}/events`, { method: "POST", json: { type } }).catch(() => {})
}

// 한 페이지 로드에서 한 번만 받아 레이아웃(배너·기본형 팝업)과 홈(기존 디자인 팝업)이 같이 씀
let liveRequest: Promise<PublicSiteNotice[]> | null = null
const fetchLiveNotices = () => {
  liveRequest ??= request<{ notices: PublicSiteNotice[] }>("/api/notices/live").then((d) => d.notices)
  return liveRequest
}

const hideKey = (id: number) => `dukji_notice_hide_${id}`
const SESSION_SHOWN_KEY = "dukji_notice_shown"

function isHidden(id: number): boolean {
  try {
    const until = Number(localStorage.getItem(hideKey(id)))
    return until > Date.now()
  } catch {
    return false
  }
}

function shownThisVisit(): number[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_SHOWN_KEY) || "[]")
  } catch {
    return []
  }
}

export function markNoticeShown(id: number) {
  try {
    const shown = shownThisVisit()
    if (!shown.includes(id)) sessionStorage.setItem(SESSION_SHOWN_KEY, JSON.stringify([...shown, id]))
  } catch {}
}

// 사용자가 고른 "보지 않기" 기한 저장. 오늘 하루 = 한국 시간 자정까지
export function hideNotice(id: number, dismiss: NoticeDismiss) {
  if (dismiss === "none") return
  const now = Date.now()
  let until: number
  if (dismiss === "forever") until = Number.MAX_SAFE_INTEGER
  else if (dismiss === "week") until = now + 7 * 24 * 60 * 60 * 1000
  else {
    const kstOffset = 9 * 60 * 60 * 1000
    const kstMidnight = Math.floor((now + kstOffset) / 86400000 + 1) * 86400000
    until = kstMidnight - kstOffset
  }
  try {
    localStorage.setItem(hideKey(id), String(until))
  } catch {}
}

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
const isLoggedIn = () => {
  try {
    return Boolean(localStorage.getItem("dukji_user"))
  } catch {
    return false
  }
}

function matches(n: PublicSiteNotice, onHome: boolean) {
  if (n.pages === "home" && !onHome) return false
  if (n.audience === "member" && !isLoggedIn()) return false
  if (n.audience === "guest" && isLoggedIn()) return false
  if (n.device === "mobile" && !isMobile()) return false
  if (n.device === "desktop" && isMobile()) return false
  return !isHidden(n.id)
}

export interface SiteNoticeSelection {
  status: "loading" | "ready" | "error" // error: 서버에 공지 기능이 아직 없거나 연결 실패
  modal: PublicSiteNotice | null
  bar: PublicSiteNotice | null
}

// 홈 광고 자리(왼쪽·오른쪽·아래)에 지금 걸린 광고 (게시 + 기간 안, 우선순위 순). 기간이 끝나면 서버가 빼 줌
export function useHomeAds(slot: AdPlacement): { status: "loading" | "ready" | "error"; ads: PublicSiteNotice[] } {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; ads: PublicSiteNotice[] }>({ status: "loading", ads: [] })
  useEffect(() => {
    let cancelled = false
    fetchLiveNotices()
      .then((notices) => !cancelled && setState({ status: "ready", ads: notices.filter((n) => n.placement === slot) }))
      .catch(() => !cancelled && setState({ status: "error", ads: [] }))
    return () => {
      cancelled = true
    }
  }, [slot])
  return state
}

// 지금 화면에 띄울 레이어 팝업·띠 배너 하나씩 (서버가 우선순위 순으로 줌)
export function useSiteNotices(onHome: boolean): SiteNoticeSelection {
  const [selection, setSelection] = useState<SiteNoticeSelection>({ status: "loading", modal: null, bar: null })

  useEffect(() => {
    let cancelled = false
    fetchLiveNotices()
      .then((notices) => {
        if (cancelled) return
        const shown = shownThisVisit()
        // 팝업 바로가기(?popup=, 현장 QR 포함)나 팝업 상세 페이지로 들어오면 레이어 팝업 없이 해당 팝업 상세를 보여줌
        const deepLink = new URLSearchParams(window.location.search).has("popup") || window.location.pathname.startsWith("/popups/detail")
        const candidates = notices.filter((n) => matches(n, onHome))
        setSelection({
          status: "ready",
          modal: (!deepLink && candidates.find((n) => n.placement === "modal" && !shown.includes(n.id))) || null,
          bar: candidates.find((n) => n.placement === "bar" && !shown.includes(n.id)) || null,
        })
      })
      .catch(() => {
        if (!cancelled) setSelection({ status: "error", modal: null, bar: null })
      })
    return () => {
      cancelled = true
    }
  }, [onHome])

  return selection
}

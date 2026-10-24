"use client"

import { useEffect, useState } from "react"
import type { PopupEvent } from "@/data/popup-data"
import { apiFetch } from "@/lib/api"

// 팝업 상세 페이지 주소 (정적 배포라 id 는 쿼리로, /popups/detail?id= 도 같은 페이지). 목록·지도·캘린더·검색이 모두 여기로 연결
export const popupDetailHref = (id: string) => `/popups/detail/?id=${encodeURIComponent(id)}`

export function goToPopupDetail(id: string) {
  window.location.href = popupDetailHref(id)
}

export type PopupListState = { events: PopupEvent[]; status: "loading" | "ok" | "error" }

// 팝업 목록: backend(popups 서비스)에서 받아옴. 화면용 예시 팝업은 두지 않고, 못 받으면 status 가 error
export function usePopupList(): PopupListState {
  const [state, setState] = useState<PopupListState>({ events: [], status: "loading" })

  useEffect(() => {
    let cancelled = false
    fetchPopups()
      .then((popups) => {
        if (!cancelled) setState({ events: popups, status: "ok" })
      })
      .catch(() => {
        if (!cancelled) setState({ events: [], status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export function usePopupEvents(): PopupEvent[] {
  return usePopupList().events
}

// 상세 한 건 (없으면 null)
export async function fetchPopup(id: string): Promise<PopupEvent | null> {
  const res = await apiFetch(`/api/popups/${encodeURIComponent(id)}`, { cache: "no-store" })
  if (res.status === 404) return null
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "팝업을 불러오지 못했습니다.")
  return json.popup
}

export async function fetchPopups(options: { includeUnpublished?: boolean } = {}): Promise<PopupEvent[]> {
  const res = await apiFetch(`/api/popups${options.includeUnpublished ? "?all=1" : ""}`, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "팝업 목록을 불러오지 못했습니다.")
  return json.popups
}

// 지난 팝업 (종료 처리됐거나 종료일이 지난 팝업, 최근 종료 순). 팝업 일정·지도 달력에서만 씀
export async function fetchPastPopups(offset = 0, limit = 500): Promise<{ popups: PopupEvent[]; total: number }> {
  const res = await apiFetch(`/api/popups/past?offset=${offset}&limit=${limit}`, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "지난 팝업을 불러오지 못했습니다.")
  return { popups: json.popups, total: json.total }
}

type SaveResult = { success: true; popup: PopupEvent } | { success: false; errors: string[] }

// 관리자: 등록·수정·삭제
export async function createPopup(input: Partial<PopupEvent>): Promise<SaveResult> {
  return savePopup("/api/popups", "POST", input)
}

export async function updatePopup(id: string, input: Partial<PopupEvent>): Promise<SaveResult> {
  return savePopup(`/api/popups/${encodeURIComponent(id)}`, "PATCH", input)
}

export async function deletePopup(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/popups/${encodeURIComponent(id)}`, { method: "DELETE" })
  return res.ok
}

async function savePopup(path: string, method: "POST" | "PATCH", input: Partial<PopupEvent>): Promise<SaveResult> {
  try {
    const res = await apiFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (res.ok && json.success) return { success: true, popup: json.popup }
    return { success: false, errors: json.errors || [json.error || "저장하지 못했습니다."] }
  } catch {
    return { success: false, errors: ["서버에 연결할 수 없습니다."] }
  }
}

// 상세 조회 수 기록: 같은 브라우저 세션에서는 팝업마다 한 번만 보냄
export function recordPopupView(id: string) {
  try {
    const key = "dukji_viewed_popups"
    const seen: string[] = JSON.parse(sessionStorage.getItem(key) || "[]")
    if (seen.includes(id)) return
    sessionStorage.setItem(key, JSON.stringify([...seen, id]))
  } catch {
    // 저장소를 못 쓰면 그냥 보냄
  }
  apiFetch(`/api/popups/${encodeURIComponent(id)}/views`, { method: "POST" }).catch(() => {})
}

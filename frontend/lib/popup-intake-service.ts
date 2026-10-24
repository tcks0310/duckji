import { apiFetch } from "@/lib/api"
import type { PopupEvent } from "@/data/popup-data"

// 자동 수집 후보 · 기간 종료 처리 (backend popups 서비스 /api/popups/admin/...)
// 예전 운영사 팝업 신청은 2026-10-16 삭제 (archive/popup-application/)

export type CandidateCategory = "anime" | "cafe" | "exhibition" | "goods"

export interface CandidateCheck {
  key: string
  label: string
  ok: boolean
  detail: string
}

export interface PopupCandidate {
  id: string
  status: "pending" | "converted" | "dismissed" | "duplicate"
  title: string
  category: CandidateCategory
  startDate: string | null
  endDate: string | null
  location: string
  venueName: string
  admission: string
  summary: string
  officialUrl: string
  sourceName: string
  sourceUrl: string
  corroboratingUrls: string[]
  checks: CandidateCheck[]
  score: number
  duplicateOf: string | null
  popupId: string | null
  collectedAt: string
}

export const CANDIDATE_CATEGORY_LABELS: Record<CandidateCategory, string> = {
  anime: "애니메이션·캐릭터",
  cafe: "콜라보 카페",
  exhibition: "전시·페스티벌",
  goods: "굿즈샵",
}

type Ok<T> = { success: true } & T
type Fail = { success: false; errors: string[] }

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<Ok<T> | Fail> {
  try {
    const { json, ...rest } = init || {}
    const res = await apiFetch(path, {
      cache: "no-store",
      ...rest,
      ...(json !== undefined ? { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } } : {}),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.success) return data
    return { success: false, errors: data.errors || [data.error || "처리하지 못했습니다."] }
  } catch {
    return { success: false, errors: ["서버에 연결할 수 없습니다."] }
  }
}

export const fetchIntakeSummary = () =>
  call<{ summary: { candidatesPending: number; expiredToEnd: number; endingWithin7Days: number; draftsWaiting: number } }>("/api/popups/admin/summary")

export const fetchCandidates = (status?: PopupCandidate["status"]) =>
  call<{ candidates: PopupCandidate[] }>(`/api/popups/admin/candidates${status ? `?status=${status}` : ""}`)

export const changeCandidate = (id: string, body: { status: "pending" | "dismissed" | "duplicate"; duplicateOf?: string }) =>
  call<{ candidate: PopupCandidate }>(`/api/popups/admin/candidates/${encodeURIComponent(id)}`, { method: "PATCH", json: body })

export const convertCandidate = (id: string) =>
  call<{ candidate: PopupCandidate; popup: PopupEvent }>(`/api/popups/admin/candidates/${encodeURIComponent(id)}/convert`, { method: "POST" })

export const fetchBlockedSources = () => call<{ sources: { host: string; reason: string; createdAt: string }[] }>("/api/popups/admin/blocked-sources")

export const blockSource = (host: string, reason: string) =>
  call<{ host: string }>("/api/popups/admin/blocked-sources", { method: "POST", json: { host, reason } })

export const unblockSource = (host: string) => call<{}>(`/api/popups/admin/blocked-sources/${encodeURIComponent(host)}`, { method: "DELETE" })

export const fetchExpired = () => call<{ today: string; toEnd: PopupEvent[]; toArchive: PopupEvent[] }>("/api/popups/admin/expired")

export const endExpired = (ids: string[]) => call<{ ended: string[] }>("/api/popups/admin/end-expired", { method: "POST", json: { ids } })

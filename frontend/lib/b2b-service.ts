import { apiFetch } from "@/lib/api"

// backend b2b 서비스 (입점·광고 신청, 계약·광고 기간, 견적·제작 문의, 덕지몰 품목)

// 신청 종류: listing = 팝업 입점, ad = 광고, both = 둘 다
export type ApplyKind = "listing" | "ad" | "both"
export const APPLY_KIND_LABELS: Record<ApplyKind, string> = { listing: "팝업 입점", ad: "광고", both: "팝업 입점 + 광고" }

// 광고 자리 (신청서에서 고름). 계약은 팝업 입점(listing)도 자리로 고를 수 있음
export type AdSlot = "ad_left" | "ad_right" | "ad_bottom" | "modal" | "bar"
export type ContractSlot = AdSlot | "listing"
export const SLOT_LABELS: Record<ContractSlot, string> = {
  ad_left: "홈 왼쪽 광고",
  ad_right: "홈 오른쪽 광고",
  ad_bottom: "홈 아래 광고",
  modal: "사이트 공지 팝업",
  bar: "화면 아래 띠 배너",
  listing: "팝업 목록 입점",
}
export const AD_SLOTS: AdSlot[] = ["ad_left", "ad_right", "ad_bottom", "modal", "bar"]

export type B2bStatus = "submitted" | "reviewing" | "needs_info" | "approved" | "published" | "rejected" | "ended" | "archived"

export interface B2bApplication {
  id: number
  code: string
  brandName: string
  eventName: string
  eventType: string
  location: string
  schedule: string
  content: string
  linkUrl: string
  imageUrl: string
  keywords: string[]
  plan: "basic" | "standard" | "flagship"
  nativeBooking: boolean
  placementWish: string
  managerName: string
  managerPhone: string
  managerEmail: string
  managerCompany: string
  applyKind: ApplyKind
  eventFrom: string | null
  eventUntil: string | null
  adSlots: AdSlot[]
  adFrom: string | null
  adUntil: string | null
  budget: string
  attachments: string[] // 관리자 화면에서는 1시간짜리 서명 주소
  status: B2bStatus
  statusReason: string
  placement: string
  publishFrom: string | null
  publishUntil: string | null
  adminNote: string
  createdAt: string
  updatedAt: string
}

export interface B2bStatusInfo {
  value: B2bStatus
  label: string
  next: B2bStatus[]
}


type Result<T> = ({ success: true } & T) | { success: false; errors: string[] }

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await apiFetch(path, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    })
    const json = await res.json()
    if (res.ok && json.success) return json
    return { success: false, errors: json.errors || [json.error || "요청을 처리하지 못했습니다."] }
  } catch {
    return { success: false, errors: ["서버에 연결하지 못했습니다."] }
  }
}

// 공개: 입점·광고 신청
export const submitB2bApplication = (input: Record<string, unknown>) =>
  call<{ application: { id: number; code: string } }>("/api/b2b/applications", { method: "POST", body: JSON.stringify(input) })

// 계약·광고 기간 (관리자 B2B 제휴 관리 › 계약·광고 기간)
export type ContractPeriod = "running" | "upcoming" | "ended" | "cancelled"
export const CONTRACT_PERIOD_LABELS: Record<ContractPeriod, string> = { running: "진행 중", upcoming: "예정", ended: "끝남", cancelled: "취소" }

export interface B2bContract {
  id: number
  code: string
  applicationId: number | null
  kind: ApplyKind
  brandName: string
  title: string
  slots: ContractSlot[]
  startsOn: string
  endsOn: string
  amount: number | null
  managerName: string
  managerPhone: string
  managerEmail: string
  memo: string
  status: "active" | "cancelled"
  period: ContractPeriod
  createdAt: string
  updatedAt: string
}

export type B2bContractInput = Omit<B2bContract, "id" | "code" | "period" | "createdAt" | "updatedAt">

export const fetchContracts = (q: { period?: string; month?: string; application?: number } = {}) => {
  const params = new URLSearchParams()
  if (q.period) params.set("period", q.period)
  if (q.month) params.set("month", q.month)
  if (q.application) params.set("application", String(q.application))
  const qs = params.toString()
  return call<{ contracts: B2bContract[] }>(`/api/b2b/admin/contracts${qs ? `?${qs}` : ""}`)
}
export const createContract = (input: B2bContractInput) =>
  call<{ contract: B2bContract }>("/api/b2b/admin/contracts", { method: "POST", body: JSON.stringify(input) })
export const updateContract = (id: number, patch: Partial<B2bContractInput>) =>
  call<{ contract: B2bContract }>(`/api/b2b/admin/contracts/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
export const deleteContract = (id: number) => call<{}>(`/api/b2b/admin/contracts/${id}`, { method: "DELETE" })

// 관리자
export const fetchB2bStatuses = () => call<{ statuses: B2bStatusInfo[] }>("/api/b2b/admin/statuses")

export const fetchB2bApplications = (status = "") =>
  call<{ total: number; applications: B2bApplication[] }>(`/api/b2b/admin/applications?limit=200${status ? `&status=${status}` : ""}`)

export const updateB2bApplication = (id: number, patch: Record<string, unknown>) =>
  call<{ application: B2bApplication }>(`/api/b2b/admin/applications/${id}`, { method: "PATCH", body: JSON.stringify(patch) })


// 자동 수집 후보 · 수집 제외 사이트 · 관리자 처리 이력
// 예전 운영사 팝업 신청(popup_applications)·메일 대기는 2026-10-16 삭제 (코드는 archive/popup-application/)

// 후보 분야 (팝업 category 중 flagship 은 덕지 자체 기획이라 제외)
export const CANDIDATE_CATEGORIES = ["anime", "cafe", "exhibition", "goods"] as const
export type CandidateCategory = (typeof CANDIDATE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<CandidateCategory, string> = {
  anime: "애니 팝업",
  cafe: "콜라보 카페",
  exhibition: "전시회/체험전",
  goods: "상설 굿즈샵",
}

export const RESERVATION_LABELS = {
  free: "자유 입장",
  naver: "네이버 예약",
  onsite: "현장 대기",
  ticket: "티켓 구매",
} as const

export const CANDIDATE_STATUSES = ["pending", "converted", "dismissed", "duplicate"] as const
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export interface CandidateCheck {
  key: string // source_reachable | title_on_page | official_source | corroborated | dates_valid | location_found | not_duplicate
  label: string
  ok: boolean
  detail: string
}

// 수집기가 보내는 값
export interface CandidateInput {
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
}

export interface PopupCandidate extends CandidateInput {
  id: string
  status: CandidateStatus
  score: number
  duplicateOf: string | null
  popupId: string | null
  collectedAt: string
  updatedAt: string
}

export interface AdminAction {
  targetType: "candidate" | "popup"
  targetId: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  reason: string
  adminId: string
}

export interface BlockedSource {
  host: string
  reason: string
  createdAt: string
}

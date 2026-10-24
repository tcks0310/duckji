// 방문 통계 기록 종류
// - pageview : 페이지를 열거나 사이트 안에서 다른 페이지로 이동
// - search   : 사이트 안 검색창에서 검색
// - signup   : 회원가입 완료
export const EVENT_KINDS = ["pageview", "search", "signup"] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const DEVICES = ["mobile", "tablet", "desktop"] as const
export type Device = (typeof DEVICES)[number]

export interface EventInput {
  kind: EventKind
  visitorId: string
  sessionId: string
  path: string
  referrerHost: string | null
  utmSource: string | null
  searchQuery: string | null
  country: string | null
  device: Device | null
  lang: string | null
}

// 관리자 조회 기간 (한국 시간 기준 오늘부터 거슬러 며칠)
export const PERIOD_DAYS = [1, 7, 30, 90] as const

// 지도 클릭 집계 (인기 팝업·인기 검색어 순위용)
// - marker : 지도에서 팝업 마커를 누름
// - map    : 팝업 하나가 표시된 지도를 누름 (상세 화면 지도 등)
// - search : 지도 검색어 (검색 화면이 생기면 사용)
export const CLICK_KINDS = ["marker", "map", "search"] as const
export type ClickKind = (typeof CLICK_KINDS)[number]

export const RANKING_PERIODS = ["day", "week", "month"] as const
export type RankingPeriod = (typeof RANKING_PERIODS)[number]

export interface ClickInput {
  kind: ClickKind
  target: string // marker·map: 팝업 id, search: 검색어(소문자·공백 정리)
}

export interface RankingItem {
  rank: number
  target: string // 팝업 id 또는 검색어. 팝업 제목은 popups API 결과와 id 로 맞춰 씁니다
  clicks: number
  visitors: number
}

import { apiFetch } from "@/lib/api"

// 지도 클릭 집계 (backend map-stats 서비스). 실패해도 화면 동작에는 영향을 주지 않습니다.
export type MapClickKind = "marker" | "map"

export function trackMapClick(kind: MapClickKind, popupId: string) {
  sendClick({ kind, popupId })
}

// 지도 검색 화면이 생기면 검색할 때 호출
export function trackMapSearch(keyword: string) {
  const trimmed = keyword.trim()
  if (trimmed) sendClick({ kind: "search", keyword: trimmed })
}

function sendClick(body: Record<string, string>) {
  apiFetch("/api/map-stats/clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}

export interface MapRankingItem {
  rank: number
  target: string // type=popup: 팝업 id (usePopupEvents 결과와 id 로 맞춤), type=keyword: 검색어
  clicks: number
  visitors: number
}

// 인기 순위 (기본: 최근 7일 인기 팝업 1·2·3위)
export async function fetchMapRanking(
  options: { type?: "popup" | "keyword"; period?: "day" | "week" | "month"; limit?: number } = {}
): Promise<MapRankingItem[]> {
  const params = new URLSearchParams({
    type: options.type || "popup",
    period: options.period || "week",
    limit: String(options.limit || 3),
  })
  const res = await apiFetch(`/api/map-stats/ranking?${params}`)
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "순위를 불러오지 못했습니다.")
  return json.items
}

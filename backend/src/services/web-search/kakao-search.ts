import { stripTags, type WebSearchItem } from "./naver"

// 카카오(다음) 검색 API (REST API 키, 장소 검색·도보 경로와 같은 키). 하루 호출 넉넉히 무료
// 네이버 개발자센터 검색 API 는 2026-07-31 부터 신규 신청이 막혀 홈 통합 검색의 웹 결과는 이쪽을 씀
export type KakaoSearchKind = "web" | "blog" | "cafe"

function hostOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export async function kakaoSearch(restKey: string, kind: KakaoSearchKind, query: string, size: number): Promise<WebSearchItem[]> {
  const params = new URLSearchParams({ query, size: String(size), sort: "accuracy" })
  const res = await fetch(`https://dapi.kakao.com/v2/search/${kind}?${params}`, {
    headers: { Authorization: `KakaoAK ${restKey}` },
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`kakao search ${kind} ${res.status}`)
  const json = (await res.json()) as { documents?: Record<string, string>[] }
  return (json.documents || []).map((d) => {
    const link = d.url || ""
    const date = /^\d{4}-\d{2}-\d{2}/.test(d.datetime || "") && kind !== "web" ? d.datetime.slice(0, 10) : null
    return {
      title: stripTags(d.title || ""),
      link,
      description: stripTags(d.contents || ""),
      source: stripTags(d.blogname || d.cafename || "") || hostOf(link),
      date,
    }
  })
}

// 네이버 검색 API
// - NAVER API HUB(네이버 클라우드, naverapihub.apigw.ntruss.com/search/v1/{kind}): 2026-07-31 부터 새로 신청하는 곳
// - 예전 개발자센터(openapi.naver.com/v1/search/{kind}.json): 신규 신청 막힘, 기존 키는 2027-06-30 까지
// HUB 키(hub=true)가 있으면 HUB 로 부름. 요청·응답 모양은 같고 주소와 인증 헤더만 다름
// 약관상 결과 저장·캐싱, AI 입력, 결과 화면 광고가 금지라 web-search 는 네이버 결과를 캐시하지 않음
export type WebSearchKind = "webkr" | "blog" | "news" | "cafearticle"

export interface WebSearchItem {
  title: string
  link: string
  description: string
  source: string // 블로그 이름, 언론사 등 (없으면 도메인)
  date: string | null // YYYY-MM-DD (블로그·뉴스만)
}

const LEGACY = "https://openapi.naver.com/v1/search"
const HUB = "https://naverapihub.apigw.ntruss.com/search/v1"

export type NaverCredentials = { clientId: string; clientSecret: string; hub?: boolean }

function naverRequest(c: NaverCredentials, kind: string, params: URLSearchParams) {
  const url = c.hub ? `${HUB}/${kind}?${params}` : `${LEGACY}/${kind}.json?${params}`
  const headers: Record<string, string> = c.hub
    ? { "X-NCP-APIGW-API-KEY-ID": c.clientId, "X-NCP-APIGW-API-KEY": c.clientSecret }
    : { "X-Naver-Client-Id": c.clientId, "X-Naver-Client-Secret": c.clientSecret }
  return fetch(url, { headers, signal: AbortSignal.timeout(4000) })
}

// 네이버 결과의 <b> 강조 태그와 HTML 엔티티를 걷어 냄 (화면에서는 글자로만 보여 줌)
export function stripTags(text: string) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim()
}

function hostOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function toDate(item: Record<string, string>): string | null {
  if (item.postdate && /^\d{8}$/.test(item.postdate)) {
    return `${item.postdate.slice(0, 4)}-${item.postdate.slice(4, 6)}-${item.postdate.slice(6, 8)}`
  }
  if (item.pubDate) {
    const d = new Date(item.pubDate)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

export async function naverSearch(
  credentials: NaverCredentials,
  kind: WebSearchKind,
  query: string,
  display: number
): Promise<WebSearchItem[]> {
  const params = new URLSearchParams({ query, display: String(display), start: "1" })
  if (kind === "news") params.set("sort", "sim")
  let res = await naverRequest(credentials, kind, params)
  // HUB 웹문서 경로가 webkr 가 아니라 web 인 경우 대비
  if (credentials.hub && kind === "webkr" && res.status === 404) res = await naverRequest(credentials, "web", params)
  if (!res.ok) throw new Error(`naver ${kind} ${res.status}`)
  const json = (await res.json()) as { items?: Record<string, string>[] }
  return (json.items || []).map((item) => {
    const link = item.originallink || item.link || ""
    return {
      title: stripTags(item.title || ""),
      link,
      description: stripTags(item.description || ""),
      source: stripTags(item.bloggername || item.cafename || "") || hostOf(link),
      date: toDate(item),
    }
  })
}

// 네이버 지역(장소) 검색: 관리자 화면에서 장소 이름·주소로 찾아 좌표까지 채움 (한 번에 5곳까지)
// mapx·mapy 는 WGS84 경도·위도 × 10,000,000
export interface PlaceItem {
  name: string
  category: string
  address: string // 도로명 주소 (없으면 지번)
  jibunAddress: string
  lat: number
  lng: number
}

export async function naverPlaces(credentials: NaverCredentials, query: string): Promise<PlaceItem[]> {
  const params = new URLSearchParams({ query, display: "5", start: "1", sort: "random" })
  const res = await naverRequest(credentials, "local", params)
  if (!res.ok) throw new Error(`naver local ${res.status}`)
  const json = (await res.json()) as { items?: Record<string, string>[] }
  return (json.items || [])
    .map((item) => ({
      name: stripTags(item.title || ""),
      category: stripTags(item.category || ""),
      address: item.roadAddress || item.address || "",
      jibunAddress: item.address || "",
      lat: Number(item.mapy) / 1e7,
      lng: Number(item.mapx) / 1e7,
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > 30 && p.lat < 45 && p.lng > 120 && p.lng < 135)
}

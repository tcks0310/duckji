import { Hono } from "hono"
import { config } from "../../shared/config"
import { requireAdmin } from "../../shared/auth/require-admin"
import { kakaoWalkLeg, type LatLng, type WalkLeg } from "./kakao-walk"
import { kakaoPlaces } from "./kakao-places"
import { kakaoSearch, type KakaoSearchKind } from "./kakao-search"
import { naverPlaces, naverSearch, type NaverCredentials, type WebSearchItem, type WebSearchKind } from "./naver"

// GET /api/web-search?q=검색어
// → { success, configured, sections: [{ provider: "kakao" | "naver", groups: [{ label, items }] }] }
// 홈 통합 검색 아래에 카카오(다음)·네이버 결과를 함께 보여 줌. 되는 쪽만 sections 에 들어가고, 둘 다 안 되면 configured=false
// 카카오 결과만 10분 캐시 (네이버는 약관상 결과 캐싱 금지라 매번 부름)
export const webSearchRoute = new Hono()

const KINDS: { key: "web" | "blog" | "news"; kind: WebSearchKind; display: number }[] = [
  { key: "web", kind: "webkr", display: 5 },
  { key: "blog", kind: "blog", display: 5 },
  { key: "news", kind: "news", display: 5 },
]

// 같은 검색어는 10분 동안 다시 부르지 않음 (Lambda 인스턴스 안 메모리, 하루 호출 한도 아끼기)
const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; body: unknown }>()

// HUB 키가 있으면 HUB, 없으면 예전 개발자센터 키
function naverCredentials(): NaverCredentials | null {
  if (config.naverHubClientId && config.naverHubClientSecret) return { clientId: config.naverHubClientId, clientSecret: config.naverHubClientSecret, hub: true }
  if (config.naverSearchClientId && config.naverSearchClientSecret) return { clientId: config.naverSearchClientId, clientSecret: config.naverSearchClientSecret }
  return null
}

// GET /api/web-search/places?q=장소 이름 또는 주소
// → { success, configured, places: [{ name, category, address, jibunAddress, lat, lng }] } (관리자 팝업·덕지순례 장소 등록)
// 카카오 로컬 검색(이름·주소)을 먼저 쓰고, 안 되거나 비면 네이버 지역 검색으로 다시 찾음
webSearchRoute.get("/places", async (c) => {
  const q = (c.req.query("q") || "").trim().slice(0, 100)
  if (!q) return c.json({ success: false, error: "검색어(q)가 필요합니다." }, 400)
  const kakaoKey = config.kakaoRestApiKey
  const naver = naverCredentials()
  if (!kakaoKey && !naver) return c.json({ success: true, configured: false, places: [] })

  const key = `places:${q.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return c.json(hit.body)

  let configured = false
  let fromKakao = false
  let places: Awaited<ReturnType<typeof kakaoPlaces>> = []
  if (kakaoKey) {
    try {
      places = await kakaoPlaces(kakaoKey, q)
      configured = true
      fromKakao = places.length > 0
    } catch (e) {
      console.error("web-search: kakao places failed", e)
    }
  }
  if (!places.length && naver) {
    try {
      places = await naverPlaces(naver, q)
      configured = true
    } catch (e) {
      console.error("web-search: naver places failed", e)
    }
  }
  const body = { success: true, configured, places }
  // 네이버 결과는 약관상 캐시하지 않음
  if (fromKakao) {
    if (cache.size > 500) cache.clear()
    cache.set(key, { at: Date.now(), body })
  }
  return c.json(body)
})

// POST /api/web-search/walk-route { points: [{ lat, lng }] } (관리자, 덕지순례 코스 저장 때)
// → { success, configured, legs: [{ from, to, path: [[lat, lng]...], distanceM, durationS } | null], error? }
// 장소 i → i+1 구간마다 카카오 도보 경로를 부르고, 같은 구간은 하루 동안 다시 부르지 않음
const walkCache = new Map<string, { at: number; leg: WalkLeg }>()
const WALK_CACHE_MS = 24 * 60 * 60 * 1000
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

webSearchRoute.post("/walk-route", requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { points?: { lat?: unknown; lng?: unknown }[] }
  const points: LatLng[] = (Array.isArray(body.points) ? body.points : [])
    .slice(0, 12)
    .map((p) => [round6(Number(p?.lat)), round6(Number(p?.lng))] as LatLng)
  if (points.length < 2 || points.some(([la, ln]) => !Number.isFinite(la) || !Number.isFinite(ln))) {
    return c.json({ success: false, error: "장소 좌표가 두 곳 이상 필요합니다." }, 400)
  }
  const key = config.kakaoRestApiKey
  if (!key) return c.json({ success: true, configured: false, legs: [] })

  let error = ""
  const legs = []
  for (let i = 0; i + 1 < points.length; i++) {
    const from = points[i]
    const to = points[i + 1]
    const cacheKey = `${from.join(",")}>${to.join(",")}`
    const hit = walkCache.get(cacheKey)
    if (hit && Date.now() - hit.at < WALK_CACHE_MS) {
      legs.push({ from, to, ...hit.leg })
      continue
    }
    try {
      const leg = await kakaoWalkLeg(key, from, to)
      if (walkCache.size > 500) walkCache.clear()
      walkCache.set(cacheKey, { at: Date.now(), leg })
      legs.push({ from, to, ...leg })
    } catch (e) {
      console.error("web-search: kakao walk failed", e)
      error = e instanceof Error ? e.message : String(e)
      legs.push(null)
    }
  }
  return c.json({ success: true, configured: true, legs, ...(error ? { error } : {}) })
})

const KAKAO_KINDS: { key: KakaoSearchKind; label: string; size: number }[] = [
  { key: "web", label: "웹문서", size: 5 },
  { key: "blog", label: "블로그", size: 5 },
  { key: "cafe", label: "카페", size: 5 },
]
const NAVER_LABELS: Record<string, string> = { web: "웹문서", blog: "블로그", news: "뉴스" }
type Section = { provider: "kakao" | "naver"; groups: { label: string; items: WebSearchItem[] }[] }

async function kakaoSection(key: string, q: string): Promise<Section | null> {
  const ck = `kakao:${q.toLowerCase()}`
  const hit = cache.get(ck)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body as Section
  const results = await Promise.allSettled(KAKAO_KINDS.map((k) => kakaoSearch(key, k.key, q, k.size)))
  if (results.every((r) => r.status === "rejected")) {
    console.error("web-search: kakao failed", (results[0] as PromiseRejectedResult).reason)
    return null
  }
  const section: Section = {
    provider: "kakao",
    groups: KAKAO_KINDS.map((k, i) => {
      const r = results[i]
      return { label: k.label, items: r.status === "fulfilled" ? r.value : [] }
    }),
  }
  if (cache.size > 500) cache.clear()
  cache.set(ck, { at: Date.now(), body: section })
  return section
}

async function naverSection(cred: NaverCredentials, q: string): Promise<Section | null> {
  const results = await Promise.allSettled(KINDS.map((k) => naverSearch(cred, k.kind, q, k.display)))
  // 셋 다 실패하면 (검색 API 미신청·키 오류) 네이버 칸은 뺌
  if (results.every((r) => r.status === "rejected")) {
    console.error("web-search: naver failed", (results[0] as PromiseRejectedResult).reason)
    return null
  }
  return {
    provider: "naver",
    groups: KINDS.map((k, i) => {
      const r = results[i]
      return { label: NAVER_LABELS[k.key], items: r.status === "fulfilled" ? r.value : [] }
    }),
  }
}

webSearchRoute.get("/", async (c) => {
  const q = (c.req.query("q") || "").trim().slice(0, 100)
  if (!q) return c.json({ success: false, error: "검색어(q)가 필요합니다." }, 400)
  const kakaoKey = config.kakaoRestApiKey
  const naver = naverCredentials()
  const [kakao, nv] = await Promise.all([
    kakaoKey ? kakaoSection(kakaoKey, q).catch(() => null) : null,
    naver ? naverSection(naver, q).catch(() => null) : null,
  ])
  const sections = [kakao, nv].filter((x): x is Section => Boolean(x))
  return c.json({ success: true, configured: sections.length > 0, sections })
})

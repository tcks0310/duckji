"use client"

// 통합 검색 공통 처리 (홈 큰 검색창 · 검색 결과 페이지(/search) · 상단 검색창이 같이 씀)
// - 검색 실행 기록: recordSearch 한 곳에서만 보냄 (검색어 순위·방문 통계는 여기에 붙이면 됨)
// - 사이트 안 검색: rankBySearch 로 정확도 점수를 매겨 먼저 보여 줌
// - 외부 검색: fetchWebSearch(카카오(다음)·네이버 검색 API, 서버 web-search 서비스) + 네이버·구글 바로가기
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { trackSearch } from "@/lib/analytics"
import { fetchMapRanking, trackMapSearch, type MapRankingItem } from "@/lib/map-stats"
import type { PartyEvent } from "@/lib/party-api"
import type { FundingProject } from "@/types/funding"
import type { PopupEvent } from "@/data/popup-data"

export type SearchSource = "home-bar" | "header" | "search-page" | "popular-keyword"

// 검색 결과 페이지 주소 (홈 검색창 · 상단 검색창 · 인기 검색어 모두 여기로 이동)
export const searchPageHref = (q: string) => (q.trim() ? `/search/?q=${encodeURIComponent(q.trim())}` : "/search/")
export function goToSearch(q: string) {
  window.location.href = searchPageHref(q)
}

// ---------- 검색 실행 기록 ----------
export function recordSearch(query: string, source: SearchSource) {
  const q = query.trim()
  if (!q) return
  void source // 어디서 검색했는지 (방문 통계에서 나눠 보려면 여기서 함께 보냄)
  trackMapSearch(q) // 인기 검색어 순위 (map-stats)
  trackSearch(q) // 관리자 방문 통계의 사이트 안 검색어 (analytics)
  popularCache = null
}

// ---------- 인기 검색어 (map-stats 검색어 집계: 오늘, 없으면 최근 7일) ----------
let popularCache: { at: number; items: MapRankingItem[] } | null = null
export async function loadPopularKeywords(limit = 10): Promise<MapRankingItem[]> {
  if (popularCache && Date.now() - popularCache.at < 60_000) return popularCache.items.slice(0, limit)
  let items = await fetchMapRanking({ type: "keyword", period: "day", limit: 10 })
  if (items.length === 0) items = await fetchMapRanking({ type: "keyword", period: "week", limit: 10 })
  popularCache = { at: Date.now(), items }
  return items.slice(0, limit)
}

export function usePopularKeywords(enabled = true) {
  const [items, setItems] = useState<MapRankingItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled || items) return
    loadPopularKeywords()
      .then(setItems)
      .catch(() => {
        setFailed(true)
        setItems([])
      })
  }, [enabled, items])
  return { items, failed, reload: () => setItems(null) }
}

// ---------- 정확도 점수 ----------
// 제목이 검색어와 같으면 가장 높고, 제목 시작 > 제목 포함 > 다른 칸 포함 순.
// 띄어쓰기를 무시하고도 비교하고(나혼자만레벨업 = 나 혼자만 레벨업), 여러 단어면 모든 단어가 어딘가에 있어야 함.
export interface SearchField {
  text: string | null | undefined
  weight: number // 제목 3, 부제·작품명 2, 장소·설명 1 정도
}

const norm = (s: string) => s.toLowerCase().trim()
const compact = (s: string) => norm(s).replace(/\s+/g, "")

export function searchScore(query: string, fields: SearchField[]): number {
  const q = norm(query)
  if (!q) return 0
  const qc = compact(q)
  const tokens = q.split(/\s+/).filter(Boolean)
  const texts = fields.map((f) => ({ t: norm(f.text || ""), c: compact(f.text || ""), w: f.weight }))

  // 모든 단어가 어느 칸엔가 있어야 결과로 침
  const allTokens = tokens.every((tok) => texts.some((x) => x.t.includes(tok) || x.c.includes(tok)))
  if (!allTokens && !texts.some((x) => x.c.includes(qc))) return 0

  let score = 0
  for (const x of texts) {
    if (!x.t) continue
    if (x.t === q || x.c === qc) score += 100 * x.w
    else if (x.t.startsWith(q) || x.c.startsWith(qc)) score += 60 * x.w
    else if (x.t.includes(q) || x.c.includes(qc)) score += 40 * x.w
    else score += tokens.filter((tok) => x.t.includes(tok)).length * 10 * x.w
  }
  return score
}

export function rankBySearch<T>(items: T[], query: string, fields: (item: T) => SearchField[], tieBreak?: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, score: searchScore(query, fields(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (tieBreak ? tieBreak(b.item) - tieBreak(a.item) : 0) || a.index - b.index)
    .map((x) => x.item)
}

// ---------- 사이트 안 검색 (서버 DB) ----------
// 서비스마다 ?q= 로 DB 에서 찾아 정확도 순으로 돌려줌 (팝업·펀딩·게시글은 서버가 순위를 매김, 게시글은 제목·해시태그·내용)
// 파티·갤러리는 서버가 포함 여부만 걸러 주므로 여기서 같은 기준으로 순위를 매김
export interface BoardSearchPost {
  id: number
  galleryId: number
  galleryName: string
  gallerySlug: string
  authorName: string
  head: string
  title: string
  excerpt: string
  commentCount: number
  voteCount: number // 덕업 수
  hashtags: string[]
  coverUrl: string | null
  createdAt: string
}

export interface GallerySearchItem {
  id: number
  slug: string
  name: string
  category?: string
  description?: string
  aliases?: string[]
}

export interface SiteSearchResult {
  query: string
  popups: PopupEvent[]
  fundings: FundingProject[]
  parties: PartyEvent[]
  galleries: GallerySearchItem[]
  posts: BoardSearchPost[]
  failed: string[] // 불러오지 못한 분야 (서버 오류·미배포)
}

async function getJson<T>(path: string, pick: (json: any) => T): Promise<T> {
  const res = await apiFetch(path, { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`)
  return pick(json)
}

export async function searchSite(query: string, limit = 20): Promise<SiteSearchResult> {
  const q = query.trim()
  const enc = encodeURIComponent(q)
  const [popups, fundings, parties, galleries, posts] = await Promise.allSettled([
    getJson(`/api/popups?q=${enc}&limit=${limit}`, (j) => j.popups as PopupEvent[]),
    getJson(`/api/funding/projects?q=${enc}&limit=${limit}`, (j) => j.projects as FundingProject[]),
    getJson(`/api/party/events?q=${enc}`, (j) => j.events as PartyEvent[]),
    getJson(`/api/galleries?q=${enc}`, (j) => j.galleries as GallerySearchItem[]),
    getJson(`/api/galleries/posts?q=${enc}&limit=${limit}`, (j) =>
      (j.posts as any[]).map(
        (p): BoardSearchPost => ({
          ...p,
          voteCount: p.upCount ?? 0,
          hashtags: p.hashtags || [],
          coverUrl: p.cover?.type === "image" ? p.cover.url : null,
        })
      )
    ),
  ])
  const failed: string[] = []
  const value = <T,>(r: PromiseSettledResult<T[]>, name: string): T[] => {
    if (r.status === "fulfilled") return r.value || []
    failed.push(name)
    return []
  }
  return {
    query: q,
    popups: value(popups, "popups"),
    fundings: value(fundings, "funding"),
    parties: rankBySearch(value(parties, "party"), q, (e) => [
      { text: e.title, weight: 3 },
      { text: e.workTitle, weight: 2 },
      { text: e.characterName, weight: 2 },
      { text: e.description, weight: 0.5 },
    ]).slice(0, limit),
    galleries: rankBySearch(value(galleries, "gallery"), q, (g) => [
      { text: g.name, weight: 3 },
      { text: (g.aliases || []).join(" "), weight: 2 },
    ]).slice(0, limit),
    posts: value(posts, "board"),
    failed,
  }
}

// 입력이 멈추고 delay 뒤에 서버 검색 (같은 검색어는 다시 부르지 않음)
const searchCache = new Map<string, SiteSearchResult>()
export function useSiteSearch(query: string, { enabled = true, delay = 300, limit = 20 } = {}) {
  const [result, setResult] = useState<SiteSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!enabled || !q) {
      setLoading(false)
      return
    }
    const key = `${limit}|${q.toLowerCase()}`
    const cached = searchCache.get(key)
    if (cached) {
      setResult(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchSite(q, limit).then((r) => {
        if (r.failed.length < 5) {
          if (searchCache.size > 100) searchCache.clear()
          searchCache.set(key, r)
        }
        if (cancelled) return
        setResult(r)
        setLoading(false)
      })
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, enabled, delay, limit])
  const current = result && result.query === query.trim() ? result : null
  return { result: current, loading: loading || (!!query.trim() && !current) }
}

// ---------- 외부 검색 ----------
export interface WebSearchItem {
  title: string
  link: string
  description: string
  source: string
  date: string | null
}

export interface WebSearchSection {
  provider: "kakao" | "naver"
  groups: { label: string; items: WebSearchItem[] }[]
}

export interface WebSearchResult {
  configured: boolean // false 면 외부 검색 API 가 하나도 연결 안 됨 → 바로가기만
  sections: WebSearchSection[] // 카카오(다음)·네이버 중 되는 쪽
}

const EMPTY_WEB: WebSearchResult = { configured: false, sections: [] }

export async function fetchWebSearch(query: string): Promise<WebSearchResult> {
  const q = query.trim()
  if (!q) return EMPTY_WEB
  try {
    const res = await apiFetch(`/api/web-search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return EMPTY_WEB
    const json = await res.json()
    return { configured: Boolean(json.configured), sections: Array.isArray(json.sections) ? json.sections : [] }
  } catch {
    return EMPTY_WEB
  }
}

export const daumSearchUrl = (q: string) => `https://search.daum.net/search?q=${encodeURIComponent(q.trim())}`
export const naverSearchUrl = (q: string) => `https://search.naver.com/search.naver?query=${encodeURIComponent(q.trim())}`
export const googleSearchUrl = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`

// 키워드 정리·매칭 (DB 와 무관한 순수 함수)

const MAX_KEYWORDS = 10
const MAX_LENGTH = 30

// "#나루토, 주술회전" 같은 문자열이나 배열을 받아 소문자·중복 제거된 목록으로
export function normalizeKeywords(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n]/) : []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== "string") continue
    const k = v.replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase()
    if (!k || k.length > MAX_LENGTH || out.includes(k)) continue
    out.push(k)
    if (out.length >= MAX_KEYWORDS) break
  }
  return out
}

export interface MatchableItem {
  keywords: string[]
  eventName: string
  brandName: string
  content: string
}

// 구독 키워드가 없으면 모든 소식, 있으면 소식 키워드와 겹치거나 제목·브랜드·본문에 들어 있을 때
export function matchesKeywords(subscriberKeywords: string[], item: MatchableItem): boolean {
  if (!subscriberKeywords.length) return true
  const haystack = `${item.eventName}\n${item.brandName}\n${item.content}`.toLowerCase()
  return subscriberKeywords.some((k) => item.keywords.includes(k) || haystack.includes(k))
}

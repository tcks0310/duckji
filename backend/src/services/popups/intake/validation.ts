import { CANDIDATE_CATEGORIES, type CandidateCheck, type CandidateInput } from "./types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const strList = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, max) : []

export const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

// 오늘 날짜 (KST, YYYY-MM-DD)
export const todayKst = (now = new Date()) => new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

// 수집기가 보낸 후보 검증 (형식만, 진위 검증 결과는 checks 로 함께 옴)
export function validateCandidateInput(body: Record<string, unknown>): Result<CandidateInput> {
  const errors: string[] = []
  const date = (v: unknown) => {
    const s = str(v, 10)
    return DATE_RE.test(s) ? s : null
  }
  const category = str(body.category, 20)
  const checks: CandidateCheck[] = Array.isArray(body.checks)
    ? body.checks
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .slice(0, 20)
        .map((c) => ({ key: str(c.key, 40), label: str(c.label, 100), ok: c.ok === true, detail: str(c.detail, 500) }))
    : []

  const value: CandidateInput = {
    title: str(body.title, 200),
    category: (CANDIDATE_CATEGORIES as readonly string[]).includes(category) ? (category as CandidateInput["category"]) : "anime",
    startDate: date(body.startDate),
    endDate: date(body.endDate),
    location: str(body.location, 500),
    venueName: str(body.venueName, 200),
    admission: str(body.admission, 200),
    summary: str(body.summary, 3000),
    officialUrl: isHttpUrl(str(body.officialUrl, 1000)) ? str(body.officialUrl, 1000) : "",
    sourceName: str(body.sourceName, 200),
    sourceUrl: str(body.sourceUrl, 1000),
    corroboratingUrls: strList(body.corroboratingUrls, 10).filter(isHttpUrl),
    checks,
  }
  if (!value.title) errors.push("title 이 필요합니다.")
  if (!isHttpUrl(value.sourceUrl)) errors.push("sourceUrl 이 올바르지 않습니다.")
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

// 종합 점수: 통과한 검증 비율 (0~100)
export const scoreChecks = (checks: CandidateCheck[]) =>
  checks.length ? Math.round((checks.filter((c) => c.ok).length / checks.length) * 100) : 0

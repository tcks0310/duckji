import { CLICK_KINDS, RANKING_PERIODS, type ClickInput, type ClickKind, type RankingPeriod } from "./types"

const POPUP_ID_RE = /^[a-z0-9][a-z0-9-]{1,99}$/

export type ClickValidation = { ok: true; value: ClickInput } | { ok: false; error: string }

export function validateClick(body: Record<string, unknown>): ClickValidation {
  const kind = body.kind as ClickKind
  if (!CLICK_KINDS.includes(kind)) return { ok: false, error: `kind 는 ${CLICK_KINDS.join(", ")} 중 하나여야 합니다.` }

  if (kind === "search") {
    const keyword = typeof body.keyword === "string" ? body.keyword.trim().replace(/\s+/g, " ").toLowerCase() : ""
    if (keyword.length < 1 || keyword.length > 50) return { ok: false, error: "keyword 는 1~50자여야 합니다." }
    return { ok: true, value: { kind, target: keyword } }
  }

  const popupId = typeof body.popupId === "string" ? body.popupId.trim() : ""
  if (!POPUP_ID_RE.test(popupId)) return { ok: false, error: "popupId 가 올바르지 않습니다." }
  return { ok: true, value: { kind, target: popupId } }
}

// 순위 조회 옵션: ?type=popup|keyword  ?period=day|week|month  ?limit=3 (최대 20)
export function parseRankingQuery(query: { type?: string; period?: string; limit?: string }) {
  const type = query.type === "keyword" ? "keyword" : "popup"
  const period = (RANKING_PERIODS.includes(query.period as RankingPeriod) ? query.period : "week") as RankingPeriod
  const limit = Math.min(Math.max(Math.trunc(Number(query.limit)) || 3, 1), 20)
  return { type, period, limit } as const
}

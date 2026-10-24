import { db } from "../../shared/db/require-database"
import { ADMIN_AUTHOR, KST_TODAY, iso, type Q } from "./util"

// 덕력: 덕지 갤러리 활동 점수 (덕지 포인트 DP 와 별개, 현금성 없음). 쌓인 덕력으로 레벨이 오름
//  - 글: 하루 첫 글 하나에 30 (지웠다 다시 써도 그날은 다시 받지 않음)
//  - 댓글: 하루 5개까지 개당 10
//  - 덕업 받으면 +1, 덕다운 받으면 -1 (취소·변경하면 되돌림)
//  - 글·댓글이 지워지거나 숨겨지면 그 글·댓글로 받은 덕력을 되돌림
export const DUCKRYEOK_RULES = {
  post: { amount: 30, dailyLimit: 1, label: "글 작성" },
  comment: { amount: 10, dailyLimit: 5, label: "댓글 작성" },
  up: { amount: 1, label: "덕업 받음" },
  down: { amount: -1, label: "덕다운 받음" },
} as const

// 레벨 (누적 덕력 기준, 초반은 빠르게·후반은 느리게)
export const LEVELS = [
  { level: 1, min: 0, title: "새싹 덕후" },
  { level: 2, min: 60, title: "입덕" },
  { level: 3, min: 150, title: "덕질 입문" },
  { level: 4, min: 300, title: "덕후" },
  { level: 5, min: 500, title: "열혈 덕후" },
  { level: 6, min: 800, title: "찐덕" },
  { level: 7, min: 1200, title: "고인물" },
  { level: 8, min: 1800, title: "성덕" },
  { level: 9, min: 2600, title: "덕지 명예회원" },
  { level: 10, min: 3600, title: "덕지 레전드" },
]

export function levelOf(duckryeok: number) {
  const cur = [...LEVELS].reverse().find((l) => duckryeok >= l.min) ?? LEVELS[0]
  const next = LEVELS.find((l) => l.min > duckryeok) ?? null
  return {
    level: cur.level,
    title: cur.title,
    min: cur.min, // 이번 레벨이 시작하는 덕력
    duckryeok,
    next: next ? { level: next.level, min: next.min, remaining: next.min - duckryeok } : null,
  }
}

export type LevelInfo = ReturnType<typeof levelOf>

const LABELS: Record<string, string> = {
  post: "글 작성",
  comment: "댓글 작성",
  reaction: "덕업·덕다운",
  post_removed: "글 삭제·숨김",
  comment_removed: "댓글 삭제·숨김",
  admin: "운영팀 조정",
}

async function add(
  client: Q,
  row: { memberId: string; amount: number; reason: string; refType?: string; refId?: number; note?: string },
  onConflictPost = false
): Promise<number> {
  if (!row.amount || row.memberId === ADMIN_AUTHOR.id) return 0
  const { rowCount } = await client.query(
    `INSERT INTO gallery.duckryeok_ledger (member_id, amount, reason, ref_type, ref_id, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ${onConflictPost ? "ON CONFLICT (member_id, day) WHERE reason = 'post' DO NOTHING" : ""}`,
    [row.memberId, row.amount, row.reason, row.refType ?? null, row.refId ?? null, row.note ?? ""]
  )
  if (!rowCount) return 0
  await client.query(
    `INSERT INTO gallery.members (member_id, duckryeok) VALUES ($1, $2)
     ON CONFLICT (member_id) DO UPDATE SET duckryeok = gallery.members.duckryeok + EXCLUDED.duckryeok, updated_at = NOW()`,
    [row.memberId, row.amount]
  )
  return row.amount
}

// 글 작성: 하루 첫 글이면 30
export const creditPost = (client: Q, memberId: string, postId: number) =>
  add(client, { memberId, amount: DUCKRYEOK_RULES.post.amount, reason: "post", refType: "post", refId: postId }, true)

// 댓글 작성: 하루 5개까지
export async function creditComment(client: Q, memberId: string, commentId: number) {
  if (memberId === ADMIN_AUTHOR.id) return 0
  await client.query("SELECT pg_advisory_xact_lock(hashtext('duckryeok:' || $1))", [memberId])
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM gallery.duckryeok_ledger WHERE member_id = $1 AND reason = 'comment' AND day = ${KST_TODAY}`,
    [memberId]
  )
  if (rows[0].n >= DUCKRYEOK_RULES.comment.dailyLimit) return 0
  return add(client, { memberId, amount: DUCKRYEOK_RULES.comment.amount, reason: "comment", refType: "comment", refId: commentId })
}

// 덕업·덕다운 변화량(delta)을 글쓴이에게 (예: 덕다운 → 덕업 으로 바꾸면 +2)
export const applyReaction = (client: Q, authorId: string, postId: number, delta: number) =>
  add(client, { memberId: authorId, amount: delta, reason: "reaction", refType: "post", refId: postId })

// 글·댓글이 지워지거나 숨겨지면 그 대상으로 받은 덕력을 모두 되돌림
export async function revokeFor(client: Q, memberId: string, refType: "post" | "comment", refId: number) {
  const { rows } = await client.query<{ net: number }>(
    "SELECT COALESCE(sum(amount), 0)::int AS net FROM gallery.duckryeok_ledger WHERE member_id = $1 AND ref_type = $2 AND ref_id = $3",
    [memberId, refType, refId]
  )
  return add(client, { memberId, amount: -rows[0].net, reason: refType === "post" ? "post_removed" : "comment_removed", refType, refId })
}

// 되돌렸던 덕력 다시 (관리자가 숨김을 풀 때): 그 대상으로 원래 받은 만큼이 되도록
export async function restoreFor(client: Q, memberId: string, refType: "post" | "comment", refId: number) {
  const { rows } = await client.query<{ earned: number; net: number }>(
    `SELECT COALESCE(sum(amount) FILTER (WHERE reason IN ('post', 'comment', 'reaction')), 0)::int AS earned,
            COALESCE(sum(amount), 0)::int AS net
     FROM gallery.duckryeok_ledger WHERE member_id = $1 AND ref_type = $2 AND ref_id = $3`,
    [memberId, refType, refId]
  )
  return add(client, { memberId, amount: rows[0].earned - rows[0].net, reason: "admin", refType, refId, note: "숨김 해제" })
}

// 관리자 조정 (+/-)
export const adjustByAdmin = (client: Q, memberId: string, amount: number, note: string) =>
  add(client, { memberId, amount, reason: "admin", note })

export async function getDuckryeok(ids: string[]): Promise<Map<string, number>> {
  const list = [...new Set(ids.filter((id) => id && id !== ADMIN_AUTHOR.id))]
  if (!list.length) return new Map()
  const { rows } = await db().query("SELECT member_id, duckryeok FROM gallery.members WHERE member_id = ANY($1)", [list])
  return new Map(rows.map((r: any) => [r.member_id as string, Number(r.duckryeok)]))
}

// 오늘 받은 횟수 (내 홈 안내)
export async function todayEarned(memberId: string) {
  const { rows } = await db().query(
    `SELECT reason, count(*)::int AS n FROM gallery.duckryeok_ledger
     WHERE member_id = $1 AND day = ${KST_TODAY} AND reason IN ('post', 'comment') GROUP BY reason`,
    [memberId]
  )
  const n = Object.fromEntries(rows.map((r: any) => [r.reason, r.n]))
  return {
    post: { count: n.post || 0, limit: DUCKRYEOK_RULES.post.dailyLimit, amount: DUCKRYEOK_RULES.post.amount },
    comment: { count: n.comment || 0, limit: DUCKRYEOK_RULES.comment.dailyLimit, amount: DUCKRYEOK_RULES.comment.amount },
  }
}

export async function ledgerOf(memberId: string, limit: number) {
  const { rows } = await db().query(
    `SELECT id, amount, reason, ref_type, ref_id, note, created_at FROM gallery.duckryeok_ledger
     WHERE member_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [memberId, limit]
  )
  return rows.map((r: any) => ({
    id: Number(r.id),
    amount: r.amount as number,
    reason: r.reason as string,
    label: r.note || LABELS[r.reason] || r.reason,
    refType: r.ref_type as string | null,
    refId: r.ref_id === null ? null : Number(r.ref_id),
    createdAt: iso(r.created_at)!,
  }))
}

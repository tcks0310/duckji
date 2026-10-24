import type { PoolClient } from "pg"

// funding 이 다른 서비스 소유 테이블에 닿는 곳은 이 파일에만 모아 둡니다.
// 지금은 같은 RDS 를 쓰니 SQL 로 쓰지만, DB 를 분리하면 이 파일만 API·메시지 큐로 바꾸면 됩니다.

// 펀딩 덕지 포인트: 개설 50 DP(하루 3번), 참여 신청 20 DP(하루 10번). 프로젝트마다 한 번. 사유 코드는 예전 화면 지급과 같음
export const OPEN_REWARD = { amount: 50, reason: "funding_open", dailyLimit: 3 }
export const JOIN_REWARD = { amount: 20, reason: "funding_join", dailyLimit: 10 }

// 덕지 포인트 원장(users 서비스 소유)에 지급 기록
// 같은 회원·사유·대상(refId)은 원장의 고유 인덱스로 한 번만. 하루 한도를 넘었거나 이미 받았으면 null
export async function earnMemberPoints(
  client: PoolClient,
  memberId: string,
  rule: { amount: number; reason: string; dailyLimit: number },
  refId: string
): Promise<number | null> {
  await client.query("INSERT INTO member_point_balances (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [memberId])
  const { rows } = await client.query<{ balance: number }>("SELECT balance FROM member_point_balances WHERE member_id = $1 FOR UPDATE", [memberId])
  const { rows: today } = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM member_point_ledger
     WHERE member_id = $1 AND reason = $2 AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`,
    [memberId, rule.reason]
  )
  if (today[0].n >= rule.dailyLimit) return null
  const inserted = await client.query(
    "INSERT INTO member_point_ledger (member_id, amount, reason, ref_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
    [memberId, rule.amount, rule.reason, refId]
  )
  if (!inserted.rowCount) return null
  const balance = rows[0].balance + rule.amount
  await client.query("UPDATE member_point_balances SET balance = $2, updated_at = NOW() WHERE member_id = $1", [memberId, balance])
  return balance
}

// ---- DP 결제 (DB 함수 dp_spend·dp_refund). 무료 DP 부터 빠지고, 환불은 쓴 그대로(유료는 유료로) 돌아감
export const PAY_REASON = "funding_pay"
export const REFUND_REASON = "funding_refund"

export class DpError extends Error {
  constructor(public status: 409 | 503, message: string) {
    super(message)
  }
}

// 참여 1건 결제. refId = 참여 id. 모자라면 DpError(409)
export async function spendDp(client: PoolClient, memberId: string, amount: number, refId: string, memo: string) {
  try {
    const { rows } = await client.query<{ balance: number }>("SELECT dp_spend($1, $2, $3, $4, $5) AS balance", [
      memberId,
      amount,
      PAY_REASON,
      refId,
      memo.slice(0, 200),
    ])
    return rows[0].balance
  } catch (e) {
    throw toDpError(e, amount) ?? e
  }
}

// 참여 1건 환불. 결제 기록이 없거나 이미 돌려줬으면 null
export async function refundDp(client: PoolClient, memberId: string, refId: string, memo: string) {
  const { rows } = await client.query<{ balance: number | null }>("SELECT dp_refund($1, $2, $3, $4, $5) AS balance", [
    memberId,
    PAY_REASON,
    REFUND_REASON,
    refId,
    memo.slice(0, 200),
  ])
  return rows[0].balance
}

function toDpError(e: unknown, amount: number) {
  const err = e as { code?: string; message?: string }
  const m = /^DP_INSUFFICIENT:(\d+)/.exec(err.message ?? "")
  if (m) return new DpError(409, `DP 가 부족해요. 결제할 DP ${amount.toLocaleString()}, 보유 ${Number(m[1]).toLocaleString()} DP`)
  if (err.message === "DP_DUPLICATE") return new DpError(409, "이미 결제한 참여입니다.")
  // DB 함수·칸이 아직 없을 때
  if (err.code === "42883" || err.code === "42703") return new DpError(503, "DP 결제를 준비 중이에요. 잠시 후 다시 시도해 주세요.")
  return null
}

// ---- 커뮤니티 프로필 (users 서비스 소유 dukji_users). 펀딩 개설자·참여자·댓글은 갤러리와 같은 이름·사진으로 보여 줌
export type MemberCard = { id: string; name: string; avatarUrl: string }

export async function memberCards(q: Pick<PoolClient, "query">, ids: string[]): Promise<Map<string, MemberCard>> {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return new Map()
  try {
    const { rows } = await q.query("SELECT id, name, avatar_url, status FROM dukji_users WHERE id = ANY($1)", [list])
    return new Map(
      rows.map((r: any) => [r.id as string, { id: r.id, name: r.status === "withdrawn" ? "탈퇴 회원" : r.name, avatarUrl: r.avatar_url || "" }])
    )
  } catch {
    return new Map() // 회원 표가 없는 DB(로컬 등)
  }
}

// 관리자 화면: 개설자 연락처 (견적서를 관리자가 직접 메일로 보낼 때)
export async function memberContacts(q: Pick<PoolClient, "query">, ids: string[]) {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return {} as Record<string, { email: string }>
  try {
    const { rows } = await q.query("SELECT id, to_jsonb(u) ->> 'email' AS email FROM dukji_users u WHERE id = ANY($1)", [list])
    return Object.fromEntries(rows.map((r: any) => [r.id, { email: r.email || "" }])) as Record<string, { email: string }>
  } catch {
    return {}
  }
}

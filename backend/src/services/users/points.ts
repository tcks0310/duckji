import { Hono, type Context } from "hono"
import type { PoolClient } from "pg"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db, requireDatabase } from "../../shared/db/require-database"
import { tx } from "./members"
import { ADMIN_REASON, EARN_RULES, SPEND_RULES, labelFor, type PointRule } from "./point-rules"

// 덕지 포인트(DP): 회원 본인 잔액·내역 (/api/users/me/points), 관리자 조정·테스트 기록 (/api/users/admin/points)
export const memberPointsRoute = new Hono<MemberEnv>()
export const adminPointsRoute = new Hono()

memberPointsRoute.use("*", requireDatabase, requireMember)
adminPointsRoute.use("*", requireDatabase, requireAdmin)

const REF_RE = /^[A-Za-z0-9가-힣_.:-]{1,100}$/
const ADMIN_MAX_ABS = 1_000_000

export class PointError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message)
  }
}

// 유료 DP 칸이 있는지. DB 가 바뀌기 전에 코드가 먼저 배포돼도 지급·차감이 멈추지 않게 (한 번 확인하면 기억)
let paidColumn: boolean | undefined
async function hasPaidBalance(client: PoolClient) {
  if (paidColumn === undefined) {
    const { rows } = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'member_point_balances' AND column_name = 'paid_balance'"
    )
    if (!rows[0]) return false // 아직 없으면 다음에 다시 확인
    paidColumn = true
  }
  return paidColumn
}

type Entry = { memberId: string; amount: number; reason: string; refId?: string | null; memo?: string | null; isTest?: boolean; createdBy?: string | null }

// 원장에 한 줄 쓰고 잔액 반영 (잔액 행을 잠가 동시 요청에도 음수가 되지 않게)
export async function writeEntry(client: PoolClient, e: Entry) {
  await client.query("INSERT INTO member_point_balances (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [e.memberId]).catch((err) => {
    // 회원 원장에 없는 회원 (가입을 마치지 않은 세션 등)
    if (err?.code === "23503") throw new PointError(404, "회원 정보를 찾을 수 없습니다. 다시 로그인해주세요.")
    throw err
  })
  const { rows } = await client.query<{ balance: number }>(
    "SELECT balance FROM member_point_balances WHERE member_id = $1 FOR UPDATE",
    [e.memberId]
  )
  const balance = rows[0].balance + e.amount
  if (balance < 0) throw new PointError(409, `포인트가 부족합니다. (보유 ${rows[0].balance} DP)`)
  const inserted = await client.query(
    `INSERT INTO member_point_ledger (member_id, amount, reason, ref_id, memo, is_test, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
    [e.memberId, e.amount, e.reason, e.refId ?? null, e.memo ?? null, e.isTest ?? false, e.createdBy ?? null]
  )
  if (!inserted.rowCount) throw new PointError(409, "이미 받은 포인트입니다.")
  // 차감이면 유료 DP 는 잔액을 넘지 않게만 줄임 (무료부터 쓰는 규칙은 DB 함수 dp_spend)
  await client.query(
    (await hasPaidBalance(client))
      ? "UPDATE member_point_balances SET balance = $2, paid_balance = LEAST(paid_balance, $2), updated_at = NOW() WHERE member_id = $1"
      : "UPDATE member_point_balances SET balance = $2, updated_at = NOW() WHERE member_id = $1",
    [e.memberId, balance]
  )
  return balance
}

// 하루·전체 횟수 한도 확인 (하루 = 한국 시간 자정 기준)
async function checkLimits(client: PoolClient, memberId: string, reason: string, rule: PointRule) {
  if (rule.dailyLimit) {
    const { rows } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM member_point_ledger
       WHERE member_id = $1 AND reason = $2
         AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`,
      [memberId, reason]
    )
    if (rows[0].n >= rule.dailyLimit) throw new PointError(409, `오늘은 '${rule.label}' 포인트를 모두 받았습니다.`)
  }
  if (rule.totalLimit) {
    const { rows } = await client.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM member_point_ledger WHERE member_id = $1 AND reason = $2",
      [memberId, reason]
    )
    if (rows[0].n >= rule.totalLimit) throw new PointError(409, `'${rule.label}' 포인트는 더 받을 수 없습니다.`)
  }
}

// 신규 가입 축하 포인트를 가입 완료 트랜잭션 안에서 바로 지급 (한 번만). 실패해도 가입은 막지 않음
export async function grantSignupBonus(client: PoolClient, memberId: string) {
  const { rows } = await client.query("SELECT 1 FROM member_point_ledger WHERE member_id = $1 AND reason = 'signup_bonus'", [memberId])
  if (rows[0]) return
  await client.query("SAVEPOINT signup_bonus")
  try {
    await writeEntry(client, { memberId, amount: EARN_RULES.signup_bonus.max, reason: "signup_bonus", refId: "signup" })
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT signup_bonus")
    console.error("signup bonus failed", e)
  }
}

// 신규 가입 축하 포인트 (한 번만). 가입 때 못 받은 회원(예전 회원 등)은 잔액을 처음 볼 때 지급
async function ensureSignupBonus(memberId: string) {
  const rule = EARN_RULES.signup_bonus
  const { rows } = await db().query("SELECT 1 FROM member_point_ledger WHERE member_id = $1 AND reason = 'signup_bonus'", [memberId])
  if (rows[0]) return
  await tx((client) => writeEntry(client, { memberId, amount: rule.max, reason: "signup_bonus", refId: "signup" })).catch((e) => {
    if (!(e instanceof PointError)) throw e
  })
}

async function getBalance(memberId: string) {
  const { rows } = await db().query<{ balance: number }>("SELECT balance FROM member_point_balances WHERE member_id = $1", [memberId])
  return rows[0]?.balance ?? 0
}

// 잔액 중 돈으로 충전한 유료 DP (환불 대상). 표·칸이 아직 없으면 0
async function getPaidBalance(memberId: string) {
  const { rows } = await db()
    .query<{ paid_balance: number }>("SELECT paid_balance FROM member_point_balances WHERE member_id = $1", [memberId])
    .catch(() => ({ rows: [] as { paid_balance: number }[] }))
  return rows[0]?.paid_balance ?? 0
}

type HistoryRow = { id: string; amount: number; reason: string; ref_id: string | null; memo: string | null; is_test: boolean; created_at: Date; balance_after: number }

// 내역 (최신순, 각 줄 뒤의 잔액 포함). before = 이 id 보다 오래된 것
async function getHistory(memberId: string, limit: number, before?: number) {
  const { rows } = await db().query<HistoryRow>(
    `SELECT * FROM (
       SELECT id, amount, reason, ref_id, memo, is_test, created_at,
              SUM(amount) OVER (ORDER BY id)::int AS balance_after
       FROM member_point_ledger WHERE member_id = $1
     ) t
     WHERE ($3::bigint IS NULL OR id < $3) ORDER BY id DESC LIMIT $2`,
    [memberId, limit, before ?? null]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    amount: r.amount,
    reason: r.reason,
    label: labelFor(r.reason),
    refId: r.ref_id,
    memo: r.memo,
    isTest: r.is_test,
    balanceAfter: r.balance_after,
    createdAt: r.created_at,
  }))
}

const fail = (c: Context, e: unknown) => {
  if (e instanceof PointError) return c.json({ success: false, error: e.message }, e.status)
  throw e
}

// ---- 회원 ----

// 내 잔액
memberPointsRoute.get("/", async (c) => {
  const id = c.get("member").id
  await ensureSignupBonus(id)
  return c.json({ success: true, balance: await getBalance(id), paidBalance: await getPaidBalance(id) })
})

// 내 내역 ?limit=30&before=<id>
memberPointsRoute.get("/history", async (c) => {
  const id = c.get("member").id
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 30, 1), 100)
  const before = Number(c.req.query("before"))
  await ensureSignupBonus(id)
  const history = await getHistory(id, limit, Number.isSafeInteger(before) && before > 0 ? before : undefined)
  return c.json({ success: true, balance: await getBalance(id), paidBalance: await getPaidBalance(id), history, hasMore: history.length === limit })
})

// 받기·쓰기 { reason, refId?, amount? } — 금액·한도는 서버 규칙(point-rules.ts)으로 확인
async function applyRule(c: Context<MemberEnv>, kind: "earn" | "spend") {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const reason = typeof body.reason === "string" ? body.reason : ""
  const rule = (kind === "earn" ? EARN_RULES : SPEND_RULES)[reason]
  if (!rule || reason === "signup_bonus") return c.json({ success: false, error: "알 수 없는 포인트 항목입니다." }, 400)
  const refId = typeof body.refId === "string" && body.refId ? body.refId : null
  if (refId !== null && !REF_RE.test(refId)) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  if (rule.once && !refId) return c.json({ success: false, error: "대상이 필요합니다." }, 400)
  const amount = body.amount === undefined && rule.min === rule.max ? rule.min : Number(body.amount)
  if (!Number.isInteger(amount) || amount < rule.min || amount > rule.max) {
    return c.json({ success: false, error: "포인트 금액이 올바르지 않습니다." }, 400)
  }
  const memberId = c.get("member").id
  try {
    const balance = await tx(async (client) => {
      // 잔액 행을 먼저 잠가 같은 회원의 동시 요청이 한도 확인을 함께 통과하지 못하게
      await client.query("SELECT 1 FROM member_point_balances WHERE member_id = $1 FOR UPDATE", [memberId])
      await checkLimits(client, memberId, reason, rule)
      return writeEntry(client, { memberId, amount: kind === "earn" ? amount : -amount, reason, refId })
    })
    return c.json({ success: true, balance, amount: kind === "earn" ? amount : -amount, label: rule.label })
  } catch (e) {
    return fail(c, e)
  }
}

memberPointsRoute.post("/earn", (c) => applyRule(c, "earn"))
memberPointsRoute.post("/spend", (c) => applyRule(c, "spend"))

// ---- 관리자 ----

// 지급 규칙 (관리 화면 안내용)
adminPointsRoute.get("/rules", (c) => c.json({ success: true, earn: EARN_RULES, spend: SPEND_RULES }))

// 회원 잔액·내역
adminPointsRoute.get("/:memberId", async (c) => {
  const memberId = c.req.param("memberId")
  const { rows } = await db().query<{ name: string }>("SELECT name FROM dukji_users WHERE id = $1", [memberId])
  if (!rows[0]) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  const { rows: test } = await db().query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM member_point_ledger WHERE member_id = $1 AND is_test",
    [memberId]
  )
  return c.json({
    success: true,
    member: { id: memberId, name: rows[0].name },
    balance: await getBalance(memberId),
    testEntries: test[0].n,
    history: await getHistory(memberId, 100),
  })
})

// 지급·차감 { amount(+/-), memo, isTest } — isTest 면 아래 '테스트 기록 지우기'로 한 번에 지울 수 있음
adminPointsRoute.post("/:memberId/adjust", async (c) => {
  const memberId = c.req.param("memberId")
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const amount = Number(body.amount)
  const memo = typeof body.memo === "string" ? body.memo.trim().slice(0, 200) : ""
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > ADMIN_MAX_ABS) {
    return c.json({ success: false, error: "금액은 0이 아닌 정수여야 합니다." }, 400)
  }
  if (!memo) return c.json({ success: false, error: "사유를 입력해주세요." }, 400)
  const { rows } = await db().query("SELECT 1 FROM dukji_users WHERE id = $1 AND status <> 'withdrawn'", [memberId])
  if (!rows[0]) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  try {
    const balance = await tx((client) =>
      writeEntry(client, { memberId, amount, reason: ADMIN_REASON, memo, isTest: body.isTest === true, createdBy: "admin" })
    )
    return c.json({ success: true, balance })
  } catch (e) {
    return fail(c, e)
  }
})

// 테스트 기록 지우기: is_test 줄을 지우고 잔액을 원장 합계로 다시 계산 (0 미만이면 0)
adminPointsRoute.delete("/:memberId/test-entries", async (c) => {
  const memberId = c.req.param("memberId")
  const result = await tx(async (client) => {
    await client.query("INSERT INTO member_point_balances (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [memberId])
    await client.query("SELECT 1 FROM member_point_balances WHERE member_id = $1 FOR UPDATE", [memberId])
    const deleted = await client.query("DELETE FROM member_point_ledger WHERE member_id = $1 AND is_test", [memberId])
    // 유료 DP 칸이 있으면 같은 문장에서 잔액을 넘지 않게 맞춤 (따로 하면 CHECK 에 걸림)
    const total = "GREATEST(0, COALESCE((SELECT SUM(amount) FROM member_point_ledger WHERE member_id = $1), 0))"
    const paid = (await hasPaidBalance(client)) ? `, paid_balance = LEAST(paid_balance, ${total})` : ""
    const { rows } = await client.query<{ balance: number }>(
      `UPDATE member_point_balances SET balance = ${total}${paid}, updated_at = NOW() WHERE member_id = $1 RETURNING balance`,
      [memberId]
    )
    return { deleted: deleted.rowCount ?? 0, balance: rows[0].balance }
  })
  return c.json({ success: true, ...result })
})

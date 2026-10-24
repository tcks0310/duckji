import { Hono } from "hono"
import { requireServiceCall } from "../../shared/auth/service-call"
import { db, requireDatabase } from "../../shared/db/require-database"

// 다른 서비스가 서명한 호출로 쓰는 DP 결제·환불 (회원이 직접 부를 수 없음)
// DB 를 직접 못 쓰는 VPC 밖 서비스가 씀. 무료 DP 부터 빠지고 환불은 쓴 그대로 (DB 함수 dp_spend·dp_refund)
// POST /api/users/service/dp/spend   { memberId, amount, reason, ref, memo } → { balance }  (모자라면 409 code=dp_insufficient)
// POST /api/users/service/dp/refund  { memberId, reason, ref, memo } → { balance | null }
export const serviceDpRoute = new Hono()

// 서비스가 쓸 수 있는 사유만 (사유별 장부 이름은 point-rules.ts LEDGER_LABELS)
const REASONS: Record<string, string> = { saju_ask: "saju_refund" }

serviceDpRoute.use("*", requireServiceCall, requireDatabase)

const read = (c: any) => c.get("serviceBody") as Record<string, unknown>
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

serviceDpRoute.post("/spend", async (c) => {
  const b = read(c)
  const memberId = str(b.memberId, 100)
  const reason = str(b.reason, 40)
  const ref = str(b.ref, 100)
  const amount = Number(b.amount)
  if (!memberId || !ref || !REASONS[reason] || !Number.isInteger(amount) || amount <= 0 || amount > 100_000) {
    return c.json({ success: false, error: "요청 값이 올바르지 않습니다." }, 400)
  }
  try {
    const { rows } = await db().query<{ balance: number }>("SELECT dp_spend($1, $2, $3, $4, $5) AS balance", [memberId, amount, reason, ref, str(b.memo, 200)])
    return c.json({ success: true, balance: rows[0].balance })
  } catch (e) {
    const m = /^DP_INSUFFICIENT:(-?\d+)/.exec((e as Error).message ?? "")
    if (m) return c.json({ success: false, code: "dp_insufficient", balance: Number(m[1]) }, 409)
    if ((e as Error).message === "DP_DUPLICATE") return c.json({ success: false, code: "duplicate" }, 409)
    throw e
  }
})

serviceDpRoute.post("/refund", async (c) => {
  const b = read(c)
  const memberId = str(b.memberId, 100)
  const reason = str(b.reason, 40)
  const ref = str(b.ref, 100)
  if (!memberId || !ref || !REASONS[reason]) return c.json({ success: false, error: "요청 값이 올바르지 않습니다." }, 400)
  const { rows } = await db().query<{ balance: number | null }>("SELECT dp_refund($1, $2, $3, $4, $5) AS balance", [memberId, reason, REASONS[reason], ref, str(b.memo, 200)])
  return c.json({ success: true, balance: rows[0].balance })
})

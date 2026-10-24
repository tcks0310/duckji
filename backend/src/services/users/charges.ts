import { randomBytes } from "crypto"
import { Hono } from "hono"
import { DP_PAYMENT_COOKIE, readSealedCookie, type DpPaymentResult } from "../../shared/auth/member-extra"
import { deleteCookie } from "hono/cookie"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db, requireDatabase } from "../../shared/db/require-database"
import { getMemberInfo, tx } from "./members"

// DP 충전 결제 (/api/users/me/points/charges). 1 DP = 1원, 포트원 결제창(KG이니시스 등)
// 1) POST /            충전 주문 만들기 → 결제창에 넣을 paymentId·공개 키·주문자 정보
// 2) (브라우저) 포트원 결제창 → POST /api/auth/payments/dp-charge/verify (VPC 밖에서 포트원 조회, 암호화 쿠키)
// 3) POST /:id/complete 쿠키의 확인 결과와 DB 의 충전 주문(금액·회원)이 맞으면 유료 DP 입금
export const memberChargesRoute = new Hono<MemberEnv>()
memberChargesRoute.use("*", requireDatabase, requireMember)

export const CHARGE_REASON = "dp_charge"
const MIN = 1000
// 앱에서는 DP 충전 대신 굿즈·펀딩 결제 화면에서 모자란 금액만 카드로 냄 (결제창 상품명만 다르고 처리는 충전과 같음)
const ORDER_NAMES: Record<string, string> = { goods: "덕지 굿즈 주문", funding: "덕지 펀딩 참여" }
const MAX = 500_000

const paymentConfig = () => {
  const storeId = process.env.PORTONE_STORE_ID || ""
  const channelKey = process.env.PORTONE_PAYMENT_CHANNEL_KEY || ""
  return storeId && channelKey ? { storeId, channelKey } : null
}

type ChargeRow = { payment_id: string; amount: number; status: string; created_at: Date; paid_at: Date | null }
const toCharge = (r: ChargeRow) => ({
  paymentId: r.payment_id,
  amount: r.amount,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  paidAt: r.paid_at?.toISOString() || null,
})

// 충전 주문 만들기 { amount }
memberChargesRoute.post("/", async (c) => {
  const pg = paymentConfig()
  if (!pg) return c.json({ success: false, error: "DP 충전 결제가 아직 준비되지 않았어요." }, 503)
  const memberId = c.get("member").id
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const amount = Number(body.amount)
  if (!Number.isSafeInteger(amount) || amount < MIN || amount > MAX || amount % 100 !== 0) {
    return c.json({ success: false, error: `충전 금액은 ${MIN.toLocaleString()}원부터 ${MAX.toLocaleString()}원까지 100원 단위로 고를 수 있어요.` }, 400)
  }
  const { rows: recent } = await db().query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM member_dp_charges WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
    [memberId]
  )
  if (recent[0].n >= 20) return c.json({ success: false, error: "충전 시도가 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429)

  const info = await getMemberInfo(memberId)
  if (!info) return c.json({ success: false, error: "회원 정보를 찾을 수 없어요. 다시 로그인해 주세요." }, 404)
  const phone = info.profile.phone
  if (!phone) return c.json({ success: false, error: "결제에 휴대폰 번호가 필요해요. 회원 정보 수정에서 번호를 먼저 등록해 주세요." }, 400)

  const paymentId = `dpc-${randomBytes(12).toString("hex")}`
  await db().query("INSERT INTO member_dp_charges (payment_id, member_id, amount) VALUES ($1, $2, $3)", [paymentId, memberId, amount])
  return c.json({
    success: true,
    paymentId,
    storeId: pg.storeId,
    channelKey: pg.channelKey,
    orderName: ORDER_NAMES[String(body.purpose)] || `덕지 포인트 ${amount.toLocaleString()} DP`,
    amount,
    customer: {
      customerId: memberId,
      fullName: info.profile.realName || info.user.name,
      phoneNumber: phone,
      email: info.user.email || undefined,
    },
  })
})

// 확인을 마치지 못한 충전 (결제창을 닫았거나 확인 전에 페이지를 떠난 경우 다시 확인용, 하루 안)
memberChargesRoute.get("/pending", async (c) => {
  const { rows } = await db().query<ChargeRow>(
    "SELECT * FROM member_dp_charges WHERE member_id = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '1 day' ORDER BY created_at DESC LIMIT 5",
    [c.get("member").id]
  )
  return c.json({ success: true, charges: rows.map(toCharge) })
})

// 결제 확인 결과 반영 (auth 가 남긴 암호화 쿠키 필요)
memberChargesRoute.post("/:paymentId/complete", async (c) => {
  const memberId = c.get("member").id
  const paymentId = c.req.param("paymentId")
  const result = readSealedCookie<DpPaymentResult>(c, DP_PAYMENT_COOKIE)
  if (!result || result.paymentId !== paymentId || result.memberId !== memberId) {
    return c.json({ success: false, error: "결제 확인 정보가 없어요. 다시 확인해 주세요." }, 400)
  }
  deleteCookie(c, DP_PAYMENT_COOKIE, { path: "/" })

  const out = await tx(async (client) => {
    const { rows } = await client.query<ChargeRow & { member_id: string }>(
      "SELECT * FROM member_dp_charges WHERE payment_id = $1 FOR UPDATE",
      [paymentId]
    )
    const charge = rows[0]
    if (!charge || charge.member_id !== memberId) return { status: 404 as const, error: "충전 주문을 찾을 수 없어요." }
    if (charge.status === "paid") return { status: 200 as const, already: true, amount: charge.amount }
    if (result.status === "failed") {
      await client.query("UPDATE member_dp_charges SET status = 'failed', fail_reason = $2 WHERE payment_id = $1 AND status = 'pending'", [
        paymentId,
        result.reason || null,
      ])
      return { status: 409 as const, error: "결제가 완료되지 않았어요." }
    }
    if (result.amount !== charge.amount) {
      // 결제창 금액이 바뀐 경우: 입금하지 않고 기록만 (관리자 확인 후 결제 취소)
      console.error("dp charge amount mismatch", paymentId, charge.amount, result.amount)
      await client.query("UPDATE member_dp_charges SET status = 'failed', fail_reason = $2 WHERE payment_id = $1", [
        paymentId,
        `금액 불일치 (주문 ${charge.amount}, 결제 ${result.amount})`,
      ])
      return { status: 409 as const, error: "결제 금액이 충전 주문과 달라요. 고객센터로 문의해 주세요." }
    }
    await client.query("INSERT INTO member_point_balances (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [memberId])
    await client.query("SELECT 1 FROM member_point_balances WHERE member_id = $1 FOR UPDATE", [memberId])
    await client.query(
      `INSERT INTO member_point_ledger (member_id, amount, paid_amount, reason, ref_id, memo)
       VALUES ($1, $2, $2, $3, $4, $5)`,
      [memberId, charge.amount, CHARGE_REASON, paymentId, `${charge.amount.toLocaleString()}원 결제`]
    )
    await client.query(
      "UPDATE member_point_balances SET balance = balance + $2, paid_balance = paid_balance + $2, updated_at = NOW() WHERE member_id = $1",
      [memberId, charge.amount]
    )
    await client.query(
      "UPDATE member_dp_charges SET status = 'paid', pg_tx_id = $2, pay_method = $3, paid_at = NOW() WHERE payment_id = $1",
      [paymentId, result.txId?.slice(0, 100) || null, result.method?.slice(0, 20) || null]
    )
    return { status: 200 as const, already: false, amount: charge.amount }
  })
  if (out.status !== 200) return c.json({ success: false, error: out.error }, out.status)
  const { rows } = await db().query<{ balance: number }>("SELECT balance FROM member_point_balances WHERE member_id = $1", [memberId])
  return c.json({ success: true, amount: out.amount, alreadyCharged: out.already, balance: rows[0]?.balance ?? 0 })
})

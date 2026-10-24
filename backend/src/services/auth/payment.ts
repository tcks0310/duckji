import { Hono } from "hono"
import { getOptionalMember } from "../../shared/auth/require-member"
import { DP_PAYMENT_COOKIE, DP_PAYMENT_COOKIE_MAX_AGE, setSealedCookie, type DpPaymentResult } from "../../shared/auth/member-extra"

// DP 충전 결제 확인 (포트원 V2). users 서비스는 VPC 안이라 포트원에 못 나가서 여기(VPC 밖)서 조회합니다.
// 브라우저가 결제창을 마치면 paymentId 를 보내고, 서버가 포트원에 결제 상태·금액·주문자를 직접 확인해
// 암호화 쿠키(10분)로 users 서비스에 넘깁니다. 금액이 충전 주문과 같은지는 users 가 DB 기준으로 다시 확인.
// 키: PORTONE_API_SECRET (본인인증과 같은 키)

export const paymentRoute = new Hono()

type PortOnePayment = {
  status?: string
  id?: string
  storeId?: string
  transactionId?: string
  currency?: string
  amount?: { total?: number }
  method?: { type?: string }
  customer?: { id?: string }
  failure?: { reason?: string }
}

const METHOD: Record<string, string> = {
  PaymentMethodCard: "CARD",
  PaymentMethodTransfer: "TRANSFER",
  PaymentMethodEasyPay: "EASY_PAY",
  PaymentMethodVirtualAccount: "VIRTUAL_ACCOUNT",
  PaymentMethodMobile: "MOBILE",
}

paymentRoute.post("/dp-charge/verify", async (c) => {
  const member = getOptionalMember(c)
  if (!member) return c.json({ success: false, error: "로그인이 필요합니다." }, 401)
  const secret = process.env.PORTONE_API_SECRET
  if (!secret) return c.json({ success: false, error: "DP 충전 결제가 아직 준비되지 않았어요." }, 503)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : ""
  if (!/^dpc-[A-Za-z0-9_-]{8,60}$/.test(paymentId)) return c.json({ success: false, error: "결제 정보를 찾을 수 없어요." }, 400)

  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
  })
  if (res.status === 404) return c.json({ success: true, status: "pending" }) // 결제창을 열기 전이거나 아직 기록 전
  if (!res.ok) {
    console.error("portone payment lookup failed", res.status, await res.text().catch(() => ""))
    return c.json({ success: false, error: "결제 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, 503)
  }
  const p = (await res.json()) as PortOnePayment
  const storeId = process.env.PORTONE_STORE_ID
  if ((storeId && p.storeId && p.storeId !== storeId) || p.customer?.id !== member.id) {
    return c.json({ success: false, error: "결제 정보를 찾을 수 없어요." }, 400)
  }

  let result: DpPaymentResult
  if (p.status === "PAID" && p.currency === "KRW" && Number.isSafeInteger(p.amount?.total)) {
    result = {
      paymentId,
      memberId: member.id,
      status: "paid",
      amount: p.amount!.total!,
      txId: p.transactionId,
      method: METHOD[p.method?.type || ""] || p.method?.type,
    }
  } else if (p.status === "FAILED" || p.status === "CANCELLED") {
    result = { paymentId, memberId: member.id, status: "failed", amount: 0, reason: (p.failure?.reason || (p.status === "CANCELLED" ? "결제 취소" : "결제 실패")).slice(0, 200) }
  } else {
    // READY(창만 열림)·PENDING·가상계좌 입금 대기 등
    return c.json({ success: true, status: "pending" })
  }
  setSealedCookie(c, DP_PAYMENT_COOKIE, result, DP_PAYMENT_COOKIE_MAX_AGE)
  return c.json({ success: true, status: result.status })
})

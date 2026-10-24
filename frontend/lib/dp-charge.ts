import { apiFetch } from "@/lib/api"
import { loadPortOne } from "@/lib/member-auth"
import { loadPoints } from "@/lib/member-points"

// DP 충전 결제 (포트원 V2 결제창, 1 DP = 1원)
// 1) users 서비스에 충전 주문 → 2) 포트원 결제창 → 3) auth 서비스가 포트원에 결제 확인 → 4) users 가 유료 DP 입금
// 모바일은 결제창이 페이지를 넘겼다가 /mypage/charge/?paymentId=... 로 돌아옴 (그때 confirmCharge)

export type PayMethod = "CARD" | "TRANSFER"
export type ChargeResult = { status: "ok"; amount: number; balance: number } | { status: "pending" } | { status: "canceled"; message: string } | { status: "error"; error: string }

async function post(path: string, body?: unknown) {
  try {
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok && json.success !== false, status: res.status, json }
  } catch {
    return { ok: false, status: 0, json: { error: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." } }
  }
}

const errorOf = (r: { status: number; json: any }, fallback: string) =>
  r.status === 401 ? "로그인이 필요해요." : r.json?.error || fallback

// 결제를 마친 paymentId 확인 → DP 입금 (같은 결제는 한 번만 입금됨)
export async function confirmCharge(paymentId: string): Promise<ChargeResult> {
  const v = await post("/api/auth/payments/dp-charge/verify", { paymentId })
  if (!v.ok) return { status: "error", error: errorOf(v, "결제 결과를 확인하지 못했어요.") }
  if (v.json.status === "pending") return { status: "pending" }
  const c = await post(`/api/users/me/points/charges/${encodeURIComponent(paymentId)}/complete`)
  if (!c.ok) return { status: "error", error: errorOf(c, "DP 를 넣지 못했어요. 고객센터로 문의해 주세요.") }
  await loadPoints()
  return { status: "ok", amount: c.json.amount, balance: c.json.balance }
}

// 충전 주문을 만들고 결제창 열기
// purpose: 앱에서 굿즈·펀딩 결제 때 모자란 금액만 카드로 낼 때 (결제창 상품명이 '굿즈 주문'·'펀딩 참여'로 나옴, lib/card-pay.ts)
// redirectUrl: 모바일 결제창이 끝나고 돌아올 주소 (기본은 충전 페이지)
export async function chargeDp(amount: number, payMethod: PayMethod, opts: { purpose?: "goods" | "funding"; redirectUrl?: string } = {}): Promise<ChargeResult> {
  const o = await post("/api/users/me/points/charges", { amount, purpose: opts.purpose })
  if (!o.ok) return { status: "error", error: errorOf(o, "충전 주문을 만들지 못했어요.") }
  let PortOne: any
  try {
    PortOne = await loadPortOne()
  } catch {
    return { status: "error", error: "결제창을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }
  }
  const res = await PortOne.requestPayment({
    storeId: o.json.storeId,
    channelKey: o.json.channelKey,
    paymentId: o.json.paymentId,
    orderName: o.json.orderName,
    totalAmount: o.json.amount,
    currency: "CURRENCY_KRW",
    payMethod,
    customer: o.json.customer,
    redirectUrl: opts.redirectUrl || `${window.location.origin}/mypage/charge/`,
  })
  if (res?.code) return { status: "canceled", message: res.message || "결제가 취소됐어요." }
  return confirmCharge(o.json.paymentId)
}

// 확인을 못 마친 충전(결제 직후 창을 닫은 경우 등)을 다시 확인. 입금된 건수와 DP 합계
export async function resumePendingCharges(): Promise<{ count: number; amount: number }> {
  try {
    const res = await apiFetch("/api/users/me/points/charges/pending", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !Array.isArray(json.charges)) return { count: 0, amount: 0 }
    let count = 0
    let amount = 0
    for (const ch of json.charges as { paymentId: string }[]) {
      const r = await confirmCharge(ch.paymentId)
      if (r.status === "ok") {
        count += 1
        amount += r.amount
      }
    }
    return { count, amount }
  } catch {
    return { count: 0, amount: 0 }
  }
}

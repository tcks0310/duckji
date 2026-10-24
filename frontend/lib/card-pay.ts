import { chargeDp, confirmCharge, type ChargeResult } from "@/lib/dp-charge"

// 앱에서 굿즈·펀딩 결제 (2026-10-19 hj 결정 '카드 바로 결제')
// 앱 안에서 DP 충전을 팔면 스토어 인앱결제 대상이라, 앱에서는 충전 버튼을 숨기고 결제 화면에서 모자란 금액만 카드로 냄
// 처리는 DP 충전과 같음: 모자란 만큼 카드 결제 → DP 입금 → 바로 그 DP 로 주문·참여
// 모바일 결제창은 페이지를 넘겼다가 돌아오므로, 입력해 둔 내용(draft)을 sessionStorage 에 두었다가 돌아오면 이어서 주문함

const KEY = "dukji_card_pay"
type Saved<T> = { path: string; draft: T }

// 카드 최소 결제 1,000원, 100원 단위 (users 충전 규칙). 남는 몇백 원은 DP 로 남음
export const cardAmountFor = (short: number) => Math.max(1000, Math.ceil(short / 100) * 100)

export async function payShortByCard<T>(short: number, purpose: "goods" | "funding", draft: T): Promise<ChargeResult> {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname, draft } satisfies Saved<T>))
  } catch {
    // 저장소를 못 쓰면 돌아온 뒤 다시 입력해야 함
  }
  const back = new URL(window.location.href)
  back.searchParams.delete("paymentId")
  back.searchParams.delete("code")
  back.searchParams.delete("message")
  const r = await chargeDp(cardAmountFor(short), "CARD", { purpose, redirectUrl: back.toString() })
  if (r.status !== "pending") clearCardDraft()
  return r
}

export function clearCardDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
}

// 모바일 결제창에서 돌아왔는지 (?paymentId=...). 돌아왔으면 주소에서 결제 값은 지우고, 결제 확인 결과와 저장해 둔 입력을 줌
export async function takeCardReturn<T>(): Promise<{ result: ChargeResult; draft: T | null } | null> {
  const q = new URLSearchParams(window.location.search)
  const paymentId = q.get("paymentId")
  if (!paymentId) return null
  const code = q.get("code")
  const message = q.get("message")
  q.delete("paymentId")
  q.delete("code")
  q.delete("message")
  const rest = q.toString()
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""))
  let draft: T | null = null
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null") as Saved<T> | null
    if (saved && saved.path === window.location.pathname) draft = saved.draft
  } catch {}
  clearCardDraft()
  if (code) return { result: { status: "canceled", message: message || "결제가 취소됐어요." }, draft }
  return { result: await confirmCharge(paymentId), draft }
}

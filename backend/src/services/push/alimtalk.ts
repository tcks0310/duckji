import { createHmac, randomBytes } from "crypto"
import { serviceHeaders } from "../../shared/auth/service-call"

// 카카오 알림톡 보내기 (솔라피 https://solapi.com, 1분마다 스케줄 + 관리자 테스트 발송)
// users 서비스에서 보낼 알림(빈칸까지 채운 것)을 받아 솔라피로 보내고 결과를 돌려줌. 알림톡이 실패하면 솔라피가 문자로 대신 보냄
// SOLAPI_API_KEY / SOLAPI_API_SECRET: 솔라피 콘솔 → API Key, SOLAPI_SENDER: 등록한 발신번호(문자 대체용), KAKAO_PFID: 채널 연동 ID(KA01PF...)
// 넷 중 하나라도 비면 아무것도 꺼내지 않음 (값을 넣은 뒤 생긴 알림부터 나감)

export type AlimtalkMessage = { id: number; kind: string; templateId: string; to: string; variables: Record<string, string> }

export const isAlimtalkConfigured = () =>
  Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER && process.env.KAKAO_PFID)

function authHeader() {
  const date = new Date().toISOString()
  const salt = randomBytes(16).toString("hex")
  const signature = createHmac("sha256", process.env.SOLAPI_API_SECRET!).update(date + salt).digest("hex")
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
}

// 한 건 보내기. 솔라피가 접수하면 ok (카카오 전달 실패는 솔라피가 문자로 대신 보냄)
export async function sendAlimtalk(m: Pick<AlimtalkMessage, "to" | "templateId" | "variables">): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      message: {
        to: m.to,
        from: (process.env.SOLAPI_SENDER || "").replace(/\D/g, ""),
        type: "ATA",
        kakaoOptions: { pfId: process.env.KAKAO_PFID, templateId: m.templateId, variables: m.variables },
      },
    }),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e?.message || e) }) as const)
  if (res.ok) return { ok: true }
  const detail = await res.text().catch(() => "")
  let error = detail.slice(0, 200)
  try {
    const j = JSON.parse(detail)
    error = [j.errorCode, j.errorMessage].filter(Boolean).join(" ").slice(0, 200) || error
  } catch {}
  console.error("alimtalk send failed", res.status, error)
  return { ok: false, error: error || `HTTP ${res.status}` }
}

const usersBase = () => (process.env.USERS_API_URL || "").replace(/\/$/, "")

async function callUsers(path: string, payload: object) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${usersBase()}/api/users/service/push/alimtalk/${path}`, { method: "POST", headers: serviceHeaders(body), body })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok || !json.success) throw new Error(`users alimtalk/${path} 실패: ${res.status} ${json.error || ""}`)
  return json
}

export async function sendAlimtalkPending() {
  if (!isAlimtalkConfigured() || !usersBase()) return { sent: 0, skipped: "not_configured" }
  const { messages } = (await callUsers("claim", {})) as { messages: AlimtalkMessage[] }
  const results: { id: number; ok: boolean; error?: string }[] = []
  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10)
    const rs = await Promise.all(batch.map((m) => sendAlimtalk(m)))
    rs.forEach((r, j) => results.push({ id: batch[j].id, ...r }))
  }
  if (results.length) await callUsers("result", { results })
  const summary = { claimed: messages.length, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }
  if (messages.length) console.log("alimtalk", JSON.stringify(summary))
  return summary
}

// 관리자 테스트 발송용 예시 값 (템플릿 빈칸 이름은 users/alimtalk.ts 와 같음)
export const SAMPLE_VARIABLES: Record<string, Record<string, string>> = {
  order_paid: { 이름: "덕지", 주문번호: "DJ-261021-TEST01", 상품명: "아크릴 키링 외 1건", 결제금액: "12,000 DP", 결제수단: "덕지 DP" },
  order_shipped: { 이름: "덕지", 주문번호: "DJ-261021-TEST01", 상품명: "아크릴 키링 외 1건", 택배사: "CJ대한통운", 송장번호: "123456789012" },
  order_canceled: { 이름: "덕지", 주문번호: "DJ-261021-TEST01", 상품명: "아크릴 키링 외 1건", 환불금액: "12,000 DP", 환불방법: "덕지 DP로 환불" },
  booking_confirmed: { 이름: "덕지", 팝업이름: "테스트 팝업", 예약일시: "10월 25일(토) 14:00", 인원: "2", 장소: "서울 강동구", 예약번호: "BK-TEST01" },
  booking_reminder: { 이름: "덕지", 팝업이름: "테스트 팝업", 예약일시: "10월 25일(토) 14:00", 인원: "2", 장소: "서울 강동구" },
  waiting_called: { 이름: "덕지", 팝업이름: "테스트 팝업", 대기번호: "12", 인원: "2", 입장마감: "10" },
}

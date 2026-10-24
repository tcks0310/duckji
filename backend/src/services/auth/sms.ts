import { createHmac, randomBytes } from "crypto"
import { config } from "../../shared/config"

// 문자 발송 (솔라피 https://solapi.com). VPC 밖 auth 서비스에서만 부름 (VPC 안 Lambda 는 인터넷 접속 없음)
// SOLAPI_API_KEY / SOLAPI_API_SECRET: 솔라피 콘솔 → 개발/연동 → API Key
// SMS_SENDER: 솔라피에 등록·승인된 발신번호 (숫자만)

export const isSmsConfigured = () =>
  Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SMS_SENDER)

export class SmsError extends Error {}

export async function sendSms(to: string, text: string): Promise<void> {
  if (!isSmsConfigured()) {
    // 로컬 개발: 실제로 보내지 않고 로그로 대신함
    if (!config.isProduction) {
      console.log(`[sms:dev] ${to} ← ${text}`)
      return
    }
    throw new SmsError("문자 발송이 아직 설정되지 않았습니다.")
  }
  const date = new Date().toISOString()
  const salt = randomBytes(16).toString("hex")
  const signature = createHmac("sha256", process.env.SOLAPI_API_SECRET!).update(date + salt).digest("hex")
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({ message: { to, from: process.env.SMS_SENDER, text } }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("solapi send failed", res.status, detail.slice(0, 300))
    throw new SmsError("인증 문자를 보내지 못했습니다. 잠시 후 다시 시도해주세요.")
  }
}

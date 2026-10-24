import { db } from "../../shared/db/require-database"

// SES → SNS → users Lambda 로 오는 반송(Bounce)·스팸 신고(Complaint) 알림 처리
// 영구 반송·스팸 신고 주소는 mail_suppressions 에 넣고, 신고한 회원은 마케팅 메일 수신 동의를 끔.
// 메일을 보내는 서비스는 발송 전에 mail_suppressions 를 확인합니다.

export const isSnsEvent = (event: any) => Array.isArray(event?.Records) && event.Records[0]?.EventSource === "aws:sns"

type Suppression = { email: string; reason: "bounce" | "complaint"; detail: string }

export function parseSesNotification(message: any): Suppression[] {
  const type = message?.eventType || message?.notificationType
  if (type === "Bounce" && message.bounce?.bounceType === "Permanent") {
    return (message.bounce.bouncedRecipients || []).map((r: any) => ({
      email: String(r.emailAddress || ""),
      reason: "bounce" as const,
      detail: [message.bounce.bounceSubType, r.diagnosticCode].filter(Boolean).join(" | ").slice(0, 500),
    }))
  }
  if (type === "Complaint") {
    return (message.complaint?.complainedRecipients || []).map((r: any) => ({
      email: String(r.emailAddress || ""),
      reason: "complaint" as const,
      detail: String(message.complaint?.complaintFeedbackType || "").slice(0, 500),
    }))
  }
  return [] // 일시 반송(Transient) 등은 기록하지 않음
}

export async function handleSesNotifications(event: any) {
  const items = event.Records.flatMap((r: any) => {
    try {
      return parseSesNotification(JSON.parse(r.Sns?.Message || "{}"))
    } catch {
      return []
    }
  }).filter((s: Suppression) => s.email.includes("@"))
  for (const s of items) {
    const email = s.email.trim().toLowerCase()
    await db().query(
      `INSERT INTO mail_suppressions (email_lower, reason, detail) VALUES ($1, $2, $3)
       ON CONFLICT (email_lower) DO UPDATE SET reason = EXCLUDED.reason, detail = EXCLUDED.detail, created_at = NOW()`,
      [email.slice(0, 150), s.reason, s.detail || null]
    )
    if (s.reason === "complaint") {
      const { rows } = await db().query<{ id: string }>(
        "UPDATE dukji_users SET marketing_agreed = FALSE WHERE lower(email) = $1 AND marketing_agreed RETURNING id",
        [email]
      )
      for (const r of rows) {
        await db().query(
          "INSERT INTO member_consents (member_id, consent_type, version, agreed, channel) VALUES ($1, 'marketing_email', 'complaint', FALSE, 'ses_complaint')",
          [r.id]
        )
      }
    }
  }
  console.log(`SES 알림 ${items.length}건 처리`)
  return { processed: items.length }
}

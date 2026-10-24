// b2b 서비스 전용 설정 (다른 서비스와 공유하지 않음)
export const b2bConfig = {
  // 메일 발송 방식: none(기본, outbox 에 쌓아만 둠) | log(로그로 출력, 개발용) | ses(SES 연결 후)
  mailDriver: (process.env.MAIL_DRIVER || "none") as "none" | "log" | "ses",
  mailFrom: process.env.MAIL_FROM || "덕지 <news@duckji.com>",
  // 새 입점 신청 알림을 받을 운영자 메일 (비우면 알림 안 함)
  notifyEmail: process.env.B2B_NOTIFY_EMAIL || "",
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
}

import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { requireAdmin } from "../../shared/auth/require-admin"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { db, requireDatabase } from "../../shared/db/require-database"

// 관리자 광고 메시지 보내기 (/api/users/admin/ad-messages)
// 받는 사람 = 활동 중 + 휴대폰 번호 있음 + 마케팅 문자 수신 동의(member_consents marketing_sms 최신 행 agreed)
// 문자 발송(솔라피)은 아직 연결 전: 초안 저장·받는 사람 수 확인만 되고 발송 요청은 503
// 카카오톡은 채널 개설 전이라 화면에서 '개설 예정'만 보임 (channel 'kakao' 저장은 막음)
export const adminAdMessagesRoute = new Hono()
adminAdMessagesRoute.use("*", requireAdmin, requireDatabase)

const actorOf = (c: Context) => readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId ?? "admin-account"

// 정보통신망법 50조: 밤 9시 ~ 아침 8시(한국 시간)에는 따로 동의 없이 광고를 못 보냄
const isNightKst = (d: Date) => {
  const h = (d.getUTCHours() + 9) % 24
  return h >= 21 || h < 8
}

const AUDIENCE_SQL = `
  FROM dukji_users u
  JOIN member_profiles p ON p.member_id = u.id AND p.phone_enc IS NOT NULL
  JOIN LATERAL (
    SELECT c.agreed FROM member_consents c
    WHERE c.member_id = u.id AND c.consent_type = 'marketing_sms'
    ORDER BY c.created_at DESC, c.id DESC LIMIT 1
  ) mc ON mc.agreed
  WHERE u.status = 'active'`

const toMessage = (r: any) => ({
  id: Number(r.id),
  channel: r.channel as "sms" | "kakao",
  title: r.title as string,
  body: r.body as string,
  imageUrl: r.image_url as string,
  linkUrl: r.link_url as string,
  scheduledAt: r.scheduled_at ? (r.scheduled_at as Date).toISOString() : null,
  status: r.status as "draft" | "sent" | "cancelled",
  recipientCount: r.recipient_count as number | null,
  sentAt: r.sent_at ? (r.sent_at as Date).toISOString() : null,
  createdAt: (r.created_at as Date).toISOString(),
  updatedAt: (r.updated_at as Date).toISOString(),
})

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const isHttpUrl = (v: string) => /^https?:\/\/[^\s]+$/i.test(v)

function validate(body: Record<string, unknown> | null) {
  const errors: string[] = []
  if (!body) return { errors: ["내용을 읽지 못했습니다."], value: null }
  if (body.channel !== undefined && body.channel !== "sms") errors.push("카카오톡은 채널 개설 뒤에 쓸 수 있어요.")
  const value = {
    title: str(body.title, 60),
    body: str(body.body, 2000),
    imageUrl: str(body.imageUrl, 1000),
    linkUrl: str(body.linkUrl, 1000),
    scheduledAt: null as Date | null,
  }
  if (!value.body) errors.push("보낼 내용을 적어 주세요.")
  if (value.imageUrl && !isHttpUrl(value.imageUrl)) errors.push("사진 주소가 올바르지 않습니다.")
  if (value.linkUrl && !isHttpUrl(value.linkUrl)) errors.push("링크는 http:// 또는 https:// 로 시작해야 합니다.")
  if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    const d = new Date(body.scheduledAt)
    if (Number.isNaN(d.getTime())) errors.push("보낼 시각이 올바르지 않습니다.")
    else if (isNightKst(d)) errors.push("밤 9시부터 아침 8시 사이에는 광고 문자를 보낼 수 없어요.")
    else value.scheduledAt = d
  }
  return { errors, value }
}

const idOf = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isInteger(id) && id > 0 ? id : null
}

// 받는 사람 수 (수신 동의 회원)
adminAdMessagesRoute.get("/audience", async (c) => {
  const { rows } = await db().query(`SELECT count(*)::int AS n ${AUDIENCE_SQL}`)
  return c.json({ success: true, sms: rows[0].n as number, smsReady: false, kakaoReady: false })
})

adminAdMessagesRoute.get("/", async (c) => {
  const { rows } = await db().query("SELECT * FROM member_ad_messages ORDER BY created_at DESC, id DESC LIMIT 100")
  return c.json({ success: true, messages: rows.map(toMessage) })
})

adminAdMessagesRoute.post("/", async (c) => {
  const { errors, value } = validate(await c.req.json().catch(() => null))
  if (errors.length || !value) return c.json({ success: false, errors }, 400)
  const { rows } = await db().query(
    `INSERT INTO member_ad_messages (channel, title, body, image_url, link_url, scheduled_at, created_by)
     VALUES ('sms', $1, $2, $3, $4, $5, $6) RETURNING *`,
    [value.title, value.body, value.imageUrl, value.linkUrl, value.scheduledAt, actorOf(c)]
  )
  return c.json({ success: true, message: toMessage(rows[0]) })
})

adminAdMessagesRoute.put("/:id", async (c) => {
  const id = idOf(c)
  if (!id) return c.json({ success: false, errors: ["Not Found"] }, 404)
  const { errors, value } = validate(await c.req.json().catch(() => null))
  if (errors.length || !value) return c.json({ success: false, errors }, 400)
  const { rows } = await db().query(
    `UPDATE member_ad_messages SET title = $2, body = $3, image_url = $4, link_url = $5, scheduled_at = $6, updated_at = NOW()
     WHERE id = $1 AND status = 'draft' RETURNING *`,
    [id, value.title, value.body, value.imageUrl, value.linkUrl, value.scheduledAt]
  )
  if (!rows[0]) return c.json({ success: false, errors: ["초안만 고칠 수 있어요."] }, 409)
  return c.json({ success: true, message: toMessage(rows[0]) })
})

adminAdMessagesRoute.delete("/:id", async (c) => {
  const id = idOf(c)
  if (!id) return c.json({ success: false, errors: ["Not Found"] }, 404)
  const { rowCount } = await db().query("DELETE FROM member_ad_messages WHERE id = $1 AND status = 'draft'", [id])
  if (!rowCount) return c.json({ success: false, errors: ["초안만 지울 수 있어요."] }, 409)
  return c.json({ success: true })
})

// 발송·테스트 발송: 솔라피 연결 전
adminAdMessagesRoute.post("/:id/send", (c) =>
  c.json({ success: false, errors: ["문자 발송(솔라피)이 아직 연결되지 않아 보낼 수 없어요."] }, 503)
)

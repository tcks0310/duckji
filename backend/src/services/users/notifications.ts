import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { requireAdmin } from "../../shared/auth/require-admin"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db, requireDatabase } from "../../shared/db/require-database"

// 알림함 (/api/users/me/notifications, /api/users/admin/notifications ...)
// 알림은 각 기능의 표에 단 트리거가 notify() 로 넣고, 여기서는 읽기·읽음 처리·설정·관리자 알림 관리만 합니다.
// 시간 알림(오픈 전날·마감 임박·예약 전날·펀딩 마감 3일 전)은 목록을 열 때 notify_due(회원) 로 만듭니다.

const PAGE = 30
const PREF_KEYS = ["popup", "funding", "gallery", "quietNight"] as const
const CHANNELS = ["inbox", "push", "alimtalk", "email"] as const

// 표·칸이 아직 없으면 빈 목록으로 (화면이 깨지지 않게)
let ready: boolean | null = null
async function hasTables() {
  if (ready) return true
  const { rows } = await db().query("SELECT to_regclass('member_notifications') AS t")
  ready = Boolean(rows[0].t)
  return ready
}

const toItem = (r: any) => ({
  id: Number(r.id),
  kind: r.kind as string,
  group: (r.group_code as string) || "",
  title: r.title as string,
  body: r.body as string,
  link: r.link as string,
  createdAt: (r.created_at as Date).toISOString(),
  read: Boolean(r.read_at),
})

const LIST_SQL = `
  SELECT n.id, n.kind, n.title, n.body, n.link, n.created_at, n.read_at, k.group_code
  FROM member_notifications n LEFT JOIN notification_kinds k ON k.code = n.kind`

const limitOf = (v: string | undefined) => Math.min(Math.max(Number(v) || PAGE, 1), 100)
const beforeOf = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null)

function idsOf(body: any): number[] | "all" | null {
  if (body?.all === true) return "all"
  if (!Array.isArray(body?.ids)) return null
  const ids = body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
  return ids.length && ids.length <= 200 ? ids : null
}

// ---------------------------------------------------------------- 회원
export const memberNotificationsRoute = new Hono<MemberEnv>()
memberNotificationsRoute.use("*", requireDatabase, requireMember)

const memberId = (c: Context<MemberEnv>) => c.get("member").id

memberNotificationsRoute.get("/", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, items: [], unread: 0, hasMore: false })
  const id = memberId(c)
  await db().query("SELECT notify_due($1)", [id])
  const limit = limitOf(c.req.query("limit"))
  const before = beforeOf(c.req.query("before"))
  const { rows } = await db().query(
    `${LIST_SQL} WHERE n.audience = 'member' AND n.member_id = $1 AND ($2::bigint IS NULL OR n.id < $2)
     ORDER BY n.id DESC LIMIT $3`,
    [id, before, limit + 1]
  )
  const { rows: count } = await db().query(
    "SELECT COUNT(*)::int AS n FROM member_notifications WHERE member_id = $1 AND read_at IS NULL",
    [id]
  )
  return c.json({ success: true, items: rows.slice(0, limit).map(toItem), unread: count[0].n, hasMore: rows.length > limit })
})

// 종 아이콘의 빨간 숫자 (페이지를 옮길 때마다 부름)
memberNotificationsRoute.get("/unread-count", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, unread: 0 })
  const id = memberId(c)
  await db().query("SELECT notify_due($1)", [id])
  const { rows } = await db().query(
    "SELECT COUNT(*)::int AS n FROM member_notifications WHERE member_id = $1 AND read_at IS NULL",
    [id]
  )
  return c.json({ success: true, unread: rows[0].n })
})

memberNotificationsRoute.post("/read", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, unread: 0 })
  const ids = idsOf(await c.req.json().catch(() => null))
  if (!ids) return c.json({ success: false, error: "읽음 처리할 알림을 골라 주세요." }, 400)
  const id = memberId(c)
  if (ids === "all") {
    await db().query("UPDATE member_notifications SET read_at = NOW() WHERE member_id = $1 AND read_at IS NULL", [id])
  } else {
    await db().query(
      "UPDATE member_notifications SET read_at = NOW() WHERE member_id = $1 AND id = ANY($2::bigint[]) AND read_at IS NULL",
      [id, ids]
    )
  }
  const { rows } = await db().query(
    "SELECT COUNT(*)::int AS n FROM member_notifications WHERE member_id = $1 AND read_at IS NULL",
    [id]
  )
  return c.json({ success: true, unread: rows[0].n })
})

const toPrefs = (r: any) => ({
  popup: r ? Boolean(r.popup) : true,
  funding: r ? Boolean(r.funding) : true,
  gallery: r ? Boolean(r.gallery) : true,
  quietNight: r ? Boolean(r.quiet_night) : true,
})

memberNotificationsRoute.get("/prefs", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, prefs: toPrefs(null) })
  const { rows } = await db().query("SELECT * FROM member_notification_prefs WHERE member_id = $1", [memberId(c)])
  return c.json({ success: true, prefs: toPrefs(rows[0]) })
})

memberNotificationsRoute.put("/prefs", async (c) => {
  if (!(await hasTables())) return c.json({ success: false, error: "알림 설정을 아직 쓸 수 없어요." }, 503)
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const { rows: cur } = await db().query("SELECT * FROM member_notification_prefs WHERE member_id = $1", [memberId(c)])
  const next = toPrefs(cur[0])
  for (const key of PREF_KEYS) if (typeof body[key] === "boolean") next[key] = body[key] as boolean
  const { rows } = await db().query(
    `INSERT INTO member_notification_prefs (member_id, popup, funding, gallery, quiet_night) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (member_id) DO UPDATE SET popup = $2, funding = $3, gallery = $4, quiet_night = $5, updated_at = NOW()
     RETURNING *`,
    [memberId(c), next.popup, next.funding, next.gallery, next.quietNight]
  )
  return c.json({ success: true, prefs: toPrefs(rows[0]) })
})

// ---------------------------------------------------------------- 관리자
export const adminNotificationsRoute = new Hono()
adminNotificationsRoute.use("*", requireAdmin, requireDatabase)

const actorOf = (c: Context) => readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId ?? "admin-account"

// 관리자 종 아이콘: 관리자 알림 (관리자 전체가 같이 봄)
adminNotificationsRoute.get("/inbox", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, items: [], unread: 0, hasMore: false })
  const limit = limitOf(c.req.query("limit"))
  const before = beforeOf(c.req.query("before"))
  const { rows } = await db().query(
    `${LIST_SQL} WHERE n.audience = 'admin' AND ($1::bigint IS NULL OR n.id < $1) ORDER BY n.id DESC LIMIT $2`,
    [before, limit + 1]
  )
  const { rows: count } = await db().query(
    "SELECT COUNT(*)::int AS n FROM member_notifications WHERE audience = 'admin' AND read_at IS NULL"
  )
  return c.json({ success: true, items: rows.slice(0, limit).map(toItem), unread: count[0].n, hasMore: rows.length > limit })
})

adminNotificationsRoute.post("/inbox/read", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, unread: 0 })
  const ids = idsOf(await c.req.json().catch(() => null))
  if (!ids) return c.json({ success: false, error: "읽음 처리할 알림을 골라 주세요." }, 400)
  if (ids === "all") {
    await db().query("UPDATE member_notifications SET read_at = NOW() WHERE audience = 'admin' AND read_at IS NULL")
  } else {
    await db().query(
      "UPDATE member_notifications SET read_at = NOW() WHERE audience = 'admin' AND id = ANY($1::bigint[]) AND read_at IS NULL",
      [ids]
    )
  }
  const { rows } = await db().query("SELECT COUNT(*)::int AS n FROM member_notifications WHERE audience = 'admin' AND read_at IS NULL")
  return c.json({ success: true, unread: rows[0].n })
})

const toKind = (r: any) => ({
  code: r.code as string,
  group: r.group_code as string,
  name: r.name as string,
  description: r.description as string,
  audience: r.audience as "member" | "admin",
  enabled: Boolean(r.enabled),
  titleTpl: r.title_tpl as string,
  bodyTpl: r.body_tpl as string,
  linkTpl: r.link_tpl as string,
  vars: r.vars as string,
  channels: (r.channels as string[]) || [],
  alimtalkTemplateId: (r.alimtalk_template_id as string | undefined) ?? "",
  essential: Boolean(r.essential),
  prefGroup: (r.pref_group as string | null) ?? null,
  sendHour: r.send_hour === null ? null : Number(r.send_hour),
  sentCount: Number(r.sent_count || 0),
  lastSentAt: r.last_sent_at ? (r.last_sent_at as Date).toISOString() : null,
  updatedAt: (r.updated_at as Date).toISOString(),
})

// 알림 종류 목록 (보낸 수·마지막 보낸 때 포함)
adminNotificationsRoute.get("/kinds", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, kinds: [] })
  const { rows } = await db().query(
    `SELECT k.*, s.sent_count, s.last_sent_at FROM notification_kinds k
     LEFT JOIN (SELECT kind, COUNT(*) AS sent_count, MAX(created_at) AS last_sent_at FROM member_notifications GROUP BY kind) s
       ON s.kind = k.code
     ORDER BY k.sort_order, k.code`
  )
  return c.json({ success: true, kinds: rows.map(toKind) })
})

// 켜고 끄기·문구·보내는 길·보내는 시각
adminNotificationsRoute.put("/kinds/:code", async (c) => {
  if (!(await hasTables())) return c.json({ success: false, error: "알림 기능을 준비 중입니다." }, 503)
  const code = c.req.param("code")
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const { rows: found } = await db().query("SELECT * FROM notification_kinds WHERE code = $1", [code])
  if (!found[0]) return c.json({ success: false, error: "없는 알림 종류입니다." }, 404)
  const cur = found[0]
  const text = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.trim().slice(0, max) : fallback)
  const enabled = typeof body.enabled === "boolean" ? body.enabled : cur.enabled
  const titleTpl = text(body.titleTpl, 200, cur.title_tpl)
  if (!titleTpl) return c.json({ success: false, error: "제목을 입력해 주세요." }, 400)
  const bodyTpl = text(body.bodyTpl, 500, cur.body_tpl)
  const linkTpl = text(body.linkTpl, 300, cur.link_tpl)
  if (linkTpl && !linkTpl.startsWith("/") && !linkTpl.startsWith("{")) {
    return c.json({ success: false, error: "링크는 / 로 시작하는 사이트 안 주소로 적어 주세요." }, 400)
  }
  let channels: string[] = cur.channels
  if (Array.isArray(body.channels)) {
    channels = CHANNELS.filter((ch) => (body.channels as unknown[]).includes(ch))
    if (!channels.includes("inbox")) channels.unshift("inbox") // 알림함은 항상
  }
  // 알림톡 템플릿 ID (059 전이면 열이 없어 건너뜀)
  const hasTemplateCol = "alimtalk_template_id" in cur
  const templateId = hasTemplateCol ? text(body.alimtalkTemplateId, 60, cur.alimtalk_template_id) : ""
  if (templateId && !/^[A-Za-z0-9_-]{4,60}$/.test(templateId)) return c.json({ success: false, error: "템플릿 ID 는 영문·숫자로 적어 주세요." }, 400)
  let sendHour: number | null = cur.send_hour
  if (cur.send_hour !== null && body.sendHour !== undefined) {
    const h = Number(body.sendHour)
    if (!Number.isInteger(h) || h < 0 || h > 23) return c.json({ success: false, error: "보내는 시각은 0~23시로 골라 주세요." }, 400)
    sendHour = h
  }
  const { rows } = await db().query(
    `UPDATE notification_kinds SET enabled = $2, title_tpl = $3, body_tpl = $4, link_tpl = $5, channels = $6, send_hour = $7,
            updated_at = NOW(), updated_by = $8
     WHERE code = $1 RETURNING *`,
    [code, enabled, titleTpl, bodyTpl, linkTpl, channels, sendHour, actorOf(c)]
  )
  if (hasTemplateCol) {
    const { rows: t } = await db().query("UPDATE notification_kinds SET alimtalk_template_id = $2 WHERE code = $1 RETURNING *", [code, templateId])
    return c.json({ success: true, kind: toKind(t[0]) })
  }
  return c.json({ success: true, kind: toKind(rows[0]) })
})

// 보낸 기록 (회원·종류로 찾기)
adminNotificationsRoute.get("/log", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, items: [], hasMore: false })
  const limit = limitOf(c.req.query("limit"))
  const before = beforeOf(c.req.query("before"))
  const kind = c.req.query("kind") || null
  const q = (c.req.query("q") || "").trim().slice(0, 100)
  const { rows } = await db().query(
    `SELECT n.*,
            k.name AS kind_name, u.name AS member_name, u.email AS member_email
     FROM member_notifications n
     LEFT JOIN notification_kinds k ON k.code = n.kind
     LEFT JOIN dukji_users u ON u.id = n.member_id
     WHERE ($1::bigint IS NULL OR n.id < $1)
       AND ($2::text IS NULL OR n.kind = $2)
       AND ($3 = '' OR n.member_id = $3 OR u.name ILIKE '%' || $3 || '%' OR u.email ILIKE '%' || $3 || '%')
     ORDER BY n.id DESC LIMIT $4`,
    [before, kind, q, limit + 1]
  )
  return c.json({
    success: true,
    hasMore: rows.length > limit,
    items: rows.slice(0, limit).map((r) => ({
      id: Number(r.id),
      audience: r.audience,
      memberId: r.member_id,
      memberName: r.member_name || "",
      memberEmail: r.member_email || "",
      kind: r.kind,
      kindName: r.kind_name || r.kind,
      title: r.title,
      body: r.body,
      link: r.link,
      createdAt: (r.created_at as Date).toISOString(),
      readAt: r.read_at ? (r.read_at as Date).toISOString() : null,
      alimtalkStatus: (r.alimtalk_status as string | null | undefined) ?? null,
      alimtalkError: (r.alimtalk_error as string | null | undefined) ?? null,
    })),
  })
})

// 운영 공지 직접 보내기 (활동 중인 회원 전체, 알림함)
adminNotificationsRoute.get("/broadcasts", async (c) => {
  if (!(await hasTables())) return c.json({ success: true, items: [], recipients: 0 })
  const { rows } = await db().query("SELECT * FROM notification_broadcasts ORDER BY id DESC LIMIT 50")
  const { rows: count } = await db().query("SELECT COUNT(*)::int AS n FROM dukji_users WHERE status = 'active'")
  return c.json({
    success: true,
    recipients: count[0].n,
    items: rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      body: r.body,
      link: r.link,
      sentCount: r.sent_count,
      createdAt: (r.created_at as Date).toISOString(),
    })),
  })
})

adminNotificationsRoute.post("/broadcasts", async (c) => {
  if (!(await hasTables())) return c.json({ success: false, error: "알림 기능을 준비 중입니다." }, 503)
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : ""
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 500) : ""
  const link = typeof body?.link === "string" ? body.link.trim().slice(0, 300) : ""
  if (!title) return c.json({ success: false, error: "제목을 입력해 주세요." }, 400)
  if (link && !link.startsWith("/")) return c.json({ success: false, error: "링크는 / 로 시작하는 사이트 안 주소로 적어 주세요." }, 400)
  const { rows: kind } = await db().query("SELECT enabled FROM notification_kinds WHERE code = 'notice'")
  if (!kind[0]?.enabled) return c.json({ success: false, error: "알림 종류에서 '운영 공지'가 꺼져 있어요." }, 400)
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const { rows } = await client.query(
      "INSERT INTO notification_broadcasts (title, body, link, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
      [title, text, link, actorOf(c)]
    )
    const id = rows[0].id as string
    const sent = await client.query(
      `INSERT INTO member_notifications (audience, member_id, kind, ref_id, title, body, link)
       SELECT 'member', u.id, 'notice', $1, $2, $3, $4 FROM dukji_users u WHERE u.status = 'active'
       ON CONFLICT DO NOTHING`,
      [String(id), title, text, link]
    )
    await client.query("UPDATE notification_broadcasts SET sent_count = $2 WHERE id = $1", [id, sent.rowCount ?? 0])
    await client.query("COMMIT")
    return c.json({ success: true, sentCount: sent.rowCount ?? 0 })
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
})

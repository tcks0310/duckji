import { Hono } from "hono"
import { requireServiceCall } from "../../shared/auth/service-call"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db, requireDatabase } from "../../shared/db/require-database"
import { claimAlimtalk, saveAlimtalkResults } from "./alimtalk"

// 앱 푸시
// 회원: 덕지 앱이 받은 기기 토큰을 지금 로그인한 회원에 붙이고, 로그아웃 때 뗌
//   POST   /api/users/me/push-devices  { token, platform, appVersion }
//   DELETE /api/users/me/push-devices  { token }
// push 서비스(VPC 밖, 5분마다)가 서명한 호출로 보낼 알림을 받아 감
//   POST /api/users/service/push/claim    {} → { messages: [{ id, token, title, body, link }] }
//   POST /api/users/service/push/invalid  { tokens } (FCM 이 없는 기기라고 한 토큰 지움)
// 알림톡 (059, alimtalk.ts): 같은 push 서비스가 솔라피로 보냄
//   POST /api/users/service/push/alimtalk/claim   {} → { messages: [{ id, kind, templateId, to, variables }] }
//   POST /api/users/service/push/alimtalk/result  { results: [{ id, ok, error? }] }

const TOKEN_RE = /^[A-Za-z0-9_:\-.]{20,400}$/
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

let ready: boolean | null = null
async function hasTable() {
  if (ready) return true
  const { rows } = await db().query("SELECT to_regclass('member_push_devices') AS t")
  ready = Boolean(rows[0].t)
  return ready
}

// ---------------------------------------------------------------- 회원 (덕지 앱 웹 화면이 부름)
export const memberPushDevicesRoute = new Hono<MemberEnv>()
memberPushDevicesRoute.use("*", requireDatabase, requireMember)

memberPushDevicesRoute.post("/", async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const token = str(b.token, 400)
  const platform = b.platform === "ios" ? "ios" : b.platform === "android" ? "android" : ""
  if (!TOKEN_RE.test(token) || !platform) return c.json({ success: false, error: "기기 정보가 올바르지 않습니다." }, 400)
  if (!(await hasTable())) return c.json({ success: true, saved: false })
  await db().query(
    `INSERT INTO member_push_devices (token, member_id, platform, app_version) VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET member_id = EXCLUDED.member_id, platform = EXCLUDED.platform,
       app_version = EXCLUDED.app_version, last_seen_at = NOW()`,
    [token, c.get("member").id, platform, str(b.appVersion, 20)]
  )
  return c.json({ success: true, saved: true })
})

memberPushDevicesRoute.delete("/", async (c) => {
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const token = str(b.token, 400)
  if (!token || !(await hasTable())) return c.json({ success: true })
  await db().query("DELETE FROM member_push_devices WHERE token = $1 AND member_id = $2", [token, c.get("member").id])
  return c.json({ success: true })
})

// ---------------------------------------------------------------- push 서비스
export const servicePushRoute = new Hono()
servicePushRoute.use("*", requireServiceCall, requireDatabase)

// 보낼 알림 꺼내기: 시간 알림(오픈 전날·마감 임박 등)을 먼저 만들고, 아직 처리 안 한 알림을 처리 끝으로 표시하며 꺼냄
// 밤 9시~아침 8시에는 '밤에는 푸시 안 받기'(기본 켬) 회원의 필수 아닌 알림을 남겨 두었다가 아침에 보냄
// 하루 넘게 지난 알림은 보내지 않고 처리 끝으로만 표시
servicePushRoute.post("/claim", async (c) => {
  if (!(await hasTable())) return c.json({ success: true, messages: [] })
  await db().query("SELECT notify_due(NULL)")
  const { rows } = await db().query(
    `WITH pending AS (
       SELECT n.id, n.audience, n.member_id, n.title, n.body, n.link, n.created_at,
              COALESCE('push' = ANY (k.channels), FALSE) AS wants_push, COALESCE(k.essential, FALSE) AS essential
         FROM member_notifications n
         LEFT JOIN notification_kinds k ON k.code = n.kind
        WHERE n.pushed_at IS NULL
        ORDER BY n.id
        LIMIT 5000
          FOR UPDATE OF n SKIP LOCKED
     ), held AS (
       SELECT p.id FROM pending p
         LEFT JOIN member_notification_prefs pr ON pr.member_id = p.member_id
        WHERE EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Seoul') NOT BETWEEN 8 AND 20
          AND p.wants_push AND NOT p.essential AND COALESCE(pr.quiet_night, TRUE)
          AND p.created_at > NOW() - INTERVAL '1 day'
     ), done AS (
       UPDATE member_notifications m SET pushed_at = NOW()
         FROM pending p
        WHERE m.id = p.id AND p.id NOT IN (SELECT id FROM held)
       RETURNING p.id, p.audience, p.member_id, p.title, p.body, p.link, p.created_at, p.wants_push
     )
     SELECT d.id, d.title, d.body, d.link, dev.token
       FROM done d
       JOIN member_push_devices dev ON dev.member_id = d.member_id
      WHERE d.audience = 'member' AND d.wants_push AND d.created_at > NOW() - INTERVAL '1 day'
      ORDER BY d.id`
  )
  return c.json({
    success: true,
    messages: rows.map((r: any) => ({ id: Number(r.id), token: r.token, title: r.title, body: r.body, link: r.link })),
  })
})

servicePushRoute.post("/invalid", async (c) => {
  const b = c.get("serviceBody" as never) as { tokens?: unknown }
  const tokens = Array.isArray(b?.tokens) ? b.tokens.filter((t): t is string => typeof t === "string" && t.length <= 400).slice(0, 1000) : []
  if (tokens.length) await db().query("DELETE FROM member_push_devices WHERE token = ANY($1::text[])", [tokens])
  return c.json({ success: true, removed: tokens.length })
})

servicePushRoute.post("/alimtalk/claim", async (c) => {
  return c.json({ success: true, messages: await claimAlimtalk() })
})

servicePushRoute.post("/alimtalk/result", async (c) => {
  const b = c.get("serviceBody" as never) as { results?: unknown }
  const results = Array.isArray(b?.results)
    ? b.results
        .filter((r: any) => r && Number.isInteger(r.id) && typeof r.ok === "boolean")
        .map((r: any) => ({ id: r.id as number, ok: r.ok as boolean, error: typeof r.error === "string" ? r.error : undefined }))
        .slice(0, 1000)
    : []
  await saveAlimtalkResults(results)
  return c.json({ success: true, saved: results.length })
})

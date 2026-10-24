import { Hono } from "hono"
import { getCookie } from "hono/cookie"
import { requireAdmin } from "../../shared/auth/require-admin"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { db, requireDatabase } from "../../shared/db/require-database"
import { decryptField, hashPhone, maskPhone } from "./crypto"
import { getMemberForAdmin, setMemberName, tx, withdraw } from "./members"
import { fromRow, type UserRow } from "./rows"

// 관리자 회원 관리
// 기간 정지 · 영구 정지(+ 그 휴대폰 번호로 재가입 금지) · 해제 · 탈퇴 처리, 조치 이력
// 경로: /api/users/admin/... (관리자 센터 공통 규칙)

export const adminMembersRoute = new Hono()
adminMembersRoute.use("*", requireAdmin, requireDatabase)

const actorOf = (c: any) => readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId ?? "admin-account"

const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", naver: "네이버", google: "구글", apple: "애플", cognito: "이메일", email: "이메일" }

// 회원 목록: 로그인 수단·가린 휴대폰·제재 상태까지
adminMembersRoute.get("/members", async (c) => {
  const q = c.req.query("q")?.trim()
  const status = c.req.query("status")
  const { rows } = await db().query<
    UserRow & {
      suspended_until: Date | null
      sanction_reason: string | null
      signup_completed_at: Date | null
      phone_enc: string | null
      phone_banned: boolean
      identity_verified: boolean
      methods: string[] | null
      dp_balance: number | null
    }
  >(
    `SELECT u.*, p.phone_enc,
       (SELECT pb.balance FROM member_point_balances pb WHERE pb.member_id = u.id) AS dp_balance,
       EXISTS (SELECT 1 FROM signup_bans b WHERE (b.kind = 'phone' AND b.hash = u.phone_hash) OR (b.kind = 'ci' AND b.hash = u.ci_hash)) AS phone_banned,
       (u.ci_hash IS NOT NULL) AS identity_verified,
       (SELECT array_agg(DISTINCT i.provider) FROM member_identities i WHERE i.member_id = u.id) AS methods
     FROM dukji_users u LEFT JOIN member_profiles p ON p.member_id = u.id
     WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1 OR u.id ILIKE $1)
       AND (($2::text IS NULL AND u.status <> 'withdrawn') OR u.status = $2)
     ORDER BY u.joined_at DESC LIMIT 500`,
    [q ? `%${q}%` : null, status && status !== "all" ? status : null]
  )
  const members = rows.map((r) => ({
    ...fromRow(r),
    // 보유 DP 는 포인트 원장(member_point_balances) 기준. dukji_users.points 는 가입 때 넣은 350 그대로라 쓰지 않음
    points: r.dp_balance ?? 0,
    phone: maskPhone(decryptField(r.phone_enc)) || undefined,
    loginMethods: (r.methods || [r.provider]).map((p) => PROVIDER_LABEL[p] || p),
    providers: r.methods || [r.provider],
    suspendedUntil: r.suspended_until?.toISOString() || null,
    sanctionReason: r.sanction_reason,
    signupCompleted: Boolean(r.signup_completed_at),
    phoneVerified: Boolean((r as { phone_verified_at?: Date | null }).phone_verified_at),
    phoneBanned: r.phone_banned,
    identityVerified: r.identity_verified,
    signupPlatform: ((r as { signup_platform?: string }).signup_platform || "web") as "web" | "app",
  }))
  const { rows: counts } = await db().query<{ status: string; n: string }>("SELECT status, count(*) AS n FROM dukji_users GROUP BY status")
  return c.json({ success: true, members, total: members.length, counts: Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])) })
})

// 대시보드 회원 수: 실 가입자(가입 완료·탈퇴 안 함)와 탈퇴 포함 전체 이력을 나눠서
// 가입 미완료 = 회원 DB 에 행은 있지만 가입 페이지를 마치지 않은 회원(가입 단계 생기기 전 소셜 로그인 이력 포함)
adminMembersRoute.get("/member-stats", async (c) => {
  const { rows } = await db().query<Record<string, string>>(
    `SELECT
       count(*) AS total,
       count(*) FILTER (WHERE status <> 'withdrawn' AND signup_completed_at IS NOT NULL) AS registered,
       count(*) FILTER (WHERE status <> 'withdrawn' AND signup_completed_at IS NULL) AS incomplete,
       count(*) FILTER (WHERE status = 'withdrawn') AS withdrawn,
       count(*) FILTER (WHERE status IN ('suspended', 'banned')) AS sanctioned,
       count(*) FILTER (WHERE status <> 'withdrawn' AND signup_completed_at IS NOT NULL AND ci_hash IS NULL) AS unverified,
       -- 가입 경로 (to_jsonb: 표·칸이 없어도 오류 없이)
       count(*) FILTER (WHERE status <> 'withdrawn' AND signup_completed_at IS NOT NULL AND to_jsonb(u) ->> 'signup_platform' = 'app') AS from_app,
       count(*) FILTER (WHERE status <> 'withdrawn' AND signup_completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') AS today
     FROM dukji_users u`
  )
  // 실 가입자의 로그인 수단별(연동 포함, 한 사람이 여러 수단이면 각각 셈)
  const { rows: methods } = await db().query<{ provider: string; n: string }>(
    `SELECT CASE WHEN i.provider = 'cognito' THEN 'email' ELSE i.provider END AS provider, count(DISTINCT u.id) AS n
     FROM dukji_users u JOIN member_identities i ON i.member_id = u.id
     WHERE u.status <> 'withdrawn' AND u.signup_completed_at IS NOT NULL
     GROUP BY 1`
  )
  const s = rows[0]
  return c.json({
    success: true,
    stats: {
      registered: Number(s.registered),
      incomplete: Number(s.incomplete),
      withdrawn: Number(s.withdrawn),
      sanctioned: Number(s.sanctioned),
      total: Number(s.total),
      unverified: Number(s.unverified),
      today: Number(s.today),
      fromApp: Number(s.from_app),
      byMethod: Object.fromEntries(methods.map((r) => [r.provider, Number(r.n)])),
    },
  })
})

// 조치: suspend(기간 정지, days) · ban(영구 정지, banPhone 기본 true) · restore(해제) · withdraw(탈퇴 처리)
adminMembersRoute.post("/members/:id/sanction", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const action = body.action
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : ""
  const actor = actorOf(c)
  if (actor === id) return c.json({ success: false, error: "자기 자신은 제재할 수 없습니다." }, 400)
  if (!["suspend", "ban", "restore", "withdraw"].includes(action as string)) {
    return c.json({ success: false, error: "조치 종류가 올바르지 않습니다." }, 400)
  }
  if ((action === "suspend" || action === "ban") && !reason) return c.json({ success: false, error: "제재 사유를 입력해주세요." }, 400)
  const days = Number(body.days)
  if (action === "suspend" && (!Number.isInteger(days) || days < 1 || days > 365)) {
    return c.json({ success: false, error: "정지 기간은 1~365일이어야 합니다." }, 400)
  }

  if (action === "withdraw") {
    // 탈퇴하면 로그인 수단 기록이 지워지므로 이메일 로그인 계정(Cognito sub)을 먼저 읽어 화면에 넘김 → 화면이 admin 서비스로 Cognito 계정 삭제
    const { rows: cognito } = await db().query<{ sub: string }>(
      "SELECT provider_user_id AS sub FROM member_identities WHERE member_id = $1 AND provider = 'cognito'",
      [id]
    )
    const done = await withdraw(id, reason ? `관리자 탈퇴 처리: ${reason}` : "관리자 탈퇴 처리", "admin")
    if (!done) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
    await db().query("INSERT INTO member_admin_actions (member_id, action, reason, actor) VALUES ($1, 'withdraw', $2, $3)", [id, reason || null, actor])
    return c.json({ success: true, cognitoSubs: cognito.map((r) => r.sub) })
  }

  const result = await tx(async (client) => {
    const { rows } = await client.query<{ phone_hash: string | null; ci_hash: string | null; phone_enc: string | null; role: string }>(
      `SELECT u.phone_hash, u.ci_hash, u.role, p.phone_enc FROM dukji_users u LEFT JOIN member_profiles p ON p.member_id = u.id
       WHERE u.id = $1 AND u.status <> 'withdrawn' FOR UPDATE OF u`,
      [id]
    )
    const m = rows[0]
    if (!m) return null
    if (m.role === "admin" && action !== "restore") return "admin" as const
    const detail: Record<string, unknown> = {}
    if (action === "suspend") {
      await client.query(
        `UPDATE dukji_users SET status = 'suspended', suspended_until = NOW() + make_interval(days => $2), sanction_reason = $3 WHERE id = $1`,
        [id, days, reason]
      )
      detail.days = days
    } else if (action === "ban") {
      await client.query("UPDATE dukji_users SET status = 'banned', suspended_until = NULL, sanction_reason = $2 WHERE id = $1", [id, reason])
      // 그 번호로 다시 가입하지 못하게 (가입 때 해시가 없던 예전 회원은 저장된 번호로 계산)
      const phone = decryptField(m.phone_enc)
      const phoneHash = m.phone_hash || (phone ? hashPhone(phone) : null)
      // 본인인증한 회원은 CI 도 막아 번호를 바꿔도 같은 사람은 가입 불가
      const bans: ["phone" | "ci", string][] = []
      if (body.banPhone !== false && phoneHash) bans.push(["phone", phoneHash])
      if (body.banPhone !== false && m.ci_hash) bans.push(["ci", m.ci_hash])
      for (const [kind, hash] of bans) {
        await client.query(
          `INSERT INTO signup_bans (kind, hash, member_id, reason, created_by) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (kind, hash) DO NOTHING`,
          [kind, hash, id, reason, actor]
        )
      }
      detail.phoneBanned = bans.some(([k]) => k === "phone")
      detail.identityBanned = bans.some(([k]) => k === "ci")
    } else {
      await client.query("UPDATE dukji_users SET status = 'active', suspended_until = NULL, sanction_reason = NULL WHERE id = $1", [id])
      if (body.liftPhoneBan === true) {
        await client.query("DELETE FROM signup_bans WHERE member_id = $1 OR (kind = 'phone' AND hash = $2) OR (kind = 'ci' AND hash = $3)", [id, m.phone_hash, m.ci_hash])
        detail.phoneBanLifted = true
      }
    }
    await client.query(
      "INSERT INTO member_admin_actions (member_id, action, reason, detail, actor) VALUES ($1, $2, $3, $4, $5)",
      [id, action, reason || null, JSON.stringify(detail), actor]
    )
    return detail
  })
  if (result === null) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  if (result === "admin") return c.json({ success: false, error: "관리자 회원은 먼저 관리자 권한을 해제해야 제재할 수 있습니다." }, 400)
  console.log(JSON.stringify({ event: "member_sanction", memberId: id, action, by: actor, ...result }))
  return c.json({ success: true, ...result })
})

// 회원 세부 정보: 실명·생년(연도)·성별·나이·가린 번호·배송지·로그인 수단별 연동 기록·동의 상태 (개인정보는 가려서)
adminMembersRoute.get("/members/:id/profile", async (c) => {
  const info = await getMemberForAdmin(c.req.param("id"))
  if (!info) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, ...info })
})

// 닉네임 변경 (조치 이력에 이전 닉네임 기록)
adminMembersRoute.put("/members/:id/name", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (name.length < 2 || name.length > 20) return c.json({ success: false, error: "닉네임은 2~20자여야 합니다." }, 400)
  const { rows } = await db().query<{ name: string }>("SELECT name FROM dukji_users WHERE id = $1 AND status <> 'withdrawn'", [id])
  if (!rows[0] || !(await setMemberName(id, name))) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  await db().query("INSERT INTO member_admin_actions (member_id, action, reason, detail, actor) VALUES ($1, 'rename', NULL, $2, $3)", [
    id,
    JSON.stringify({ from: rows[0].name, to: name }),
    actorOf(c),
  ])
  return c.json({ success: true, name })
})

// 회원별 조치 이력
adminMembersRoute.get("/members/:id/actions", async (c) => {
  const { rows } = await db().query(
    "SELECT action, reason, detail, actor, created_at FROM member_admin_actions WHERE member_id = $1 ORDER BY created_at DESC LIMIT 100",
    [c.req.param("id")]
  )
  return c.json({ success: true, actions: rows })
})

// 재가입 금지 목록 (번호·CI 자체는 저장하지 않으므로 회원·사유로 표시). id = kind:hash
adminMembersRoute.get("/signup-bans", async (c) => {
  const { rows } = await db().query(
    `SELECT b.kind || ':' || b.hash AS id, b.kind, b.member_id, u.name AS member_name, b.reason, b.created_by, b.created_at
     FROM signup_bans b LEFT JOIN dukji_users u ON u.id = b.member_id ORDER BY b.created_at DESC LIMIT 500`
  )
  // 탈퇴 후 재가입 대기 중인 회원 (본인 탈퇴 30일, 강제 탈퇴 90일). 표·칸이 아직 없으면 빈 목록
  const waits = await db()
    .query(
      `SELECT 'rejoin:' || w.member_id AS id, 'rejoin' AS kind, w.member_id, NULL AS member_name,
         CASE WHEN w.kind = 'admin' THEN '강제 탈퇴' ELSE '본인 탈퇴' END || COALESCE(' · ' || w.reason, '') AS reason,
         w.kind AS created_by, w.withdrawn_at AS created_at, w.rejoin_after
       FROM member_withdrawals w WHERE w.rejoin_after > NOW() ORDER BY w.withdrawn_at DESC LIMIT 500`
    )
    .then((r) => r.rows)
    .catch((e) => {
      if (e?.code === "42703") return []
      throw e
    })
  return c.json({ success: true, bans: [...rows, ...waits] })
})

adminMembersRoute.delete("/signup-bans/:id", async (c) => {
  const [kind, hash] = c.req.param("id").split(":")
  // 탈퇴 후 재가입 대기를 관리자가 풂 (rejoin:회원id)
  if (kind === "rejoin") {
    const memberId = c.req.param("id").slice("rejoin:".length)
    const { rowCount } = await db().query(
      "UPDATE member_withdrawals SET rejoin_after = NULL WHERE member_id = $1 AND rejoin_after > NOW()",
      [memberId]
    )
    if (!rowCount) return c.json({ success: false, error: "재가입 대기 기록을 찾을 수 없습니다." }, 404)
    await db().query("INSERT INTO member_admin_actions (member_id, action, actor) VALUES ($1, 'rejoin_wait_lifted', $2)", [memberId, actorOf(c)])
    return c.json({ success: true })
  }
  const { rows } = await db().query<{ member_id: string | null }>(
    "DELETE FROM signup_bans WHERE kind = $1 AND hash = $2 RETURNING member_id",
    [kind, hash]
  )
  if (!rows[0]) return c.json({ success: false, error: "차단 기록을 찾을 수 없습니다." }, 404)
  await db().query(
    "INSERT INTO member_admin_actions (member_id, action, actor) VALUES ($1, 'signup_ban_lifted', $2)",
    [rows[0].member_id || "-", actorOf(c)]
  )
  return c.json({ success: true })
})

// Cognito 에서 직접 지운 이메일 계정 대조: 화면이 admin 서비스에서 받은 Cognito sub 목록을 넘기면,
// 목록에 없는 이메일 로그인 수단을 정리함. 다른 로그인 수단(소셜)이 있으면 이메일 연결만 끊고, 없으면 관리자 탈퇴 처리
// 목록을 잘못 받아 여러 명이 한꺼번에 탈퇴되는 일을 막으려고 5명이 넘으면 confirm 없이는 목록만 돌려줌
const COGNITO_SYNC_LIMIT = 5
adminMembersRoute.post("/members/cognito-sync", async (c) => {
  const body = await c.req.json<{ subs?: unknown; confirm?: unknown }>().catch(() => ({}) as { subs?: unknown; confirm?: unknown })
  if (!Array.isArray(body.subs) || !body.subs.every((s) => typeof s === "string")) {
    return c.json({ success: false, error: "Cognito 계정 목록이 올바르지 않습니다." }, 400)
  }
  const subs = new Set(body.subs as string[])
  const { rows } = await db().query<{ member_id: string; sub: string; others: number }>(
    `SELECT i.member_id, i.provider_user_id AS sub,
            (SELECT COUNT(*)::int FROM member_identities o WHERE o.member_id = i.member_id AND o.provider <> 'cognito') AS others
     FROM member_identities i JOIN dukji_users u ON u.id = i.member_id
     WHERE i.provider = 'cognito' AND u.status <> 'withdrawn'`
  )
  const missing = rows.filter((r) => !subs.has(r.sub))
  if (!missing.length) return c.json({ success: true, withdrawn: [], unlinked: [] })
  if ((missing.length > COGNITO_SYNC_LIMIT || subs.size === 0) && body.confirm !== true) {
    return c.json({ success: false, needsConfirm: true, missing: missing.map((r) => r.member_id) }, 409)
  }
  const actor = actorOf(c)
  const withdrawn: string[] = []
  const unlinked: string[] = []
  for (const r of missing) {
    if (r.others > 0) {
      await db().query("DELETE FROM member_identities WHERE provider = 'cognito' AND provider_user_id = $1", [r.sub])
      unlinked.push(r.member_id)
      continue
    }
    if (await withdraw(r.member_id, "Cognito 에서 삭제된 이메일 계정", "admin")) {
      await db().query(
        "INSERT INTO member_admin_actions (member_id, action, reason, actor) VALUES ($1, 'withdraw', 'Cognito 에서 삭제된 이메일 계정', $2)",
        [r.member_id, actor]
      )
      withdrawn.push(r.member_id)
    }
  }
  return c.json({ success: true, withdrawn, unlinked })
})

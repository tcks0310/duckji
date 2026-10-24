import type { Context } from "hono"
import { getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import { pool } from "../db/pool"
import { clearMemberSessionCookie, MEMBER_SESSION_COOKIE, verifyMemberSessionToken, type Member } from "./member-session"

export type MemberEnv = { Variables: { member: Member } }

// 정지·탈퇴 회원, 회원 DB 에 행이 없는 세션(가입을 안 마쳤거나 지워진 회원)은 세션이 남아 있어도 막음.
// DB 가 있는 서비스에서만 확인하고, 같은 회원은 30초간 결과를 재사용 (행 없음은 곧 가입을 마칠 수 있어 재사용 안 함)
const STATUS_TTL_MS = 30_000
const statusCache = new Map<string, { blocked: string | null; at: number }>()

async function blockedReason(memberId: string): Promise<string | null> {
  if (!pool) return null
  const hit = statusCache.get(memberId)
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.blocked
  let blocked: string | null = null
  try {
    // to_jsonb: 제재 컬럼이 없어도 오류 없이 읽기
    const { rows } = await pool.query<{ status: string | null; until: string | null }>(
      "SELECT to_jsonb(u) ->> 'status' AS status, to_jsonb(u) ->> 'suspended_until' AS until FROM dukji_users u WHERE id = $1",
      [memberId]
    )
    const r = rows[0]
    if (!r) return "member_not_found"
    if (r.status === "banned" || r?.status === "withdrawn") blocked = "member_banned"
    else if (r?.status === "suspended" && (!r.until || Date.parse(r.until) > Date.now())) blocked = "member_suspended"
  } catch {
    return null // 회원 표가 없는 DB(로컬 등)에서는 확인하지 않음
  }
  if (statusCache.size > 5000) statusCache.clear()
  statusCache.set(memberId, { blocked, at: Date.now() })
  return blocked
}

// 로그인 세션만 확인 (상태 확인 없음). 로그인 직후 POST /api/users/me 처럼 정지 사유를 직접 알려 줄 곳에서 씀
export const requireMemberSession = createMiddleware<MemberEnv>(async (c, next) => {
  const member = verifyMemberSessionToken(getCookie(c, MEMBER_SESSION_COOKIE))
  if (!member) return c.json({ success: false, error: "로그인이 필요합니다." }, 401)
  c.set("member", member)
  await next()
})

// 로그인한 회원만 통과. 라우트에서는 c.get("member") 로 회원 정보를 꺼냄
export const requireMember = createMiddleware<MemberEnv>(async (c, next) => {
  const member = verifyMemberSessionToken(getCookie(c, MEMBER_SESSION_COOKIE))
  if (!member) return c.json({ success: false, error: "로그인이 필요합니다." }, 401)
  const blocked = await blockedReason(member.id)
  // 회원 행 없음: 로그인 안 한 것으로 봄. 쿠키는 그대로 둠 (로그인 직후 POST /api/users/me 가 같은 회원으로 연결 중일 수 있음)
  if (blocked === "member_not_found") return c.json({ success: false, code: blocked, error: "로그인이 필요합니다." }, 401)
  if (blocked) {
    clearMemberSessionCookie(c)
    return c.json({ success: false, code: blocked, error: "이용이 정지된 계정입니다." }, 403)
  }
  c.set("member", member)
  await next()
})

// 로그인 여부와 상관없이 회원 정보가 있으면 꺼냄 (없으면 null)
export const getOptionalMember = (c: Context): Member | null =>
  verifyMemberSessionToken(getCookie(c, MEMBER_SESSION_COOKIE))

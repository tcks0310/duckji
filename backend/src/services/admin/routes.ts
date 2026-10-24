import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { deleteCognitoUser, isCognitoAdminConfigured, listCognitoSubs } from "./cognito-members"
import { getCookie } from "hono/cookie"
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  isAdminConfigured,
  readAdminSession,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "../../shared/auth/admin-session"

export const adminRoute = new Hono()

// 현재 관리자 세션 여부 확인
// via: "member" = 관리자 역할 회원, "account" = 비상용 관리자 계정
adminRoute.get("/session", (c) => {
  const session = readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))
  return c.json({
    authenticated: Boolean(session),
    via: session ? (session.memberId ? "member" : "account") : null,
    configured: isAdminConfigured(),
  })
})

// 비상용 관리자 계정 로그인 (ADMIN_ID / ADMIN_PASSWORD)
// 비밀번호 대입 방지: IP 당 15분에 10번까지 시도 (admin 은 DB 없이 돌아서 Lambda 인스턴스별로 셈, API Gateway 전체 제한도 같이 걸림)
adminRoute.post("/session", async (c) => {
  if (!(await consumeQuota("admin-login", clientIp(c), 10, 900)))
    return c.json({ success: false, error: "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요." }, 429)
  const body = await c.req.json<{ id?: unknown; password?: unknown }>().catch(() => null)
  const { id, password } = body || {}
  if (typeof id !== "string" || typeof password !== "string" || !verifyAdminCredentials(id, password)) {
    return c.json({ success: false }, 401)
  }
  setAdminSessionCookie(c)
  return c.json({ success: true })
})

// 관리자 로그아웃
adminRoute.delete("/session", (c) => {
  clearAdminSessionCookie(c)
  return c.json({ success: true })
})

const SUB_PATTERN = /^[0-9a-f-]{36}$/

// 이메일 로그인 계정(Cognito) 목록의 sub. 회원 관리 화면이 users 서비스와 대조해 Cognito 에서 지운 회원을 탈퇴 처리
adminRoute.get("/cognito/users", requireAdmin, async (c) => {
  if (!isCognitoAdminConfigured()) return c.json({ success: false, error: "Cognito 관리 설정이 아직 없습니다." }, 503)
  return c.json({ success: true, subs: await listCognitoSubs() })
})

// 관리자 탈퇴 처리한 이메일 회원의 로그인 계정 삭제
adminRoute.delete("/cognito/users/:sub", requireAdmin, async (c) => {
  const sub = c.req.param("sub")
  if (!SUB_PATTERN.test(sub)) return c.json({ success: false, error: "계정 값이 올바르지 않습니다." }, 400)
  if (!isCognitoAdminConfigured()) return c.json({ success: false, error: "Cognito 관리 설정이 아직 없습니다." }, 503)
  await deleteCognitoUser(sub)
  return c.json({ success: true })
})

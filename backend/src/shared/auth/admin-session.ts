import { createHmac, timingSafeEqual } from "crypto"
import type { Context } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import { config } from "../config"

// 관리자 인증
// 관리자 세션 쿠키는 두 경로로 발급됩니다.
//  1) 회원 DB 에서 role = 'admin' 인 회원이 로그인하면 users 서비스(POST /api/users/me)가 발급 (기본)
//  2) 비상용 관리자 계정(ADMIN_ID / ADMIN_PASSWORD) 로그인 (admin 서비스, 첫 관리자 지정·장애 대응용)
// 서명 키는 ADMIN_PASSWORD 라서, 비어 있으면 관리자 세션은 항상 거부됩니다.

export const ADMIN_SESSION_COOKIE = "dukji_admin_session"
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12 // 12시간

const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

const sign = (payload: string) =>
  createHmac("sha256", `dukji-admin:${config.adminPassword}`).update(payload).digest("hex")

export function isAdminConfigured(): boolean {
  return config.adminPassword.length > 0
}

export function verifyAdminCredentials(id: string, password: string): boolean {
  if (!isAdminConfigured()) return false
  return safeEqual(id.trim(), config.adminId) && safeEqual(password, config.adminPassword)
}

// 세션 토큰: "만료시각[:회원id].서명" (비밀번호가 바뀌면 기존 세션은 자동 무효화)
// 회원 id 가 없으면 비상용 관리자 계정 세션
export function createAdminSessionToken(memberId?: string): string {
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000
  const payload = memberId ? `${expiresAt}:${Buffer.from(memberId).toString("base64url")}` : String(expiresAt)
  return `${payload}.${sign(payload)}`
}

export interface AdminSession {
  memberId: string | null // null = 비상용 관리자 계정
}

export function readAdminSession(token: string | undefined): AdminSession | null {
  if (!isAdminConfigured() || !token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null
  const [expiresAt, encodedId] = payload.split(":")
  if (!(Number(expiresAt) >= Date.now())) return null
  return { memberId: encodedId ? Buffer.from(encodedId, "base64url").toString("utf8") : null }
}

export function isValidAdminSession(token: string | undefined): boolean {
  return readAdminSession(token) !== null
}

export function setAdminSessionCookie(c: Context, memberId?: string) {
  setCookie(c, ADMIN_SESSION_COOKIE, createAdminSessionToken(memberId), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "Strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  })
}

export function clearAdminSessionCookie(c: Context) {
  deleteCookie(c, ADMIN_SESSION_COOKIE, { path: "/" })
}

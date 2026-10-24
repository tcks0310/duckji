import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import type { Context } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import { config } from "../config"

// 회원 로그인 세션
// 로그인한 서비스(auth: 소셜, users: 이메일)가 서명된 토큰을 쿠키로 발급하고,
// 다른 서비스는 DB 조회 없이 서명만 검증해서 회원을 식별합니다.
// 모든 서비스가 같은 MEMBER_SESSION_SECRET 을 써야 합니다.
// 나중에 Cognito 로 바꾸면 이 파일의 발급·검증만 Cognito JWT 로 교체하면 됩니다.

export const MEMBER_SESSION_COOKIE = "dukji_member_session"
export const MEMBER_SESSION_MAX_AGE = 60 * 60 * 24 * 14 // 14일

export interface Member {
  id: string // 예: kakao-123, naver-abc, google-xyz, email-<uuid>
  name: string
  email: string
  avatarUrl?: string
  provider: "kakao" | "naver" | "google" | "apple" | "email" | "cognito"
  emailVerified?: boolean // 로그인 서비스가 인증한 이메일인지 (같은 이메일 계정 합치기에 씀)
}

// 운영에서 비밀값이 없으면 회원 로그인 자체를 막고, 로컬 개발에서는 프로세스마다 임시 키를 씀
const devSecret = randomBytes(32).toString("hex")
const secret = () => config.memberSessionSecret || (config.isProduction ? "" : devSecret)

export function isMemberSessionConfigured(): boolean {
  return secret().length > 0
}

export const memberSecret = () => secret()

const sign = (payload: string) => createHmac("sha256", `dukji-member:${secret()}`).update(payload).digest("base64url")

// 토큰: base64url(JSON).서명
export function createMemberSessionToken(member: Member): string {
  const payload = Buffer.from(
    JSON.stringify({ ...member, exp: Date.now() + MEMBER_SESSION_MAX_AGE * 1000 })
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function verifyMemberSessionToken(token: string | undefined): Member | null {
  if (!isMemberSessionConfigured() || !token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (typeof data.exp !== "number" || data.exp < Date.now() || typeof data.id !== "string") return null
    return {
      id: data.id,
      name: String(data.name || ""),
      email: String(data.email || ""),
      avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
      provider: data.provider,
      emailVerified: data.emailVerified === true,
    }
  } catch {
    return null
  }
}

export function setMemberSessionCookie(c: Context, member: Member) {
  setCookie(c, MEMBER_SESSION_COOKIE, createMemberSessionToken(member), {
    httpOnly: true,
    secure: config.isProduction,
    // www.duckji.com ↔ api.duckji.com 은 같은 사이트라 Lax 로 충분 (다른 사이트의 POST 에는 안 실림)
    sameSite: "Lax",
    path: "/",
    maxAge: MEMBER_SESSION_MAX_AGE,
  })
}

export function clearMemberSessionCookie(c: Context) {
  deleteCookie(c, MEMBER_SESSION_COOKIE, { path: "/" })
}

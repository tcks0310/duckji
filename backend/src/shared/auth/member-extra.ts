import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { config } from "../config"
import { memberSecret } from "./member-session"

// 소셜 로그인에서 받은 추가 회원 정보(성별·생일·전화번호 등)를 auth 서비스(DB 없음)에서
// users 서비스(DB 있음)로 넘기는 짧은 쿠키입니다.
// 세션 쿠키에는 개인정보를 넣지 않고, 이 쿠키는 암호화해서 10분만 두며 POST /api/users/me 가 읽고 바로 지웁니다.

export const MEMBER_EXTRA_COOKIE = "dukji_member_extra"
const MAX_AGE = 60 * 10

export interface MemberExtra {
  realName?: string
  phone?: string // 숫자만, 국내 형식 (010...)
  birthYear?: string // YYYY
  birthday?: string // MMDD
  gender?: "female" | "male"
  ageRange?: string
  shippingAddress?: {
    recipient: string
    phone: string
    zipCode: string
    address1: string
    address2?: string
  }
  // 이메일 가입 때 받은 약관 동의 (새 회원을 만들 때만 기록)
  consents?: Record<string, boolean>
}

const key = () => createHash("sha256").update(`dukji-member-extra:${memberSecret()}`).digest()

// 암호화한 짧은 쿠키 (값은 JSON, exp 지나면 무시)
export function setSealedCookie(c: Context, name: string, data: object, maxAge: number) {
  if (!memberSecret()) return
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...data, exp: Date.now() + maxAge * 1000 }), "utf8"), cipher.final()])
  const token = [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".")
  setCookie(c, name, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge,
  })
}

// 읽기만 (지우지 않음)
export function readSealedCookie<T>(c: Context, name: string): T | null {
  const token = getCookie(c, name)
  if (!token || !memberSecret()) return null
  try {
    const [iv, tag, body] = token.split(".").map((p) => Buffer.from(p, "base64url"))
    const decipher = createDecipheriv("aes-256-gcm", key(), iv)
    decipher.setAuthTag(tag)
    const data = JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"))
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null
    delete data.exp
    return data as T
  } catch {
    return null
  }
}

// 읽고 바로 지움 (한 번만 쓰임)
export function takeSealedCookie<T>(c: Context, name: string): T | null {
  if (!getCookie(c, name)) return null
  const data = readSealedCookie<T>(c, name)
  deleteCookie(c, name, { path: "/" })
  return data
}

export function setMemberExtraCookie(c: Context, extra: MemberExtra) {
  if (Object.keys(extra).length === 0) return
  setSealedCookie(c, MEMBER_EXTRA_COOKIE, extra, MAX_AGE)
}

// 회원가입 대기 (로그인 수단은 확인됐지만 가입 정보를 아직 안 넣음). users 서비스가 쓰고 읽음
export const SIGNUP_COOKIE = "dukji_signup"
export const SIGNUP_COOKIE_MAX_AGE = 60 * 30
// 휴대폰 인증번호 문자 발송표: users 서비스(DB, VPC 안)가 만들고 auth 서비스(VPC 밖)가 읽어 문자를 보냄
export const SMS_TICKET_COOKIE = "dukji_sms_ticket"
export interface SmsTicket {
  phone: string
  code: string
}

export const takeMemberExtraCookie = (c: Context) => takeSealedCookie<MemberExtra>(c, MEMBER_EXTRA_COOKIE)

// 본인인증 결과: auth 서비스(포트원 확인, VPC 밖)가 만들고 users 서비스가 가입·번호 변경 때 읽음
export const IDENTITY_COOKIE = "dukji_identity"
export const IDENTITY_COOKIE_MAX_AGE = 60 * 30
export interface IdentityResult {
  ci: string
  name: string
  phone: string // 숫자만
  birthDate: string | null // YYYY-MM-DD
  gender: "female" | "male" | null
  foreigner?: boolean
}

// 마이페이지 로그인 수단 연동 중: 연동을 시작한 회원 id. 다른 수단으로 로그인한 뒤 POST /api/users/me 가 읽어
// 새 로그인 수단을 이 회원에게 붙이고 세션을 원래 회원으로 되돌림
export const LINK_COOKIE = "dukji_link"
export const LINK_COOKIE_MAX_AGE = 60 * 10
export interface LinkTicket {
  memberId: string
}

// DP 충전 결제 확인 결과: auth 서비스(포트원 결제 조회, VPC 밖)가 만들고 users 서비스가 읽어 DP 입금
export const DP_PAYMENT_COOKIE = "dukji_dp_payment"
export const DP_PAYMENT_COOKIE_MAX_AGE = 60 * 10
export interface DpPaymentResult {
  paymentId: string
  memberId: string
  status: "paid" | "failed"
  amount: number // 포트원이 확인한 결제 금액(원)
  txId?: string
  method?: string
  reason?: string
}

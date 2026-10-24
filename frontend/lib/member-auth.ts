import type { UserProfile } from "@/components/auth/types"
import { apiFetch } from "@/lib/api"
import { forgetAdminMember, rememberMemberRole } from "@/lib/admin-access"
import { forgetPushDevice } from "@/lib/app-bridge"

// 회원 로그인 세션 (backend 가 httpOnly 쿠키로 발급)
// 소셜: 각 SDK 가 받은 토큰을 backend 가 검증 → 쿠키 발급 (auth 서비스)
// 이메일: Cognito 로 가입·인증·비밀번호 확인 → auth 서비스가 쿠키 발급 (Cognito 없는 로컬은 users 서비스)
// 로그인 후 POST /api/users/me 로 회원 DB 에 기록합니다.
// 화면 표시용 정보는 기존처럼 localStorage("dukji_user")에도 저장합니다.

type AuthResult =
  | { success: true; user: UserProfile }
  | { success: false; error: string; signupRequired?: boolean }

// 로그인 수단은 확인됐지만 회원가입 정보(휴대폰·필수 약관)가 아직 없음 → /signup 으로 보냄
export class SignupRequiredError extends Error {
  code = "signup_required"
  constructor() {
    super("회원가입 정보를 입력해주세요.")
  }
}
export const isSignupRequired = (e: unknown) => (e as any)?.code === "signup_required"
export const SIGNUP_PATH = "/signup/"

const toProfile = (u: any): UserProfile => ({
  id: u.id,
  name: u.name,
  email: u.email,
  provider: u.provider,
  avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl.replace(/^http:\/\//, "https://") : u.avatarUrl,
})

async function post(path: string, body?: unknown, onUser?: (user: any) => void): Promise<AuthResult> {
  try {
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (json.code === "signup_required") return { success: false, error: json.error, signupRequired: true }
    if (!res.ok || !json.success) return { success: false, error: json.error || "요청을 처리하지 못했습니다." }
    onUser?.(json.user)
    return { success: true, user: toProfile(json.user) }
  } catch {
    return { success: false, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

// 소셜 SDK 토큰으로 서버 세션 만들기 (덕지 앱의 구글 로그인은 ID 토큰)
export async function startSocialSession(provider: "kakao" | "google", token: string | { idToken: string }): Promise<AuthResult> {
  const result = await post(`/api/auth/${provider}`, typeof token === "string" ? { accessToken: token } : token)
  return result.success ? syncMember() : result
}

// 애플: 애플 JS 가 준 identity token(+처음 한 번 주는 이름)으로 서버 세션 (lib/apple-auth.ts)
export async function startAppleSession(idToken: string, nonce: string, name?: string): Promise<AuthResult> {
  const result = await post("/api/auth/apple", { idToken, nonce, name })
  return result.success ? syncMember() : result
}

type EmailResult = { ok: boolean; status: number; json: any }

async function postJson(path: string, body: unknown): Promise<EmailResult> {
  try {
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) }
  } catch {
    return { ok: false, status: 0, json: { error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." } }
  }
}

const failOf = (r: EmailResult): AuthResult => ({ success: false, error: r.json.error || "요청을 처리하지 못했습니다." })
const cognitoDisabled = (r: EmailResult) => r.status === 503 && r.json.code === "cognito_disabled"

// 로그인 페이지로 이동. 로그인 뒤 지금 보던 페이지로 돌아옴 (/login?next=...)
export function goToLogin(next?: string) {
  const here = next ?? `${window.location.pathname}${window.location.search}`
  const safe = here.startsWith("/") && !here.startsWith("//") && !here.startsWith("/login") ? here : "/"
  window.location.href = safe === "/" ? "/login/" : `/login/?next=${encodeURIComponent(safe)}`
}

// 이메일 가입·로그인 단계 결과. code = 메일로 받은 인증 코드 입력이 필요함
type CodeStep = { success: false; needsCode: true; error?: string; existing?: boolean }
export type EmailStep = AuthResult | CodeStep
export const needsCode = (r: EmailStep): r is CodeStep =>
  !r.success && "needsCode" in r

// 이메일 가입: Cognito 가입 → (화면에서) 인증 코드 확인 → 로그인 → 회원 DB 기록
// 예전에 가입만 하고 인증을 못 마친 이메일이면 서버가 코드를 다시 보내고 같은 코드 단계로 이어짐
export async function signupWithEmail(input: {
  email: string
  password: string
  name: string
  agreements: { age: boolean; terms: boolean; privacy: boolean; marketing: boolean }
}): Promise<EmailStep> {
  const email = input.email.trim().toLowerCase()
  const r = await postJson("/api/auth/email/signup", { ...input, email })
  if (cognitoDisabled(r)) return post("/api/users/email/signup", input) // Cognito 없는 로컬 개발
  if (!r.ok) return failOf(r)
  return { success: false, needsCode: true, existing: r.json.existing === true }
}

export async function confirmEmailCode(email: string, code: string): Promise<{ success: true } | { success: false; error: string }> {
  const r = await postJson("/api/auth/email/confirm", { email: email.trim().toLowerCase(), code: code.trim() })
  return r.ok ? { success: true } : { success: false, error: r.json.error || "인증 코드가 올바르지 않습니다." }
}

export async function resendEmailCode(email: string): Promise<{ success: true } | { success: false; error: string }> {
  const r = await postJson("/api/auth/email/resend", { email: email.trim().toLowerCase() })
  return r.ok ? { success: true } : { success: false, error: r.json.error || "인증 코드를 보내지 못했습니다." }
}

// 이메일 로그인. 인증 전 계정이면 코드를 보내고 코드 단계로. 예전 이메일 가입 회원도 같은 비밀번호로 로그인됩니다.
export async function loginWithEmail(email: string, password: string): Promise<EmailStep> {
  email = email.trim().toLowerCase()
  const r = await postJson("/api/auth/email/login", { email, password })
  if (cognitoDisabled(r)) return post("/api/users/email/login", { email, password })
  if (!r.ok && r.json.code === "needs_confirmation") {
    const sent = await postJson("/api/auth/email/resend", { email })
    return { success: false, needsCode: true, error: sent.ok ? undefined : sent.json.error }
  }
  if (!r.ok) return failOf(r)
  return syncMember()
}

// 비밀번호 재설정: 메일로 코드 받기 → 코드와 새 비밀번호로 변경
export async function requestPasswordReset(email: string): Promise<AuthResult | { success: true }> {
  const r = await postJson("/api/auth/email/forgot", { email: email.trim().toLowerCase() })
  return r.ok ? { success: true } : failOf(r)
}

export async function resetPassword(email: string, code: string, password: string): Promise<AuthResult | { success: true }> {
  const r = await postJson("/api/auth/email/reset", { email: email.trim().toLowerCase(), code, password })
  return r.ok ? { success: true } : failOf(r)
}

// 회원 탈퇴. 이메일 로그인을 쓰는 회원은 비밀번호로 이메일 계정도 함께 지웁니다.
export async function withdrawMember(input: { reason?: string; email?: string; password?: string }) {
  if (input.email && input.password) {
    // 로그인 계정을 지우기 전에 탈퇴 가능한지 확인 (배송 전 주문 등)
    try {
      const res = await apiFetch("/api/users/me/withdraw-check", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (res.status === 409) return { success: false as const, error: json.error || "지금은 탈퇴할 수 없습니다." }
    } catch {
      return { success: false as const, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
    }
    const r = await postJson("/api/auth/email/delete", { email: input.email, password: input.password })
    if (!r.ok && !cognitoDisabled(r)) return failOf(r)
  }
  try {
    const res = await apiFetch("/api/users/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok && json.success ? { success: true as const } : { success: false as const, error: json.error || "탈퇴하지 못했습니다." }
  } catch {
    return { success: false as const, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

// 회원 DB 기록 (서버는 쿠키의 회원 정보만 사용). 관리자 역할 회원이면 서버가 관리자 세션도 발급
export async function syncMember() {
  return post("/api/users/me", undefined, (user) => rememberMemberRole(user?.role))
}

export async function getSessionMember(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch("/api/auth/me", { cache: "no-store" })
    const json = await res.json()
    return json.authenticated ? toProfile(json.user) : null
  } catch {
    return null
  }
}

export async function logoutMember() {
  // 덕지 앱: 이 폰으로 이 회원 알림이 더 오지 않게 기기를 뗌
  await forgetPushDevice()
  try {
    await apiFetch("/api/auth/session", { method: "DELETE" })
  } catch {
    // 서버 연결 실패해도 화면 로그아웃은 진행
  }
  forgetAdminMember()
}

// ---- 회원가입 완료 (/signup) ----

interface PendingSignupBase {
  provider: string
  reverify?: boolean // 이미 가입한 회원이 본인인증만 하러 온 경우
  name: string
  email: string | null // 로그인 수단에서 받은 이메일 (없으면 입력받음)
  phone: string | null
  consents: Record<string, boolean> | null
}

// 본인 확인 방식 (서버 설정에 따라)
//   identity: 본인인증(포트원 창에서 PASS·문자). 한 사람 한 계정
//   sms     : 문자 인증번호
//   none    : 번호 중복만 확인 (둘 다 설정 전)
export interface VerificationInfo {
  verificationMode: "identity" | "sms" | "none"
  smsEnabled: boolean
  portone: { storeId: string; channelKey: string } | null
  identity: VerifiedIdentity | null // 이미 마친 본인인증 (30분 유효)
}
export interface VerifiedIdentity {
  name: string
  birthDate: string | null
  phone: string // 가린 번호
}
export interface PendingSignup extends PendingSignupBase, VerificationInfo {}

export async function getPendingSignup(): Promise<PendingSignup | null> {
  try {
    const res = await apiFetch("/api/users/signup", { cache: "no-store" })
    const json = await res.json()
    return json.success ? (json as PendingSignup) : null
  } catch {
    return null
  }
}

type Simple = { success: true; devCode?: string } | { success: false; error: string; loginMethods?: string[] }

const simple = (r: EmailResult): Simple =>
  r.ok && r.json.success
    ? { success: true, devCode: r.json.devCode }
    : { success: false, error: r.json.error || "요청을 처리하지 못했습니다.", loginMethods: r.json.loginMethods }

// 가입 중(signup)인지 마이페이지 번호 변경(me)인지
export type VerifyScope = "signup" | "me"

// 인증번호 받기: 회원 서버가 번호를 기록하고, 로그인 서버가 문자를 보냄
export async function sendPhoneCode(phone: string, scope: VerifyScope = "signup"): Promise<Simple> {
  const issued = simple(await postJson(`/api/users/${scope}/phone/send`, { phone }))
  if (!issued.success) return issued
  const sent = simple(await postJson("/api/auth/phone/send", {}))
  return sent.success ? issued : sent
}

export async function verifyPhoneCode(phone: string, code: string, scope: VerifyScope = "signup"): Promise<Simple> {
  return simple(await postJson(`/api/users/${scope}/phone/verify`, { phone, code }))
}

// ---- 본인인증 (포트원 V2 → 다날·KG이니시스) ----

const PORTONE_SDK = "https://cdn.portone.io/v2/browser-sdk.js"
export const IDENTITY_RETURN_PARAM = "identityVerificationId"

export function loadPortOne(): Promise<any> {
  const w = window as any
  if (w.PortOne) return Promise.resolve(w.PortOne)
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = PORTONE_SDK
    script.onload = () => (w.PortOne ? resolve(w.PortOne) : reject(new Error("본인인증 창을 불러오지 못했습니다.")))
    script.onerror = () => reject(new Error("본인인증 창을 불러오지 못했습니다."))
    document.head.appendChild(script)
  })
}

// 서버가 포트원에 결과를 직접 조회해 확인 (브라우저가 보낸 이름·번호는 쓰지 않음)
export async function confirmIdentity(identityVerificationId: string): Promise<{ success: true; identity: VerifiedIdentity } | { success: false; error: string }> {
  const r = await postJson("/api/auth/identity/verify", { identityVerificationId })
  if (!r.ok || !r.json.success) return { success: false, error: r.json.error || "본인인증을 확인하지 못했습니다." }
  return { success: true, identity: { name: r.json.name, birthDate: r.json.birthDate, phone: r.json.phone } }
}

// 본인인증 창 열기. 모바일은 페이지가 포트원으로 넘어갔다가 ?identityVerificationId=... 로 돌아옴 (그때는 confirmIdentity 로 확인)
export async function requestIdentity(portone: { storeId: string; channelKey: string }) {
  const PortOne = await loadPortOne()
  const id = `idv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const res = await PortOne.requestIdentityVerification({
    storeId: portone.storeId,
    channelKey: portone.channelKey,
    identityVerificationId: id,
    redirectUrl: `${window.location.origin}${window.location.pathname}`,
  })
  if (res?.code) return { success: false as const, error: res.message || "본인인증이 취소되었습니다." }
  return confirmIdentity(res?.identityVerificationId || id)
}

export async function completeSignup(input: {
  name: string
  email: string | null
  phone: string | null
  agreements: { age: boolean; terms: boolean; privacy: boolean; marketing: boolean }
  referralCode?: string | null
}): Promise<AuthResult & { loginMethods?: string[] }> {
  const r = await postJson("/api/users/signup/complete", input)
  if (!r.ok || !r.json.success) return { ...failOf(r), loginMethods: r.json.loginMethods }
  return { success: true, user: toProfile(r.json.user) }
}

export async function cancelSignup() {
  try {
    await apiFetch("/api/users/signup", { method: "DELETE" })
  } catch {
    // 쿠키는 30분 뒤 저절로 만료
  }
}

// ---- 마이페이지 ----

// 배송지 (주문할 때 저장하거나 마이페이지 배송지 관리에서 추가·수정)
export interface MyAddress {
  id: number
  label: string | null
  recipient: string | null
  phone: string | null
  zipCode: string
  address1: string | null
  address2: string | null
  isDefault: boolean
}
export type AddressForm = { label?: string | null; recipient: string; phone: string; zipCode: string; address1: string; address2?: string | null; isDefault?: boolean }

export interface MyInfo {
  user: { id: string; name: string; email: string; provider: string; avatarUrl?: string; joinedAt: string; points: number; role: string }
  profile: {
    realName: string | null
    phone: string | null
    birthDate: string | null
    gender: "female" | "male" | "other" | null
    region: string | null
    interests: string[]
    bio: string | null
    sources: Record<string, string>
  }
  loginMethods: { provider: string; email: string | null; linkedAt: string; lastLoginAt: string }[]
  addresses: MyAddress[]
  identityVerified: boolean
  phoneVerified: boolean
  consents: Record<string, { agreed: boolean; at: string }>
}

async function call(method: string, path: string, body?: unknown) {
  try {
    const res = await apiFetch(path, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok && json.success !== false, status: res.status, json }
  } catch {
    return { ok: false, status: 0, json: { error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." } }
  }
}

type InfoResult = { success: true; info: MyInfo } | { success: false; error: string; status: number }
const infoOf = (r: Awaited<ReturnType<typeof call>>): InfoResult =>
  r.ok ? { success: true, info: r.json as MyInfo } : { success: false, error: r.json.error || "요청을 처리하지 못했습니다.", status: r.status }

export const getMyInfo = async () => infoOf(await call("GET", "/api/users/me/info"))
export const updateMyProfile = async (input: Partial<Pick<MyInfo["profile"], "realName" | "birthDate" | "gender" | "region" | "bio" | "interests">> & { name?: string; avatarUrl?: string | null }) =>
  infoOf(await call("PUT", "/api/users/me/profile", input))
export const changeMyPhone = async (phone: string | null) => {
  const r = await call("PUT", "/api/users/me/phone", { phone })
  return r.ok ? infoOf(r) : { success: false as const, error: r.json.error || "번호를 바꾸지 못했습니다.", status: r.status, loginMethods: r.json.loginMethods as string[] | undefined }
}
export const updateMyConsents = async (changes: Record<string, boolean>) => {
  const r = await call("PUT", "/api/users/me/consents", changes)
  return r.ok ? { success: true as const } : { success: false as const, error: r.json.error || "변경하지 못했습니다." }
}

type AddressResult = { success: true; address: MyAddress } | { success: false; error: string }
const addressOf = (r: Awaited<ReturnType<typeof call>>): AddressResult =>
  r.ok ? { success: true, address: r.json.address as MyAddress } : { success: false, error: r.json.error || "배송지를 저장하지 못했습니다." }
export const addMyAddress = async (a: AddressForm) => addressOf(await call("POST", "/api/users/me/addresses", a))
export const updateMyAddress = async (id: number, a: AddressForm) => addressOf(await call("PUT", `/api/users/me/addresses/${id}`, a))
export const deleteMyAddress = async (id: number) => {
  const r = await call("DELETE", `/api/users/me/addresses/${id}`)
  return r.ok ? { success: true as const } : { success: false as const, error: r.json.error || "배송지를 지우지 못했습니다." }
}

export async function getMyVerification(): Promise<VerificationInfo | null> {
  const r = await call("GET", "/api/users/me/verification")
  return r.ok ? (r.json as VerificationInfo) : null
}

// 연동: 서버에 연동표를 받은 뒤 붙일 수단으로 로그인하면 서버가 지금 회원에 붙이고 세션을 되돌림
export const LINK_RETURN_KEY = "dukji_link_return"
export async function startLink() {
  const r = await call("POST", "/api/users/me/identities/link")
  if (r.ok) sessionStorage.setItem(LINK_RETURN_KEY, window.location.pathname)
  return r.ok ? { success: true as const } : { success: false as const, error: r.json.error || "연동을 시작하지 못했습니다." }
}
export async function endLink() {
  sessionStorage.removeItem(LINK_RETURN_KEY)
  await call("DELETE", "/api/users/me/identities/link")
}
export const unlinkProvider = async (provider: string) => infoOf(await call("DELETE", `/api/users/me/identities/${encodeURIComponent(provider)}`))

import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono, type Context } from "hono"
import { config } from "../../shared/config"
import {
  clearMemberSessionCookie,
  isMemberSessionConfigured,
  setMemberSessionCookie,
  type Member,
} from "../../shared/auth/member-session"
import { getOptionalMember } from "../../shared/auth/require-member"
import { clearAdminSessionCookie } from "../../shared/auth/admin-session"
import {
  IDENTITY_COOKIE,
  IDENTITY_COOKIE_MAX_AGE,
  setMemberExtraCookie,
  setSealedCookie,
  SMS_TICKET_COOKIE,
  takeSealedCookie,
  type MemberExtra,
  type SmsTicket,
} from "../../shared/auth/member-extra"
import { sendSms, SmsError } from "./sms"
import { fetchIdentity, IdentityError } from "./identity"
import * as cognito from "./cognito"
import { paymentRoute } from "./payment"
import { AppleTokenError, isAppleConfigured, verifyAppleIdToken } from "./apple"

// 소셜 로그인 (VPC 밖 Lambda: 외부 API 호출 O, DB X)
// 각 회사에서 받은 토큰을 서버가 직접 검증한 뒤 회원 세션 쿠키를 발급합니다.
// 회원 DB 기록은 프론트가 로그인 직후 부르는 POST /api/users/me (users 서비스, VPC 안) 가 합니다.

export const authRoute = new Hono()

// DP 충전 결제 확인 (포트원 조회, payment.ts)
authRoute.route("/payments", paymentRoute)

// extra: 동의받은 추가 정보. 세션에는 넣지 않고 암호화 쿠키로 users 서비스(/api/users/me)에 넘김
const login = (c: Context, member: Member, extra: MemberExtra = {}) => {
  if (!isMemberSessionConfigured()) {
    return c.json({ success: false, error: "회원 로그인이 아직 설정되지 않았습니다. (MEMBER_SESSION_SECRET)" }, 503)
  }
  setMemberSessionCookie(c, member)
  setMemberExtraCookie(c, extra)
  return c.json({ success: true, user: member })
}

// 동의 항목이 없으면 undefined 로 빠짐
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
// +82 10-1234-5678 / 010-1234-5678 → 01012345678
const normalizePhone = (v: unknown) => {
  const raw = str(v)
  if (!raw) return undefined
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+82/, "0")
  return /^0\d{8,10}$/.test(digits) ? digits : undefined
}
const normalizeGender = (v: unknown): MemberExtra["gender"] => {
  const g = str(v)?.toLowerCase()
  return g === "female" || g === "f" ? "female" : g === "male" || g === "m" ? "male" : undefined
}
const compact = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

// 카카오 배송지 (동의한 경우에만 응답, 아니면 무시)
async function fetchKakaoShipping(headers: Record<string, string>): Promise<MemberExtra["shippingAddress"]> {
  try {
    const res = await fetch("https://kapi.kakao.com/v1/user/shipping_address", { headers })
    if (!res.ok) return undefined
    const data = await res.json()
    const list: any[] = data.shipping_addresses || []
    const a = list.find((x) => x.is_default) || list[0]
    if (!a?.base_address || !a?.zone_number) return undefined
    return compact({
      recipient: str(a.receiver_name) || "",
      phone: normalizePhone(a.receiver_phone_number1) || "",
      zipCode: String(a.zone_number),
      address1: String(a.base_address),
      address2: str(a.detail_address),
    })
  } catch {
    return undefined
  }
}

// 현재 로그인한 회원 (쿠키 기준)
authRoute.get("/me", (c) => {
  const member = getOptionalMember(c)
  return c.json({ success: true, authenticated: Boolean(member), user: member })
})

// 로그아웃 (관리자 회원이면 관리자 세션도 함께 끝냄)
authRoute.delete("/session", (c) => {
  clearMemberSessionCookie(c)
  clearAdminSessionCookie(c)
  return c.json({ success: true })
})

// 카카오 로그인: 프론트 SDK 가 받은 액세스 토큰 → 우리 앱 토큰인지 확인 → 프로필
authRoute.post("/kakao", async (c) => {
  const { accessToken } = await c.req.json<{ accessToken?: string }>().catch(() => ({ accessToken: undefined }))
  if (!accessToken) return c.json({ success: false, error: "액세스 토큰이 없습니다." }, 400)
  const headers = { Authorization: `Bearer ${accessToken}` }

  const infoRes = await fetch("https://kapi.kakao.com/v1/user/access_token_info", { headers })
  if (!infoRes.ok) return c.json({ success: false, error: "카카오 토큰이 유효하지 않습니다." }, 401)
  const info = await infoRes.json()
  // 운영에서는 앱 ID 가 꼭 있어야 함 (다른 앱에서 발급된 토큰으로 로그인하는 것 방지)
  if ((config.kakaoAppId || config.isProduction) && String(info.app_id) !== config.kakaoAppId) {
    return c.json({ success: false, error: "다른 앱에서 발급된 카카오 토큰입니다." }, 401)
  }

  const meRes = await fetch("https://kapi.kakao.com/v2/user/me?secure_resource=true", { headers })
  if (!meRes.ok) return c.json({ success: false, error: "카카오 프로필 조회에 실패했습니다." }, 400)
  const me = await meRes.json()
  const account = me.kakao_account || {}
  const profile = account.profile || {}
  return login(
    c,
    {
      id: `kakao-${me.id}`,
      name: profile.nickname || me.properties?.nickname || "카카오 회원",
      email: account.email || `kakao_${me.id}@dukji.kr`,
      // https 사진 주소 (http 면 사이트에 '주의 요함'이 뜸)
      avatarUrl: (profile.profile_image_url || profile.thumbnail_image_url || "").replace(/^http:\/\//, "https://") || undefined,
      provider: "kakao",
      emailVerified: Boolean(account.email && account.is_email_valid && account.is_email_verified),
    },
    compact({
      realName: str(account.name),
      phone: normalizePhone(account.phone_number),
      birthYear: str(account.birthyear),
      birthday: str(account.birthday),
      gender: normalizeGender(account.gender),
      ageRange: str(account.age_range),
      shippingAddress: await fetchKakaoShipping(headers),
    })
  )
})

// 구글 로그인: 프론트 GIS 가 받은 액세스 토큰 → 우리 클라이언트 ID 로 발급됐는지 확인 → 프로필
// 덕지 앱(안드로이드·iOS 구글 로그인)은 ID 토큰을 보냄. 앱도 웹 클라이언트 ID 로 토큰을 받아서 aud 가 같음
authRoute.post("/google", async (c) => {
  const { accessToken, idToken } = await c.req
    .json<{ accessToken?: string; idToken?: string }>()
    .catch(() => ({ accessToken: undefined, idToken: undefined }))
  if (typeof idToken === "string" && idToken) return googleIdTokenLogin(c, idToken)
  if (!accessToken) return c.json({ success: false, error: "액세스 토큰이 없습니다." }, 400)

  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
  if (!infoRes.ok) return c.json({ success: false, error: "구글 토큰이 유효하지 않습니다." }, 401)
  const info = await infoRes.json()
  if ((config.googleClientId || config.isProduction) && info.aud !== config.googleClientId) {
    return c.json({ success: false, error: "다른 앱에서 발급된 구글 토큰입니다." }, 401)
  }

  const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!meRes.ok) return c.json({ success: false, error: "구글 프로필 조회에 실패했습니다." }, 400)
  const me = await meRes.json()
  if (!me.sub || !me.email) return c.json({ success: false, error: "구글 사용자 정보를 가져오지 못했습니다." }, 400)
  return login(c, {
    id: `google-${me.sub}`,
    name: me.name || me.given_name || "구글 회원",
    email: me.email,
    avatarUrl: me.picture || undefined,
    provider: "google",
    emailVerified: me.email_verified === true || me.email_verified === "true",
  })
})

// 구글 ID 토큰: 구글 tokeninfo 가 서명·만료를 확인해 줌 → 발급처·우리 클라이언트 ID 확인
async function googleIdTokenLogin(c: Context, idToken: string) {
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
  if (!infoRes.ok) return c.json({ success: false, error: "구글 토큰이 유효하지 않습니다." }, 401)
  const info = await infoRes.json()
  if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
    return c.json({ success: false, error: "구글 토큰이 유효하지 않습니다." }, 401)
  }
  if ((config.googleClientId || config.isProduction) && info.aud !== config.googleClientId) {
    return c.json({ success: false, error: "다른 앱에서 발급된 구글 토큰입니다." }, 401)
  }
  if (!info.sub || !info.email) return c.json({ success: false, error: "구글 사용자 정보를 가져오지 못했습니다." }, 400)
  return login(c, {
    id: `google-${info.sub}`,
    name: info.name || info.given_name || "구글 회원",
    email: info.email,
    avatarUrl: info.picture || undefined,
    provider: "google",
    emailVerified: info.email_verified === true || info.email_verified === "true",
  })
}

// 애플 로그인: 애플 JS(웹)·iOS 가 준 identity token → 애플 공개키로 확인 (apple.ts)
// 이름은 애플이 처음 로그인할 때만 화면에 한 번 주므로 프론트가 같이 보냄 (없으면 '애플 회원')
authRoute.post("/apple", async (c) => {
  if (!isAppleConfigured()) return c.json({ success: false, error: "애플 로그인이 아직 설정되지 않았습니다." }, 503)
  const body = await c.req.json<{ idToken?: string; nonce?: string; name?: string }>().catch(() => ({} as { idToken?: string; nonce?: string; name?: string }))
  if (!body.idToken || typeof body.idToken !== "string") return c.json({ success: false, error: "애플 토큰이 없습니다." }, 400)
  try {
    const claims = await verifyAppleIdToken(body.idToken, typeof body.nonce === "string" ? body.nonce : undefined)
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 20) : ""
    return login(c, {
      id: `apple-${claims.sub}`,
      name: name || "애플 회원",
      // 이메일 범위를 거부하면 이메일이 없음 → 가입 화면에서 직접 입력
      email: claims.email || `apple_${claims.sub.replace(/[^A-Za-z0-9]/g, "").slice(0, 40)}@dukji.kr`,
      provider: "apple",
      // 대리 주소(이메일 가리기)는 다른 계정과 자동으로 합치지 않음
      emailVerified: Boolean(claims.email && claims.emailVerified && !claims.isPrivateEmail),
    })
  } catch (e) {
    if (e instanceof AppleTokenError) return c.json({ success: false, error: e.message }, 401)
    throw e
  }
})

// 네이버 액세스 토큰 → 프로필 → 회원 세션
async function naverProfileLogin(c: Context, accessToken: string) {
  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profileData = await profileRes.json()

  if (profileData.resultcode !== "00" || !profileData.response) {
    console.error("Naver profile error:", profileData)
    return c.json({ error: profileData.message || "프로필 조회에 실패했습니다." }, 400)
  }

  const naverUser = profileData.response
  // 네이버 이메일은 회원이 바꿀 수 있는 연락처 메일이라 인증된 이메일로 보지 않음 (자동 계정 합치기 제외)
  return login(
    c,
    {
      id: `naver-${naverUser.id}`,
      name: naverUser.name || naverUser.nickname || "네이버 회원",
      email: naverUser.email || `naver_${naverUser.id}@dukji.kr`,
      avatarUrl: naverUser.profile_image || undefined,
      provider: "naver",
      emailVerified: false,
    },
    compact({
      realName: str(naverUser.name),
      phone: normalizePhone(naverUser.mobile),
      birthYear: str(naverUser.birthyear),
      birthday: str(naverUser.birthday)?.replace("-", ""),
      gender: normalizeGender(naverUser.gender),
      ageRange: str(naverUser.age)?.replace("-", "~"),
    })
  )
}

// 네이버 로그인: 인가 코드 → 토큰 → 프로필
// 덕지 앱(네이버 SDK)은 액세스 토큰을 보냄 → 우리 네이버 앱에서 발급된 토큰인지 확인 → 프로필
authRoute.post("/naver", async (c) => {
  try {
    const { code, state, accessToken } = await c.req.json<{ code?: string; state?: string; accessToken?: string }>()

    if (typeof accessToken === "string" && accessToken) {
      const verifyRes = await fetch("https://openapi.naver.com/v1/nid/verify?info=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const verify = await verifyRes.json().catch(() => ({}))
      if (verifyRes.status === 401) return c.json({ success: false, error: "네이버 토큰이 유효하지 않습니다." }, 401)
      // 토큰 확인 응답에 발급한 앱(client_id)이 있으면 우리 앱인지 봄. 토큰 자체는 아래 프로필 조회가 다시 확인
      const clientId = verify?.response?.client_id
      if (clientId && clientId !== config.naverClientId) {
        return c.json({ success: false, error: "다른 앱에서 발급된 네이버 토큰입니다." }, 401)
      }
      return naverProfileLogin(c, accessToken)
    }

    if (!code) {
      return c.json({ error: "인가 코드가 없습니다." }, 400)
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.naverClientId,
      client_secret: config.naverClientSecret,
      code,
      state: state || "",
    })

    const tokenRes = await fetch(`https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`)
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error("Naver token error:", tokenData)
      return c.json({ error: tokenData.error_description || "토큰 발급에 실패했습니다." }, 400)
    }

    return naverProfileLogin(c, tokenData.access_token)
  } catch (error: any) {
    console.error("Naver auth error:", error)
    return c.json({ error: error?.message || "서버 오류가 발생했습니다." }, 500)
  }
})

// ---------------------------------------------------------------------------
// 이메일 가입·로그인 (Cognito)
// 가입 → 메일로 받은 인증 코드 확인 → 로그인 순서. 로그인하면 소셜과 같은 회원 세션을 발급하고,
// 프론트가 POST /api/users/me 를 불러 회원 DB 에 기록합니다 (같은 이메일 회원이 있으면 로그인 수단으로 연결).
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIGNUP_PENDING_COOKIE = "dukji_signup_pending"

const cognitoMessages: Record<string, [number, string]> = {
  UsernameExistsException: [409, "이미 가입된 이메일입니다. 로그인해주세요."],
  InvalidPasswordException: [400, "비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다."],
  CodeMismatchException: [400, "인증 코드가 올바르지 않습니다."],
  ExpiredCodeException: [400, "인증 코드가 만료되었습니다. 코드를 다시 받아주세요."],
  NotAuthorizedException: [401, "이메일 또는 비밀번호가 올바르지 않습니다."],
  UserNotFoundException: [401, "이메일 또는 비밀번호가 올바르지 않습니다."],
  UserNotConfirmedException: [403, "이메일 인증이 아직 끝나지 않았습니다. 메일로 받은 인증 코드를 입력해주세요."],
  LimitExceededException: [429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."],
  TooManyRequestsException: [429, "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."],
  TooManyFailedAttemptsException: [429, "시도 횟수를 넘었습니다. 잠시 후 다시 시도해주세요."],
  CodeDeliveryFailureException: [502, "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요."],
}

const cognitoFail = (c: Context, e: unknown) => {
  if (!(e instanceof cognito.CognitoError)) throw e
  const [status, error] = cognitoMessages[e.type] || [400, "요청을 처리하지 못했습니다."]
  if (!cognitoMessages[e.type]) console.warn("cognito error", e.type, e.message)
  const code = e.type === "UserNotConfirmedException" ? "needs_confirmation" : undefined
  return c.json({ success: false, error, code }, status as 400)
}

const readBody = async (c: Context) => (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
const emailOf = (b: Record<string, unknown>) => (typeof b.email === "string" ? b.email.trim().toLowerCase() : "")
const textOf = (v: unknown) => (typeof v === "string" ? v : "")

// Cognito 가 없으면(로컬 개발) 프론트가 예전 /api/users/email/* 로 돌아가도록 알려줌
authRoute.use("/email/*", async (c, next) => {
  if (!cognito.isCognitoConfigured()) {
    return c.json({ success: false, code: "cognito_disabled", error: "이메일 가입이 아직 설정되지 않았습니다." }, 503)
  }
  await next()
})

// 인증·재설정 메일을 보내는 요청은 IP 당 1시간 20번까지 (auth 는 DB 없이 돌아서 Lambda 인스턴스별로 셈, Cognito 자체 제한도 같이 걸림)
const mailQuota = async (c: Context, next: () => Promise<void>) => {
  if (!(await consumeQuota("auth-mail", clientIp(c), 20, 3600)))
    return c.json({ success: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429)
  await next()
}
authRoute.use("/email/signup", mailQuota)
authRoute.use("/email/resend", mailQuota)
authRoute.use("/email/forgot", mailQuota)

authRoute.post("/email/signup", async (c) => {
  const b = await readBody(c)
  const email = emailOf(b)
  const password = textOf(b.password)
  const name = textOf(b.name).trim()
  const agreements = (b.agreements || {}) as Record<string, unknown>
  if (!EMAIL_RE.test(email) || email.length > 150) return c.json({ success: false, error: "올바른 이메일 주소를 입력해주세요." }, 400)
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return c.json({ success: false, error: "비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다." }, 400)
  }
  if (name.length < 2 || name.length > 20) return c.json({ success: false, error: "닉네임은 2~20자여야 합니다." }, 400)
  if (agreements.age !== true || agreements.terms !== true || agreements.privacy !== true) {
    return c.json({ success: false, error: "필수 약관에 모두 동의해주세요." }, 400)
  }
  let existing = false
  try {
    await cognito.signUp(email, password, name)
  } catch (e) {
    // 가입만 하고 메일 인증을 못 마친 이메일: 코드를 다시 보내고 인증 단계로 이어 줌
    // (이미 인증을 마친 계정이면 ResendConfirmationCode 가 실패해서 원래대로 '이미 가입됨')
    if (!(e instanceof cognito.CognitoError && e.type === "UsernameExistsException")) return cognitoFail(c, e)
    try {
      await cognito.resendCode(email)
      existing = true
    } catch {
      return cognitoFail(c, e)
    }
  }
  // 동의 내역은 인증 후 첫 로그인 때 회원 DB 에 기록 (1시간 안에 같은 브라우저에서 로그인하는 경우)
  setSealedCookie(
    c,
    SIGNUP_PENDING_COOKIE,
    {
      email,
      consents: { age_14: true, terms: true, privacy_required: true, marketing_email: agreements.marketing === true },
    },
    60 * 60
  )
  return c.json({ success: true, needsConfirmation: true, existing })
})

authRoute.post("/email/confirm", async (c) => {
  const b = await readBody(c)
  const code = textOf(b.code).trim()
  if (!emailOf(b) || !/^\d{4,8}$/.test(code)) return c.json({ success: false, error: "인증 코드를 확인해주세요." }, 400)
  try {
    await cognito.confirmSignUp(emailOf(b), code)
    return c.json({ success: true })
  } catch (e) {
    return cognitoFail(c, e)
  }
})

authRoute.post("/email/resend", async (c) => {
  const b = await readBody(c)
  if (!emailOf(b)) return c.json({ success: false, error: "이메일을 입력해주세요." }, 400)
  try {
    await cognito.resendCode(emailOf(b))
  } catch (e) {
    // 가입하지 않은 이메일인지 알려주지 않음
    if (!(e instanceof cognito.CognitoError && e.type === "UserNotFoundException")) return cognitoFail(c, e)
  }
  return c.json({ success: true })
})

authRoute.post("/email/login", async (c) => {
  const b = await readBody(c)
  const email = emailOf(b)
  const password = textOf(b.password)
  if (!email || !password) return c.json({ success: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401)
  let identity: cognito.CognitoIdentity
  try {
    ;({ identity } = await cognito.passwordLogin(email, password))
  } catch (e) {
    return cognitoFail(c, e)
  }
  const pending = takeSealedCookie<{ email: string; consents: Record<string, boolean> }>(c, SIGNUP_PENDING_COOKIE)
  return login(
    c,
    {
      id: `cognito-${identity.sub}`,
      name: identity.name || identity.email.split("@")[0],
      email: identity.email,
      provider: "cognito",
      emailVerified: identity.emailVerified,
    },
    pending?.email === identity.email ? { consents: pending.consents } : {}
  )
})

authRoute.post("/email/forgot", async (c) => {
  const b = await readBody(c)
  if (!emailOf(b)) return c.json({ success: false, error: "이메일을 입력해주세요." }, 400)
  try {
    await cognito.forgotPassword(emailOf(b))
  } catch (e) {
    if (!(e instanceof cognito.CognitoError && e.type === "UserNotFoundException")) return cognitoFail(c, e)
  }
  return c.json({ success: true })
})

authRoute.post("/email/reset", async (c) => {
  const b = await readBody(c)
  const password = textOf(b.password)
  const code = textOf(b.code).trim()
  if (!emailOf(b) || !code) return c.json({ success: false, error: "인증 코드를 확인해주세요." }, 400)
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return c.json({ success: false, error: "비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다." }, 400)
  }
  try {
    await cognito.confirmForgotPassword(emailOf(b), code, password)
    return c.json({ success: true })
  } catch (e) {
    return cognitoFail(c, e)
  }
})

// 회원 탈퇴 전 이메일 로그인 계정 삭제 (본인 비밀번호 확인). 회원 DB 탈퇴는 DELETE /api/users/me
authRoute.post("/email/delete", async (c) => {
  const b = await readBody(c)
  try {
    const { accessToken } = await cognito.passwordLogin(emailOf(b), textOf(b.password))
    await cognito.deleteUser(accessToken)
    return c.json({ success: true })
  } catch (e) {
    return cognitoFail(c, e)
  }
})

// ---------------------------------------------------------------------------
// 회원가입 휴대폰 인증 문자 보내기
// users 서비스(POST /api/users/signup/phone/send)가 인증번호를 DB 에 기록하고 암호화한 발송표 쿠키를 주면,
// 여기서 그 쿠키를 읽어 문자를 보냅니다 (users 는 VPC 안이라 외부로 못 나감). 브라우저는 번호를 볼 수 없음.
// ---------------------------------------------------------------------------
authRoute.post("/phone/send", async (c) => {
  const ticket = takeSealedCookie<SmsTicket>(c, SMS_TICKET_COOKIE)
  if (!ticket?.phone || !/^\d{6}$/.test(ticket.code || "")) {
    return c.json({ success: false, error: "인증번호를 다시 요청해주세요." }, 400)
  }
  try {
    await sendSms(ticket.phone, `[덕지] 인증번호 [${ticket.code}]를 입력해주세요.`)
    return c.json({ success: true })
  } catch (e) {
    if (e instanceof SmsError) return c.json({ success: false, error: e.message }, 503)
    throw e
  }
})

// ---------------------------------------------------------------------------
// 본인인증 결과 확인 (가입·휴대폰 변경)
// 포트원에서 결과를 직접 조회해 암호화 쿠키(30분)로 users 서비스에 넘김. 브라우저에는 이름·생년월일만 보여 줌
// ---------------------------------------------------------------------------
authRoute.post("/identity/verify", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const id = typeof body.identityVerificationId === "string" ? body.identityVerificationId.trim() : ""
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return c.json({ success: false, error: "본인인증을 다시 진행해주세요." }, 400)
  try {
    const identity = await fetchIdentity(id)
    setSealedCookie(c, IDENTITY_COOKIE, identity, IDENTITY_COOKIE_MAX_AGE)
    return c.json({
      success: true,
      name: identity.name,
      birthDate: identity.birthDate,
      phone: identity.phone.replace(/^(\d{3})\d+(\d{4})$/, "$1-****-$2"),
    })
  } catch (e) {
    if (e instanceof IdentityError) return c.json({ success: false, error: e.message }, e.status)
    throw e
  }
})

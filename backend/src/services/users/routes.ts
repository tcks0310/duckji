import { Hono } from "hono"
import { DuplicateEmailError, usersRepository } from "./repository"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getCookie } from "hono/cookie"
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  isAdminConfigured,
  readAdminSession,
  setAdminSessionCookie,
} from "../../shared/auth/admin-session"
import { requireMember, requireMemberSession, type MemberEnv } from "../../shared/auth/require-member"
import { clearMemberSessionCookie, isMemberSessionConfigured, setMemberSessionCookie } from "../../shared/auth/member-session"
import {
  IDENTITY_COOKIE,
  LINK_COOKIE,
  LINK_COOKIE_MAX_AGE,
  readSealedCookie,
  setSealedCookie,
  takeSealedCookie,
  type IdentityResult,
  type LinkTicket,
  SIGNUP_COOKIE,
  SIGNUP_COOKIE_MAX_AGE,
  SMS_TICKET_COOKIE,
  takeMemberExtraCookie,
} from "../../shared/auth/member-extra"
import { deleteCookie } from "hono/cookie"
import { config } from "../../shared/config"
import { db, requireDatabase } from "../../shared/db/require-database"
import { pool } from "../../shared/db/pool"
import {
  addAddress,
  deleteAddress,
  getMemberForAdmin,
  getMemberInfo,
  OPTIONAL_CONSENTS,
  resolveLogin,
  sanctionOf,
  setMemberRole,
  updateAddress,
  updateConsents,
  updateProfile,
  withdraw,
  hasOrdersInProgress,
  type AddressInput,
  type ProfileInput,
} from "./members"
import { MemberDataKeyMissingError } from "./crypto"
import { serviceDpRoute } from "./service-points"
import { hashPassword, verifyPassword } from "./password"
import {
  changePhone,
  completeSignup,
  isSmsEnabled,
  verificationMode,
  loginKeyOf,
  SignupError,
  startPhoneVerification,
  verifyPhoneCode,
  type PendingSignup,
} from "./signup"
import type { DukjiUser } from "./types"
import { adminSavedStatsRoute, savedItemsRoute } from "./saved-items"
import { adminPointsRoute, memberPointsRoute } from "./points"
import { memberChargesRoute } from "./charges"
import { ReferralError, referralRoute } from "./referral"
import { adminMembersRoute } from "./sanctions"
import { adminAdMessagesRoute } from "./ad-messages"
import { adminNotificationsRoute, memberNotificationsRoute } from "./notifications"
import { memberPushDevicesRoute, servicePushRoute } from "./push"
import { linkIdentity, LinkError, unlinkIdentity } from "./links"
import { isAppRequest } from "../../shared/app-client"

export const usersRoute = new Hono<MemberEnv>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const toMember = (u: DukjiUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  provider: u.provider,
})

// 회원 목록(이름·이메일)은 관리자만 조회 가능
usersRoute.get("/", requireAdmin, async (c) => {
  const users = await usersRepository.list({
    query: c.req.query("q"),
    provider: c.req.query("provider"),
  })
  return c.json({ success: true, users, total: users.length })
})

// 로그인 직후 회원 정보 동기화: 서버가 발급한 세션 쿠키의 회원 정보로만 기록 (요청 본문은 믿지 않음)
// DB 가 있으면 로그인 수단으로 회원을 찾고, 같은 인증 이메일의 회원이 있으면 그 계정에 로그인 수단을 연결함
usersRoute.post("/me", requireMemberSession, async (c) => {
  const member = c.get("member")
  const extra = takeMemberExtraCookie(c)
  // 마이페이지에서 연동을 시작했으면: 방금 로그인한 수단을 원래 회원에 붙이고 세션을 원래 회원으로 되돌림
  const link = takeSealedCookie<LinkTicket>(c, LINK_COOKIE)
  if (link?.memberId && pool) {
    try {
      const user = await linkIdentity(link.memberId, member)
      setMemberSessionCookie(c, { ...toMember(user), emailVerified: user.emailVerified })
      return c.json({ success: true, user, linked: true, linkedProvider: member.provider })
    } catch (e) {
      if (!(e instanceof LinkError)) throw e
      // 연동 실패: 원래 회원 세션 복구 (탈퇴 등으로 회원이 없으면 로그아웃)
      const { rows } = await db().query<{ id: string; name: string; email: string; avatar_url: string | null; provider: DukjiUser["provider"]; email_verified: boolean }>(
        "SELECT id, name, email, avatar_url, provider, email_verified FROM dukji_users WHERE id = $1 AND status <> 'withdrawn'",
        [link.memberId]
      )
      const u = rows[0]
      if (u) {
        setMemberSessionCookie(c, { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url || undefined, provider: u.provider, emailVerified: u.email_verified })
      } else clearMemberSessionCookie(c)
      return c.json({ success: false, code: "link_failed", error: e.message }, e.status)
    }
  }
  const result = pool
    ? await resolveLogin(member, extra).catch(async (e) => {
        // 표·칸이 없을 때(회원 원장 테이블·컬럼 없음)에는 예전 방식으로 기록
        if (e?.code !== "42P01" && e?.code !== "42703") throw e
        return { user: await usersRepository.upsert(member), linked: false }
      })
    : { user: await usersRepository.upsert(member), linked: false }
  // 처음 쓰는 로그인 수단이거나 가입 정보를 아직 안 넣은 회원: 로그인 세션 대신 가입 대기 쿠키를 두고 가입 페이지로
  if ("pending" in result) {
    const pending: PendingSignup = { member, extra, memberId: result.memberId }
    setSealedCookie(c, SIGNUP_COOKIE, pending, SIGNUP_COOKIE_MAX_AGE)
    clearMemberSessionCookie(c)
    return c.json({ success: false, code: "signup_required", error: "회원가입 정보를 입력해주세요." })
  }
  const { user, linked } = result
  if (user.status === "banned" || user.status === "withdrawn") {
    clearMemberSessionCookie(c)
    return c.json({ success: false, code: "member_banned", error: "이용이 정지된 계정입니다." }, 403)
  }
  if (user.status === "suspended") {
    clearMemberSessionCookie(c)
    const { until, reason } = await sanctionOf(user.id)
    const untilText = until ? `${new Date(until).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}까지 ` : ""
    return c.json(
      { success: false, code: "member_suspended", until, reason, error: `${untilText}이용이 정지된 계정입니다.${reason ? ` (사유: ${reason})` : ""}` },
      403
    )
  }
  // 다른 회원에 연결됐으면 그 회원으로 세션을 다시 발급
  if (user.id !== member.id) setMemberSessionCookie(c, { ...toMember(user), emailVerified: user.emailVerified })
  // 관리자 역할 회원이면 관리자 세션 발급, 아니면 남아 있던 관리자 세션을 지움 (비상용 계정 세션은 유지)
  if (user.role === "admin" && isAdminConfigured()) {
    setAdminSessionCookie(c, user.id)
  } else if (readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId) {
    clearAdminSessionCookie(c)
  }
  return c.json({ success: true, user, linked })
})

// ---- 내 찜·장바구니 ----
usersRoute.route("/me/saved", savedItemsRoute)

// ---- 덕지 포인트(DP) ----
usersRoute.route("/me/points/charges", memberChargesRoute)
usersRoute.route("/me/points", memberPointsRoute)
usersRoute.route("/service/dp", serviceDpRoute) // 다른 서비스의 서명된 DP 결제·환불

// ---- 친구 추천 (추천 ID 확인 · 내 추천 ID) ----
usersRoute.route("/referral", referralRoute)
usersRoute.route("/admin/points", adminPointsRoute)
usersRoute.route("/admin/saved-stats", adminSavedStatsRoute)
usersRoute.route("/admin/ad-messages", adminAdMessagesRoute)
usersRoute.route("/me/notifications", memberNotificationsRoute)
usersRoute.route("/admin/notifications", adminNotificationsRoute)
usersRoute.route("/me/push-devices", memberPushDevicesRoute) // 덕지 앱 푸시 기기
usersRoute.route("/service/push", servicePushRoute) // push 서비스(VPC 밖)가 서명한 호출로 보낼 알림을 받아 감

// ---- 내 회원 정보 (마이페이지) ----

const PHONE_RE = /^0\d{8,10}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isValidDate = (v: string) => DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)
const optText = (v: unknown, max: number): string | null | undefined | false => {
  if (v === undefined) return undefined
  if (v === null || v === "") return null
  return typeof v === "string" && v.trim().length <= max ? v.trim() : false
}
const digits = (v: unknown) => (typeof v === "string" ? v.replace(/[^\d]/g, "") : v)

// 프로필 사진 주소 확인: 기본 이미지, 운영 이미지 도메인의 게시판 업로드, 개발 환경의 로컬 업로드
function isAllowedAvatar(url: string) {
  if (url.length > 500) return false
  if (/^\/images\/(avatar|npc)\/[a-z0-9_-]+\.(jpg|png|webp)$/.test(url)) return true
  if (/^https:\/\/img\.duckji\.com\/board\/[\w./-]+$/.test(url) && !url.includes("..")) return true
  return !config.isProduction && url.startsWith(`${config.uploadPublicBaseUrl}/`) && !url.includes("..")
}

function parseProfile(body: Record<string, unknown>): { input: ProfileInput } | { error: string } {
  const input: ProfileInput = {}
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length < 2 || name.length > 20) return { error: "닉네임은 2~20자여야 합니다." }
    input.name = name
  }
  const realName = optText(body.realName, 30)
  if (realName === false) return { error: "이름은 30자 이하여야 합니다." }
  input.realName = realName
  // 휴대폰 번호는 중복 가입 확인에 쓰여 PUT /me/phone 에서 인증을 거쳐서만 바꿈
  if (body.birthDate !== undefined) {
    const v = body.birthDate === "" ? null : body.birthDate
    if (v !== null && (typeof v !== "string" || !isValidDate(v))) return { error: "생년월일은 YYYY-MM-DD 형식이어야 합니다." }
    input.birthDate = v as string | null
  }
  if (body.gender !== undefined) {
    if (body.gender !== null && !["female", "male", "other"].includes(body.gender as string)) return { error: "성별 값이 올바르지 않습니다." }
    input.gender = body.gender as ProfileInput["gender"]
  }
  const region = optText(body.region, 50)
  if (region === false) return { error: "지역은 50자 이하여야 합니다." }
  input.region = region
  const bio = optText(body.bio, 300)
  if (bio === false) return { error: "소개는 300자 이하여야 합니다." }
  input.bio = bio
  if (body.avatarUrl !== undefined) {
    const v = body.avatarUrl === "" ? null : body.avatarUrl
    if (v !== null && (typeof v !== "string" || !isAllowedAvatar(v))) return { error: "프로필 사진은 기본 이미지나 직접 올린 사진만 쓸 수 있습니다." }
    input.avatarUrl = v as string | null
  }
  if (body.interests !== undefined) {
    const list = Array.isArray(body.interests) ? body.interests : null
    if (!list || list.length > 20 || list.some((x) => typeof x !== "string" || !x.trim() || x.length > 40)) {
      return { error: "관심 분야는 40자 이하 항목 20개까지 입력할 수 있습니다." }
    }
    input.interests = [...new Set(list.map((x) => (x as string).trim()))]
  }
  return { input }
}

function parseAddress(body: Record<string, unknown>): { input: AddressInput } | { error: string } {
  const recipient = typeof body.recipient === "string" ? body.recipient.trim() : ""
  const phone = digits(body.phone)
  const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : ""
  const address1 = typeof body.address1 === "string" ? body.address1.trim() : ""
  const address2 = optText(body.address2, 100)
  const label = optText(body.label, 30)
  if (!recipient || recipient.length > 30) return { error: "받는 분 이름을 입력해주세요." }
  if (typeof phone !== "string" || !PHONE_RE.test(phone)) return { error: "연락처 형식이 올바르지 않습니다." }
  if (!/^\d{5}$/.test(zipCode)) return { error: "우편번호는 5자리 숫자여야 합니다." }
  if (!address1 || address1.length > 200) return { error: "주소를 입력해주세요." }
  if (address2 === false || label === false) return { error: "상세주소·배송지 이름이 너무 깁니다." }
  return { input: { recipient, phone, zipCode, address1, address2, label, isDefault: body.isDefault === true } }
}

const keyMissing = (c: any, e: unknown) => {
  if (e instanceof MemberDataKeyMissingError) return c.json({ success: false, error: "회원 정보 저장이 아직 설정되지 않았습니다." }, 503)
  throw e
}

usersRoute.get("/me/info", requireDatabase, requireMember, async (c) => {
  const info = await getMemberInfo(c.get("member").id)
  if (!info) return c.json({ success: false, error: "회원 정보를 찾을 수 없습니다." }, 404)
  return c.json({ success: true, ...info })
})

usersRoute.put("/me/profile", requireDatabase, requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, error: "요청 형식이 올바르지 않습니다." }, 400)
  const parsed = parseProfile(body)
  if ("error" in parsed) return c.json({ success: false, error: parsed.error }, 400)
  // 본인인증한 회원의 이름·생년월일·성별은 인증 결과로 고정
  const { rows: idv } = await db()
    .query<{ verified: boolean }>("SELECT ci_hash IS NOT NULL AS verified FROM dukji_users WHERE id = $1", [c.get("member").id])
    .catch(() => ({ rows: [] as { verified: boolean }[] }))
  if (idv[0]?.verified) {
    delete parsed.input.realName
    delete parsed.input.birthDate
    delete parsed.input.gender
  }
  try {
    await updateProfile(c.get("member").id, parsed.input)
  } catch (e) {
    return keyMissing(c, e)
  }
  const info = await getMemberInfo(c.get("member").id)
  // 상단 메뉴 등에 보이는 이름·사진은 세션 쿠키에서 읽으므로 바뀐 값으로 다시 발급
  if (info && (parsed.input.name !== undefined || parsed.input.avatarUrl !== undefined)) {
    setMemberSessionCookie(c, { ...c.get("member"), name: info.user.name, avatarUrl: info.user.avatarUrl })
  }
  return c.json({ success: true, ...info })
})

usersRoute.post("/me/addresses", requireDatabase, requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const parsed = body ? parseAddress(body) : { error: "요청 형식이 올바르지 않습니다." }
  if ("error" in parsed) return c.json({ success: false, error: parsed.error }, 400)
  try {
    return c.json({ success: true, address: await addAddress(c.get("member").id, parsed.input) }, 201)
  } catch (e: any) {
    if (e?.message?.startsWith("배송지는")) return c.json({ success: false, error: e.message }, 400)
    return keyMissing(c, e)
  }
})

usersRoute.put("/me/addresses/:id", requireDatabase, requireMember, async (c) => {
  const id = Number(c.req.param("id"))
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const parsed = body ? parseAddress(body) : { error: "요청 형식이 올바르지 않습니다." }
  if ("error" in parsed) return c.json({ success: false, error: parsed.error }, 400)
  try {
    const address = Number.isInteger(id) ? await updateAddress(c.get("member").id, id, parsed.input) : null
    if (!address) return c.json({ success: false, error: "배송지를 찾을 수 없습니다." }, 404)
    return c.json({ success: true, address })
  } catch (e) {
    return keyMissing(c, e)
  }
})

usersRoute.delete("/me/addresses/:id", requireDatabase, requireMember, async (c) => {
  const id = Number(c.req.param("id"))
  const ok = Number.isInteger(id) && (await deleteAddress(c.get("member").id, id))
  if (!ok) return c.json({ success: false, error: "배송지를 찾을 수 없습니다." }, 404)
  return c.json({ success: true })
})

// 선택 동의만 변경 가능 (필수 동의 철회는 탈퇴로)
usersRoute.put("/me/consents", requireDatabase, requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, error: "요청 형식이 올바르지 않습니다." }, 400)
  const changes = Object.fromEntries(
    OPTIONAL_CONSENTS.filter((k) => typeof body[k] === "boolean").map((k) => [k, body[k] as boolean])
  )
  if (!Object.keys(changes).length) return c.json({ success: false, error: "변경할 동의 항목이 없습니다." }, 400)
  return c.json({ success: true, consents: await updateConsents(c.get("member").id, changes) })
})

const ORDERS_IN_PROGRESS = "배송이 끝나지 않은 주문이 있어 지금은 탈퇴할 수 없습니다. 배송 완료 후 다시 시도해 주세요."

// 탈퇴 가능한지 미리 확인 (이메일 회원은 로그인 계정을 지우기 전에 부름)
usersRoute.get("/me/withdraw-check", requireDatabase, requireMember, async (c) => {
  if (await hasOrdersInProgress(c.get("member").id)) return c.json({ success: false, error: ORDERS_IN_PROGRESS }, 409)
  return c.json({ success: true })
})

// 회원 탈퇴
usersRoute.delete("/me", requireDatabase, requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null
  const done = await withdraw(c.get("member").id, reason)
  if (done === "orders_in_progress") {
    return c.json({ success: false, error: ORDERS_IN_PROGRESS }, 409)
  }
  clearMemberSessionCookie(c)
  if (!done) return c.json({ success: false, error: "이미 탈퇴했거나 없는 회원입니다." }, 404)
  return c.json({ success: true })
})

// 이메일 회원가입
usersRoute.post("/email/signup", async (c) => {
  // 운영은 Cognito(/api/auth/email/*)로 가입·로그인. 이 경로는 Cognito 없는 로컬 개발용
  if (process.env.COGNITO_ENABLED === "true") return c.json({ success: false, error: "이메일 가입·로그인 경로가 바뀌었습니다." }, 410)
  if (!isMemberSessionConfigured()) return c.json({ success: false, error: "회원 로그인이 아직 설정되지 않았습니다." }, 503)
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const agreements = (body?.agreements || {}) as Record<string, unknown>

  const errors: string[] = []
  if (!EMAIL_RE.test(email) || email.length > 150) errors.push("올바른 이메일 주소를 입력해주세요.")
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.push("비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.")
  }
  if (name.length < 2 || name.length > 20) errors.push("닉네임은 2~20자여야 합니다.")
  if (agreements.age !== true || agreements.terms !== true || agreements.privacy !== true) {
    errors.push("필수 약관에 모두 동의해주세요.")
  }
  if (errors.length) return c.json({ success: false, error: errors[0], errors }, 400)

  try {
    const user = await usersRepository.createEmailUser({
      email,
      name,
      passwordHash: await hashPassword(password),
      marketingAgreed: agreements.marketing === true,
    })
    setMemberSessionCookie(c, toMember(user))
    return c.json({ success: true, user }, 201)
  } catch (e) {
    if (e instanceof DuplicateEmailError) return c.json({ success: false, error: e.message }, 409)
    throw e
  }
})

// 이메일 로그인
usersRoute.post("/email/login", async (c) => {
  // 운영은 Cognito(/api/auth/email/*)로 가입·로그인. 이 경로는 Cognito 없는 로컬 개발용
  if (process.env.COGNITO_ENABLED === "true") return c.json({ success: false, error: "이메일 가입·로그인 경로가 바뀌었습니다." }, 410)
  if (!isMemberSessionConfigured()) return c.json({ success: false, error: "회원 로그인이 아직 설정되지 않았습니다." }, 503)
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const fail = () => c.json({ success: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." }, 401)
  if (!email || !password) return fail()

  const user = await usersRepository.findByEmail(email)
  const hash = user && user.provider === "email" ? await usersRepository.getPasswordHash(user.id) : null
  if (!user || !hash || !(await verifyPassword(password, hash))) return fail()
  if (user.status === "banned") return c.json({ success: false, error: "이용이 정지된 계정입니다." }, 403)

  const saved = await usersRepository.upsert({ id: user.id }) // 최근 로그인 시각 갱신
  setMemberSessionCookie(c, toMember(saved))
  return c.json({ success: true, user: saved })
})

// ---- 회원가입 완료 (소셜·이메일 로그인 수단을 처음 쓴 경우) ----
// 가입 대기 쿠키(POST /me 가 발급)가 있어야 함. 닉네임·휴대폰·필수 약관을 받아 회원을 만들고 로그인 세션을 발급

const MOBILE_RE = /^01[016789]\d{7,8}$/

// 본인 확인 방식과 포트원 창을 여는 데 필요한 공개 값, 이미 마친 본인인증 결과(가린 값)
const verificationInfo = (c: any) => {
  const mode = verificationMode()
  const identity = mode === "identity" ? readSealedCookie<IdentityResult>(c, IDENTITY_COOKIE) : null
  return {
    verificationMode: mode,
    portone:
      mode === "identity"
        ? { storeId: process.env.PORTONE_STORE_ID || "", channelKey: process.env.PORTONE_CHANNEL_KEY || "" }
        : null,
    identity: identity ? { name: identity.name, birthDate: identity.birthDate, phone: identity.phone.replace(/^(\d{3})\d+(\d{4})$/, "$1-****-$2") } : null,
  }
}

const readPending = (c: any) => readSealedCookie<PendingSignup>(c, SIGNUP_COOKIE)
const noPending = (c: any) =>
  c.json({ success: false, code: "signup_expired", error: "가입 시간이 지났습니다. 다시 로그인해주세요." }, 401)
const signupFail = (c: any, e: unknown) => {
  if (e instanceof SignupError) return c.json({ success: false, error: e.message, ...e.detail }, e.status)
  if (e instanceof ReferralError) return c.json({ success: false, code: "referral_invalid", error: e.message }, e.status)
  return keyMissing(c, e)
}

usersRoute.get("/signup", requireDatabase, async (c) => {
  const pending = readPending(c)
  if (!pending) return noPending(c)
  const m = pending.member
  const realEmail = (v: string | null | undefined) =>
    v && !/@(users\.)?dukji\.kr$/i.test(v) && !/@invalid\.duckji\.com$/i.test(v) ? v : null
  let name = m.name
  let email = realEmail(m.email)
  let reverify = false
  if (pending.memberId) {
    const { rows } = await db().query<{ name: string; email: string; signup_completed_at: Date | null }>(
      "SELECT name, email, signup_completed_at FROM dukji_users WHERE id = $1",
      [pending.memberId]
    )
    const current = rows[0]
    if (current) {
      name = current.name
      email = realEmail(current.email) || email
      // 이미 가입을 마친 회원이 본인인증만 하러 온 경우 (본인인증이 켜지기 전 가입자)
      reverify = Boolean(current.signup_completed_at)
    }
  }
  return c.json({
    success: true,
    provider: m.provider,
    reverify,
    name,
    email,
    phone: pending.extra?.phone || null,
    consents: pending.extra?.consents || null,
    smsEnabled: isSmsEnabled(),
    ...verificationInfo(c),
  })
})

usersRoute.post("/signup/phone/send", requireDatabase, async (c) => {
  const pending = readPending(c)
  if (!pending) return noPending(c)
  if (!isSmsEnabled()) return c.json({ success: false, error: "문자 인증이 아직 준비되지 않았습니다." }, 503)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const phone = digits(body.phone)
  if (typeof phone !== "string" || !MOBILE_RE.test(phone)) return c.json({ success: false, error: "휴대폰 번호를 확인해주세요." }, 400)
  try {
    const code = await startPhoneVerification(loginKeyOf(pending.member), phone)
    // 문자는 auth 서비스(POST /api/auth/phone/send)가 이 발송표를 읽어 보냄
    setSealedCookie(c, SMS_TICKET_COOKIE, { phone, code }, 5 * 60)
    return c.json({ success: true, ...(config.isProduction ? {} : { devCode: code }) })
  } catch (e) {
    return signupFail(c, e)
  }
})

usersRoute.post("/signup/phone/verify", requireDatabase, async (c) => {
  const pending = readPending(c)
  if (!pending) return noPending(c)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const phone = digits(body.phone)
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (typeof phone !== "string" || !MOBILE_RE.test(phone) || !/^\d{6}$/.test(code)) {
    return c.json({ success: false, error: "인증번호 6자리를 입력해주세요." }, 400)
  }
  try {
    await verifyPhoneCode(loginKeyOf(pending.member), phone, code, pending.memberId)
    return c.json({ success: true })
  } catch (e) {
    return signupFail(c, e)
  }
})

usersRoute.post("/signup/complete", requireDatabase, async (c) => {
  const pending = readPending(c)
  if (!pending) return noPending(c)
  if (!isMemberSessionConfigured()) return c.json({ success: false, error: "회원 로그인이 아직 설정되지 않았습니다." }, 503)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null
  const phone = digits(body.phone)
  const agreements = (body.agreements || {}) as Record<string, unknown>
  if (name.length < 2 || name.length > 20) return c.json({ success: false, error: "닉네임은 2~20자여야 합니다." }, 400)
  if (email !== null && (!EMAIL_RE.test(email) || email.length > 150)) {
    return c.json({ success: false, error: "올바른 이메일 주소를 입력해주세요." }, 400)
  }
  const mode = verificationMode()
  const identity = mode === "identity" ? readSealedCookie<IdentityResult>(c, IDENTITY_COOKIE) : null
  if (mode === "identity" && !identity) return c.json({ success: false, code: "identity_required", error: "본인인증을 먼저 완료해주세요." }, 400)
  if (mode !== "identity" && (typeof phone !== "string" || !MOBILE_RE.test(phone))) {
    return c.json({ success: false, error: "휴대폰 번호를 확인해주세요." }, 400)
  }
  if (agreements.age !== true || agreements.terms !== true || agreements.privacy !== true) {
    return c.json({ success: false, error: "필수 약관에 모두 동의해주세요." }, 400)
  }
  try {
    const user = await completeSignup(pending, {
      name,
      email,
      phone: mode === "identity" ? null : (phone as string),
      consents: {
        age_14: true,
        terms: true,
        privacy_required: true,
        marketing_email: agreements.marketing === true,
        marketing_sms: agreements.marketing === true,
      },
      referralCode: typeof body.referralCode === "string" ? body.referralCode : null,
      platform: isAppRequest(c) ? "app" : "web",
    }, identity)
    deleteCookie(c, SIGNUP_COOKIE, { path: "/" })
    deleteCookie(c, IDENTITY_COOKIE, { path: "/" })
    setMemberSessionCookie(c, { ...toMember(user), emailVerified: user.emailVerified })
    return c.json({ success: true, user }, 201)
  } catch (e) {
    return signupFail(c, e)
  }
})

// 가입 취소 (가입 대기 쿠키만 지움, 회원 행은 만들지 않았음)
usersRoute.delete("/signup", (c) => {
  deleteCookie(c, SIGNUP_COOKIE, { path: "/" })
  deleteCookie(c, SMS_TICKET_COOKIE, { path: "/" })
  deleteCookie(c, IDENTITY_COOKIE, { path: "/" })
  return c.json({ success: true })
})

// ---- 마이페이지: 휴대폰 번호 변경 (가입 때와 같은 방식으로 확인) ----

usersRoute.get("/me/verification", requireMember, (c) => c.json({ success: true, smsEnabled: isSmsEnabled(), ...verificationInfo(c) }))

usersRoute.post("/me/phone/send", requireDatabase, requireMember, async (c) => {
  if (!isSmsEnabled()) return c.json({ success: false, error: "문자 인증이 아직 준비되지 않았습니다." }, 503)
  const phone = digits((await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)).phone)
  if (typeof phone !== "string" || !MOBILE_RE.test(phone)) return c.json({ success: false, error: "휴대폰 번호를 확인해주세요." }, 400)
  try {
    const code = await startPhoneVerification(`member:${c.get("member").id}`, phone)
    setSealedCookie(c, SMS_TICKET_COOKIE, { phone, code }, 5 * 60)
    return c.json({ success: true, ...(config.isProduction ? {} : { devCode: code }) })
  } catch (e) {
    return signupFail(c, e)
  }
})

usersRoute.post("/me/phone/verify", requireDatabase, requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const phone = digits(body.phone)
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (typeof phone !== "string" || !MOBILE_RE.test(phone) || !/^\d{6}$/.test(code)) {
    return c.json({ success: false, error: "인증번호 6자리를 입력해주세요." }, 400)
  }
  try {
    await verifyPhoneCode(`member:${c.get("member").id}`, phone, code, c.get("member").id)
    return c.json({ success: true })
  } catch (e) {
    return signupFail(c, e)
  }
})

usersRoute.put("/me/phone", requireDatabase, requireMember, async (c) => {
  const mode = verificationMode()
  const identity = mode === "identity" ? readSealedCookie<IdentityResult>(c, IDENTITY_COOKIE) : null
  if (mode === "identity" && !identity) return c.json({ success: false, code: "identity_required", error: "본인인증을 먼저 완료해주세요." }, 400)
  const phone = digits((await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)).phone)
  if (mode !== "identity" && (typeof phone !== "string" || !MOBILE_RE.test(phone))) {
    return c.json({ success: false, error: "휴대폰 번호를 확인해주세요." }, 400)
  }
  try {
    await changePhone(c.get("member").id, mode === "identity" ? null : (phone as string), identity)
    deleteCookie(c, IDENTITY_COOKIE, { path: "/" })
    return c.json({ success: true, ...(await getMemberInfo(c.get("member").id)) })
  } catch (e) {
    return signupFail(c, e)
  }
})

// ---- 마이페이지: 로그인 수단 연동·해제 ----
// 연동: 이 요청으로 연동표 쿠키(10분)를 받은 뒤 붙일 수단으로 평소처럼 로그인 → POST /me 가 원래 회원에 붙임

usersRoute.post("/me/identities/link", requireDatabase, requireMember, (c) => {
  setSealedCookie(c, LINK_COOKIE, { memberId: c.get("member").id } satisfies LinkTicket, LINK_COOKIE_MAX_AGE)
  return c.json({ success: true })
})

usersRoute.delete("/me/identities/link", (c) => {
  deleteCookie(c, LINK_COOKIE, { path: "/" })
  return c.json({ success: true })
})

usersRoute.delete("/me/identities/:provider", requireDatabase, requireMember, async (c) => {
  try {
    await unlinkIdentity(c.get("member").id, c.req.param("provider"))
    return c.json({ success: true, ...(await getMemberInfo(c.get("member").id)) })
  } catch (e) {
    if (e instanceof LinkError) return c.json({ success: false, error: e.message }, e.status)
    throw e
  }
})

// ---- 관리자 센터: 전체 회원·제재 (/api/users/admin/...) ----
usersRoute.route("/admin", adminMembersRoute)

// 관리자: 회원 상세 (개인정보는 가려서)
usersRoute.get("/:id", requireAdmin, requireDatabase, async (c) => {
  const member = await getMemberForAdmin(c.req.param("id"))
  if (!member) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, ...member })
})

// 관리자: 회원 역할 변경. 바뀐 역할은 그 회원이 다음에 로그인할 때 적용됨 (관리자 세션 최대 12시간)
const ROLES: DukjiUser["role"][] = ["member", "creator", "partner", "admin"]
usersRoute.put("/:id/role", requireAdmin, requireDatabase, async (c) => {
  const id = c.req.param("id")
  const { role } = await c.req.json<{ role?: unknown }>().catch(() => ({ role: undefined }))
  if (!ROLES.includes(role as DukjiUser["role"])) return c.json({ success: false, error: "역할 값이 올바르지 않습니다." }, 400)
  const actor = readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId ?? null
  if (actor === id && role !== "admin") {
    return c.json({ success: false, error: "자기 자신의 관리자 권한은 해제할 수 없습니다. 다른 관리자에게 요청해주세요." }, 400)
  }
  if (!(await setMemberRole(id, role as DukjiUser["role"]))) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  console.log(JSON.stringify({ event: "member_role_changed", memberId: id, role, by: actor ?? "admin-account" }))
  return c.json({ success: true, role })
})

usersRoute.delete("/", requireAdmin, async (c) => {
  const id = c.req.query("id")
  if (!id) return c.json({ success: false, error: "User ID is required" }, 400)
  await usersRepository.delete(id)
  return c.json({ success: true, message: "User deleted" })
})

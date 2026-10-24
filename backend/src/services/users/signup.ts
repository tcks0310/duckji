import { createHash, randomInt } from "crypto"
import type { PoolClient } from "pg"
import type { Member } from "../../shared/auth/member-session"
import type { IdentityResult, MemberExtra } from "../../shared/auth/member-extra"
export type { IdentityResult }
import { encryptField, hashCi, hashEmail, hashPhone, MemberDataKeyMissingError } from "./crypto"
import {
  applyExtra,
  AUTH_SOURCE,
  insertConsents,
  isRealEmail,
  providerUserId,
  tx,
  type ConsentType,
} from "./members"
import { applyReferral, ensureReferralCode } from "./referral"
import { grantSignupBonus } from "./points"
import { fromRow, type UserRow } from "./rows"

// 회원가입 완료 단계
// 로그인 수단을 처음 쓰면 회원 행 없이 '가입 대기' 쿠키만 두고, 가입 페이지에서
// 닉네임·휴대폰(문자 인증)·필수 약관을 받은 뒤 회원을 만듭니다.
// 같은 휴대폰 번호나 이메일을 쓰는 회원이 있으면 가입을 막고 그 회원의 로그인 수단을 알려 줍니다.

export interface PendingSignup {
  member: Member
  extra: MemberExtra | null
  memberId: string | null // 가입 정보를 아직 안 넣은 기존 회원이면 그 id
}

export class SignupError extends Error {
  constructor(
    public status: 400 | 403 | 409 | 429,
    message: string,
    public detail: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

const CODE_TTL_MIN = 5
const VERIFIED_TTL_MIN = 30
const MAX_ATTEMPTS = 5

// 문자 발송이 설정됐는지 (솔라피 키가 auth 서비스에 들어갔을 때 true 로 넣음)
export const isSmsEnabled = () => process.env.SMS_ENABLED === "true"

// 가입 때 본인 확인 방식
//   identity: 본인인증(포트원 → 다날·KG이니시스, PASS/문자). 사람마다 하나인 CI 로 한 사람 한 계정
//   sms     : 문자 인증번호(솔라피). 번호 주인만 확인
//   none    : 둘 다 설정 전. 입력한 번호로 중복만 확인
export type VerificationMode = "identity" | "sms" | "none"
export const verificationMode = (): VerificationMode =>
  process.env.IDENTITY_ENABLED === "true" ? "identity" : isSmsEnabled() ? "sms" : "none"

export const loginKeyOf = (m: Member) => `${m.provider}:${providerUserId(m)}`

const codeHash = (loginKey: string, phoneHash: string, code: string) =>
  createHash("sha256").update(`${loginKey}:${phoneHash}:${code}`).digest("hex")

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "구글",
  apple: "애플",
  cognito: "이메일",
  email: "이메일",
}

// 이미 가입된 회원의 로그인 수단 (가입을 막을 때 안내용)
async function existingMember(client: PoolClient, where: string, value: string, exceptId: string | null) {
  const { rows } = await client.query<{ id: string; provider: string }>(
    `SELECT id, provider FROM dukji_users WHERE ${where} AND status <> 'withdrawn' AND id <> $2 LIMIT 1`,
    [value, exceptId || ""]
  )
  if (!rows[0]) return null
  const { rows: ids } = await client.query<{ provider: string }>(
    "SELECT DISTINCT provider FROM member_identities WHERE member_id = $1",
    [rows[0].id]
  )
  const providers = [...new Set((ids.length ? ids.map((r) => r.provider) : [rows[0].provider]).map((p) => PROVIDER_LABEL[p] || p))]
  return { id: rows[0].id, loginMethods: providers }
}

// 영구 제재로 재가입이 막힌 번호·본인 (표가 아직 없으면 건너뜀)
export async function assertNotBanned(client: PoolClient, kind: "phone" | "ci", hash: string) {
  await client.query("SAVEPOINT signup_ban")
  let banned = false
  try {
    const { rows } = await client.query("SELECT 1 FROM signup_bans WHERE kind = $1 AND hash = $2", [kind, hash])
    banned = Boolean(rows[0])
    await client.query("RELEASE SAVEPOINT signup_ban")
  } catch (e: any) {
    if (e?.code !== "42P01") throw e
    await client.query("ROLLBACK TO SAVEPOINT signup_ban")
  }
  if (banned) {
    throw new SignupError(403, `이용이 제한된 ${kind === "ci" ? "회원" : "휴대폰 번호"}입니다. 고객센터로 문의해주세요.`, { code: "signup_banned" })
  }
  await assertRejoinAllowed(client, kind === "ci" ? "ci_hash" : "phone_hash", hash)
}

// 탈퇴 후 재가입 제한 기간(본인 탈퇴 30일, 강제 탈퇴 90일) 안이면 막음 (표·칸이 아직 없으면 건너뜀)
export async function assertRejoinAllowed(client: PoolClient, column: "email_hash" | "phone_hash" | "ci_hash", hash: string) {
  await client.query("SAVEPOINT rejoin_check")
  let until: Date | null = null
  try {
    const { rows } = await client.query<{ rejoin_after: Date }>(
      `SELECT rejoin_after FROM member_withdrawals WHERE ${column} = $1 AND rejoin_after > NOW() ORDER BY rejoin_after DESC LIMIT 1`,
      [hash]
    )
    until = rows[0]?.rejoin_after ?? null
    await client.query("RELEASE SAVEPOINT rejoin_check")
  } catch (e: any) {
    if (e?.code !== "42703") throw e
    await client.query("ROLLBACK TO SAVEPOINT rejoin_check")
  }
  if (until) {
    const day = until.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })
    throw new SignupError(403, `탈퇴한 회원은 일정 기간 다시 가입할 수 없습니다. ${day}부터 가입할 수 있습니다.`, {
      code: "rejoin_wait",
      rejoinAfter: until.toISOString(),
    })
  }
}

const duplicate = (what: string, methods: string[]) =>
  new SignupError(409, `이미 가입된 ${what}입니다. ${methods.join(", ")}(으)로 가입한 계정으로 로그인한 뒤 마이페이지에서 연동해주세요.`, {
    code: "duplicate_member",
    loginMethods: methods,
  })

// 인증번호 만들기 (문자는 VPC 밖 auth 서비스가 보냄). 같은 수단은 1분에 1번, 1시간 5번, 같은 번호는 하루 10번까지
export async function startPhoneVerification(loginKey: string, phone: string): Promise<string> {
  const phoneHash = hashPhone(phone)
  return tx(async (client) => {
    await client.query("DELETE FROM phone_verifications WHERE created_at < NOW() - INTERVAL '1 day'")
    const { rows } = await client.query<{ recent: string; hour: string; phone_day: string }>(
      `SELECT
         count(*) FILTER (WHERE login_key = $1 AND created_at > NOW() - INTERVAL '60 seconds') AS recent,
         count(*) FILTER (WHERE login_key = $1 AND created_at > NOW() - INTERVAL '1 hour') AS hour,
         count(*) FILTER (WHERE phone_hash = $2) AS phone_day
       FROM phone_verifications WHERE login_key = $1 OR phone_hash = $2`,
      [loginKey, phoneHash]
    )
    if (Number(rows[0].recent) > 0) throw new SignupError(429, "인증번호는 1분 뒤에 다시 받을 수 있습니다.")
    if (Number(rows[0].hour) >= 5 || Number(rows[0].phone_day) >= 10) {
      throw new SignupError(429, "인증번호 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.")
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    await client.query(
      `INSERT INTO phone_verifications (login_key, phone_hash, code_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
      [loginKey, phoneHash, codeHash(loginKey, phoneHash, code), CODE_TTL_MIN]
    )
    return code
  })
}

// 인증번호 확인. 번호 주인임이 확인된 뒤에만 이미 가입된 번호인지 알려 줌
export async function verifyPhoneCode(loginKey: string, phone: string, code: string, exceptMemberId: string | null) {
  const phoneHash = hashPhone(phone)
  return tx(async (client) => {
    const { rows } = await client.query<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
      `SELECT id, code_hash, attempts, expires_at < NOW() AS expired FROM phone_verifications
       WHERE login_key = $1 AND phone_hash = $2 AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [loginKey, phoneHash]
    )
    const row = rows[0]
    if (!row) throw new SignupError(400, "인증번호를 먼저 받아주세요.")
    if (row.expired) throw new SignupError(400, "인증번호가 만료되었습니다. 다시 받아주세요.")
    if (row.attempts >= MAX_ATTEMPTS) throw new SignupError(429, "인증번호를 여러 번 틀렸습니다. 인증번호를 다시 받아주세요.")
    if (row.code_hash !== codeHash(loginKey, phoneHash, code)) {
      await client.query("UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1", [row.id])
      const left = MAX_ATTEMPTS - row.attempts - 1
      throw new SignupError(400, left > 0 ? `인증번호가 올바르지 않습니다. (${left}번 남음)` : "인증번호를 여러 번 틀렸습니다. 인증번호를 다시 받아주세요.")
    }
    await client.query("UPDATE phone_verifications SET verified_at = NOW() WHERE id = $1", [row.id])
    await assertNotBanned(client, "phone", phoneHash)
    const dup = await existingMember(client, "phone_hash = $1", phoneHash, exceptMemberId)
    if (dup) throw duplicate("휴대폰 번호", dup.loginMethods)
  })
}

export interface SignupInput {
  name: string
  email: string | null // 로그인 수단에서 이메일을 못 받은 경우에만 입력값을 씀
  phone: string | null // 본인인증 방식이면 인증 결과의 번호를 씀
  consents: Partial<Record<ConsentType, boolean>>
  referralCode?: string | null // 추천인 ID (선택)
  platform?: "web" | "app" // 가입 경로 (앱 껍데기는 X-Duckji-Client: app 머리글을 붙임)
}

interface Contact {
  phone: string
  phoneHash: string
  phoneVerified: boolean
  ciHash: string | null
  identity: IdentityResult | null
}

// 본인 확인 방식에 맞춰 번호·본인을 확인하고 제재·중복을 거름
async function checkContact(
  client: PoolClient,
  loginKey: string,
  typedPhone: string | null,
  identity: IdentityResult | null,
  memberId: string | null
): Promise<Contact> {
  const mode = verificationMode()
  if (mode === "identity") {
    if (!identity) throw new SignupError(400, "본인인증을 먼저 완료해주세요.")
    const ciHash = hashCi(identity.ci)
    await assertNotBanned(client, "ci", ciHash)
    const dup = await existingMember(client, "ci_hash = $1", ciHash, memberId)
    if (dup) {
      throw new SignupError(409, `이미 가입한 회원입니다. ${dup.loginMethods.join(", ")}(으)로 가입한 계정으로 로그인한 뒤 마이페이지에서 연동해주세요.`, {
        code: "duplicate_member",
        loginMethods: dup.loginMethods,
      })
    }
    const phoneHash = hashPhone(identity.phone)
    await assertNotBanned(client, "phone", phoneHash)
    // 번호가 다른 명의로 넘어간 경우(번호 재사용): 예전 회원의 번호 표시만 비움
    await client.query("UPDATE dukji_users SET phone_hash = NULL, phone_verified_at = NULL WHERE phone_hash = $1 AND id <> $2", [
      phoneHash,
      memberId || "",
    ])
    return { phone: identity.phone, phoneHash, phoneVerified: true, ciHash, identity }
  }

  if (!typedPhone) throw new SignupError(400, "휴대폰 번호를 입력해주세요.")
  const phoneHash = hashPhone(typedPhone)
  let phoneVerified = false
  if (mode === "sms") {
    const { rows } = await client.query(
      `SELECT 1 FROM phone_verifications
       WHERE login_key = $1 AND phone_hash = $2 AND verified_at > NOW() - make_interval(mins => $3) LIMIT 1`,
      [loginKey, phoneHash, VERIFIED_TTL_MIN]
    )
    if (!rows[0]) throw new SignupError(400, "휴대폰 인증을 먼저 완료해주세요.")
    phoneVerified = true
  }
  await assertNotBanned(client, "phone", phoneHash)
  const dup = await existingMember(client, "phone_hash = $1", phoneHash, memberId)
  if (dup) throw duplicate("휴대폰 번호", dup.loginMethods)
  return { phone: typedPhone, phoneHash, phoneVerified, ciHash: null, identity: null }
}

// 번호·본인인증 결과를 회원 원장과 프로필에 기록
async function saveContact(client: PoolClient, memberId: string, ct: Contact) {
  await client.query(
    `UPDATE dukji_users SET phone_hash = $2, phone_verified_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
       ci_hash = COALESCE($4, ci_hash), identity_verified_at = CASE WHEN $4::text IS NULL THEN identity_verified_at ELSE NOW() END
     WHERE id = $1`,
    [memberId, ct.phoneHash, ct.phoneVerified, ct.ciHash]
  )
  const source = ct.identity ? "identity" : ct.phoneVerified ? "verified" : "self"
  const idn = ct.identity
  await client.query(
    `INSERT INTO member_profiles (member_id, phone_enc, real_name_enc, birth_date_enc, gender, sources)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (member_id) DO UPDATE SET
       phone_enc = EXCLUDED.phone_enc,
       real_name_enc = COALESCE(EXCLUDED.real_name_enc, member_profiles.real_name_enc),
       birth_date_enc = COALESCE(EXCLUDED.birth_date_enc, member_profiles.birth_date_enc),
       gender = COALESCE(EXCLUDED.gender, member_profiles.gender),
       sources = member_profiles.sources || EXCLUDED.sources, updated_at = NOW()`,
    [
      memberId,
      encryptField(ct.phone),
      encryptField(idn?.name),
      encryptField(idn?.birthDate),
      idn?.gender || null,
      JSON.stringify(
        idn
          ? { phone: source, realName: source, ...(idn.birthDate ? { birthDate: source } : {}), ...(idn.gender ? { gender: source } : {}) }
          : { phone: source }
      ),
    ]
  )
}

// 가입 완료: 본인·번호·이메일 중복 확인 → 회원 만들기(또는 기존 회원 보완) → 동의 이력·프로필 기록
export async function completeSignup(pending: PendingSignup, input: SignupInput, identity: IdentityResult | null) {
  const m = pending.member
  const loginKey = loginKeyOf(m)
  const providerEmail = isRealEmail(m.email) ? m.email.trim().toLowerCase() : null
  const verified = Boolean(m.emailVerified && providerEmail)

  return tx(async (client) => {
    let current: UserRow | undefined
    if (pending.memberId) {
      const { rows } = await client.query<UserRow>("SELECT * FROM dukji_users WHERE id = $1 FOR UPDATE", [pending.memberId])
      current = rows[0]
      if (!current || current.status === "withdrawn") throw new SignupError(400, "가입 정보를 찾을 수 없습니다. 다시 로그인해주세요.")
      if (current.status === "banned" || current.status === "suspended") throw new SignupError(403, "이용이 정지된 계정입니다.")
    }
    const contact = await checkContact(client, loginKey, input.phone, identity, pending.memberId)

    const currentEmail = current && isRealEmail(current.email) ? current.email.toLowerCase() : null
    const email = currentEmail || providerEmail || input.email
    if (!email) throw new SignupError(400, "이메일을 입력해주세요.")
    const dupEmail = await existingMember(client, "lower(email) = $1", email, pending.memberId)
    if (dupEmail) throw duplicate("이메일", dupEmail.loginMethods)
    await assertRejoinAllowed(client, "email_hash", hashEmail(email))

    const marketing = input.consents.marketing_email === true
    let memberId: string
    if (current) {
      memberId = current.id
      await client.query(
        `UPDATE dukji_users SET name = $2, email = $3, signup_completed_at = COALESCE(signup_completed_at, NOW()),
           terms_agreed_at = COALESCE(terms_agreed_at, NOW()), marketing_agreed = $4, last_login_at = NOW()
         WHERE id = $1`,
        [memberId, input.name, email, marketing]
      )
    } else {
      // 탈퇴한 회원 행이 같은 id 를 쓰고 있으면 새 id 로 (탈퇴 행은 다른 기록의 참조용으로 남아 있음)
      const { rows: taken } = await client.query("SELECT 1 FROM dukji_users WHERE id = $1", [m.id])
      memberId = taken[0] ? `${m.id}-${Date.now().toString(36)}` : m.id
      await client.query(
        `INSERT INTO dukji_users (id, name, email, email_verified, provider, avatar_url, auth_source,
           signup_completed_at, terms_agreed_at, marketing_agreed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)`,
        [
          memberId,
          input.name,
          email,
          verified && email === providerEmail,
          m.provider,
          m.avatarUrl || "/images/avatar/female.jpg",
          AUTH_SOURCE[m.provider] || "간편가입",
          marketing,
        ]
      )
      await client.query(
        `INSERT INTO member_identities (provider, provider_user_id, member_id, email, email_verified)
         VALUES ($1, $2, $3, $4, $5)`,
        [m.provider, providerUserId(m), memberId, providerEmail, verified]
      )
      // 가입 경로 (표·칸이 아직 없으면 건너뜀)
      if (input.platform === "app") {
        await client.query("SAVEPOINT signup_platform")
        try {
          await client.query("UPDATE dukji_users SET signup_platform = 'app' WHERE id = $1", [memberId])
        } catch {
          await client.query("ROLLBACK TO SAVEPOINT signup_platform")
        }
      }
    }
    await saveContact(client, memberId, contact)
    await insertConsents(client, memberId, input.consents, "signup")
    // 친구 추천: 내 추천 ID 를 만들고, 적은 추천인 ID 가 실제 회원이면 양쪽에 DP 지급
    await ensureReferralCode(client, memberId)
    // 이미 가입을 마친 회원이 본인인증만 다시 하는 경우엔 추천 보상을 주지 않음
    if (!current?.signup_completed_at) await applyReferral(client, memberId, input.referralCode)
    // 신규 가입 축하 350 DP. 예전엔 잔액을 처음 볼 때만 줘서, 가입 뒤 새로고침 없이 나가면 0 으로 남았음
    await grantSignupBonus(client, memberId)
    if (pending.extra) {
      await client.query("SAVEPOINT extra")
      try {
        await applyExtra(client, memberId, pending.extra, m.provider)
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT extra")
        if (!(e instanceof MemberDataKeyMissingError)) console.error("member extra save failed", e)
      }
    }

    const { rows } = await client.query<UserRow>("SELECT * FROM dukji_users WHERE id = $1", [memberId])
    return fromRow(rows[0])
  }).catch((e) => {
    // 동시에 같은 사람·번호·이메일로 가입한 경우 (유일 인덱스)
    if (e?.code === "23505") throw new SignupError(409, "이미 가입한 회원입니다.", { code: "duplicate_member" })
    throw e
  })
}

// 마이페이지 휴대폰 번호 변경. 본인인증 방식이면 가입한 본인 명의로 다시 인증해야 함
export async function changePhone(memberId: string, phone: string | null, identity: IdentityResult | null) {
  return tx(async (client) => {
    if (identity) {
      const { rows } = await client.query<{ ci_hash: string | null }>("SELECT ci_hash FROM dukji_users WHERE id = $1", [memberId])
      if (rows[0]?.ci_hash && rows[0].ci_hash !== hashCi(identity.ci)) {
        throw new SignupError(403, "가입한 본인 명의의 휴대폰으로만 바꿀 수 있습니다.")
      }
    }
    const contact = await checkContact(client, `member:${memberId}`, phone, identity, memberId)
    await saveContact(client, memberId, contact)
  }).catch((e) => {
    if (e?.code === "23505") throw new SignupError(409, "이미 가입된 휴대폰 번호입니다.", { code: "duplicate_member" })
    throw e
  })
}

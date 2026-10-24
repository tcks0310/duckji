import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import type { Member } from "../../shared/auth/member-session"
import type { MemberExtra } from "../../shared/auth/member-extra"
import { fromRow, type UserRow } from "./rows"
import { decryptField, encryptField, hashEmail, hashPhone, maskAddress, maskName, maskPhone, MemberDataKeyMissingError } from "./crypto"
import type { DukjiUser } from "./types"

// 회원 통합 원장 (PostgreSQL 전용)
// 회원 = dukji_users 한 행, 로그인 수단 = member_identities 여러 행.

export const AUTH_SOURCE: Record<string, string> = {
  kakao: "카카오톡 간편가입",
  naver: "네이버 간편가입",
  google: "구글 간편가입",
  apple: "애플 간편가입",
  cognito: "이메일 가입",
}

export const CONSENT_VERSION = "2026-10"
export const REQUIRED_CONSENTS = ["age_14", "terms", "privacy_required"] as const
export const OPTIONAL_CONSENTS = ["privacy_optional", "marketing_email", "marketing_sms"] as const
const CONSENT_TYPES = [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS]
export type ConsentType = (typeof REQUIRED_CONSENTS)[number] | (typeof OPTIONAL_CONSENTS)[number]
// 탈퇴 후 같은 이메일·휴대폰·본인(CI)으로 다시 가입할 수 없는 기간 (일반 서비스 방식). 확인용 해시도 이 기간만 보관
export const REJOIN_WAIT_DAYS = { self: 30, admin: 90 } as const
export type WithdrawKind = keyof typeof REJOIN_WAIT_DAYS

// 프로필 사진: 기본 이미지(/images/avatar/·/images/npc/) 또는 회원이 올린 사진(이미지 도메인의 members/ 업로드 경로)만 저장
export const DEFAULT_AVATAR = "/images/avatar/female.jpg"
export const OWN_AVATAR_PREFIX = "https://img.duckji.com/members/"

export interface ProfileInput {
  name?: string
  realName?: string | null
  phone?: string | null
  birthDate?: string | null
  gender?: "female" | "male" | "other" | null
  region?: string | null
  interests?: string[]
  bio?: string | null
  // 프로필 사진 (null 이면 기본 이미지로)
  avatarUrl?: string | null
}

export interface AddressInput {
  label?: string | null
  recipient: string
  phone: string
  zipCode: string
  address1: string
  address2?: string | null
  isDefault?: boolean
}

// 가짜 대체 주소(소셜에서 이메일을 못 받은 경우)는 실제 이메일로 보지 않음
export const isRealEmail = (email: string | undefined) =>
  Boolean(email) && !/@(users\.)?dukji\.kr$/i.test(email!) && !/@invalid\.duckji\.com$/i.test(email!)

export const providerUserId = (m: Pick<Member, "id" | "provider">) =>
  m.id.startsWith(`${m.provider}-`) ? m.id.slice(m.provider.length + 1) : m.id

export const tx = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

const birthDateFrom = (extra: MemberExtra) => {
  const y = extra.birthYear && /^\d{4}$/.test(extra.birthYear) ? extra.birthYear : null
  const md = extra.birthday && /^\d{4}$/.test(extra.birthday) ? `${extra.birthday.slice(0, 2)}-${extra.birthday.slice(2)}` : null
  if (y && md) return `${y}-${md}`
  return y || (md ? `--${md}` : null)
}

// 소셜에서 받은 추가 정보는 비어 있는 칸만 채움 (회원이 직접 고친 값은 덮어쓰지 않음)
export async function applyExtra(client: PoolClient, memberId: string, extra: MemberExtra, provider: string) {
  const fields: Record<string, string | null> = {
    realName: extra.realName || null,
    phone: extra.phone || null,
    birthDate: birthDateFrom(extra),
    gender: extra.gender || null,
    ageRange: extra.ageRange || null,
  }
  const sources = Object.fromEntries(Object.entries(fields).filter(([, v]) => v).map(([k]) => [k, provider]))
  if (Object.keys(sources).length) {
    await client.query(
      `INSERT INTO member_profiles (member_id, real_name_enc, phone_enc, birth_date_enc, gender, age_range, sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (member_id) DO UPDATE SET
         real_name_enc  = COALESCE(member_profiles.real_name_enc, EXCLUDED.real_name_enc),
         phone_enc      = COALESCE(member_profiles.phone_enc, EXCLUDED.phone_enc),
         birth_date_enc = COALESCE(member_profiles.birth_date_enc, EXCLUDED.birth_date_enc),
         gender         = COALESCE(member_profiles.gender, EXCLUDED.gender),
         age_range      = COALESCE(member_profiles.age_range, EXCLUDED.age_range),
         sources        = EXCLUDED.sources || member_profiles.sources,
         updated_at     = NOW()`,
      [
        memberId,
        encryptField(fields.realName),
        encryptField(fields.phone),
        encryptField(fields.birthDate),
        fields.gender,
        fields.ageRange,
        JSON.stringify(sources),
      ]
    )
  }
  const a = extra.shippingAddress
  if (a?.recipient && a.phone && a.zipCode && a.address1) {
    await client.query(
      `INSERT INTO member_addresses (member_id, label, recipient_enc, phone_enc, zip_code, address1_enc, address2_enc, is_default, source)
       SELECT $1::varchar, '기본 배송지', $2, $3, $4, $5, $6, TRUE, $7
       WHERE NOT EXISTS (SELECT 1 FROM member_addresses WHERE member_id = $1::varchar)`,
      [memberId, encryptField(a.recipient), encryptField(a.phone), a.zipCode, encryptField(a.address1), encryptField(a.address2), provider]
    )
  }
}

// 로그인 직후: 로그인 수단 → 회원 찾기. 없으면 같은 인증 이메일 회원에 연결.
// 회원이 없거나 가입 정보(휴대폰·필수 약관)를 아직 안 넣은 회원이면 pending 을 돌려주고,
// 회원 행은 가입 페이지에서 정보를 다 받은 뒤 completeSignup(signup.ts) 이 만듭니다.
export type LoginResult = { user: DukjiUser; linked: boolean } | { pending: true; memberId: string | null }

export async function resolveLogin(m: Member, extra: MemberExtra | null): Promise<LoginResult> {
  const pid = providerUserId(m)
  const email = isRealEmail(m.email) ? m.email.trim().toLowerCase() : null
  const verified = Boolean(m.emailVerified && email)

  return tx(async (client) => {
    // 가입 완료 단계 칸이 없으면 여기서 42703 → routes 가 예전 방식으로 기록
    await client.query("SELECT signup_completed_at FROM dukji_users LIMIT 0")
    let linked = false
    const { rows: ids } = await client.query<{ member_id: string }>(
      "SELECT member_id FROM member_identities WHERE provider = $1 AND provider_user_id = $2 FOR UPDATE",
      [m.provider, pid]
    )
    let memberId = ids[0]?.member_id

    if (memberId) {
      await client.query(
        `UPDATE member_identities
         SET last_login_at = NOW(), email = COALESCE($3, email), email_verified = email_verified OR $4
         WHERE provider = $1 AND provider_user_id = $2`,
        [m.provider, pid, email, verified]
      )
    } else {
      // 예전 방식으로 만들어진 회원 행이 이미 있으면 그대로 연결
      const { rows: same } = await client.query<{ id: string }>(
        "SELECT id FROM dukji_users WHERE id = $1 AND status <> 'withdrawn'",
        [m.id]
      )
      memberId = same[0]?.id
      // Cognito(이메일 인증 또는 예전 비밀번호로 본인 확인) → 예전 이메일 가입 회원이면 그 회원으로 이전
      if (!memberId && m.provider === "cognito" && email) {
        const { rows: legacy } = await client.query<{ id: string }>(
          `SELECT id FROM dukji_users WHERE provider = 'email' AND lower(email) = $1 AND status IN ('active', 'dormant')
           ORDER BY joined_at LIMIT 1`,
          [email]
        )
        if (legacy[0]) {
          memberId = legacy[0].id
          linked = true
          // 비밀번호는 이제 Cognito 가 관리하므로 예전 비밀번호·로그인 수단은 지움
          await client.query("DELETE FROM dukji_user_email_credentials WHERE user_id = $1", [memberId])
          await client.query("DELETE FROM member_identities WHERE member_id = $1 AND provider = 'email'", [memberId])
        }
      }
      // 같은 이메일 계정 합치기: 양쪽 다 인증된 이메일일 때만 (남의 계정에 붙는 것 방지)
      if (!memberId && verified) {
        const { rows: match } = await client.query<{ id: string }>(
          `SELECT id FROM dukji_users
           WHERE lower(email) = $1 AND email_verified AND status IN ('active', 'dormant')
           ORDER BY joined_at LIMIT 1`,
          [email]
        )
        if (match[0]) {
          memberId = match[0].id
          linked = true
        }
      }
      // 처음 보는 로그인 수단: 가입 페이지에서 필수 정보를 받은 뒤 회원을 만듦
      if (!memberId) return { pending: true as const, memberId: null }
      await client.query(
        `INSERT INTO member_identities (provider, provider_user_id, member_id, email, email_verified)
         VALUES ($1, $2, $3, $4, $5)`,
        [m.provider, pid, memberId, email, verified]
      )
    }

    // 가입 정보를 아직 안 넣은 회원(예전 가입자 포함)도 가입 페이지로
    const { rows: state } = await client.query<{ signup_completed_at: Date | null; status: string; role: string; ci_hash: string | null }>(
      "SELECT signup_completed_at, status, role, ci_hash FROM dukji_users WHERE id = $1",
      [memberId]
    )
    const s = state[0]
    // 본인인증이 켜진 뒤에는 본인인증을 안 한 기존 회원도 가입 페이지에서 한 번 인증해야 함
    // (관리자는 인증 장애 때 관리자 센터에 못 들어가는 일이 없도록 제외)
    const needsIdentity = process.env.IDENTITY_ENABLED === "true" && !s?.ci_hash && s?.role !== "admin"
    if ((!s?.signup_completed_at || needsIdentity) && !["banned", "suspended", "withdrawn"].includes(s?.status)) {
      return { pending: true as const, memberId }
    }
    // 기간 정지가 끝났으면 자동 해제 (컬럼이 아직 없으면 건너뜀)
    if (state[0]?.status === "suspended") {
      await client.query("SAVEPOINT sanction")
      try {
        await client.query(
          `UPDATE dukji_users SET status = 'active', suspended_until = NULL, sanction_reason = NULL
           WHERE id = $1 AND status = 'suspended' AND suspended_until <= NOW()`,
          [memberId]
        )
        await client.query("RELEASE SAVEPOINT sanction")
      } catch (e: any) {
        if (e?.code !== "42703") throw e
        await client.query("ROLLBACK TO SAVEPOINT sanction")
      }
    }

    // 이름·사진은 처음 가입한 수단으로 로그인할 때만 갱신 (연결된 다른 수단이 덮어쓰지 않도록)
    // 회원이 마이페이지에서 고른 사진(기본 이미지·직접 올린 사진, 우리 주소)은 소셜 사진으로 덮어쓰지 않음
    // 가입 때 자동으로 들어간 기본 사진(DEFAULT_AVATAR)은 소셜 사진이 있으면 바뀜
    await client.query(
      `UPDATE dukji_users SET
         last_login_at = NOW(),
         avatar_url = CASE
           WHEN avatar_url IS NOT NULL AND ((avatar_url LIKE '/images/%' AND avatar_url <> $5) OR avatar_url LIKE $4) THEN avatar_url
           WHEN provider = $2 THEN COALESCE($3, avatar_url)
           ELSE COALESCE(avatar_url, $3) END
       WHERE id = $1`,
      [memberId, m.provider, m.avatarUrl || null, `${OWN_AVATAR_PREFIX}%`, DEFAULT_AVATAR]
    )
    // 대체 주소·미인증 이메일을 쓰던 회원은 인증된 이메일로 바꿈 (다른 회원이 안 쓰는 경우만)
    if (verified) {
      await client.query(
        `UPDATE dukji_users SET email = $2, email_verified = TRUE
         WHERE id = $1 AND NOT email_verified
           AND NOT EXISTS (SELECT 1 FROM dukji_users WHERE lower(email) = $2 AND id <> $1)`,
        [memberId, email]
      )
    }

    if (extra) {
      await client.query("SAVEPOINT extra")
      try {
        await applyExtra(client, memberId, extra, m.provider)
      } catch (e) {
        // 추가 정보 저장 실패가 로그인을 막지는 않음
        await client.query("ROLLBACK TO SAVEPOINT extra")
        if (!(e instanceof MemberDataKeyMissingError)) console.error("member extra save failed", e)
        else console.warn(e.message)
      }
    }

    const { rows } = await client.query<UserRow>("SELECT * FROM dukji_users WHERE id = $1", [memberId])
    return { user: fromRow(rows[0]), linked }
  })
}

// 가입 시 동의 기록 + 이메일 로그인 수단 (이메일 회원가입 트랜잭션 안에서 호출)
export async function recordSignup(
  client: PoolClient,
  memberId: string,
  email: string,
  agreements: Partial<Record<ConsentType, boolean>>
) {
  await client.query(
    `INSERT INTO member_identities (provider, provider_user_id, member_id, email, email_verified)
     VALUES ('email', $1, $2, $3, FALSE) ON CONFLICT DO NOTHING`,
    [providerUserId({ id: memberId, provider: "email" }), memberId, email]
  )
  await insertConsents(client, memberId, agreements, "signup")
}

export async function insertConsents(
  client: PoolClient | ReturnType<typeof db>,
  memberId: string,
  agreements: Partial<Record<ConsentType, boolean>>,
  channel: string
) {
  for (const [type, agreed] of Object.entries(agreements)) {
    if (typeof agreed !== "boolean") continue
    await client.query(
      "INSERT INTO member_consents (member_id, consent_type, version, agreed, channel) VALUES ($1, $2, $3, $4, $5)",
      [memberId, type, CONSENT_VERSION, agreed, channel]
    )
  }
}

async function latestConsents(memberId: string) {
  const { rows } = await db().query<{ consent_type: string; agreed: boolean; version: string; created_at: Date }>(
    `SELECT DISTINCT ON (consent_type) consent_type, agreed, version, created_at
     FROM member_consents WHERE member_id = $1
     ORDER BY consent_type, created_at DESC, id DESC`,
    [memberId]
  )
  return Object.fromEntries(
    rows.map((r) => [r.consent_type, { agreed: r.agreed, version: r.version, at: r.created_at.toISOString() }])
  )
}

type ProfileRow = {
  real_name_enc: string | null
  phone_enc: string | null
  birth_date_enc: string | null
  gender: string | null
  age_range: string | null
  region: string | null
  interests: string[]
  bio: string | null
  sources: Record<string, string>
}

type AddressRow = {
  id: string
  label: string | null
  recipient_enc: string
  phone_enc: string
  zip_code: string
  address1_enc: string
  address2_enc: string | null
  is_default: boolean
  source: string
}

const toAddress = (r: AddressRow) => ({
  id: Number(r.id),
  label: r.label,
  recipient: decryptField(r.recipient_enc),
  phone: decryptField(r.phone_enc),
  zipCode: r.zip_code,
  address1: decryptField(r.address1_enc),
  address2: decryptField(r.address2_enc),
  isDefault: r.is_default,
  source: r.source,
})

// 본인 회원 정보 전체 (마이페이지)
export async function getMemberInfo(memberId: string) {
  const pool = db()
  const [{ rows: u }, { rows: p }, { rows: a }, { rows: i }] = await Promise.all([
    pool.query<UserRow>("SELECT * FROM dukji_users WHERE id = $1", [memberId]),
    pool.query<ProfileRow>("SELECT * FROM member_profiles WHERE member_id = $1", [memberId]),
    pool.query<AddressRow>("SELECT * FROM member_addresses WHERE member_id = $1 ORDER BY is_default DESC, id", [memberId]),
    pool.query<{ provider: string; email: string | null; linked_at: Date; last_login_at: Date }>(
      "SELECT provider, email, linked_at, last_login_at FROM member_identities WHERE member_id = $1 ORDER BY linked_at",
      [memberId]
    ),
  ])
  if (!u[0]) return null
  const profile = p[0]
  return {
    user: fromRow(u[0]),
    // 본인인증·문자 인증 여부 (컬럼이 아직 없으면 false)
    identityVerified: Boolean(u[0].ci_hash),
    identityVerifiedAt: u[0].identity_verified_at?.toISOString() || null,
    signupCompletedAt: u[0].signup_completed_at?.toISOString() || null,
    phoneVerified: Boolean((u[0] as UserRow & { phone_verified_at?: Date | null }).phone_verified_at),
    profile: {
      realName: decryptField(profile?.real_name_enc),
      phone: decryptField(profile?.phone_enc),
      birthDate: decryptField(profile?.birth_date_enc),
      gender: profile?.gender || null,
      ageRange: profile?.age_range || null,
      region: profile?.region || null,
      interests: profile?.interests || [],
      bio: profile?.bio || null,
      sources: profile?.sources || {},
    },
    addresses: a.map(toAddress),
    loginMethods: i.map((r) => ({
      provider: r.provider,
      email: r.email,
      linkedAt: r.linked_at.toISOString(),
      lastLoginAt: r.last_login_at.toISOString(),
    })),
    consents: await latestConsents(memberId),
  }
}

const ageOf = (birthDate: string | null) => {
  const m = birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const now = new Date(Date.now() + 9 * 3600_000) // 한국 날짜 기준
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  let age = now.getUTCFullYear() - y
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age -= 1
  return age >= 0 && age < 130 ? age : null
}

// 관리자용 회원 상세 (개인정보는 가려서)
export async function getMemberForAdmin(memberId: string) {
  const info = await getMemberInfo(memberId)
  if (!info) return null
  const { profile } = info
  return {
    ...info,
    profile: {
      ...profile,
      // 만 나이 (생년월일은 연도만 보여 줌)
      age: ageOf(profile.birthDate),
      realName: maskName(profile.realName),
      phone: maskPhone(profile.phone),
      birthDate: profile.birthDate ? profile.birthDate.slice(0, 4).replace("--", "") || null : null,
    },
    addresses: info.addresses.map((a) => ({
      ...a,
      recipient: maskName(a.recipient),
      phone: maskPhone(a.phone),
      address1: maskAddress(a.address1),
      address2: a.address2 ? "***" : null,
    })),
  }
}

// 관리자: 닉네임 변경 (부적절한 닉네임 정리용)
export async function setMemberName(memberId: string, name: string): Promise<boolean> {
  const { rowCount } = await db().query("UPDATE dukji_users SET name = $2 WHERE id = $1 AND status <> 'withdrawn'", [memberId, name])
  return (rowCount ?? 0) > 0
}

// 관리자: 회원 역할 변경 (role = 'admin' 이면 다음 로그인부터 관리자 센터 사용 가능)
export async function setMemberRole(memberId: string, role: DukjiUser["role"]): Promise<boolean> {
  const { rowCount } = await db().query("UPDATE dukji_users SET role = $2 WHERE id = $1 AND status <> 'withdrawn'", [memberId, role])
  return (rowCount ?? 0) > 0
}

export async function updateProfile(memberId: string, input: ProfileInput) {
  await tx(async (client) => {
    if (input.name !== undefined) {
      await client.query("UPDATE dukji_users SET name = $2 WHERE id = $1", [memberId, input.name])
    }
    if (input.avatarUrl !== undefined) {
      await client.query("UPDATE dukji_users SET avatar_url = $2 WHERE id = $1", [memberId, input.avatarUrl || DEFAULT_AVATAR])
    }
    const sets: string[] = []
    const values: unknown[] = [memberId]
    const sources: Record<string, string> = {}
    const put = (column: string, value: unknown, sourceKey?: string) => {
      values.push(value)
      sets.push(`${column} = $${values.length}`)
      if (sourceKey) sources[sourceKey] = "self"
    }
    if (input.realName !== undefined) put("real_name_enc", encryptField(input.realName), "realName")
    if (input.phone !== undefined) put("phone_enc", encryptField(input.phone), "phone")
    if (input.birthDate !== undefined) put("birth_date_enc", encryptField(input.birthDate), "birthDate")
    if (input.gender !== undefined) put("gender", input.gender, "gender")
    if (input.region !== undefined) put("region", input.region)
    if (input.interests !== undefined) put("interests", input.interests)
    if (input.bio !== undefined) put("bio", input.bio)
    if (!sets.length) return
    values.push(JSON.stringify(sources))
    await client.query("INSERT INTO member_profiles (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [memberId])
    await client.query(
      `UPDATE member_profiles SET ${sets.join(", ")}, sources = sources || $${values.length}::jsonb, updated_at = NOW()
       WHERE member_id = $1`,
      values
    )
  })
}

export async function addAddress(memberId: string, a: AddressInput) {
  return tx(async (client) => {
    const { rows: count } = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM member_addresses WHERE member_id = $1",
      [memberId]
    )
    if (Number(count[0].n) >= 10) throw new Error("배송지는 10개까지 저장할 수 있습니다.")
    const isDefault = a.isDefault === true || Number(count[0].n) === 0
    if (isDefault) await client.query("UPDATE member_addresses SET is_default = FALSE WHERE member_id = $1", [memberId])
    const { rows } = await client.query<AddressRow>(
      `INSERT INTO member_addresses (member_id, label, recipient_enc, phone_enc, zip_code, address1_enc, address2_enc, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [memberId, a.label || null, encryptField(a.recipient), encryptField(a.phone), a.zipCode, encryptField(a.address1), encryptField(a.address2), isDefault]
    )
    return toAddress(rows[0])
  })
}

export async function updateAddress(memberId: string, id: number, a: AddressInput) {
  return tx(async (client) => {
    if (a.isDefault) await client.query("UPDATE member_addresses SET is_default = FALSE WHERE member_id = $1", [memberId])
    const { rows } = await client.query<AddressRow>(
      `UPDATE member_addresses SET label = $3, recipient_enc = $4, phone_enc = $5, zip_code = $6,
         address1_enc = $7, address2_enc = $8, is_default = is_default OR $9, source = 'self', updated_at = NOW()
       WHERE member_id = $1 AND id = $2 RETURNING *`,
      [memberId, id, a.label || null, encryptField(a.recipient), encryptField(a.phone), a.zipCode, encryptField(a.address1), encryptField(a.address2), a.isDefault === true]
    )
    return rows[0] ? toAddress(rows[0]) : null
  })
}

export async function deleteAddress(memberId: string, id: number) {
  return tx(async (client) => {
    const { rows } = await client.query<{ is_default: boolean }>(
      "DELETE FROM member_addresses WHERE member_id = $1 AND id = $2 RETURNING is_default",
      [memberId, id]
    )
    // 기본 배송지를 지우면 가장 오래된 배송지를 기본으로
    if (rows[0]?.is_default) {
      await client.query(
        `UPDATE member_addresses SET is_default = TRUE
         WHERE id = (SELECT id FROM member_addresses WHERE member_id = $1 ORDER BY id LIMIT 1)`,
        [memberId]
      )
    }
    return rows.length > 0
  })
}

// 선택 동의 변경 (바뀐 항목만 이력에 추가)
export async function updateConsents(memberId: string, changes: Partial<Record<ConsentType, boolean>>) {
  const current = await latestConsents(memberId)
  const changed = Object.fromEntries(Object.entries(changes).filter(([k, v]) => current[k]?.agreed !== v))
  if (Object.keys(changed).length) {
    await tx(async (client) => {
      await insertConsents(client, memberId, changed, "mypage")
      if (typeof changed.marketing_email === "boolean") {
        await client.query("UPDATE dukji_users SET marketing_agreed = $2 WHERE id = $1", [memberId, changed.marketing_email])
      }
    })
  }
  return latestConsents(memberId)
}

const RETAIN_YEARS = 5 // 전자상거래법: 계약·청약철회, 대금 결제·재화 공급 기록 5년

// 개인정보는 암호화해서 보관 (로컬처럼 MEMBER_DATA_KEY 가 없으면 평문)
function sealed(value: Record<string, unknown>): { enc: string | null; plain: Record<string, unknown> | null } {
  try {
    return { enc: encryptField(JSON.stringify(value)), plain: null }
  } catch (e) {
    if (!(e instanceof MemberDataKeyMissingError)) throw e
    return { enc: null, plain: value }
  }
}

// 탈퇴 회원의 주문·DP 기록을 retention.withdrawn_records 로 옮김. 운영 주문에는 배송 정보를 지운 껍데기만 남김
async function moveToRetention(client: PoolClient, memberId: string, kind: WithdrawKind) {
  const insert = (category: string, ref: string, data: unknown, enc: string | null) =>
    client.query(
      `INSERT INTO retention.withdrawn_records (member_id, category, ref, data, data_enc, retain_until)
       VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(years => $6))`,
      [memberId, category, ref, JSON.stringify(data), enc, RETAIN_YEARS]
    )
  const { rows: store } = await client.query("SELECT to_regclass('store.orders') AS t")
  if (store[0].t) {
    const { rows: orders } = await client.query(
      `SELECT o.*, COALESCE((SELECT json_agg(json_build_object('productId', i.product_id, 'name', i.name, 'priceDp', i.price_dp, 'quantity', i.quantity))
                             FROM store.order_items i WHERE i.order_id = o.id), '[]'::json) AS items
       FROM store.orders o WHERE o.member_id = $1 ORDER BY o.id FOR UPDATE OF o`,
      [memberId]
    )
    // 배송 전 주문이 있으면 본인 탈퇴는 막음 (배송지를 지우면 보낼 수 없음). 관리자 탈퇴 처리는 진행
    if (kind === "self" && orders.some((o) => o.status === "paid" || o.status === "shipped")) return "orders_in_progress" as const
    for (const o of orders) {
      const personal = sealed({
        recipientName: o.recipient_name, recipientPhone: o.recipient_phone, postcode: o.postcode,
        address: o.address, addressDetail: o.address_detail, requestNote: o.request_note, trackingNo: o.tracking_no,
      })
      await insert(
        "order",
        o.order_no,
        { orderNo: o.order_no, status: o.status, totalDp: o.total_dp, items: o.items, createdAt: o.created_at, canceledAt: o.canceled_at, ...(personal.plain || {}) },
        personal.enc
      )
    }
    await client.query(
      `UPDATE store.orders SET recipient_name = '탈퇴 회원', recipient_phone = '', postcode = '', address = '',
         address_detail = '', request_note = '', updated_at = NOW() WHERE member_id = $1`,
      [memberId]
    )
  }
  const { rows: charges } = await client.query("SELECT to_regclass('member_dp_charges') AS t")
  if (charges[0].t) {
    const { rows } = await client.query("SELECT * FROM member_dp_charges WHERE member_id = $1 ORDER BY created_at", [memberId])
    for (const c of rows) {
      await insert("dp_charge", c.payment_id, {
        paymentId: c.payment_id, amount: c.amount, status: c.status, payMethod: c.pay_method, pgTxId: c.pg_tx_id,
        failReason: c.fail_reason, createdAt: c.created_at, paidAt: c.paid_at,
      }, null)
    }
    await client.query("DELETE FROM member_dp_charges WHERE member_id = $1", [memberId])
  }
  const { rows: ledger } = await client.query("SELECT to_regclass('member_point_ledger') AS t")
  if (ledger[0].t) {
    const { rows } = await client.query(
      "SELECT * FROM member_point_ledger WHERE member_id = $1 AND NOT is_test ORDER BY id",
      [memberId]
    )
    if (rows.length) {
      await insert("dp_ledger", "", rows.map((r) => ({
        amount: r.amount, paidAmount: r.paid_amount ?? null, reason: r.reason, refId: r.ref_id, memo: r.memo, createdAt: r.created_at,
      })), null)
    }
  }
  // 보관 기한이 지난 기록 파기
  await client.query("DELETE FROM retention.withdrawn_records WHERE retain_until < NOW()")
  return "ok" as const
}

// 본인 탈퇴 전에 확인: 배송이 끝나지 않은 주문이 있으면 탈퇴 불가 (이메일 회원은 로그인 계정을 지우기 전에 확인)
export async function hasOrdersInProgress(memberId: string) {
  const { rows } = await db().query(
    `SELECT EXISTS (SELECT 1 FROM store.orders WHERE member_id = $1 AND status IN ('paid', 'shipped')) AS v`,
    [memberId]
  ).catch(() => ({ rows: [{ v: false }] }))
  return Boolean(rows[0]?.v)
}

// 회원 탈퇴: 개인정보·로그인 수단은 바로 삭제, 법정 보관 기록은 분리 보관, 회원 행은 익명화(다른 기록의 참조 유지)
export async function withdraw(memberId: string, reason: string | null, kind: WithdrawKind = "self") {
  return tx(async (client) => {
    const { rows } = await client.query<{ email: string; phone_hash: string | null; ci_hash: string | null; phone_enc: string | null }>(
      `SELECT u.email, u.phone_hash, u.ci_hash, p.phone_enc FROM dukji_users u LEFT JOIN member_profiles p ON p.member_id = u.id
       WHERE u.id = $1 AND u.status <> 'withdrawn' FOR UPDATE OF u`,
      [memberId]
    )
    const m = rows[0]
    if (!m) return false
    // 재가입 제한용 해시 (번호 해시가 없던 예전 회원은 저장된 번호로 계산)
    let phoneHash = m.phone_hash
    if (!phoneHash) {
      try {
        const phone = decryptField(m.phone_enc)
        phoneHash = phone ? hashPhone(phone) : null
      } catch {
        phoneHash = null
      }
    }
    const emailHash = isRealEmail(m.email) ? hashEmail(m.email) : null

    // 법정 보관 기록(주문·배송, DP 충전·사용)은 운영 테이블에서 빼서 분리 보관 (표·칸이 아직 없으면 건너뜀)
    const { rows: retention } = await client.query("SELECT to_regclass('retention.withdrawn_records') AS t")
    if (retention[0].t) {
      const moved = await moveToRetention(client, memberId, kind)
      if (moved === "orders_in_progress") return "orders_in_progress" as const
    }

    for (const table of ["member_identities", "member_profiles", "member_addresses", "member_consents"]) {
      await client.query(`DELETE FROM ${table} WHERE member_id = $1`, [memberId])
    }
    await client.query("DELETE FROM dukji_user_email_credentials WHERE user_id = $1", [memberId])
    // 찜·장바구니·알림 신청·포인트·앱 푸시 기기 (테이블이 아직 없으면 건너뜀)
    for (const table of ["member_likes", "member_cart_items", "member_popup_alerts", "member_point_ledger", "member_point_balances", "member_push_devices"]) {
      const { rows: found } = await client.query("SELECT to_regclass($1) AS t", [table])
      if (found[0].t) await client.query(`DELETE FROM ${table} WHERE member_id = $1`, [memberId])
    }
    // 다 차기 전 3인 스쿼드에서 빠짐 (리더면 해산). 완성된 스쿼드는 '탈퇴 회원'으로 남음 (표·칸이 아직 없으면 건너뜀)
    const { rows: squads } = await client.query("SELECT to_regclass('rewards.squad_members') AS t")
    if (squads[0].t) {
      await client.query("DELETE FROM rewards.squads WHERE leader_id = $1 AND completed_at IS NULL", [memberId])
      await client.query(
        `DELETE FROM rewards.squad_members m USING rewards.squads s
         WHERE m.squad_id = s.id AND s.completed_at IS NULL AND m.member_id = $1`,
        [memberId]
      )
    }
    // 자사 팝업의 남은 예약·웨이팅은 취소 (표·칸이 아직 없으면 건너뜀)
    const { rows: booking } = await client.query("SELECT to_regclass('popup_bookings') AS t")
    if (booking[0].t) {
      await client.query("UPDATE popup_bookings SET status = 'canceled', updated_at = NOW() WHERE member_id = $1 AND status = 'booked'", [memberId])
      await client.query(
        "UPDATE popup_waitings SET status = 'canceled', updated_at = NOW() WHERE member_id = $1 AND status IN ('waiting', 'called')",
        [memberId]
      )
    }
    // 회원 행은 글·기록 참조용 껍데기만 남기고 식별 정보는 모두 지움
    await client.query(
      `UPDATE dukji_users SET
         name = '탈퇴 회원', email = 'withdrawn-' || id || '@invalid.duckji.com', email_verified = FALSE,
         avatar_url = NULL, phone = NULL, phone_hash = NULL, phone_verified_at = NULL, ci_hash = NULL, identity_verified_at = NULL,
         marketing_agreed = FALSE, status = 'withdrawn', withdrawn_at = NOW()
       WHERE id = $1`,
      [memberId]
    )
    const days = REJOIN_WAIT_DAYS[kind]
    await client.query("SAVEPOINT withdrawal_record")
    try {
      await client.query(
        `INSERT INTO member_withdrawals (member_id, email_hash, phone_hash, ci_hash, kind, reason, rejoin_after, purge_after)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(days => $7), NOW() + make_interval(days => $7))
         ON CONFLICT (member_id) DO NOTHING`,
        [memberId, emailHash, phoneHash, m.ci_hash, kind, reason, days]
      )
      await client.query("RELEASE SAVEPOINT withdrawal_record")
    } catch (e: any) {
      // 칸이 없을 때: 이메일 해시만 남김
      if (e?.code !== "42703") throw e
      await client.query("ROLLBACK TO SAVEPOINT withdrawal_record")
      await client.query(
        `INSERT INTO member_withdrawals (member_id, email_hash, reason, purge_after)
         VALUES ($1, $2, $3, NOW() + make_interval(days => $4))
         ON CONFLICT (member_id) DO NOTHING`,
        [memberId, emailHash, reason, days]
      )
    }
    // 제한 기간이 지난 탈퇴 기록의 해시·사유 파기
    await client.query("SAVEPOINT withdrawal_purge")
    try {
      await client.query(
        `UPDATE member_withdrawals SET email_hash = NULL, phone_hash = NULL, ci_hash = NULL, reason = NULL
         WHERE purge_after < NOW() AND (email_hash IS NOT NULL OR phone_hash IS NOT NULL OR ci_hash IS NOT NULL OR reason IS NOT NULL)`
      )
      await client.query("RELEASE SAVEPOINT withdrawal_purge")
    } catch (e: any) {
      if (e?.code !== "42703") throw e
      await client.query("ROLLBACK TO SAVEPOINT withdrawal_purge")
      await client.query(
        "UPDATE member_withdrawals SET email_hash = NULL, reason = NULL WHERE purge_after < NOW() AND (email_hash IS NOT NULL OR reason IS NOT NULL)"
      )
    }
    return true
  })
}

// 정지 중인 회원에게 보여 줄 정지 기간·사유
export async function sanctionOf(memberId: string): Promise<{ until: string | null; reason: string | null }> {
  const { rows } = await db()
    .query<{ suspended_until: Date | null; sanction_reason: string | null }>(
      "SELECT suspended_until, sanction_reason FROM dukji_users WHERE id = $1",
      [memberId]
    )
    .catch(() => ({ rows: [] as { suspended_until: Date | null; sanction_reason: string | null }[] }))
  return { until: rows[0]?.suspended_until?.toISOString() || null, reason: rows[0]?.sanction_reason || null }
}

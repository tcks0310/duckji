import { randomInt } from "crypto"
import { Hono } from "hono"
import type { PoolClient } from "pg"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db, requireDatabase } from "../../shared/db/require-database"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { writeEntry } from "./points"

// 친구 추천
// 회원마다 고유 추천 ID(DJ + 6자리). 가입할 때 추천인 ID 를 적으면 실제 회원인지 확인한 뒤
// 추천인에게 150 DP, 추천인을 적고 가입한 회원에게 50 DP 를 줌. 회원마다 추천인은 한 번만 적을 수 있음
export const REFERRER_DP = 150
export const REFERRED_DP = 50

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 헷갈리는 0·O·1·I 는 뺌
const CODE_RE = /^DJ[A-Z0-9]{6}$/

export class ReferralError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message)
  }
}

export const normalizeReferralCode = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase().replace(/[\s-]/g, "") : "")

const newCode = () => "DJ" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")

// 회원의 추천 ID (없으면 만들어 줌)
export async function ensureReferralCode(client: PoolClient | ReturnType<typeof db>, memberId: string): Promise<string> {
  const { rows } = await client.query<{ referral_code: string | null }>("SELECT referral_code FROM dukji_users WHERE id = $1", [memberId])
  if (!rows[0]) throw new ReferralError(404, "회원 정보를 찾을 수 없습니다.")
  if (rows[0].referral_code) return rows[0].referral_code
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode()
    const updated = await client
      .query<{ referral_code: string }>(
        "UPDATE dukji_users SET referral_code = COALESCE(referral_code, $2) WHERE id = $1 RETURNING referral_code",
        [memberId, code]
      )
      .catch((e) => {
        if (e?.code === "23505") return null // 다른 회원이 쓰는 ID 면 다시 만듦
        throw e
      })
    if (updated?.rows[0]) return updated.rows[0].referral_code
  }
  throw new Error("referral code generation failed")
}

// 추천 ID 로 회원 찾기 (탈퇴·정지 회원은 추천인이 될 수 없음)
async function findReferrer(client: PoolClient | ReturnType<typeof db>, code: string) {
  if (!CODE_RE.test(code)) return null
  const { rows } = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM dukji_users WHERE referral_code = $1 AND status = 'active' AND signup_completed_at IS NOT NULL",
    [code]
  )
  return rows[0] || null
}

// 가입 완료 때 (signup.ts completeSignup 의 트랜잭션 안에서) 추천 기록 + 양쪽 DP 지급
export async function applyReferral(client: PoolClient, referredId: string, rawCode: unknown) {
  const code = normalizeReferralCode(rawCode)
  if (!code) return null
  const referrer = await findReferrer(client, code)
  if (!referrer) throw new ReferralError(404, "추천인 ID 를 찾을 수 없습니다. 다시 확인해주세요.")
  if (referrer.id === referredId) throw new ReferralError(400, "내 추천인 ID 는 적을 수 없습니다.")
  const inserted = await client.query(
    `INSERT INTO member_referrals (referred_id, referrer_id, code, referrer_dp, referred_dp)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (referred_id) DO NOTHING`,
    [referredId, referrer.id, code, REFERRER_DP, REFERRED_DP]
  )
  if (!inserted.rowCount) return null // 이미 추천인을 적은 회원 (가입을 다시 마치는 경우)
  await writeEntry(client, { memberId: referrer.id, amount: REFERRER_DP, reason: "referral_reward", refId: referredId })
  await writeEntry(client, { memberId: referredId, amount: REFERRED_DP, reason: "referral_signup", refId: referrer.id })
  return { referrerName: referrer.name, rewardDp: REFERRED_DP }
}

// 닉네임 일부만 보여 줌 (추천 ID 로 회원 이름을 다 알아낼 수 없게)
const maskName = (name: string) => {
  const chars = Array.from(name)
  if (chars.length <= 1) return name
  if (chars.length === 2) return `${chars[0]}*`
  return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1]
}

export const referralRoute = new Hono<MemberEnv>()
referralRoute.use("*", requireDatabase)

// 가입 화면: 추천인 ID 가 실제 회원인지 확인
referralRoute.get("/check", async (c) => {
  if (!(await consumeQuota("users-referral-check", clientIp(c), 30, 600))) {
    return c.json({ success: false, error: "잠시 후 다시 시도해주세요." }, 429)
  }
  const code = normalizeReferralCode(c.req.query("code"))
  const referrer = code ? await findReferrer(db(), code) : null
  if (!referrer) return c.json({ success: true, valid: false, error: "추천인 ID 를 찾을 수 없습니다." })
  return c.json({ success: true, valid: true, code, name: maskName(referrer.name) })
})

// 마이페이지: 내 추천 ID · 추천으로 가입한 회원 수 · 받은 DP
referralRoute.get("/me", requireMember, async (c) => {
  const memberId = c.get("member").id
  const code = await ensureReferralCode(db(), memberId).catch((e) => {
    if (e instanceof ReferralError) return null
    throw e
  })
  if (!code) return c.json({ success: false, error: "회원 정보를 찾을 수 없습니다. 다시 로그인해주세요." }, 404)
  const { rows } = await db().query<{ n: number; dp: number }>(
    "SELECT COUNT(*)::int AS n, COALESCE(SUM(referrer_dp), 0)::int AS dp FROM member_referrals WHERE referrer_id = $1",
    [memberId]
  )
  const { rows: mine } = await db().query<{ name: string }>(
    "SELECT u.name FROM member_referrals r JOIN dukji_users u ON u.id = r.referrer_id WHERE r.referred_id = $1",
    [memberId]
  )
  return c.json({
    success: true,
    code,
    invitedCount: rows[0].n,
    earnedDp: rows[0].dp,
    referrerDp: REFERRER_DP,
    referredDp: REFERRED_DP,
    referredBy: mine[0] ? maskName(mine[0].name) : null,
  })
})

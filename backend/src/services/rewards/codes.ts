import { db } from "../../shared/db/require-database"
import { CREATOR_CODE_LIMIT, REASONS } from "./rules"
import { earnMemberPoints, memberProfiles, RewardError } from "./shared-tables"
import { tx } from "./tx"

// 보상 코드 (rewards.codes). 회원마다 코드 하나에 한 번, 크리에이터 코드는 회원당 하나만
// 종류: popup = 팝업 관련, goods = 굿즈 관련, general = 일반 배포(이벤트·SNS 등), creator = 크리에이터 제휴
// 연결 대상(target_id·target_name): 팝업이면 팝업 id·이름, 굿즈면 굿즈 이름, 일반 배포면 배포처, 크리에이터면 크리에이터 이름

export const CODE_KINDS = ["popup", "goods", "general", "creator"] as const
export type CodeKind = (typeof CODE_KINDS)[number]
const isKind = (v: unknown): v is CodeKind => typeof v === "string" && (CODE_KINDS as readonly string[]).includes(v)
export const CODE_RE = /^[A-Z0-9-]{3,40}$/
export const normalizeCode = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "")

type CodeRow = {
  code: string
  kind: CodeKind
  name: string
  target_id: string
  target_name: string
  reward_dp: number
  reward_item: string
  max_redemptions: number | null
  starts_at: Date | null
  ends_at: Date | null
  active: boolean
  memo: string
  created_at: Date
  updated_at: Date
  used?: number
}

export const codeFromRow = (r: CodeRow) => ({
  code: r.code,
  kind: r.kind,
  name: r.name,
  targetId: r.target_id,
  targetName: r.target_name,
  rewardDp: r.reward_dp,
  rewardItem: r.reward_item,
  maxRedemptions: r.max_redemptions,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  active: r.active,
  memo: r.memo,
  used: r.used ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// 마이페이지 포인트 관리에서 넣는 코드 (아무 종류나)
export async function redeemCode(memberId: string, raw: unknown) {
  const code = normalizeCode(raw)
  if (!CODE_RE.test(code)) throw new RewardError(400, "코드를 확인해주세요.")
  return tx(async (client) => {
    // 같은 회원 요청이 겹쳐도 한도 확인을 같이 통과하지 못하게
    await client.query("SELECT pg_advisory_xact_lock(hashtext('rewards-code:' || $1))", [memberId])
    const { rows } = await client.query<CodeRow>("SELECT * FROM rewards.codes WHERE code = $1 FOR UPDATE", [code])
    const row = rows[0]
    const now = Date.now()
    if (!row || !row.active || (row.starts_at && row.starts_at.getTime() > now) || (row.ends_at && row.ends_at.getTime() <= now)) {
      throw new RewardError(404, "유효하지 않거나 이미 만료된 코드입니다.", "invalid_code")
    }
    const mine = await client.query("SELECT 1 FROM rewards.code_redemptions WHERE code = $1 AND member_id = $2", [code, memberId])
    if (mine.rowCount) throw new RewardError(409, "이미 등록한 코드입니다.", "already_claimed")
    const kind = row.kind
    if (kind === "creator") {
      const { rows: n } = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM rewards.code_redemptions WHERE member_id = $1 AND kind = 'creator'",
        [memberId]
      )
      if (n[0].n >= CREATOR_CODE_LIMIT) throw new RewardError(409, "크리에이터 코드는 한 번만 등록할 수 있습니다.", "creator_limit")
    }
    if (row.max_redemptions !== null) {
      const { rows: n } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM rewards.code_redemptions WHERE code = $1", [code])
      if (n[0].n >= row.max_redemptions) throw new RewardError(409, "선착순 사용이 끝난 코드입니다.", "sold_out")
    }
    await client.query(
      "INSERT INTO rewards.code_redemptions (code, member_id, kind, reward_dp) VALUES ($1, $2, $3, $4)",
      [code, memberId, kind, row.reward_dp]
    )
    const reason = kind === "creator" ? REASONS.creator : REASONS.promo
    const balance = await earnMemberPoints(client, memberId, row.reward_dp, reason, code, `${row.name} (${code})`)
    return { code, kind, name: row.name, targetName: row.target_name, rewardDp: row.reward_dp, rewardItem: row.reward_item, balance }
  })
}

// 내가 등록한 코드 (kind 를 주면 그 종류만)
export async function myCodes(memberId: string, kind?: CodeKind) {
  const { rows } = await db().query<{ code: string; kind: CodeKind; name: string; reward_dp: number; reward_item: string; created_at: Date }>(
    `SELECT r.code, c.kind, c.name, r.reward_dp, c.reward_item, r.created_at FROM rewards.code_redemptions r
     JOIN rewards.codes c ON c.code = r.code WHERE r.member_id = $1 AND ($2::text IS NULL OR c.kind = $2) ORDER BY r.created_at DESC`,
    [memberId, kind ?? null]
  )
  return rows.map((r) => ({ code: r.code, kind: r.kind, name: r.name, rewardDp: r.reward_dp, rewardItem: r.reward_item, createdAt: r.created_at }))
}

// ---- 관리자 ----

export async function listCodes() {
  const { rows } = await db().query<CodeRow>(
    `SELECT c.*, (SELECT count(*)::int FROM rewards.code_redemptions r WHERE r.code = c.code) AS used
     FROM rewards.codes c ORDER BY c.created_at DESC`
  )
  return rows.map(codeFromRow)
}

export type CodeInput = {
  code?: string
  kind?: CodeKind
  name?: string
  targetId?: string
  targetName?: string
  rewardDp?: number
  rewardItem?: string
  maxRedemptions?: number | null
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  memo?: string
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined)
const dateOrNull = (v: unknown) => {
  if (v === null || v === "") return null
  if (typeof v !== "string") return undefined
  const t = Date.parse(v)
  if (Number.isNaN(t)) throw new RewardError(400, "날짜 형식이 올바르지 않습니다.")
  return new Date(t)
}

// 입력 확인 → 컬럼 값. partial 이면 들어온 칸만
export function validateCode(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {}
  if (!partial) {
    const code = normalizeCode(body.code)
    if (!CODE_RE.test(code)) throw new RewardError(400, "코드는 영문 대문자·숫자·하이픈 3~40자입니다.")
    out.code = code
  }
  if (body.kind !== undefined || !partial) {
    if (!isKind(body.kind)) throw new RewardError(400, "코드 종류를 골라주세요.")
    out.kind = body.kind
  }
  const targetId = str(body.targetId, 100)
  if (targetId !== undefined) out.target_id = targetId
  const targetName = str(body.targetName, 150)
  if (targetName !== undefined) out.target_name = targetName
  if (!partial && body.kind !== "general" && !targetName) {
    throw new RewardError(400, body.kind === "popup" ? "어떤 팝업 코드인지 골라주세요." : body.kind === "goods" ? "어떤 굿즈 코드인지 입력해주세요." : "크리에이터 이름을 입력해주세요.")
  }
  const name = str(body.name, 100)
  if (name !== undefined) {
    if (!name) throw new RewardError(400, "코드 이름을 입력해주세요.")
    out.name = name
  } else if (!partial) throw new RewardError(400, "코드 이름을 입력해주세요.")
  if (body.rewardDp !== undefined || !partial) {
    const dp = Number(body.rewardDp)
    if (!Number.isInteger(dp) || dp < 1 || dp > 5000) throw new RewardError(400, "지급 DP 는 1~5000 사이 정수입니다.")
    out.reward_dp = dp
  }
  const item = str(body.rewardItem, 100)
  if (item !== undefined) out.reward_item = item
  if (body.maxRedemptions !== undefined) {
    if (body.maxRedemptions === null || body.maxRedemptions === "") out.max_redemptions = null
    else {
      const n = Number(body.maxRedemptions)
      if (!Number.isInteger(n) || n < 1) throw new RewardError(400, "사용 횟수 상한은 1 이상 정수입니다.")
      out.max_redemptions = n
    }
  }
  const starts = dateOrNull(body.startsAt)
  if (starts !== undefined) out.starts_at = starts
  const ends = dateOrNull(body.endsAt)
  if (ends !== undefined) out.ends_at = ends
  if (typeof body.active === "boolean") out.active = body.active
  const memo = str(body.memo, 200)
  if (memo !== undefined) out.memo = memo
  return out
}

export async function createCode(values: Record<string, unknown>) {
  const keys = Object.keys(values)
  const { rows } = await db()
    .query<CodeRow>(
      `INSERT INTO rewards.codes (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      keys.map((k) => values[k])
    )
    .catch((e) => {
      if (e?.code === "23505") throw new RewardError(409, "이미 있는 코드입니다.")
      throw e
    })
  return codeFromRow(rows[0])
}

export async function updateCode(code: string, values: Record<string, unknown>) {
  const keys = Object.keys(values)
  if (!keys.length) throw new RewardError(400, "바꿀 내용이 없습니다.")
  const { rows } = await db().query<CodeRow>(
    `UPDATE rewards.codes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = NOW() WHERE code = $1 RETURNING *`,
    [code, ...keys.map((k) => values[k])]
  )
  if (!rows[0]) throw new RewardError(404, "코드를 찾을 수 없습니다.")
  return codeFromRow(rows[0])
}

// 아직 아무도 안 쓴 코드만 지움 (쓴 코드는 끄기)
export async function deleteCode(code: string) {
  return tx(async (client) => {
    const used = await client.query("SELECT 1 FROM rewards.code_redemptions WHERE code = $1 LIMIT 1", [code])
    if (used.rowCount) throw new RewardError(409, "이미 등록한 회원이 있어 지울 수 없습니다. 대신 꺼 주세요.")
    const r = await client.query("DELETE FROM rewards.codes WHERE code = $1", [code])
    if (!r.rowCount) throw new RewardError(404, "코드를 찾을 수 없습니다.")
  })
}

// 코드를 등록한 회원 (최신순)
export async function codeRedemptions(code: string) {
  const { rows } = await db().query<{ member_id: string; reward_dp: number; created_at: Date }>(
    "SELECT member_id, reward_dp, created_at FROM rewards.code_redemptions WHERE code = $1 ORDER BY created_at DESC LIMIT 500",
    [code]
  )
  const profiles = await memberProfiles(db(), rows.map((r) => r.member_id))
  return rows.map((r) => {
    const p = profiles.get(r.member_id)
    return { memberId: r.member_id, name: p?.name ?? "알 수 없는 회원", email: p?.email ?? "", rewardDp: r.reward_dp, createdAt: r.created_at }
  })
}

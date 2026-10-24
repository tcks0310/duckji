import { randomBytes } from "node:crypto"
import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import {
  REASONS,
  SQUAD_COLORS,
  SQUAD_COMPLETE_DP,
  SQUAD_ICONS,
  SQUAD_INTRO_MAX,
  SQUAD_MAX_MEMBERS,
  SQUAD_MESSAGE_MAX,
  SQUAD_NAME_MAX,
  SQUAD_NAME_MIN,
  SQUAD_LINKS_MAX,
  SQUAD_NOTICE_MAX,
  SQUAD_SIZE,
} from "./rules"
import { earnMemberPoints, memberNames, memberPostCount, memberProfiles, RewardError } from "./shared-tables"
import { cleanSquadImageUrl } from "./storage"
import { tx } from "./tx"

// 스쿼드 (rewards.squads / squad_members)
// 길드·소모임처럼: 고유한 이름·아이콘·소개, 정원 SQUAD_MAX_MEMBERS 명, 회원은 한 스쿼드에만
// 가입: 초대 링크(/community/squad?join=<코드>)는 바로, 스쿼드 페이지에서는 '가입 신청' → 리더 승인 (리더가 '바로 가입'으로 바꿀 수 있음)
// 처음으로 SQUAD_SIZE(3)명이 모이면 그때 팀원 전원 DP (회원마다 평생 한 번, 스쿼드마다 한 번만 확인)

type Q = Pick<PoolClient, "query">

const CODE_RE = /^SQ-[A-Z0-9]{6}$/
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 헷갈리는 0·O·1·I 제외
const newCode = () => "SQ-" + Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("")
export const normalizeSquadCode = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "")
const NAME_RE = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.\-]+$/
const NAME_TAKEN = "이미 있는 스쿼드 이름입니다. 다른 이름을 정해주세요."

type SquadRow = {
  id: string
  code: string
  leader_id: string
  name: string
  intro: string
  icon: string
  color: string
  image_url: string | null
  cover_url: string | null
  notice: string
  links: { url: string; label: string }[] | null
  join_policy: "open" | "request"
  hidden: boolean
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

// ---------- 입력 검사 ----------

export function cleanSquadName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""
  if (name.length < SQUAD_NAME_MIN || name.length > SQUAD_NAME_MAX)
    throw new RewardError(400, `스쿼드 이름은 ${SQUAD_NAME_MIN}~${SQUAD_NAME_MAX}자로 정해주세요.`, "invalid_name")
  if (!NAME_RE.test(name)) throw new RewardError(400, "스쿼드 이름은 한글·영문·숫자·공백·_ - . 만 쓸 수 있습니다.", "invalid_name")
  return name
}
const cleanIntro = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, SQUAD_INTRO_MAX) : "")
const cleanIcon = (v: unknown) => ((SQUAD_ICONS as readonly string[]).includes(String(v)) ? String(v) : null)
const cleanColor = (v: unknown) => ((SQUAD_COLORS as readonly string[]).includes(String(v)) ? String(v) : null)
const cleanPolicy = (v: unknown) => (v === "open" || v === "request" ? v : null)
const cleanNotice = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, SQUAD_NOTICE_MAX) : "")
// 스쿼드 홈 SNS 링크 [{ url, label }] (http·https 만, 최대 SQUAD_LINKS_MAX 개)
function cleanLinks(v: unknown): { url: string; label: string }[] {
  if (!Array.isArray(v)) throw new RewardError(400, "링크 형식이 올바르지 않습니다.")
  const links = v
    .map((l) => ({ url: typeof l?.url === "string" ? l.url.trim() : "", label: typeof l?.label === "string" ? l.label.trim().slice(0, 30) : "" }))
    .filter((l) => l.url)
  if (links.length > SQUAD_LINKS_MAX) throw new RewardError(400, `링크는 ${SQUAD_LINKS_MAX}개까지 넣을 수 있습니다.`)
  for (const l of links) {
    if (l.url.length > 500 || !/^https?:\/\/[^\s]+$/i.test(l.url)) throw new RewardError(400, "링크는 http:// 나 https:// 로 시작하는 주소여야 합니다.")
  }
  return links
}

async function nameTaken(client: Q, name: string, exceptId: string | number = 0) {
  const { rowCount } = await client.query("SELECT 1 FROM rewards.squads WHERE lower(name) = lower($1) AND id <> $2", [name, exceptId])
  return (rowCount ?? 0) > 0
}
const uniqueNameError = (err: any) => {
  if (err?.code === "23505" && String(err?.constraint || "").includes("name")) throw new RewardError(409, NAME_TAKEN, "name_taken")
  throw err
}

// 이름 쓸 수 있는지 (만들기·이름 바꾸기 화면에서 미리 확인)
export async function checkSquadName(v: unknown, exceptId = 0) {
  try {
    const name = cleanSquadName(v)
    if (await nameTaken(db(), name, exceptId)) return { ok: false, error: NAME_TAKEN }
    return { ok: true, name }
  } catch (e) {
    if (e instanceof RewardError) return { ok: false, error: e.message }
    throw e
  }
}

// ---------- 공통 ----------

async function assertActiveMember(client: Q, memberId: string) {
  const { rows } = await client.query<{ status: string }>("SELECT status FROM dukji_users WHERE id = $1", [memberId])
  if (!rows[0]) throw new RewardError(404, "회원 정보를 찾을 수 없습니다. 다시 로그인해주세요.")
  if (rows[0].status === "banned") throw new RewardError(403, "이용이 정지된 계정입니다.")
}

async function squadOf(client: Q, memberId: string, lock = false) {
  const { rows } = await client.query<SquadRow>(
    `SELECT s.* FROM rewards.squads s JOIN rewards.squad_members m ON m.squad_id = s.id WHERE m.member_id = $1${lock ? " FOR UPDATE OF s" : ""}`,
    [memberId]
  )
  return rows[0] || null
}

async function squadById(client: Q, id: number | string, lock = false) {
  const { rows } = await client.query<SquadRow>(`SELECT * FROM rewards.squads WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id])
  return rows[0] || null
}

async function memberCount(client: Q, squadId: string) {
  const { rows } = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM rewards.squad_members WHERE squad_id = $1", [squadId])
  return rows[0].n
}

export async function logSquadEvent(
  client: Q,
  squad: Pick<SquadRow, "id" | "name">,
  type: string,
  memberId: string | null,
  actor: string | null,
  detail: Record<string, unknown> = {}
) {
  await client.query("INSERT INTO rewards.squad_events (squad_id, squad_name, type, member_id, actor, detail) VALUES ($1, $2, $3, $4, $5, $6)", [
    squad.id,
    squad.name,
    type,
    memberId,
    actor,
    JSON.stringify(detail),
  ])
}

// 화면에 보이는 스쿼드 모습 (목록 카드·배지 공통)
const squadLook = (s: SquadRow) => ({
  id: Number(s.id),
  name: s.name,
  intro: s.intro,
  icon: s.icon,
  color: s.color,
  imageUrl: s.image_url,
  coverUrl: s.cover_url ?? null,
  notice: s.notice ?? "",
  links: s.links ?? [],
  joinPolicy: s.join_policy,
  createdAt: s.created_at.toISOString(),
  completed: Boolean(s.completed_at),
})

async function membersOf(client: Q, squad: SquadRow) {
  const { rows } = await client.query<{ member_id: string; joined_at: Date }>(
    "SELECT member_id, joined_at FROM rewards.squad_members WHERE squad_id = $1 ORDER BY joined_at, member_id",
    [squad.id]
  )
  const profiles = await memberProfiles(client, rows.map((r) => r.member_id))
  return rows.map((r) => {
    const p = profiles.get(r.member_id)
    return {
      memberId: r.member_id,
      name: p?.name || "회원",
      avatarUrl: p?.avatarUrl ?? null,
      isLeader: r.member_id === squad.leader_id,
      joinedAt: r.joined_at.toISOString(),
    }
  })
}

// 회원에게 보여줄 활동 기록 (관리자 조치 내용·사유는 빼고 무슨 일이 있었는지만)
const PUBLIC_EVENTS = ["created", "joined", "left", "kicked", "renamed", "icon_changed", "leader_changed", "reward_paid"]

async function recentEvents(client: Q, squadId: string, limit: number) {
  const { rows } = await client.query<{ id: string; type: string; member_id: string | null; detail: any; created_at: Date }>(
    "SELECT id, type, member_id, detail, created_at FROM rewards.squad_events WHERE squad_id = $1 AND type = ANY($2) ORDER BY id DESC LIMIT $3",
    [squadId, PUBLIC_EVENTS, limit]
  )
  const names = await memberNames(client, [...new Set(rows.map((r) => r.member_id).filter((v): v is string => !!v))])
  return rows.map((r) => ({
    id: Number(r.id),
    type: r.type,
    memberName: r.member_id ? names.get(r.member_id) || "회원" : null,
    detail: { from: r.detail?.from, to: r.detail?.to, dp: r.detail?.dp, count: r.detail?.memberIds?.length },
    createdAt: r.created_at.toISOString(),
  }))
}

async function chatCounts(client: Q, squadId: string) {
  const { rows } = await client.query<{ total: number; week: number }>(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS week
     FROM rewards.squad_messages WHERE squad_id = $1 AND deleted_at IS NULL`,
    [squadId]
  )
  return rows[0]
}

// ---------- 둘러보기 (누구나) ----------

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m)

export async function listSquads(opts: { q?: string; sort?: string }) {
  const q = (opts.q || "").trim().slice(0, 40)
  const order = opts.sort === "newest" ? "s.created_at DESC, s.id DESC" : "member_count DESC, s.created_at DESC, s.id DESC"
  const { rows } = await db().query<SquadRow & { member_count: number }>(
    `SELECT s.*, (SELECT COUNT(*)::int FROM rewards.squad_members m WHERE m.squad_id = s.id) AS member_count
     FROM rewards.squads s
     WHERE NOT s.hidden AND ($1::text IS NULL OR s.name ILIKE $1 OR s.intro ILIKE $1)
     ORDER BY ${order} LIMIT 200`,
    [q ? `%${likeEscape(q)}%` : null]
  )
  const leaders = await memberNames(db(), [...new Set(rows.map((r) => r.leader_id))])
  const { rows: totals } = await db().query<{ squads: number; members: number }>(
    `SELECT COUNT(*)::int AS squads, (SELECT COUNT(*)::int FROM rewards.squad_members m JOIN rewards.squads s ON s.id = m.squad_id WHERE NOT s.hidden) AS members
     FROM rewards.squads WHERE NOT hidden`
  )
  return {
    squads: rows.map((r) => ({ ...squadLook(r), memberCount: r.member_count, leaderName: leaders.get(r.leader_id) || "회원" })),
    totals: totals[0],
    maxMembers: SQUAD_MAX_MEMBERS,
  }
}

// 스쿼드 상세 (누구나). 숨긴 스쿼드는 그 팀원만 봄
export async function squadDetail(id: number, viewerId: string | null) {
  const client = db()
  const squad = await squadById(client, id)
  const mine = viewerId ? await squadOf(client, viewerId) : null
  const isMember = Boolean(mine && mine.id === squad?.id)
  if (!squad || (squad.hidden && !isMember)) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
  const members = await membersOf(client, squad)
  const [events, chat, posts30d] = await Promise.all([
    recentEvents(client, squad.id, 15),
    chatCounts(client, squad.id),
    memberPostCount(client, members.map((m) => m.memberId), 30),
  ])
  let pendingRequest = false
  if (viewerId && !isMember) {
    const { rowCount } = await client.query("SELECT 1 FROM rewards.squad_join_requests WHERE squad_id = $1 AND member_id = $2 AND status = 'pending'", [
      squad.id,
      viewerId,
    ])
    pendingRequest = (rowCount ?? 0) > 0
  }
  return {
    squad: {
      ...squadLook(squad),
      memberCount: members.length,
      maxMembers: SQUAD_MAX_MEMBERS,
      leaderName: members.find((m) => m.isLeader)?.name || "회원",
      rewardAt: SQUAD_SIZE,
      rewardDp: SQUAD_COMPLETE_DP,
    },
    // 공개 화면이라 회원 id 는 빼고 보냄
    members: members.map(({ memberId, ...m }) => ({ ...m, isMe: memberId === viewerId })),
    activity: { events, chatTotal: chat.total, chatWeek: chat.week, posts30d },
    viewer: {
      loggedIn: Boolean(viewerId),
      isMember,
      inOtherSquad: Boolean(mine && !isMember),
      pendingRequest,
    },
  }
}

// 초대 링크 미리보기 (누구나): 이름·리더·인원
export async function squadPreview(codeInput: unknown) {
  const code = normalizeSquadCode(codeInput)
  if (!CODE_RE.test(code)) throw new RewardError(404, "스쿼드 코드를 확인해주세요.")
  const { rows } = await db().query<SquadRow>("SELECT * FROM rewards.squads WHERE code = $1", [code])
  if (!rows[0]) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
  const members = await memberCount(db(), rows[0].id)
  const names = await memberNames(db(), [rows[0].leader_id])
  return {
    ...squadLook(rows[0]),
    code,
    leaderName: names.get(rows[0].leader_id) || "회원",
    members,
    size: SQUAD_MAX_MEMBERS,
    full: members >= SQUAD_MAX_MEMBERS,
  }
}

// ---------- 내 스쿼드 ----------

async function mySquadView(client: Q, squad: SquadRow, meId: string) {
  const members = await membersOf(client, squad)
  const isLeader = squad.leader_id === meId
  let requests: { id: number; name: string; avatarUrl: string | null; message: string; createdAt: string }[] = []
  if (isLeader) {
    const { rows } = await client.query<{ id: string; member_id: string; message: string; created_at: Date }>(
      "SELECT id, member_id, message, created_at FROM rewards.squad_join_requests WHERE squad_id = $1 AND status = 'pending' ORDER BY id",
      [squad.id]
    )
    const profiles = await memberProfiles(client, rows.map((r) => r.member_id))
    requests = rows.map((r) => ({
      id: Number(r.id),
      name: profiles.get(r.member_id)?.name || "회원",
      avatarUrl: profiles.get(r.member_id)?.avatarUrl ?? null,
      message: r.message,
      createdAt: r.created_at.toISOString(),
    }))
  }
  const chat = await chatCounts(client, squad.id)
  return {
    ...squadLook(squad),
    code: squad.code,
    hidden: squad.hidden,
    size: SQUAD_SIZE, // 보상 인원 (예전 화면 호환)
    maxMembers: SQUAD_MAX_MEMBERS,
    rewardDp: SQUAD_COMPLETE_DP,
    isLeader,
    completedAt: squad.completed_at?.toISOString() ?? null,
    members: members.map((m) => ({ ...m, isMe: m.memberId === meId })),
    requests,
    chatTotal: chat.total,
  }
}

// 내 스쿼드 (없으면 null)
export async function mySquad(memberId: string) {
  const squad = await squadOf(db(), memberId)
  return squad ? mySquadView(db(), squad, memberId) : null
}

export async function createSquad(memberId: string, input: Record<string, unknown>) {
  const name = cleanSquadName(input.name)
  const intro = cleanIntro(input.intro)
  const icon = cleanIcon(input.icon) || "star"
  const color = cleanColor(input.color) || "amber"
  const policy = cleanPolicy(input.joinPolicy) || "request"
  const imageUrl = input.imageUrl ? cleanSquadImageUrl(input.imageUrl) : null
  if (input.imageUrl && !imageUrl) throw new RewardError(400, "아이콘 이미지는 이 화면에서 올린 이미지만 쓸 수 있습니다.")
  return tx(async (client) => {
    await assertActiveMember(client, memberId)
    if (await squadOf(client, memberId)) throw new RewardError(409, "이미 스쿼드에 들어가 있습니다.", "already_in_squad")
    if (await nameTaken(client, name)) throw new RewardError(409, NAME_TAKEN, "name_taken")
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows } = await client
        .query<SquadRow>(
          `INSERT INTO rewards.squads (code, leader_id, name, intro, icon, color, join_policy, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (code) DO NOTHING RETURNING *`,
          [newCode(), memberId, name, intro, icon, color, policy, imageUrl]
        )
        .catch(uniqueNameError)
      if (!rows[0]) continue
      await client.query("INSERT INTO rewards.squad_members (squad_id, member_id) VALUES ($1, $2)", [rows[0].id, memberId]).catch((err) => {
        if (err?.code === "23505") throw new RewardError(409, "이미 스쿼드에 들어가 있습니다.", "already_in_squad")
        throw err
      })
      await cancelPendingRequests(client, memberId)
      await logSquadEvent(client, rows[0], "created", memberId, memberId)
      return mySquadView(client, rows[0], memberId)
    }
    throw new Error("squad code collision")
  })
}

async function cancelPendingRequests(client: Q, memberId: string) {
  await client.query("UPDATE rewards.squad_join_requests SET status = 'cancelled', decided_at = NOW() WHERE member_id = $1 AND status = 'pending'", [memberId])
}

// 팀원으로 넣기 (스쿼드는 잠근 상태로). 처음으로 SQUAD_SIZE 명이 되면 완성 → 팀원 전원 DP (이미 받은 회원은 건너뜀)
async function addMember(client: PoolClient, squad: SquadRow, memberId: string, actor: string, via: string) {
  await assertActiveMember(client, memberId)
  const current = await squadOf(client, memberId)
  if (current) {
    throw new RewardError(409, current.id === squad.id ? "이미 이 스쿼드의 팀원입니다." : "이미 다른 스쿼드에 들어가 있습니다.", "already_in_squad")
  }
  const count = await memberCount(client, squad.id)
  if (count >= SQUAD_MAX_MEMBERS) throw new RewardError(409, `정원(${SQUAD_MAX_MEMBERS}명)이 다 찬 스쿼드입니다.`, "full")
  await client.query("INSERT INTO rewards.squad_members (squad_id, member_id) VALUES ($1, $2)", [squad.id, memberId]).catch((err) => {
    if (err?.code === "23505") throw new RewardError(409, "이미 다른 스쿼드에 들어가 있습니다.", "already_in_squad")
    throw err
  })
  await cancelPendingRequests(client, memberId)
  await logSquadEvent(client, squad, "joined", memberId, actor, { via })

  const rewarded: string[] = []
  if (!squad.completed_at && count + 1 >= SQUAD_SIZE) {
    const { rows: done } = await client.query<SquadRow>("UPDATE rewards.squads SET completed_at = NOW() WHERE id = $1 RETURNING *", [squad.id])
    Object.assign(squad, done[0])
    const { rows: members } = await client.query<{ member_id: string }>("SELECT member_id FROM rewards.squad_members WHERE squad_id = $1", [squad.id])
    for (const m of members) {
      // 회원마다 평생 한 번 (refId 고정). 이미 받았으면 건너뜀
      const got = await client.query("SELECT 1 FROM member_point_ledger WHERE member_id = $1 AND reason = $2", [m.member_id, REASONS.squad])
      if (got.rowCount) continue
      await earnMemberPoints(client, m.member_id, SQUAD_COMPLETE_DP, REASONS.squad, "squad")
      rewarded.push(m.member_id)
    }
    await logSquadEvent(client, squad, "reward_paid", null, null, { dp: SQUAD_COMPLETE_DP, memberIds: rewarded })
  }
  return rewarded
}

// 초대 코드로 바로 들어가기
export async function joinSquad(memberId: string, codeInput: unknown) {
  const code = normalizeSquadCode(codeInput)
  if (!CODE_RE.test(code)) throw new RewardError(404, "스쿼드 코드를 확인해주세요.")
  return tx(async (client) => {
    const { rows } = await client.query<SquadRow>("SELECT * FROM rewards.squads WHERE code = $1 FOR UPDATE", [code])
    const squad = rows[0]
    if (!squad) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
    const rewarded = await addMember(client, squad, memberId, memberId, "invite")
    return { squad: await mySquadView(client, squad, memberId), rewardDp: rewarded.includes(memberId) ? SQUAD_COMPLETE_DP : 0 }
  })
}

// 스쿼드 페이지에서 가입: '바로 가입' 스쿼드면 바로, 아니면 가입 신청
export async function applyToSquad(memberId: string, squadId: number, messageInput: unknown) {
  const message = typeof messageInput === "string" ? messageInput.replace(/\s+/g, " ").trim().slice(0, 200) : ""
  return tx(async (client) => {
    const squad = await squadById(client, squadId, true)
    if (!squad || squad.hidden) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
    if (squad.join_policy === "open") {
      const rewarded = await addMember(client, squad, memberId, memberId, "open")
      return { joined: true, rewardDp: rewarded.includes(memberId) ? SQUAD_COMPLETE_DP : 0 }
    }
    await assertActiveMember(client, memberId)
    if (await squadOf(client, memberId)) throw new RewardError(409, "이미 스쿼드에 들어가 있습니다. 나온 뒤 신청해주세요.", "already_in_squad")
    if ((await memberCount(client, squad.id)) >= SQUAD_MAX_MEMBERS) throw new RewardError(409, `정원(${SQUAD_MAX_MEMBERS}명)이 다 찬 스쿼드입니다.`, "full")
    const { rows: open } = await client.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM rewards.squad_join_requests WHERE member_id = $1 AND status = 'pending'",
      [memberId]
    )
    if (open[0].n >= 5) throw new RewardError(409, "가입 신청은 한 번에 5곳까지 할 수 있습니다.")
    await client
      .query("INSERT INTO rewards.squad_join_requests (squad_id, member_id, message) VALUES ($1, $2, $3)", [squad.id, memberId, message])
      .catch((err) => {
        if (err?.code === "23505") throw new RewardError(409, "이미 가입 신청을 보냈습니다. 리더의 승인을 기다려주세요.", "already_requested")
        throw err
      })
    return { joined: false, requested: true, rewardDp: 0 }
  })
}

export async function cancelApplication(memberId: string, squadId: number) {
  const { rowCount } = await db().query(
    "UPDATE rewards.squad_join_requests SET status = 'cancelled', decided_at = NOW() WHERE squad_id = $1 AND member_id = $2 AND status = 'pending'",
    [squadId, memberId]
  )
  if (!rowCount) throw new RewardError(404, "보낸 가입 신청이 없습니다.")
  return { cancelled: true }
}

async function leaderSquad(client: Q, memberId: string) {
  const squad = await squadOf(client, memberId, true)
  if (!squad) throw new RewardError(404, "들어가 있는 스쿼드가 없습니다.")
  if (squad.leader_id !== memberId) throw new RewardError(403, "스쿼드 리더만 할 수 있습니다.")
  return squad
}

// 리더: 가입 신청 승인·거절
export async function decideRequest(leaderId: string, requestId: number, approve: boolean) {
  return tx(async (client) => {
    const squad = await leaderSquad(client, leaderId)
    const { rows } = await client.query<{ id: string; member_id: string }>(
      "SELECT id, member_id FROM rewards.squad_join_requests WHERE id = $1 AND squad_id = $2 AND status = 'pending' FOR UPDATE",
      [requestId, squad.id]
    )
    if (!rows[0]) throw new RewardError(404, "처리할 가입 신청이 없습니다.")
    if (approve) {
      const other = await squadOf(client, rows[0].member_id)
      if (other) {
        await client.query("UPDATE rewards.squad_join_requests SET status = 'cancelled', decided_at = NOW() WHERE id = $1", [requestId])
        return { squad: await mySquadView(client, squad, leaderId), notice: "그 회원은 이미 다른 스쿼드에 들어가 신청이 취소됐습니다." }
      }
      await addMember(client, squad, rows[0].member_id, leaderId, "request")
    }
    await client.query("UPDATE rewards.squad_join_requests SET status = $2, decided_at = NOW() WHERE id = $1 AND status = 'pending'", [
      requestId,
      approve ? "approved" : "rejected",
    ])
    return { squad: await mySquadView(client, squad, leaderId), notice: approve ? "새 팀원이 들어왔어요." : "가입 신청을 거절했어요." }
  })
}

// 리더: 이름·소개·아이콘·가입 방식 바꾸기
export async function updateMySquad(leaderId: string, input: Record<string, unknown>) {
  return tx(async (client) => {
    const squad = await leaderSquad(client, leaderId)
    const sets: string[] = []
    const params: unknown[] = [squad.id]
    const set = (col: string, v: unknown) => {
      params.push(v)
      sets.push(`${col} = $${params.length}`)
    }
    const events: [string, Record<string, unknown>][] = []
    if (input.name !== undefined) {
      const name = cleanSquadName(input.name)
      if (name !== squad.name) {
        if (await nameTaken(client, name, squad.id)) throw new RewardError(409, NAME_TAKEN, "name_taken")
        set("name", name)
        events.push(["renamed", { from: squad.name, to: name }])
      }
    }
    if (input.intro !== undefined) {
      const intro = cleanIntro(input.intro)
      if (intro !== squad.intro) {
        set("intro", intro)
        events.push(["intro_changed", {}])
      }
    }
    let iconChanged = false
    if (input.icon !== undefined) {
      const icon = cleanIcon(input.icon)
      if (!icon) throw new RewardError(400, "아이콘을 다시 골라주세요.")
      if (icon !== squad.icon) {
        set("icon", icon)
        iconChanged = true
      }
    }
    if (input.color !== undefined) {
      const color = cleanColor(input.color)
      if (!color) throw new RewardError(400, "색을 다시 골라주세요.")
      if (color !== squad.color) {
        set("color", color)
        iconChanged = true
      }
    }
    if (input.imageUrl !== undefined) {
      const url = input.imageUrl === null || input.imageUrl === "" ? null : cleanSquadImageUrl(input.imageUrl)
      if (input.imageUrl && !url) throw new RewardError(400, "아이콘 이미지는 이 화면에서 올린 이미지만 쓸 수 있습니다.")
      if (url !== squad.image_url) {
        set("image_url", url)
        iconChanged = true
      }
    }
    if (iconChanged) events.push(["icon_changed", {}])
    // 스쿼드 홈 꾸미기: 큰 사진·공지·SNS 링크
    if (input.coverUrl !== undefined) {
      const url = input.coverUrl === null || input.coverUrl === "" ? null : cleanSquadImageUrl(input.coverUrl)
      if (input.coverUrl && !url) throw new RewardError(400, "스쿼드 홈 사진은 이 화면에서 올린 이미지만 쓸 수 있습니다.")
      if (url !== squad.cover_url) {
        set("cover_url", url)
        events.push(["home_changed", {}])
      }
    }
    if (input.notice !== undefined) {
      const notice = cleanNotice(input.notice)
      if (notice !== squad.notice) set("notice", notice)
    }
    if (input.links !== undefined) set("links", JSON.stringify(cleanLinks(input.links)))
    if (input.joinPolicy !== undefined) {
      const policy = cleanPolicy(input.joinPolicy)
      if (!policy) throw new RewardError(400, "가입 방식을 다시 골라주세요.")
      if (policy !== squad.join_policy) {
        set("join_policy", policy)
        events.push(["policy_changed", { to: policy }])
      }
    }
    if (!sets.length) return mySquadView(client, squad, leaderId)
    const { rows } = await client
      .query<SquadRow>(`UPDATE rewards.squads SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`, params)
      .catch(uniqueNameError)
    for (const [type, detail] of events) await logSquadEvent(client, rows[0], type, null, leaderId, detail)
    return mySquadView(client, rows[0], leaderId)
  })
}

// 리더: 팀원 내보내기
export async function kickMember(leaderId: string, targetId: unknown) {
  if (typeof targetId !== "string" || !targetId) throw new RewardError(400, "내보낼 팀원을 골라주세요.")
  if (targetId === leaderId) throw new RewardError(400, "리더는 자신을 내보낼 수 없습니다.")
  return tx(async (client) => {
    const squad = await leaderSquad(client, leaderId)
    const { rowCount } = await client.query("DELETE FROM rewards.squad_members WHERE squad_id = $1 AND member_id = $2", [squad.id, targetId])
    if (!rowCount) throw new RewardError(404, "이 스쿼드의 팀원이 아닙니다.")
    await logSquadEvent(client, squad, "kicked", targetId, leaderId)
    return mySquadView(client, squad, leaderId)
  })
}

// 리더: 리더 넘기기
export async function transferLeader(leaderId: string, targetId: unknown) {
  if (typeof targetId !== "string" || !targetId || targetId === leaderId) throw new RewardError(400, "리더를 넘길 팀원을 골라주세요.")
  return tx(async (client) => {
    const squad = await leaderSquad(client, leaderId)
    const { rowCount } = await client.query("SELECT 1 FROM rewards.squad_members WHERE squad_id = $1 AND member_id = $2", [squad.id, targetId])
    if (!rowCount) throw new RewardError(404, "이 스쿼드의 팀원이 아닙니다.")
    const { rows } = await client.query<SquadRow>("UPDATE rewards.squads SET leader_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [
      squad.id,
      targetId,
    ])
    await logSquadEvent(client, rows[0], "leader_changed", targetId, leaderId, { from: leaderId })
    return mySquadView(client, rows[0], leaderId)
  })
}

// 나가기. 리더는 다른 팀원이 있으면 리더를 넘긴 뒤 나갈 수 있고, 혼자면 스쿼드가 해산됨
export async function leaveSquad(memberId: string) {
  return tx(async (client) => {
    const squad = await squadOf(client, memberId, true)
    if (!squad) throw new RewardError(404, "들어가 있는 스쿼드가 없습니다.")
    if (squad.leader_id === memberId) {
      if ((await memberCount(client, squad.id)) > 1) throw new RewardError(409, "리더는 다른 팀원에게 리더를 넘긴 뒤 나갈 수 있습니다.", "leader_must_transfer")
      await logSquadEvent(client, squad, "disbanded", memberId, memberId)
      await client.query("DELETE FROM rewards.squads WHERE id = $1", [squad.id])
      return { disbanded: true }
    }
    await client.query("DELETE FROM rewards.squad_members WHERE squad_id = $1 AND member_id = $2", [squad.id, memberId])
    await logSquadEvent(client, squad, "left", memberId, memberId)
    return { disbanded: false }
  })
}

// 리더: 스쿼드 해산 (팀원 모두 빠짐)
export async function disbandMySquad(leaderId: string) {
  return tx(async (client) => {
    const squad = await leaderSquad(client, leaderId)
    await logSquadEvent(client, squad, "disbanded", null, leaderId, { members: await memberCount(client, squad.id) })
    await client.query("DELETE FROM rewards.squads WHERE id = $1", [squad.id])
    return { disbanded: true }
  })
}

// ---------- 스쿼드 채팅 (팀원만, 화면이 몇 초마다 새 메시지를 불러옴) ----------

type MessageRow = { id: string; member_id: string; body: string; created_at: Date; deleted_at: Date | null }

async function messageViews(client: Q, rows: MessageRow[], meId: string | null, leaderId: string) {
  const profiles = await memberProfiles(client, [...new Set(rows.map((r) => r.member_id))])
  return rows.map((r) => ({
    id: Number(r.id),
    name: profiles.get(r.member_id)?.name || "회원",
    avatarUrl: profiles.get(r.member_id)?.avatarUrl ?? null,
    isMe: r.member_id === meId,
    isLeader: r.member_id === leaderId,
    body: r.deleted_at ? "" : r.body,
    deleted: Boolean(r.deleted_at),
    createdAt: r.created_at.toISOString(),
  }))
}

// after 가 있으면 그 뒤 새 메시지만, 없으면 최근 50개. before 가 있으면 그 앞 50개 (위로 더 보기)
export async function listMessages(memberId: string, opts: { after?: number; before?: number }) {
  const squad = await squadOf(db(), memberId)
  if (!squad) throw new RewardError(404, "들어가 있는 스쿼드가 없습니다.")
  let rows: MessageRow[]
  if (opts.after) {
    ;({ rows } = await db().query<MessageRow>(
      "SELECT id, member_id, body, created_at, deleted_at FROM rewards.squad_messages WHERE squad_id = $1 AND id > $2 ORDER BY id LIMIT 100",
      [squad.id, opts.after]
    ))
  } else {
    ;({ rows } = await db().query<MessageRow>(
      `SELECT id, member_id, body, created_at, deleted_at FROM rewards.squad_messages
       WHERE squad_id = $1 AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT 50`,
      [squad.id, opts.before || null]
    ))
    rows.reverse()
  }
  return { messages: await messageViews(db(), rows, memberId, squad.leader_id), canModerate: squad.leader_id === memberId }
}

export async function postMessage(memberId: string, bodyInput: unknown) {
  const body = typeof bodyInput === "string" ? bodyInput.replace(/\r\n/g, "\n").trim() : ""
  if (!body) throw new RewardError(400, "메시지를 입력해주세요.")
  if (body.length > SQUAD_MESSAGE_MAX) throw new RewardError(400, `메시지는 ${SQUAD_MESSAGE_MAX}자까지 쓸 수 있습니다.`)
  const squad = await squadOf(db(), memberId)
  if (!squad) throw new RewardError(404, "들어가 있는 스쿼드가 없습니다.")
  await assertActiveMember(db(), memberId)
  const { rows } = await db().query<MessageRow>(
    "INSERT INTO rewards.squad_messages (squad_id, member_id, body) VALUES ($1, $2, $3) RETURNING id, member_id, body, created_at, deleted_at",
    [squad.id, memberId, body]
  )
  return { message: (await messageViews(db(), rows, memberId, squad.leader_id))[0] }
}

// 내 메시지 또는 (리더면) 우리 스쿼드 메시지 지우기
export async function deleteMessage(memberId: string, messageId: number) {
  const squad = await squadOf(db(), memberId)
  if (!squad) throw new RewardError(404, "들어가 있는 스쿼드가 없습니다.")
  const { rowCount } = await db().query(
    `UPDATE rewards.squad_messages SET deleted_at = NOW(), deleted_by = $3
     WHERE id = $1 AND squad_id = $2 AND deleted_at IS NULL AND (member_id = $3 OR $4)`,
    [messageId, squad.id, memberId, squad.leader_id === memberId]
  )
  if (!rowCount) throw new RewardError(404, "지울 수 있는 메시지가 없습니다.")
  return { deleted: true }
}

// 아이콘 이미지 업로드 전 확인: 스쿼드 리더만
export async function isSquadLeader(memberId: string) {
  const squad = await squadOf(db(), memberId)
  return Boolean(squad && squad.leader_id === memberId)
}

// 스쿼드 아이콘 이미지를 올릴 수 있는 회원: 리더, 또는 스쿼드를 새로 만들려는(아직 스쿼드가 없는) 회원
export async function canUploadSquadImage(memberId: string) {
  const squad = await squadOf(db(), memberId)
  return !squad || squad.leader_id === memberId
}

// ======================= 관리자 =======================

export async function squadStats() {
  const { rows } = await db().query(
    `SELECT COUNT(*)::int AS total, COUNT(completed_at)::int AS completed, COUNT(*) FILTER (WHERE hidden)::int AS hidden,
            (SELECT COUNT(*)::int FROM rewards.squad_members) AS members,
            (SELECT COUNT(*)::int FROM rewards.squad_messages WHERE created_at > NOW() - INTERVAL '1 day' AND deleted_at IS NULL) AS "messagesToday",
            (SELECT COUNT(*)::int FROM rewards.squad_join_requests WHERE status = 'pending') AS "pendingRequests"
     FROM rewards.squads`
  )
  return rows[0]
}

export async function adminListSquads(qInput: unknown) {
  const q = typeof qInput === "string" ? qInput.trim().slice(0, 60) : ""
  const like = q ? `%${likeEscape(q)}%` : null
  const { rows } = await db().query<SquadRow & { member_count: number; message_count: number; last_activity: Date | null }>(
    `SELECT s.*,
            (SELECT COUNT(*)::int FROM rewards.squad_members m WHERE m.squad_id = s.id) AS member_count,
            (SELECT COUNT(*)::int FROM rewards.squad_messages c WHERE c.squad_id = s.id AND c.deleted_at IS NULL) AS message_count,
            GREATEST((SELECT max(created_at) FROM rewards.squad_events e WHERE e.squad_id = s.id),
                     (SELECT max(created_at) FROM rewards.squad_messages c WHERE c.squad_id = s.id)) AS last_activity
     FROM rewards.squads s
     WHERE $1::text IS NULL OR s.name ILIKE $1 OR s.code ILIKE $1 OR s.intro ILIKE $1
        OR s.leader_id IN (SELECT id FROM dukji_users WHERE name ILIKE $1 OR id ILIKE $1)
        OR s.id IN (SELECT squad_id FROM rewards.squad_members WHERE member_id IN (SELECT id FROM dukji_users WHERE name ILIKE $1 OR id ILIKE $1))
     ORDER BY s.created_at DESC, s.id DESC LIMIT 300`,
    [like]
  )
  const leaders = await memberNames(db(), [...new Set(rows.map((r) => r.leader_id))])
  const { rows: actions } = await db().query(
    "SELECT id, squad_id, squad_name, action, reason, detail, actor, created_at FROM rewards.squad_admin_actions ORDER BY id DESC LIMIT 20"
  )
  return {
    squads: rows.map((r) => ({
      ...squadLook(r),
      code: r.code,
      hidden: r.hidden,
      leaderId: r.leader_id,
      leaderName: leaders.get(r.leader_id) || "회원",
      memberCount: r.member_count,
      messageCount: r.message_count,
      lastActivityAt: r.last_activity?.toISOString() ?? null,
    })),
    stats: await squadStats(),
    recentActions: actions.map(adminActionView),
  }
}

const adminActionView = (r: any) => ({
  id: Number(r.id),
  squadId: Number(r.squad_id),
  squadName: r.squad_name,
  action: r.action,
  reason: r.reason,
  detail: r.detail,
  actor: r.actor,
  createdAt: r.created_at.toISOString(),
})

export async function adminSquadDetail(id: number) {
  const client = db()
  const squad = await squadById(client, id)
  if (!squad) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
  const { rows: memberRows } = await client.query<{ member_id: string; joined_at: Date }>(
    "SELECT member_id, joined_at FROM rewards.squad_members WHERE squad_id = $1 ORDER BY joined_at",
    [squad.id]
  )
  const profiles = await memberProfiles(client, memberRows.map((r) => r.member_id))
  const { rows: eventRows } = await client.query(
    "SELECT id, type, member_id, actor, detail, created_at FROM rewards.squad_events WHERE squad_id = $1 ORDER BY id DESC LIMIT 200",
    [squad.id]
  )
  const { rows: actionRows } = await client.query(
    "SELECT id, squad_id, squad_name, action, reason, detail, actor, created_at FROM rewards.squad_admin_actions WHERE squad_id = $1 ORDER BY id DESC LIMIT 100",
    [squad.id]
  )
  const { rows: msgRows } = await client.query<MessageRow & { deleted_by: string | null }>(
    "SELECT id, member_id, body, created_at, deleted_at, deleted_by FROM rewards.squad_messages WHERE squad_id = $1 ORDER BY id DESC LIMIT 100",
    [squad.id]
  )
  const { rows: reqRows } = await client.query<{ id: string; member_id: string; message: string; status: string; created_at: Date }>(
    "SELECT id, member_id, message, status, created_at FROM rewards.squad_join_requests WHERE squad_id = $1 ORDER BY id DESC LIMIT 50",
    [squad.id]
  )
  const otherIds = [
    ...eventRows.flatMap((e: any) => [e.member_id, e.actor]),
    ...msgRows.map((m) => m.member_id),
    ...reqRows.map((r) => r.member_id),
  ].filter((v): v is string => typeof v === "string" && !v.startsWith("admin"))
  const names = await memberNames(client, [...new Set(otherIds)])
  const chat = await chatCounts(client, squad.id)
  const { rows: totalMsgs } = await client.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM rewards.squad_messages WHERE squad_id = $1", [squad.id])
  const posts30d = await memberPostCount(client, memberRows.map((r) => r.member_id), 30)
  const nameOf = (id: string | null) => (!id ? null : id.startsWith("admin") ? "관리자" : names.get(id) || profiles.get(id)?.name || id)
  return {
    squad: { ...squadLook(squad), code: squad.code, hidden: squad.hidden, leaderId: squad.leader_id, updatedAt: squad.updated_at.toISOString() },
    members: memberRows.map((r) => {
      const p = profiles.get(r.member_id)
      return {
        memberId: r.member_id,
        name: p?.name || "회원",
        email: p?.email || "",
        avatarUrl: p?.avatarUrl ?? null,
        status: p?.status || "unknown",
        signedUpAt: p?.joinedAt ?? null,
        isLeader: r.member_id === squad.leader_id,
        joinedAt: r.joined_at.toISOString(),
      }
    }),
    events: eventRows.map((e: any) => ({
      id: Number(e.id),
      type: e.type,
      memberName: nameOf(e.member_id),
      actorName: nameOf(e.actor),
      detail: e.detail,
      createdAt: e.created_at.toISOString(),
    })),
    adminActions: actionRows.map(adminActionView),
    messages: msgRows.map((m) => ({
      id: Number(m.id),
      memberId: m.member_id,
      name: nameOf(m.member_id),
      body: m.body,
      deleted: Boolean(m.deleted_at),
      deletedBy: m.deleted_by ? nameOf(m.deleted_by) : null,
      createdAt: m.created_at.toISOString(),
    })),
    requests: reqRows.map((r) => ({ id: Number(r.id), name: nameOf(r.member_id), message: r.message, status: r.status, createdAt: r.created_at.toISOString() })),
    activity: { chatTotal: chat.total, chatWeek: chat.week, chatAll: totalMsgs[0].n, posts30d },
  }
}

async function logAdminAction(
  client: Q,
  squad: Pick<SquadRow, "id" | "name">,
  action: string,
  actor: string,
  reason: string | null,
  detail: Record<string, unknown> = {}
) {
  await client.query(
    "INSERT INTO rewards.squad_admin_actions (squad_id, squad_name, action, reason, detail, actor) VALUES ($1, $2, $3, $4, $5, $6)",
    [squad.id, squad.name, action, reason, JSON.stringify(detail), actor]
  )
}
const cleanReason = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null)

// 관리자: 강제 이름 변경·숨김/보이기·소개 비우기
export async function adminUpdateSquad(id: number, input: Record<string, unknown>, actor: string) {
  const reason = cleanReason(input.reason)
  return tx(async (client) => {
    const squad = await squadById(client, id, true)
    if (!squad) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
    let current = squad
    if (input.name !== undefined) {
      const name = cleanSquadName(input.name)
      if (name !== squad.name) {
        if (await nameTaken(client, name, squad.id)) throw new RewardError(409, NAME_TAKEN, "name_taken")
        const { rows } = await client
          .query<SquadRow>("UPDATE rewards.squads SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [squad.id, name])
          .catch(uniqueNameError)
        current = rows[0]
        await logSquadEvent(client, current, "renamed", null, actor, { from: squad.name, to: name, byAdmin: true })
        await logAdminAction(client, current, "rename", actor, reason, { from: squad.name, to: name })
      }
    }
    if (input.clearIntro === true && current.intro) {
      const { rows } = await client.query<SquadRow>("UPDATE rewards.squads SET intro = '', updated_at = NOW() WHERE id = $1 RETURNING *", [squad.id])
      await logAdminAction(client, current, "clear_intro", actor, reason, { intro: current.intro })
      current = rows[0]
    }
    if (input.clearImage === true && current.image_url) {
      const { rows } = await client.query<SquadRow>("UPDATE rewards.squads SET image_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING *", [squad.id])
      await logSquadEvent(client, current, "icon_changed", null, actor, { byAdmin: true })
      await logAdminAction(client, current, "clear_image", actor, reason, { imageUrl: current.image_url })
      current = rows[0]
    }
    if (typeof input.hidden === "boolean" && input.hidden !== current.hidden) {
      const { rows } = await client.query<SquadRow>("UPDATE rewards.squads SET hidden = $2, updated_at = NOW() WHERE id = $1 RETURNING *", [
        squad.id,
        input.hidden,
      ])
      current = rows[0]
      await logSquadEvent(client, current, input.hidden ? "hidden" : "shown", null, actor)
      await logAdminAction(client, current, input.hidden ? "hide" : "show", actor, reason)
    }
    return { updated: true }
  })
}

export async function adminDisbandSquad(id: number, reasonInput: unknown, actor: string) {
  const reason = cleanReason(reasonInput)
  return tx(async (client) => {
    const squad = await squadById(client, id, true)
    if (!squad) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
    const { rows } = await client.query<{ member_id: string }>("SELECT member_id FROM rewards.squad_members WHERE squad_id = $1", [squad.id])
    await logSquadEvent(client, squad, "disbanded", null, actor, { byAdmin: true, members: rows.length })
    await logAdminAction(client, squad, "disband", actor, reason, { code: squad.code, leaderId: squad.leader_id, memberIds: rows.map((r) => r.member_id) })
    await client.query("DELETE FROM rewards.squads WHERE id = $1", [squad.id])
    return { disbanded: true }
  })
}

// 관리자: 팀원 제외. 리더면 가장 먼저 들어온 팀원이 리더가 되고, 혼자였으면 해산
export async function adminRemoveMember(id: number, memberId: unknown, reasonInput: unknown, actor: string) {
  if (typeof memberId !== "string" || !memberId) throw new RewardError(400, "제외할 팀원을 골라주세요.")
  const reason = cleanReason(reasonInput)
  return tx(async (client) => {
    const squad = await squadById(client, id, true)
    if (!squad) throw new RewardError(404, "없거나 해산된 스쿼드입니다.")
    const { rowCount } = await client.query("DELETE FROM rewards.squad_members WHERE squad_id = $1 AND member_id = $2", [squad.id, memberId])
    if (!rowCount) throw new RewardError(404, "이 스쿼드의 팀원이 아닙니다.")
    await logSquadEvent(client, squad, "kicked", memberId, actor, { byAdmin: true })
    await logAdminAction(client, squad, "remove_member", actor, reason, { memberId })
    if (squad.leader_id !== memberId) return { disbanded: false }
    const { rows } = await client.query<{ member_id: string }>(
      "SELECT member_id FROM rewards.squad_members WHERE squad_id = $1 ORDER BY joined_at LIMIT 1",
      [squad.id]
    )
    if (!rows[0]) {
      await logSquadEvent(client, squad, "disbanded", null, actor, { byAdmin: true, members: 0 })
      await client.query("DELETE FROM rewards.squads WHERE id = $1", [squad.id])
      return { disbanded: true }
    }
    await client.query("UPDATE rewards.squads SET leader_id = $2, updated_at = NOW() WHERE id = $1", [squad.id, rows[0].member_id])
    await logSquadEvent(client, squad, "leader_changed", rows[0].member_id, actor, { from: memberId, byAdmin: true })
    return { disbanded: false }
  })
}

export async function adminDeleteMessage(messageId: number, actor: string) {
  return tx(async (client) => {
    const { rows } = await client.query<{ squad_id: string; member_id: string; body: string }>(
      "UPDATE rewards.squad_messages SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING squad_id, member_id, body",
      [messageId, actor]
    )
    if (!rows[0]) throw new RewardError(404, "지울 메시지가 없습니다.")
    const squad = await squadById(client, rows[0].squad_id)
    await logAdminAction(client, { id: rows[0].squad_id, name: squad?.name || "" }, "delete_message", actor, null, {
      messageId,
      memberId: rows[0].member_id,
      body: rows[0].body.slice(0, 200),
    })
    return { deleted: true }
  })
}

import { buildTextSearch } from "../../shared/search/text-search"
import { randomUUID } from "crypto"
import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import {
  PUBLIC_STATUSES,
  TYPE_NAMES,
  hasGoods,
  type Comment,
  type EditInput,
  type Message,
  type Notice,
  type Quote,
  type QuoteInput,
  type SetupInput,
  type Topic,
  type ParticipateInput,
  type Participant,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type Report,
  type ReportInput,
  type ReportStatus,
  type Reward,
} from "./project-types"
import { earnMemberPoints, JOIN_REWARD, memberCards, OPEN_REWARD, refundDp, spendDp } from "./shared-tables"

// 덕질펀딩 프로젝트 저장소
// 모금액·참여 인원·좋아요·댓글 수는 프로젝트 행에 누적하고, 바꿀 때는 트랜잭션 안에서 행을 잠금

type Row = Record<string, any>
type Member = { id: string; name: string; avatarUrl?: string }

// 라우트에서 그대로 상태 코드로 돌려주는 업무 오류
export class FundingError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message)
  }
}

const iso = (v: Date) => v.toISOString()
const orUndef = <T>(v: T | null | "") => (v === null || v === "" ? undefined : v)

const rewardFromRow = (r: Row): Reward => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  price: r.price,
  roleType: r.role_type,
  maxQuantity: orUndef(r.max_quantity),
  currentQuantity: r.current_quantity,
  itemsIncluded: r.items_included,
})

const projectFromRow = (r: Row, rewards: Reward[]): Project => ({
  ...r.details,
  id: r.id,
  type: r.type,
  typeName: TYPE_NAMES[r.type as Project["type"]],
  title: r.title,
  summary: r.summary,
  description: r.description,
  creatorId: r.creator_id,
  creatorName: r.creator_name,
  creatorLevel: r.creator_level,
  creatorAvatar: orUndef(r.creator_avatar),
  status: r.status,
  rejectionReason: orUndef(r.rejection_reason),
  topicId: orUndef(r.topic_id),
  topicName: orUndef(r.topic_name),
  managerName: orUndef(r.manager_name),
  openedAt: r.opened_at ? iso(r.opened_at) : undefined,
  isOfficialLicense: r.is_official_license,
  isSample: r.is_sample,
  targetAmount: Number(r.target_amount),
  currentAmount: Number(r.current_amount),
  targetCount: r.target_count,
  currentCount: r.current_count,
  startDate: iso(r.start_date),
  endDate: iso(r.end_date),
  ageRestriction: r.age_restriction,
  partyEventId: orUndef(r.party_event_id),
  rewards,
  likesCount: r.likes_count,
  commentsCount: r.comments_count,
  noticesCount: r.notices_count,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

const participantFromRow = (r: Row): Participant => ({
  id: String(r.id),
  projectId: r.project_id,
  rewardId: r.reward_id ?? "",
  rewardTitle: r.reward_title,
  userId: r.member_id,
  userName: r.user_name,
  userPhone: r.user_phone,
  userEmail: r.user_email,
  quantity: r.quantity,
  totalPrice: Number(r.total_price),
  paymentStatus: r.payment_status,
  deliveryAddress: orUndef(r.delivery_address),
  notes: orUndef(r.notes),
  isAdultConfirmed: r.is_adult_confirmed,
  createdAt: iso(r.created_at),
})

const commentFromRow = (r: Row): Comment => ({
  id: String(r.id),
  projectId: r.project_id,
  userId: r.member_id,
  userName: r.user_name,
  userAvatar: orUndef(r.user_avatar),
  userLevel: orUndef(r.user_level),
  content: r.content,
  createdAt: iso(r.created_at),
})

const noticeFromRow = (r: Row): Notice => ({
  id: String(r.id),
  projectId: r.project_id,
  authorType: r.author_type ?? "creator",
  title: r.title,
  content: r.content,
  createdAt: iso(r.created_at),
})

const reportFromRow = (r: Row): Report => ({
  id: String(r.id),
  projectId: r.project_id,
  projectTitle: r.project_title,
  reporterId: r.reporter_id,
  reporterEmail: r.reporter_email,
  reason: r.reason,
  details: r.details,
  status: r.status,
  adminNote: orUndef(r.admin_note),
  createdAt: iso(r.created_at),
})

const quoteFromRow = (r: Row): Quote => ({
  id: String(r.id),
  projectId: r.project_id,
  lines: r.lines,
  totalAmount: Number(r.total_amount),
  memo: r.memo,
  fileUrl: r.file_url,
  status: r.status,
  createdAt: iso(r.created_at),
  acceptedAt: r.accepted_at ? iso(r.accepted_at) : undefined,
})

const messageFromRow = (r: Row): Message => ({
  id: String(r.id),
  projectId: r.project_id,
  sender: r.sender,
  senderName: r.sender_name,
  content: r.content,
  createdAt: iso(r.created_at),
})

// 주제 이름까지 붙여 읽음
const PROJECT_SELECT = `SELECT p.*, t.name AS topic_name FROM funding.projects p LEFT JOIN funding.topics t ON t.id = p.topic_id`

async function tx<T>(fn: (q: PoolClient) => Promise<T>): Promise<T> {
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

async function withRewards(rows: Row[]): Promise<Project[]> {
  if (rows.length === 0) return []
  const { rows: rewardRows } = await db().query(
    "SELECT * FROM funding.rewards WHERE project_id = ANY($1) ORDER BY sort_order, id",
    [rows.map((r) => r.id)]
  )
  const byProject = new Map<string, Reward[]>()
  for (const rr of rewardRows) {
    const list = byProject.get(rr.project_id) ?? []
    list.push(rewardFromRow(rr))
    byProject.set(rr.project_id, list)
  }
  // 개설자 이름·사진은 커뮤니티 프로필 기준 (바꾸면 펀딩에도 바로 반영)
  const cards = await memberCards(db(), rows.map((r) => r.creator_id))
  return rows.map((r) => {
    const card = cards.get(r.creator_id)
    return projectFromRow(card ? { ...r, creator_name: card.name, creator_avatar: card.avatarUrl } : r, byProject.get(r.id) ?? [])
  })
}

// ---------------------------------------------------------------- 프로젝트
export const projects = {
  // statuses 가 없으면 전부 (관리자)
  async list(filter: { statuses?: readonly string[]; creatorId?: string; partyEventId?: string } = {}) {
    const { rows } = await db().query(
      `${PROJECT_SELECT}
       WHERE ($1::text[] IS NULL OR p.status = ANY($1))
         AND ($2::text IS NULL OR p.creator_id = $2)
         AND ($3::text IS NULL OR p.party_event_id = $3)
       ORDER BY p.created_at DESC LIMIT 500`,
      [filter.statuses ?? null, filter.creatorId ?? null, filter.partyEventId ?? null]
    )
    return withRewards(rows)
  },

  // 통합 검색: 진행 중·성사 프로젝트(예시 제외), 정확도 → 진행 중 먼저
  async search(query: string, limit: number) {
    const params: unknown[] = []
    const { where, score } = buildTextSearch(
      query,
      [
        { sql: "title", weight: 3 },
        { sql: "summary", weight: 1.5 },
        { sql: "creator_name", weight: 1 },
        { sql: "description", weight: 0.5 },
      ],
      params
    )
    params.push(limit)
    const { rows } = await db().query(
      `SELECT *, ${score} AS search_score FROM funding.projects
       WHERE status IN ('live', 'success') AND ${where}
       ORDER BY search_score DESC, CASE status WHEN 'live' THEN 0 ELSE 1 END, created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return withRewards(rows)
  },

  async get(id: string) {
    const { rows } = await db().query(`${PROJECT_SELECT} WHERE p.id = $1`, [id])
    return rows[0] ? (await withRewards(rows))[0] : null
  },

  // 개설 신청: 견적 전(pending). 참여 옵션은 관리자가 견적과 함께 만듦
  async create(input: ProjectInput, member: Member) {
    const id = `fp-${randomUUID()}`
    const balance = await tx(async (q) => {
      await q.query(
        `INSERT INTO funding.projects
           (id, type, title, summary, description, creator_id, creator_name, creator_level, creator_avatar,
            status, target_amount, target_count, end_date, age_restriction, party_event_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '', $8, 'pending', $9, $10, $11, $12, $13, $14)`,
        [id, input.type, input.title, input.summary, input.description, member.id, member.name, member.avatarUrl ?? "",
          input.targetAmount, input.targetCount, input.endDate, input.ageRestriction,
          input.partyEventId ?? null, JSON.stringify(input.details)]
      )
      return earnMemberPoints(q, member.id, OPEN_REWARD, id)
    })
    return { project: (await this.get(id))!, rewardDp: balance === null ? 0 : OPEN_REWARD.amount }
  },

  async stats() {
    const { rows } = await db().query(`
      SELECT COUNT(*)::int AS live_projects,
             COALESCE(SUM(current_count), 0)::bigint AS participants,
             COUNT(*) FILTER (WHERE end_date > NOW() AND end_date <= NOW() + INTERVAL '72 hours')::int AS closing_soon,
             COALESCE(SUM(current_amount), 0)::bigint AS funded
      FROM funding.projects WHERE status IN ('live', 'success')`)
    const r = rows[0]
    return {
      liveProjectsCount: r.live_projects,
      totalParticipantsCount: Number(r.participants),
      closingSoonCount: r.closing_soon,
      totalFundedAmount: Number(r.funded),
    }
  },

  // 파티 이벤트별 공개 펀딩 수 (관리자 파티 캘린더)
  async countByPartyEvent() {
    const { rows } = await db().query(
      `SELECT party_event_id, COUNT(*)::int AS n FROM funding.projects
       WHERE party_event_id IS NOT NULL AND status NOT IN ('draft', 'canceled') GROUP BY party_event_id`
    )
    return Object.fromEntries(rows.map((r) => [r.party_event_id, r.n])) as Record<string, number>
  },

  // ---- 관리자
  // 단계 바꾸기. live(공개)는 참여 옵션이 있어야 하고, 무산·중단이면 DP 를 돌려줌
  async setStatus(id: string, status: ProjectStatus, opts: { reason?: string }, adminId: string) {
    return tx(async (q) => {
      const { rows } = await q.query("SELECT status, end_date FROM funding.projects WHERE id = $1 FOR UPDATE", [id])
      if (!rows[0]) return false
      if (status === "live") {
        const { rows: rw } = await q.query("SELECT 1 FROM funding.rewards WHERE project_id = $1 LIMIT 1", [id])
        if (!rw.length) throw new FundingError(409, "공개하려면 참여 옵션(가격)을 먼저 정해 주세요.")
        if (new Date(rows[0].end_date).getTime() <= Date.now()) throw new FundingError(409, "모집 마감일이 지났어요. 마감일을 먼저 고쳐 주세요.")
      }
      await q.query(
        `UPDATE funding.projects
         SET status = $2::varchar, rejection_reason = $3, updated_at = NOW(),
             opened_at = CASE WHEN $2::text = 'live' AND opened_at IS NULL THEN NOW() ELSE opened_at END,
             start_date = CASE WHEN $2::text = 'live' AND opened_at IS NULL THEN NOW() ELSE start_date END
         WHERE id = $1`,
        [id, status, status === "rejected" || status === "failed" || status === "canceled" ? opts.reason ?? "" : ""]
      )
      await logAction(q, "project", id, rows[0].status, status, opts.reason ?? "", adminId)
      if (status === "failed" || status === "canceled") await refundAll(q, id, status === "failed" ? "펀딩 무산" : "펀딩 중단")
      return true
    })
  },

  // 공개 전 설정: 목표·마감·담당자·주제, 참여 옵션(참여자가 없을 때만 바꿈)
  async setup(id: string, input: SetupInput, adminId: string) {
    return tx(async (q) => {
      const { rows } = await q.query("SELECT status FROM funding.projects WHERE id = $1 FOR UPDATE", [id])
      if (!rows[0]) return false
      await q.query(
        `UPDATE funding.projects SET target_amount = $2, target_count = $3, end_date = $4, manager_name = $5, topic_id = $6, updated_at = NOW()
         WHERE id = $1`,
        [id, input.targetAmount, input.targetCount, input.endDate, input.managerName, input.topicId]
      )
      if (input.rewards) {
        const { rows: joined } = await q.query("SELECT 1 FROM funding.participants WHERE project_id = $1 LIMIT 1", [id])
        if (joined.length) throw new FundingError(409, "참여한 사람이 있어 참여 옵션은 바꿀 수 없어요.")
        await q.query("DELETE FROM funding.rewards WHERE project_id = $1", [id])
        for (const [i, r] of input.rewards.entries()) {
          await q.query(
            `INSERT INTO funding.rewards (id, project_id, sort_order, title, description, price, role_type, max_quantity, items_included)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [`${id}-r${Date.now().toString(36)}${i}`, id, i, r.title, r.description, r.price, r.roleType, r.maxQuantity ?? null, r.itemsIncluded]
          )
        }
      }
      await logAction(q, "project", id, rows[0].status, "setup", "", adminId)
      return true
    })
  },

  // 내용 고치기 (관리자). 굿즈 품목 등 details 는 통째로 바꿈
  async edit(id: string, input: EditInput, adminId: string) {
    const { rows } = await db().query(
      `UPDATE funding.projects SET title = $2, summary = $3, description = $4, age_restriction = $5, details = $6, updated_at = NOW()
       WHERE id = $1 RETURNING status`,
      [id, input.title, input.summary, input.description, input.ageRestriction, JSON.stringify(input.details)]
    )
    if (!rows[0]) return false
    await logAction(db(), "project", id, rows[0].status, "edit", "", adminId)
    return true
  },

  // 지금 공개 중인 펀딩에 참여한 회원 (참여자 프로필 목록, 이름·사진만)
  async supporters(id: string) {
    const { rows } = await db().query(
      `SELECT member_id, MIN(created_at) AS at FROM funding.participants
       WHERE project_id = $1 AND payment_status IN ('reserved', 'completed') GROUP BY member_id ORDER BY at LIMIT 200`,
      [id]
    )
    const cards = await memberCards(db(), rows.map((r) => r.member_id))
    return rows.map((r) => cards.get(r.member_id) ?? { id: r.member_id, name: "회원", avatarUrl: "" })
  },
}

// 프로젝트의 DP 결제 참여를 모두 환불 (관리자가 무산·중단 처리할 때)
async function refundAll(q: PoolClient, projectId: string, memo: string) {
  const { rows } = await q.query<{ id: string; member_id: string }>(
    "SELECT id, member_id FROM funding.participants WHERE project_id = $1 AND payment_status = 'completed' AND paid_dp > 0 FOR UPDATE",
    [projectId]
  )
  for (const r of rows) await refundDp(q, r.member_id, String(r.id), memo)
  if (rows.length)
    await q.query("UPDATE funding.participants SET payment_status = 'refunded', updated_at = NOW() WHERE id = ANY($1::bigint[])", [
      rows.map((r) => r.id),
    ])
}

// ---------------------------------------------------------------- 참여
export const participants = {
  async create(projectId: string, input: ParticipateInput, member: Member) {
    return tx(async (q) => {
      const { rows } = await q.query("SELECT * FROM funding.projects WHERE id = $1 FOR UPDATE", [projectId])
      const p = rows[0]
      if (!p) throw new FundingError(404, "존재하지 않는 펀딩 프로젝트입니다.")
      if (p.status !== "live" && p.status !== "success") throw new FundingError(409, "지금은 참여할 수 없는 펀딩입니다.")
      if (p.type === "group_buy" && !input.deliveryAddress) throw new FundingError(400, "굿즈를 받을 배송지를 골라 주세요.")
      if (new Date(p.end_date).getTime() <= Date.now()) throw new FundingError(409, "마감된 프로젝트입니다.")
      if (p.age_restriction === "adult_only" && !input.isAdultConfirmed)
        throw new FundingError(400, "성인 전용 행사입니다. 성인 확인에 동의해 주세요.")

      const { rows: rewardRows } = await q.query(
        "SELECT * FROM funding.rewards WHERE project_id = $1 ORDER BY sort_order FOR UPDATE",
        [projectId]
      )
      const reward = rewardRows.find((r) => r.id === input.rewardId)
      if (!reward) throw new FundingError(400, "참여 옵션을 선택해 주세요.")
      if (reward?.max_quantity && reward.current_quantity + input.quantity > reward.max_quantity)
        throw new FundingError(409, "선택한 옵션의 남은 수량이 부족합니다.")

      const totalPrice = reward.price * input.quantity

      // DP 로 바로 결제 (1 DP = 1원). 결제 금액이 0 이면 결제 없이 참여
      const { rows: inserted } = await q.query(
        `INSERT INTO funding.participants
           (project_id, reward_id, reward_title, member_id, user_name, user_phone, user_email, quantity, total_price,
            delivery_address, notes, is_adult_confirmed, payment_status, paid_dp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed', $9) RETURNING *`,
        [projectId, reward.id, reward.title, member.id, input.userName, input.userPhone,
          input.userEmail, input.quantity, totalPrice, input.deliveryAddress, input.notes, input.isAdultConfirmed]
      )
      const dpBalance =
        totalPrice > 0
          ? await spendDp(q, member.id, totalPrice, String(inserted[0].id), `${p.title} · ${reward.title} ${input.quantity}개`)
          : null
      await q.query("UPDATE funding.rewards SET current_quantity = current_quantity + $2 WHERE id = $1", [reward.id, input.quantity])

      // All-or-Nothing: 목표 금액이나 인원을 채우면 성사
      const { rows: updated } = await q.query(
        `UPDATE funding.projects
         SET current_count = current_count + $2, current_amount = current_amount + $3, updated_at = NOW(),
             status = CASE WHEN status = 'live'
                            AND ((target_amount > 0 AND current_amount + $3 >= target_amount)
                              OR (target_count > 0 AND current_count + $2 >= target_count))
                           THEN 'success' ELSE status END
         WHERE id = $1 RETURNING status`,
        [projectId, input.quantity, totalPrice]
      )
      const balance = await earnMemberPoints(q, member.id, JOIN_REWARD, projectId)
      return {
        participant: participantFromRow(inserted[0]),
        goalReached: p.status === "live" && updated[0].status === "success",
        rewardDp: balance === null ? 0 : JOIN_REWARD.amount,
        paidDp: totalPrice,
        dpBalance: balance ?? dpBalance,
      }
    })
  },

  async cancel(id: number, memberId: string) {
    return tx(async (q) => {
      const { rows } = await q.query("SELECT * FROM funding.participants WHERE id = $1 FOR UPDATE", [id])
      const item = rows[0]
      if (!item || item.member_id !== memberId) throw new FundingError(404, "참여 내역을 찾을 수 없습니다.")
      if (item.payment_status !== "reserved" && item.payment_status !== "completed")
        throw new FundingError(409, "이미 취소한 참여입니다.")
      const { rows: projectRows } = await q.query("SELECT status, end_date FROM funding.projects WHERE id = $1 FOR UPDATE", [item.project_id])
      const project = projectRows[0]
      // 펀딩이 끝난 뒤(마감·성사 확정)엔 참여자가 직접 취소할 수 없음. 무산되면 DP 는 자동으로 돌려줌
      if (project && (new Date(project.end_date).getTime() <= Date.now() || !["live", "success"].includes(project.status)))
        throw new FundingError(409, "마감된 펀딩은 취소할 수 없습니다.")
      const refunded = item.payment_status === "completed" && Number(item.paid_dp) > 0
      if (refunded) await refundDp(q, memberId, String(id), "참여 취소")
      await q.query("UPDATE funding.participants SET payment_status = $2, updated_at = NOW() WHERE id = $1", [
        id,
        refunded ? "refunded" : "canceled",
      ])
      await q.query(
        `UPDATE funding.projects SET current_count = GREATEST(0, current_count - $2),
           current_amount = GREATEST(0, current_amount - $3), updated_at = NOW() WHERE id = $1`,
        [item.project_id, item.quantity, item.total_price]
      )
      if (item.reward_id)
        await q.query("UPDATE funding.rewards SET current_quantity = GREATEST(0, current_quantity - $2) WHERE id = $1", [
          item.reward_id,
          item.quantity,
        ])
    })
  },

  async listByMember(memberId: string) {
    const { rows } = await db().query(
      "SELECT * FROM funding.participants WHERE member_id = $1 ORDER BY id DESC LIMIT 500",
      [memberId]
    )
    const list = rows.map(participantFromRow)
    const { rows: projectRows } = await db().query("SELECT * FROM funding.projects WHERE id = ANY($1)", [
      [...new Set(list.map((p) => p.projectId))],
    ])
    const byId = new Map((await withRewards(projectRows)).map((p) => [p.id, p]))
    return list.map((p) => ({ ...p, project: byId.get(p.projectId) }))
  },

  async listByProject(projectId: string) {
    const { rows } = await db().query("SELECT * FROM funding.participants WHERE project_id = $1 ORDER BY id DESC", [projectId])
    return rows.map(participantFromRow)
  },
}

// ---------------------------------------------------------------- 댓글 · 공지 · 좋아요
export const comments = {
  async list(projectId: string) {
    const { rows } = await db().query("SELECT * FROM funding.comments WHERE project_id = $1 ORDER BY id DESC LIMIT 500", [projectId])
    const cards = await memberCards(db(), rows.map((r) => r.member_id))
    return rows.map((r) => {
      const card = cards.get(r.member_id)
      return commentFromRow(card ? { ...r, user_name: card.name, user_avatar: card.avatarUrl } : r)
    })
  },

  // 내 댓글만 지움 (관리자는 아무 댓글)
  async remove(projectId: string, id: number, memberId: string | null) {
    return tx(async (q) => {
      const { rowCount } = await q.query(
        "DELETE FROM funding.comments WHERE id = $1 AND project_id = $2 AND ($3::text IS NULL OR member_id = $3)",
        [id, projectId, memberId]
      )
      if (rowCount) await q.query("UPDATE funding.projects SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1", [projectId])
      return Boolean(rowCount)
    })
  },

  async create(projectId: string, content: string, userLevel: string, member: Member) {
    return tx(async (q) => {
      const { rows } = await q.query(
        `INSERT INTO funding.comments (project_id, member_id, user_name, user_avatar, user_level, content)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [projectId, member.id, member.name, member.avatarUrl ?? "", userLevel || "Lv.1 덕후", content]
      )
      await q.query("UPDATE funding.projects SET comments_count = comments_count + 1 WHERE id = $1", [projectId])
      return commentFromRow(rows[0])
    })
  },
}

export const notices = {
  async list(projectId: string) {
    const { rows } = await db().query("SELECT * FROM funding.notices WHERE project_id = $1 ORDER BY id DESC", [projectId])
    return rows.map(noticeFromRow)
  },

  async create(projectId: string, title: string, content: string, authorType: "creator" | "admin") {
    return tx(async (q) => {
      const { rows } = await q.query(
        "INSERT INTO funding.notices (project_id, title, content, author_type) VALUES ($1, $2, $3, $4) RETURNING *",
        [projectId, title, content, authorType]
      )
      await q.query("UPDATE funding.projects SET notices_count = notices_count + 1 WHERE id = $1", [projectId])
      return noticeFromRow(rows[0])
    })
  },

  async remove(projectId: string, id: number) {
    return tx(async (q) => {
      const { rowCount } = await q.query("DELETE FROM funding.notices WHERE id = $1 AND project_id = $2", [id, projectId])
      if (rowCount) await q.query("UPDATE funding.projects SET notices_count = GREATEST(0, notices_count - 1) WHERE id = $1", [projectId])
      return Boolean(rowCount)
    })
  },
}

// ---------------------------------------------------------------- 견적서 · 담당자 대화 · 주제
export const quotes = {
  async list(projectId: string) {
    const { rows } = await db().query("SELECT * FROM funding.quotes WHERE project_id = $1 ORDER BY id DESC", [projectId])
    return rows.map(quoteFromRow)
  },

  // 새 견적을 보내면 예전 견적은 replaced. 견적 전(pending)이면 오픈 준비(preparing)로 넘어감
  async create(projectId: string, input: QuoteInput, adminId: string) {
    return tx(async (q) => {
      const { rows: p } = await q.query("SELECT status FROM funding.projects WHERE id = $1 FOR UPDATE", [projectId])
      if (!p[0]) return null
      await q.query("UPDATE funding.quotes SET status = 'replaced' WHERE project_id = $1 AND status = 'sent'", [projectId])
      const total = input.lines.reduce((sum, l) => sum + l.amount, 0)
      const { rows } = await q.query(
        `INSERT INTO funding.quotes (project_id, lines, total_amount, memo, file_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [projectId, JSON.stringify(input.lines), total, input.memo, input.fileUrl, adminId]
      )
      if (p[0].status === "pending") {
        await q.query("UPDATE funding.projects SET status = 'preparing', updated_at = NOW() WHERE id = $1", [projectId])
        await logAction(q, "project", projectId, "pending", "preparing", "견적 발송", adminId)
      }
      return quoteFromRow(rows[0])
    })
  },

  // 개설자가 최신 견적을 수락
  async accept(projectId: string, quoteId: number) {
    const { rows } = await db().query(
      `UPDATE funding.quotes SET status = 'accepted', accepted_at = NOW()
       WHERE id = $1 AND project_id = $2 AND status = 'sent' RETURNING *`,
      [quoteId, projectId]
    )
    return rows[0] ? quoteFromRow(rows[0]) : null
  },
}

export const messages = {
  async list(projectId: string) {
    const { rows } = await db().query("SELECT * FROM funding.messages WHERE project_id = $1 ORDER BY id LIMIT 1000", [projectId])
    return rows.map(messageFromRow)
  },

  async create(projectId: string, sender: "creator" | "admin", senderName: string, content: string) {
    const { rows } = await db().query(
      "INSERT INTO funding.messages (project_id, sender, sender_name, content) VALUES ($1, $2, $3, $4) RETURNING *",
      [projectId, sender, senderName, content]
    )
    return messageFromRow(rows[0])
  },

  // 관리자 목록에 보여 줄 '개설자가 마지막으로 보낸 메시지' 시각 (답장 필요 표시)
  async lastByProject() {
    const { rows } = await db().query(
      `SELECT DISTINCT ON (project_id) project_id, sender, created_at FROM funding.messages ORDER BY project_id, id DESC`
    )
    return Object.fromEntries(rows.map((r) => [r.project_id, { sender: r.sender as string, at: iso(r.created_at) }]))
  },
}

export const topics = {
  async list(): Promise<Topic[]> {
    const { rows } = await db().query(
      `SELECT t.*, (SELECT COUNT(*) FROM funding.projects p WHERE p.topic_id = t.id)::int AS project_count
       FROM funding.topics t ORDER BY t.sort_order, t.id`
    )
    return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, projectCount: r.project_count }))
  },

  async create(name: string, sortOrder: number) {
    try {
      const { rows } = await db().query("INSERT INTO funding.topics (name, sort_order) VALUES ($1, $2) RETURNING id", [name, sortOrder])
      return rows[0].id as number
    } catch (e: any) {
      if (e?.code === "23505") throw new FundingError(409, "같은 이름의 주제가 있어요.")
      throw e
    }
  },

  async update(id: number, name: string, sortOrder: number) {
    try {
      const { rowCount } = await db().query("UPDATE funding.topics SET name = $2, sort_order = $3 WHERE id = $1", [id, name, sortOrder])
      return Boolean(rowCount)
    } catch (e: any) {
      if (e?.code === "23505") throw new FundingError(409, "같은 이름의 주제가 있어요.")
      throw e
    }
  },

  async remove(id: number) {
    const { rowCount } = await db().query("DELETE FROM funding.topics WHERE id = $1", [id])
    return Boolean(rowCount)
  },
}

export const likes = {
  async idsByMember(memberId: string) {
    const { rows } = await db().query("SELECT project_id FROM funding.likes WHERE member_id = $1", [memberId])
    return rows.map((r) => r.project_id as string)
  },

  async has(projectId: string, memberId: string) {
    const { rowCount } = await db().query("SELECT 1 FROM funding.likes WHERE project_id = $1 AND member_id = $2", [projectId, memberId])
    return Boolean(rowCount)
  },

  // 누른 상태면 취소, 아니면 추가. 바뀐 뒤 상태와 좋아요 수를 돌려줌
  async toggle(projectId: string, memberId: string) {
    return tx(async (q) => {
      const removed = await q.query("DELETE FROM funding.likes WHERE project_id = $1 AND member_id = $2", [projectId, memberId])
      const liked = !removed.rowCount
      if (liked) await q.query("INSERT INTO funding.likes (project_id, member_id) VALUES ($1, $2)", [projectId, memberId])
      const { rows } = await q.query(
        "UPDATE funding.projects SET likes_count = GREATEST(0, likes_count + $2) WHERE id = $1 RETURNING likes_count",
        [projectId, liked ? 1 : -1]
      )
      return { liked, likesCount: rows[0].likes_count as number }
    })
  },
}

// ---------------------------------------------------------------- 신고
export const reports = {
  async create(input: ReportInput, projectTitle: string, reporterId: string) {
    const { rows } = await db().query(
      `INSERT INTO funding.reports (project_id, project_title, reporter_id, reporter_email, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.projectId, projectTitle, reporterId, input.reporterEmail, input.reason, input.details]
    )
    return reportFromRow(rows[0])
  },

  async list() {
    const { rows } = await db().query("SELECT * FROM funding.reports ORDER BY id DESC LIMIT 500")
    return rows.map(reportFromRow)
  },

  async update(id: number, status: ReportStatus, adminNote: string | undefined, adminId: string) {
    const { rows: before } = await db().query("SELECT status FROM funding.reports WHERE id = $1", [id])
    if (!before[0]) return null
    const { rows } = await db().query(
      `UPDATE funding.reports SET status = $2, admin_note = COALESCE($3, admin_note), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status, adminNote ?? null]
    )
    await logAction(db(), "report", String(id), before[0].status, status, adminNote ?? "", adminId, id)
    return reportFromRow(rows[0])
  },
}

// 견적 전 건수 (관리자 대시보드)
export async function projectPendingSummary() {
  const { rows } = await db().query(`
    SELECT (SELECT COUNT(*) FROM funding.projects WHERE status = 'pending')::int AS projects,
           (SELECT COUNT(*) FROM funding.reports WHERE status IN ('received', 'investigating'))::int AS reports`)
  return { projects: rows[0].projects as number, reports: rows[0].reports as number }
}

export { hasGoods }
export const isPublicStatus = (status: string) => (PUBLIC_STATUSES as readonly string[]).includes(status)

// 관리자 처리 이력 (funding.admin_actions). 프로젝트 id 는 문자열이라 target_key 에 둠
async function logAction(
  q: Pick<PoolClient, "query">,
  target: "project" | "report",
  key: string,
  fromStatus: string | null,
  toStatus: string,
  reason: string,
  adminId: string,
  numericId = 0
) {
  await q.query(
    `INSERT INTO funding.admin_actions (target_type, target_id, target_key, from_status, to_status, reason, admin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [target, numericId, key, fromStatus, toStatus, reason, adminId]
  )
}

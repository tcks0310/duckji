import { db } from "../../shared/db/require-database"
import { POST_COUNT_SQL } from "./shared-tables"
import type { PartyEvent, PartyEventInput } from "./types"

export class DuplicatePartyEventError extends Error {}

const fromRow = (r: any): PartyEvent => ({
  id: Number(r.id),
  slug: r.slug,
  title: r.title,
  kind: r.kind,
  workTitle: r.work_title,
  characterName: r.character_name,
  month: r.month,
  day: r.day,
  year: r.year,
  description: r.description,
  imageUrl: r.image_url,
  source: r.source,
  gallerySlug: r.gallery_slug,
  status: r.status,
  rejectReason: r.reject_reason,
  suggestedBy: r.suggested_by,
  postCount: Number(r.post_count ?? 0),
  createdAt: r.created_at.toISOString(),
})

const SELECT = `SELECT e.*, ${POST_COUNT_SQL} AS post_count FROM party.events e`

const COLUMNS = [
  "slug", "title", "kind", "work_title", "character_name", "month", "day", "year",
  "description", "image_url", "source", "gallery_slug", "status",
]
const values = (i: PartyEventInput) => [
  i.slug, i.title, i.kind, i.workTitle, i.characterName, i.month, i.day, i.year,
  i.description, i.imageUrl, i.source, i.gallerySlug, i.status,
]

const rethrowDuplicate = (e: any): never => {
  if (e?.code === "23505") throw new DuplicatePartyEventError("이미 같은 주소(slug)의 이벤트가 있습니다.")
  throw e
}

async function logAction(a: {
  targetId: number
  action: "create" | "update" | "status"
  fromStatus: string | null
  toStatus: string | null
  reason?: string
  adminId: string
}) {
  await db().query(
    `INSERT INTO party.admin_actions (target_type, target_id, action, from_status, to_status, reason, admin_id)
     VALUES ('event', $1, $2, $3, $4, $5, $6)`,
    [a.targetId, a.action, a.fromStatus, a.toStatus, a.reason || "", a.adminId]
  )
}

export const partyRepository = {
  // 공개 목록은 published 만. 관리자는 statuses 로 골라 봄
  async list(filter: { month?: number; query?: string; statuses: string[] }) {
    const { rows } = await db().query(
      `${SELECT}
       WHERE ($1::int IS NULL OR e.month = $1)
         AND e.status = ANY($2)
         AND ($3::text IS NULL OR e.title ILIKE $3 OR e.work_title ILIKE $3 OR e.character_name ILIKE $3)
       ORDER BY e.month, e.day, e.title`,
      [filter.month ?? null, filter.statuses, filter.query ? `%${filter.query}%` : null]
    )
    return rows.map(fromRow)
  },

  async get(slug: string) {
    const { rows } = await db().query(`${SELECT} WHERE e.slug = $1`, [slug])
    return rows[0] ? fromRow(rows[0]) : null
  },

  async getByPost(postId: number) {
    const { rows } = await db().query(
      `${SELECT} WHERE e.id = (SELECT event_id FROM party.event_posts WHERE post_id = $1)`,
      [postId]
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  // 관리자 등록
  async create(input: PartyEventInput, adminId: string) {
    const { rows } = await db()
      .query(
        `INSERT INTO party.events (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        values(input)
      )
      .catch(rethrowDuplicate)
    await logAction({ targetId: Number(rows[0].id), action: "create", fromStatus: null, toStatus: input.status, adminId })
    return (await partyRepository.get(input.slug))!
  },

  // 회원 제보 (submitted 로 접수)
  async suggest(input: PartyEventInput, memberId: string) {
    await db()
      .query(
        `INSERT INTO party.events (${COLUMNS.join(", ")}, suggested_by)
         VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")}, $${COLUMNS.length + 1})`,
        [...values({ ...input, status: "submitted" }), memberId]
      )
      .catch(rethrowDuplicate)
    return (await partyRepository.get(input.slug))!
  },

  async countSubmittedBy(memberId: string, sinceHours: number) {
    const { rows } = await db().query(
      "SELECT COUNT(*)::int AS n FROM party.events WHERE suggested_by = $1 AND created_at > NOW() - make_interval(hours => $2)",
      [memberId, sinceHours]
    )
    return rows[0].n as number
  },

  // 관리자 수정 (상태 변경 포함). 반려는 사유 필수
  async update(existing: PartyEvent, input: PartyEventInput, adminId: string, reason?: string) {
    await db()
      .query(
        `UPDATE party.events SET ${COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(", ")},
           reject_reason = $${COLUMNS.length + 1}, updated_at = NOW()
         WHERE id = $${COLUMNS.length + 2}`,
        [...values(input), input.status === "rejected" ? reason || existing.rejectReason : null, existing.id]
      )
      .catch(rethrowDuplicate)
    const statusChanged = existing.status !== input.status
    await logAction({
      targetId: existing.id,
      action: statusChanged ? "status" : "update",
      fromStatus: existing.status,
      toStatus: input.status,
      reason,
      adminId,
    })
    return (await partyRepository.get(input.slug))!
  },

  // 글 하나는 이벤트 하나에만 연결 (이미 다른 이벤트에 연결돼 있으면 false)
  async linkPost(eventId: number, postId: number) {
    const { rowCount } = await db().query(
      "INSERT INTO party.event_posts (event_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [eventId, postId]
    )
    if (rowCount) return true
    const { rows } = await db().query("SELECT event_id FROM party.event_posts WHERE post_id = $1", [postId])
    return Number(rows[0]?.event_id) === eventId
  },

  // 관리자 대시보드용 대기 건수
  async summary() {
    const { rows } = await db().query(
      "SELECT status, COUNT(*)::int AS n FROM party.events GROUP BY status"
    )
    return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>
  },
}

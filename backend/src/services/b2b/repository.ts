import type { PoolClient } from "pg"
import { config } from "../../shared/config"
import { db } from "../../shared/db/require-database"
import { b2bConfig as cfg } from "./config"
import { enqueueMail } from "./mailer"
import { NEXT_STATUSES, NOTIFY_APPLICANT, REASON_REQUIRED, type ApplicationStatus } from "./status"
import { adminNoticeMail, applicationReceivedMail, applicationStatusMail } from "./templates"
import type { ApplicationInput, ApplicationReview } from "./validation"

const DAILY_APPLICATION_LIMIT = 5 // 같은 이메일로 하루 최대 신청 수 (스팸 방지)

export class B2bError extends Error {
  constructor(message: string, public status: 400 | 404 | 409 | 429 = 400) {
    super(message)
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)
// pg 는 DATE 를 로컬 자정 Date 로 돌려주므로 로컬 기준으로 다시 문자열로
export const ymd = (d: Date | string | null) => {
  if (!d) return null
  if (typeof d === "string") return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const toApplication = (r: any) => ({
  id: Number(r.id),
  code: `B2B-${r.id}`,
  brandName: r.brand_name as string,
  eventName: r.event_name as string,
  eventType: r.event_type as string,
  location: r.location as string,
  schedule: r.schedule as string,
  content: r.content as string,
  linkUrl: r.link_url as string,
  imageUrl: r.image_url as string,
  keywords: r.keywords as string[],
  plan: r.plan as string,
  nativeBooking: r.native_booking as boolean,
  placementWish: r.placement_wish as string,
  managerName: r.manager_name as string,
  managerPhone: r.manager_phone as string,
  managerEmail: r.manager_email as string,
  managerCompany: (r.manager_company as string) || "",
  applyKind: (r.apply_kind as string) || "listing",
  eventFrom: ymd(r.event_from),
  eventUntil: ymd(r.event_until),
  adSlots: (r.ad_slots as string[]) || [],
  adFrom: ymd(r.ad_from),
  adUntil: ymd(r.ad_until),
  budget: (r.budget as string) || "",
  attachments: (r.attachments as string[]) || [],
  status: r.status as ApplicationStatus,
  statusReason: r.status_reason as string,
  placement: r.placement as string,
  publishFrom: ymd(r.publish_from),
  publishUntil: ymd(r.publish_until),
  adminNote: r.admin_note as string,
  reviewedAt: iso(r.reviewed_at),
  publishedAt: iso(r.published_at),
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
})

export type Application = ReturnType<typeof toApplication>

async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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

async function logAction(
  q: PoolClient,
  a: { targetType: string; targetId: number; action: string; from?: string | null; to?: string | null; reason?: string }
) {
  await q.query(
    `INSERT INTO b2b.admin_actions (target_type, target_id, action, from_status, to_status, reason, admin_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [a.targetType, a.targetId, a.action, a.from ?? null, a.to ?? null, a.reason ?? "", config.adminId]
  )
}

// ------------------------------------------------------------------------------
// 입점 신청
// ------------------------------------------------------------------------------

export async function createApplication(input: ApplicationInput): Promise<Application> {
  return tx(async (client) => {
    const { rows: recent } = await client.query(
      `SELECT count(*)::int AS n FROM b2b.applications WHERE lower(manager_email) = $1 AND created_at > NOW() - INTERVAL '1 day'`,
      [input.managerEmail]
    )
    if (recent[0].n >= DAILY_APPLICATION_LIMIT) throw new B2bError("오늘은 더 이상 신청할 수 없습니다. 내일 다시 시도해 주세요.", 429)

    const { rows } = await client.query(
      `INSERT INTO b2b.applications
         (brand_name, event_name, event_type, location, schedule, content, link_url, image_url, keywords, plan,
          native_booking, placement_wish, manager_name, manager_phone, manager_email, privacy_agreed_at,
          apply_kind, event_from, event_until, ad_slots, ad_from, ad_until, budget, attachments, manager_company)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [
        input.brandName, input.eventName, input.eventType, input.location, input.schedule, input.content,
        input.linkUrl, input.imageUrl, input.keywords, input.plan, input.nativeBooking, input.placementWish,
        input.managerName, input.managerPhone, input.managerEmail,
        input.applyKind, input.eventFrom, input.eventUntil, input.adSlots, input.adFrom, input.adUntil, input.budget,
        input.attachments, input.managerCompany,
      ]
    )
    const app = toApplication(rows[0])
    await enqueueMail(client, "application_received", app.managerEmail, applicationReceivedMail(app))
    if (cfg.notifyEmail) await enqueueMail(client, "admin_notice", cfg.notifyEmail, adminNoticeMail(app))
    return app
  })
}

export async function listApplications(opts: { status?: string; q?: string; limit: number; offset: number }) {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.status) {
    params.push(opts.status.split(","))
    where.push(`status = ANY($${params.length})`)
  }
  if (opts.q) {
    params.push(`%${opts.q.toLowerCase()}%`)
    where.push(`(lower(brand_name) LIKE $${params.length} OR lower(event_name) LIKE $${params.length} OR lower(manager_email) LIKE $${params.length})`)
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  const { rows: count } = await db().query(`SELECT count(*)::int AS n FROM b2b.applications ${whereSql}`, params)
  params.push(opts.limit, opts.offset)
  const { rows } = await db().query(
    `SELECT * FROM b2b.applications ${whereSql} ORDER BY created_at DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { total: count[0].n as number, applications: rows.map(toApplication) }
}

export async function getApplication(id: number) {
  const { rows } = await db().query("SELECT * FROM b2b.applications WHERE id = $1", [id])
  if (!rows[0]) return null
  const { rows: history } = await db().query(
    `SELECT action, from_status, to_status, reason, admin_id, created_at FROM b2b.admin_actions
     WHERE target_type = 'application' AND target_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`,
    [id]
  )
  return {
    application: toApplication(rows[0]),
    history: history.map((h) => ({
      action: h.action as string,
      fromStatus: h.from_status as string | null,
      toStatus: h.to_status as string | null,
      reason: h.reason as string,
      adminId: h.admin_id as string,
      createdAt: iso(h.created_at)!,
    })),
  }
}

// 관리자 심사·수정. 상태가 바뀌면 이력을 남기고 필요한 경우 신청자에게 메일
export async function reviewApplication(id: number, review: ApplicationReview): Promise<Application> {
  return tx(async (client) => {
    const { rows } = await client.query("SELECT * FROM b2b.applications WHERE id = $1 FOR UPDATE", [id])
    if (!rows[0]) throw new B2bError("신청을 찾을 수 없습니다.", 404)
    const current = toApplication(rows[0])
    const next = review.status && review.status !== current.status ? review.status : null
    const reason = review.reason ?? ""

    if (next) {
      if (!NEXT_STATUSES[current.status].includes(next)) {
        throw new B2bError(`'${current.status}' 에서 '${next}' 로 바꿀 수 없습니다.`, 409)
      }
      if (REASON_REQUIRED.includes(next) && !reason) throw new B2bError("반려·보완요청은 사유가 필요합니다.")
    }

    const sets: string[] = ["updated_at = NOW()"]
    const params: unknown[] = []
    const set = (col: string, v: unknown) => {
      params.push(v)
      sets.push(`${col} = $${params.length}`)
    }
    if (review.placement !== undefined) set("placement", review.placement)
    if (review.publishFrom !== undefined) set("publish_from", review.publishFrom)
    if (review.publishUntil !== undefined) set("publish_until", review.publishUntil)
    if (review.keywords !== undefined) set("keywords", review.keywords)
    if (review.adminNote !== undefined) set("admin_note", review.adminNote)
    if (review.content !== undefined) set("content", review.content)
    if (next) {
      set("status", next)
      set("status_reason", reason)
      sets.push("reviewed_at = NOW()")
      if (next === "published") sets.push("published_at = COALESCE(published_at, NOW())", "publish_from = COALESCE(publish_from, (NOW() AT TIME ZONE 'Asia/Seoul')::date)")
    }
    params.push(id)
    const { rows: updated } = await client.query(
      `UPDATE b2b.applications SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    )
    const app = toApplication(updated[0])

    if (next) {
      await logAction(client, { targetType: "application", targetId: id, action: "status", from: current.status, to: next, reason })
      if (NOTIFY_APPLICANT.includes(next)) {
        await enqueueMail(client, "application_status", app.managerEmail, applicationStatusMail(app, next, reason))
      }
    } else if (sets.length > 1) {
      await logAction(client, { targetType: "application", targetId: id, action: "update" })
    }
    return app
  })
}

export async function deleteApplication(id: number, reason: string): Promise<boolean> {
  return tx(async (client) => {
    const { rows } = await client.query("DELETE FROM b2b.applications WHERE id = $1 RETURNING status", [id])
    if (!rows[0]) return false
    await logAction(client, { targetType: "application", targetId: id, action: "delete", from: rows[0].status, reason })
    return true
  })
}

// 관리자 대시보드용 대기 건수 (기능정의서 4.1)
export async function getSummary() {
  const { rows } = await db().query(
    `SELECT
       (SELECT count(*)::int FROM b2b.applications WHERE status = 'submitted') AS submitted,
       (SELECT count(*)::int FROM b2b.applications WHERE status = 'reviewing') AS reviewing,
       (SELECT count(*)::int FROM b2b.applications WHERE status = 'published') AS published,
       (SELECT count(*)::int FROM b2b.outbox WHERE status = 'queued') AS queued_mails`
  )
  const r = rows[0]
  return {
    pending: r.submitted + r.reviewing,
    applications: { submitted: r.submitted, reviewing: r.reviewing, published: r.published },
    queuedMails: r.queued_mails,
  }
}

// ------------------------------------------------------------------------------
// 발송 대기 목록 (메일 본문은 빼고)
// ------------------------------------------------------------------------------

export async function listOutbox(opts: { status?: string; kind?: string; limit: number; offset: number }) {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.status) {
    params.push(opts.status)
    where.push(`status = $${params.length}`)
  }
  if (opts.kind) {
    params.push(opts.kind)
    where.push(`kind = $${params.length}`)
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  params.push(opts.limit, opts.offset)
  const { rows } = await db().query(
    `SELECT id, kind, to_email, subject, status, attempts, error, created_at, sent_at FROM b2b.outbox ${whereSql}
     ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind as string,
    to: (r.to_email as string).replace(/^(.{2})[^@]*/, (_: string, p: string) => `${p}***`),
    subject: r.subject as string,
    status: r.status as string,
    attempts: r.attempts as number,
    error: (r.error as string) || null,
    createdAt: iso(r.created_at)!,
    sentAt: iso(r.sent_at),
  }))
}

export { logAction, tx }

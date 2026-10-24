import { Hono } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db } from "../../shared/db/require-database"
import { consumeQuota } from "../../shared/db/rate-limit"

// 갤러리 개설 요청: 회원이 요청 → 같은 이름은 한 건에 동의자만 늘어남 → 관리자가 개설·반려
// category 는 요청자가 고른 성격(애니·게임 등, 참고용). 실제 대분류는 관리자가 개설할 때 정함
const REQUEST_CATEGORIES = ["anime", "manga", "movie", "game", "vtuber", "goods", "cosplay", "etc"] as const
const STATUSES = ["pending", "approved", "rejected"] as const

export interface GalleryRequest {
  id: number
  name: string
  category: string
  reason: string
  requesterName: string
  supporterCount: number
  status: (typeof STATUSES)[number]
  adminNote: string
  galleryId: number | null
  createdAt: string
  handledAt: string | null
}

const SELECT = `
  SELECT r.*, (SELECT count(*) FROM gallery.gallery_request_supporters s WHERE s.request_id = r.id)::int AS supporter_count
  FROM gallery.gallery_requests r`

const fromRow = (r: any): GalleryRequest => ({
  id: Number(r.id),
  name: r.name,
  category: r.category,
  reason: r.reason,
  requesterName: r.requester_name,
  supporterCount: r.supporter_count,
  status: r.status,
  adminNote: r.admin_note,
  galleryId: r.gallery_id === null ? null : Number(r.gallery_id),
  createdAt: new Date(r.created_at).toISOString(),
  handledAt: r.handled_at ? new Date(r.handled_at).toISOString() : null,
})

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export const galleryRequestRoute = new Hono<MemberEnv>()

// 처리 대기 중인 요청 목록 (누구나, 동의 많은 순)
galleryRequestRoute.get("/requests", async (c) => {
  const { rows } = await db().query(`${SELECT} WHERE r.status = 'pending' ORDER BY supporter_count DESC, r.created_at DESC LIMIT 50`)
  return c.json({ success: true, requests: rows.map(fromRow) })
})

// 요청하기 (회원). 이미 있는 갤러리면 409 + 그 갤러리, 대기 중인 같은 이름이 있으면 동의로 더함
galleryRequestRoute.post("/requests", requireMember, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const name = str(body?.name)
  const category = str(body?.category) || "etc"
  const reason = str(body?.reason)
  const errors: string[] = []
  if (!name || name.length > 100) errors.push("갤러리 이름은 1~100자여야 합니다.")
  if (!(REQUEST_CATEGORIES as readonly string[]).includes(category)) errors.push("분류를 골라 주세요.")
  if (reason.length > 1000) errors.push("요청 이유는 1000자 이하여야 합니다.")
  if (errors.length) return c.json({ success: false, errors }, 400)

  const existing = await db().query<{ slug: string; name: string }>(
    `SELECT g.slug, g.name FROM gallery.galleries g
     WHERE g.status <> 'closed'
       AND (lower(g.name) = lower($1) OR EXISTS (SELECT 1 FROM gallery.gallery_aliases a WHERE a.gallery_id = g.id AND lower(a.alias) = lower($1)))
     LIMIT 1`,
    [name]
  )
  if (existing.rows[0]) {
    return c.json({ success: false, error: `이미 "${existing.rows[0].name}" 갤러리가 있어요.`, gallery: existing.rows[0] }, 409)
  }

  const member = c.get("member")
  if (!(await consumeQuota("gallery-request", member.id, 10, 86400)))
    return c.json({ success: false, error: "갤러리 개설 요청은 하루 10번까지 할 수 있습니다." }, 429)
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const pending = await client.query<{ id: string }>(
      "SELECT id FROM gallery.gallery_requests WHERE status = 'pending' AND lower(name) = lower($1) FOR UPDATE",
      [name]
    )
    let requestId = pending.rows[0]?.id
    const joined = Boolean(requestId)
    if (!requestId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO gallery.gallery_requests (name, category, reason, requester_id, requester_name)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, category, reason, member.id, member.name]
      )
      requestId = created.rows[0].id
    }
    await client.query(
      "INSERT INTO gallery.gallery_request_supporters (request_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [requestId, member.id]
    )
    await client.query("COMMIT")
    const { rows } = await db().query(`${SELECT} WHERE r.id = $1`, [requestId])
    return c.json({ success: true, joined, request: fromRow(rows[0]) }, joined ? 200 : 201)
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    throw e
  } finally {
    client.release()
  }
})

// 관리자: 요청 목록 (?status=pending|approved|rejected)
galleryRequestRoute.get("/admin/requests", requireAdmin, async (c) => {
  const status = str(c.req.query("status")) || "pending"
  if (!(STATUSES as readonly string[]).includes(status)) return c.json({ success: false, error: "status 가 올바르지 않습니다." }, 400)
  const { rows } = await db().query(`${SELECT} WHERE r.status = $1 ORDER BY supporter_count DESC, r.created_at DESC LIMIT 200`, [status])
  return c.json({ success: true, requests: rows.map(fromRow) })
})

// 관리자: 개설(approved, 만든 갤러리 id 연결)·반려(rejected)
galleryRequestRoute.patch("/admin/requests/:id", requireAdmin, async (c) => {
  const id = /^\d{1,18}$/.test(c.req.param("id")) ? Number(c.req.param("id")) : null
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const status = str(body?.status)
  if (!id || !body || !["approved", "rejected"].includes(status)) {
    return c.json({ success: false, error: "status 는 approved 나 rejected 여야 합니다." }, 400)
  }
  const galleryId = Number.isInteger(body.galleryId) ? (body.galleryId as number) : null
  const { rows } = await db().query(
    `UPDATE gallery.gallery_requests SET status = $2, admin_note = $3, gallery_id = COALESCE($4, gallery_id), handled_at = NOW()
     WHERE id = $1 RETURNING id`,
    [id, status, str(body.adminNote).slice(0, 1000), galleryId]
  )
  if (!rows[0]) return c.json({ success: false, error: "Not Found" }, 404)
  const { rows: updated } = await db().query(`${SELECT} WHERE r.id = $1`, [id])
  return c.json({ success: true, request: fromRow(updated[0]) })
})

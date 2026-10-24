import { db } from "../../shared/db/require-database"
import type { VenueSpace, VenueSpaceInput } from "./types"

// PostgreSQL 저장소

type Row = Record<string, any>

const iso = (v: Date | null) => (v ? v.toISOString() : null)

const venueFromRow = (r: Row): VenueSpace => ({
  id: Number(r.id),
  name: r.name,
  location: r.location,
  address: r.address,
  capacity: r.capacity,
  area: r.area,
  imageUrls: r.image_urls,
  availablePeriod: r.available_period,
  priceGuide: r.price_guide,
  description: r.description,
  partner: r.partner,
  isPublished: r.is_published,
  sortOrder: r.sort_order,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
})

const VENUE_COLUMNS: [keyof VenueSpaceInput, string][] = [
  ["name", "name"], ["location", "location"], ["address", "address"], ["capacity", "capacity"], ["area", "area"],
  ["imageUrls", "image_urls"], ["availablePeriod", "available_period"], ["priceGuide", "price_guide"],
  ["description", "description"], ["partner", "partner"], ["isPublished", "is_published"], ["sortOrder", "sort_order"],
]
const venueValues = (v: VenueSpaceInput) => VENUE_COLUMNS.map(([f]) => v[f])

export const venues = {
  async list(includeUnpublished: boolean) {
    const { rows } = await db().query(
      `SELECT * FROM funding.venues WHERE ($1 OR is_published) ORDER BY sort_order, id`,
      [includeUnpublished]
    )
    return rows.map(venueFromRow)
  },

  async get(id: number, includeUnpublished: boolean) {
    const { rows } = await db().query(`SELECT * FROM funding.venues WHERE id = $1 AND ($2 OR is_published)`, [id, includeUnpublished])
    return rows[0] ? venueFromRow(rows[0]) : null
  },

  async create(input: VenueSpaceInput, adminId: string) {
    const cols = VENUE_COLUMNS.map(([, c]) => c)
    const { rows } = await db().query(
      `INSERT INTO funding.venues (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      venueValues(input)
    )
    await logAction("venue", rows[0].id, null, "created", "", adminId)
    return venueFromRow(rows[0])
  },

  async update(id: number, input: VenueSpaceInput, adminId: string) {
    const sets = VENUE_COLUMNS.map(([, c], i) => `${c} = $${i + 2}`)
    const { rows } = await db().query(
      `UPDATE funding.venues SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...venueValues(input)]
    )
    if (!rows[0]) return null
    await logAction("venue", id, null, "updated", "", adminId)
    return venueFromRow(rows[0])
  },

  async delete(id: number, adminId: string) {
    const { rowCount } = await db().query("DELETE FROM funding.venues WHERE id = $1", [id])
    if (!rowCount) return false
    await logAction("venue", id, null, "deleted", "", adminId)
    return true
  },
}

// 관리자 처리 이력 (기능정의서 2.3)
async function logAction(target: string, targetId: number, fromStatus: string | null, toStatus: string, reason: string, adminId: string) {
  await db().query(
    `INSERT INTO funding.admin_actions (target_type, target_id, from_status, to_status, reason, admin_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [target, targetId, fromStatus, toStatus, reason, adminId]
  )
}

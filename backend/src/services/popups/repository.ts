import { buildTextSearch, textSearchScore } from "../../shared/search/text-search"
import { pool } from "../../shared/db/pool"
import seedData from "./seed-data.json"
import { formatCoordinates, type Popup, type PopupInput } from "./types"

const STATUS_RANK: Record<string, number> = { ongoing: 0, closing_soon: 1, upcoming: 2, ended: 3 }

const POPUP_SEARCH_COLUMNS = [
  { sql: "title", weight: 3 },
  { sql: "sub_title", weight: 2 },
  { sql: "venue_name", weight: 1.5 },
  { sql: "location", weight: 1 },
  { sql: "category_label", weight: 1 },
  { sql: "description", weight: 0.5 },
]

export interface PopupsRepository {
  list(options: { includeUnpublished: boolean }): Promise<Popup[]>
  /** 통합 검색: 공개 팝업만, 정확도 → 진행 중·마감 임박·예정·종료 순 */
  search(query: string, limit: number): Promise<Popup[]>
  /** 지난 팝업: 관리자가 종료 처리했거나 종료일이 지난 공개 팝업, 최근 종료 순 */
  listPast(options: { limit: number; offset: number }): Promise<{ popups: Popup[]; total: number }>
  /** 공개 팝업 + 종료 처리된 팝업(지난 팝업 상세). includeUnpublished 면 전부 */
  get(id: string, options: { includeUnpublished: boolean }): Promise<Popup | null>
  create(input: PopupInput): Promise<Popup>
  update(id: string, input: PopupInput): Promise<Popup | null>
  delete(id: string): Promise<boolean>
}

const toPopup = (input: PopupInput): Popup => ({
  ...input,
  coordinates: formatCoordinates(input.latitude, input.longitude),
})

const bySortOrder = (a: Popup, b: Popup) => a.sortOrder - b.sortOrder

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const isPast = (p: Popup, today: string) => !!p.endedAt || (p.isPublished && p.endDate < today)

// 메모리 저장소 (DATABASE_URL 미설정 시). 기존 팝업 데이터로 시작하고 재시작하면 초기화됨
class MemoryPopupsRepository implements PopupsRepository {
  private popups = (seedData as Omit<PopupInput, "origin" | "originRef" | "endedAt">[]).map((p) =>
    toPopup({ origin: "manual", originRef: null, endedAt: null, ...p })
  )

  async list({ includeUnpublished }: { includeUnpublished: boolean }) {
    return this.popups.filter((p) => includeUnpublished || p.isPublished).sort(bySortOrder)
  }

  async search(query: string, limit: number) {
    return this.popups
      .filter((p) => p.isPublished)
      .map((p) => ({
        p,
        score: textSearchScore(query, [
          { text: p.title, weight: 3 },
          { text: p.subTitle, weight: 2 },
          { text: p.venueName, weight: 1.5 },
          { text: p.location, weight: 1 },
          { text: p.categoryLabel, weight: 1 },
          { text: p.description, weight: 0.5 },
        ]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (STATUS_RANK[a.p.status] ?? 9) - (STATUS_RANK[b.p.status] ?? 9))
      .slice(0, limit)
      .map((x) => x.p)
  }

  async listPast({ limit, offset }: { limit: number; offset: number }) {
    const today = kstToday()
    const all = this.popups.filter((p) => isPast(p, today)).sort((a, b) => b.endDate.localeCompare(a.endDate))
    return { popups: all.slice(offset, offset + limit), total: all.length }
  }

  async get(id: string, { includeUnpublished }: { includeUnpublished: boolean }) {
    const popup = this.popups.find((p) => p.id === id)
    return popup && (includeUnpublished || popup.isPublished || popup.endedAt) ? popup : null
  }

  async create(input: PopupInput) {
    if (this.popups.some((p) => p.id === input.id)) throw new DuplicatePopupError(input.id)
    const popup = toPopup(input)
    this.popups.push(popup)
    return popup
  }

  async update(id: string, input: PopupInput) {
    const index = this.popups.findIndex((p) => p.id === id)
    if (index === -1) return null
    this.popups[index] = toPopup({ ...input, id })
    return this.popups[index]
  }

  async delete(id: string) {
    const before = this.popups.length
    this.popups = this.popups.filter((p) => p.id !== id)
    return this.popups.length < before
  }
}

export class DuplicatePopupError extends Error {
  constructor(id: string) {
    super(`이미 같은 id 의 팝업이 있습니다: ${id}`)
  }
}

// 컬럼 순서 (camelCase 필드 ↔ snake_case 컬럼)
const COLUMNS: [keyof PopupInput, string][] = [
  ["id", "id"], ["title", "title"], ["subTitle", "sub_title"], ["category", "category"], ["categoryLabel", "category_label"],
  ["status", "status"], ["statusLabel", "status_label"], ["dDay", "d_day"], ["startDate", "start_date"], ["endDate", "end_date"],
  ["location", "location"], ["venueName", "venue_name"], ["latitude", "latitude"], ["longitude", "longitude"],
  ["admission", "admission"], ["operationType", "operation_type"], ["reservationType", "reservation_type"], ["reservationLabel", "reservation_label"],
  ["operatingHours", "operating_hours"], ["posterUrl", "poster_url"], ["galleryImages", "gallery_images"],
  ["description", "description"], ["highlights", "highlights"], ["perks", "perks"], ["officialUrl", "official_url"],
  ["sourceName", "source_name"], ["sourceUrl", "source_url"], ["verifiedDate", "verified_date"],
  ["isFeatured", "is_featured"], ["isFlagship", "is_flagship"], ["isSponsored", "is_sponsored"],
  ["isPartnerVerified", "is_partner_verified"], ["hasNativeBooking", "has_native_booking"],
  ["hasNativeWaiting", "has_native_waiting"], ["waitingCount", "waiting_count"], ["viewCount", "view_count"],
  ["likeCount", "like_count"], ["isPublished", "is_published"], ["sortOrder", "sort_order"],
  ["origin", "origin"], ["originRef", "origin_ref"], ["endedAt", "ended_at"],
]
const JSON_FIELDS = new Set<keyof PopupInput>(["galleryImages", "highlights", "perks"])

const toValues = (input: PopupInput) =>
  COLUMNS.map(([field]) => {
    const v = input[field]
    if (JSON_FIELDS.has(field)) return JSON.stringify(v ?? [])
    return v === undefined ? null : v
  })

const fromRow = (row: Record<string, unknown>): Popup => {
  const input = Object.fromEntries(COLUMNS.map(([field, column]) => [field, row[column]])) as Record<string, unknown>
  const toDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))
  const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return toPopup({
    ...(input as unknown as PopupInput),
    startDate: toDate(input.startDate),
    endDate: toDate(input.endDate),
    latitude: toNum(input.latitude),
    longitude: toNum(input.longitude),
    officialUrl: (input.officialUrl as string | null) || undefined,
    origin: (input.origin as PopupInput["origin"]) || "manual",
    originRef: (input.originRef as string | null) ?? null,
    endedAt: input.endedAt instanceof Date ? input.endedAt.toISOString() : ((input.endedAt as string | null) ?? null),
  })
}

// PostgreSQL 저장소
class PostgresPopupsRepository implements PopupsRepository {
  constructor(private db: NonNullable<typeof pool>) {}

  async list({ includeUnpublished }: { includeUnpublished: boolean }) {
    const { rows } = await this.db.query(
      `SELECT * FROM popups WHERE ($1 OR is_published) ORDER BY sort_order, start_date`,
      [includeUnpublished]
    )
    return rows.map(fromRow)
  }

  async search(query: string, limit: number) {
    const params: unknown[] = []
    const { where, score } = buildTextSearch(query, POPUP_SEARCH_COLUMNS, params)
    params.push(limit)
    const { rows } = await this.db.query(
      `SELECT *, ${score} AS search_score FROM popups
       WHERE is_published AND ${where}
       ORDER BY search_score DESC,
                CASE status WHEN 'ongoing' THEN 0 WHEN 'closing_soon' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,
                sort_order, start_date
       LIMIT $${params.length}`,
      params
    )
    return rows.map(fromRow)
  }

  async listPast({ limit, offset }: { limit: number; offset: number }) {
    const where = `ended_at IS NOT NULL OR (is_published AND end_date < $1::date)`
    const today = kstToday()
    const { rows } = await this.db.query(
      `SELECT * FROM popups WHERE ${where} ORDER BY end_date DESC, sort_order LIMIT $2 OFFSET $3`,
      [today, limit, offset]
    )
    const { rows: count } = await this.db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM popups WHERE ${where}`, [today])
    return { popups: rows.map(fromRow), total: count[0].n }
  }

  async get(id: string, { includeUnpublished }: { includeUnpublished: boolean }) {
    const { rows } = await this.db.query(`SELECT * FROM popups WHERE id = $1 AND ($2 OR is_published OR ended_at IS NOT NULL)`, [id, includeUnpublished])
    return rows[0] ? fromRow(rows[0]) : null
  }

  async create(input: PopupInput) {
    const columns = COLUMNS.map(([, c]) => c)
    const placeholders = columns.map((_, i) => `$${i + 1}`)
    try {
      const { rows } = await this.db.query(
        `INSERT INTO popups (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        toValues(input)
      )
      return fromRow(rows[0])
    } catch (e: any) {
      if (e?.code === "23505") throw new DuplicatePopupError(input.id)
      throw e
    }
  }

  async update(id: string, input: PopupInput) {
    const sets = COLUMNS.slice(1).map(([, c], i) => `${c} = $${i + 2}`)
    const { rows } = await this.db.query(
      `UPDATE popups SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...toValues({ ...input, id }).slice(1)]
    )
    return rows[0] ? fromRow(rows[0]) : null
  }

  async delete(id: string) {
    const { rowCount } = await this.db.query("DELETE FROM popups WHERE id = $1", [id])
    return (rowCount ?? 0) > 0
  }
}

export const popupsRepository: PopupsRepository = pool ? new PostgresPopupsRepository(pool) : new MemoryPopupsRepository()

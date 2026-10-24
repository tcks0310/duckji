import { pool } from "../../../shared/db/pool"
import type { AdminAction, BlockedSource, CandidateInput, CandidateStatus, PopupCandidate } from "./types"

export type CandidatePatch = Partial<Pick<PopupCandidate, "status" | "duplicateOf" | "popupId">>
export type NewCandidate = CandidateInput & { score: number; duplicateOf: string | null }

export interface IntakeRepository {
  insertCandidates(candidates: NewCandidate[]): Promise<{ inserted: number; skipped: number }>
  getCandidate(id: string): Promise<PopupCandidate | null>
  listCandidates(filter: { status?: CandidateStatus }): Promise<PopupCandidate[]>
  updateCandidate(id: string, patch: CandidatePatch): Promise<PopupCandidate | null>

  listBlockedSources(): Promise<BlockedSource[]>
  addBlockedSource(host: string, reason: string): Promise<void>
  removeBlockedSource(host: string): Promise<boolean>

  logAction(action: AdminAction): Promise<void>
  counts(): Promise<{ candidates: Record<string, number> }>
}

const nowIso = () => new Date().toISOString()
const countBy = <T>(items: T[], key: (t: T) => string) =>
  items.reduce<Record<string, number>>((acc, t) => ((acc[key(t)] = (acc[key(t)] || 0) + 1), acc), {})

// ---------------------------------------------------------------------------
// 메모리 저장소 (DATABASE_URL 미설정 시, 로컬 개발용). 재시작하면 사라짐
// ---------------------------------------------------------------------------
class MemoryIntakeRepository implements IntakeRepository {
  private seq = 0
  private candidates: PopupCandidate[] = []
  private blocked: BlockedSource[] = []
  private actions: AdminAction[] = []

  private nextId = () => String(++this.seq)

  async insertCandidates(candidates: NewCandidate[]) {
    let inserted = 0
    for (const c of candidates) {
      if (this.candidates.some((x) => x.sourceUrl === c.sourceUrl && x.title === c.title)) continue
      this.candidates.push({ ...c, id: this.nextId(), status: "pending", popupId: null, collectedAt: nowIso(), updatedAt: nowIso() })
      inserted++
    }
    return { inserted, skipped: candidates.length - inserted }
  }

  async getCandidate(id: string) {
    return this.candidates.find((c) => c.id === id) ?? null
  }

  async listCandidates({ status }: { status?: CandidateStatus }) {
    return this.candidates.filter((c) => !status || c.status === status).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
  }

  async updateCandidate(id: string, patch: CandidatePatch) {
    const c = this.candidates.find((x) => x.id === id)
    if (!c) return null
    Object.assign(c, patch, { updatedAt: nowIso() })
    return c
  }

  async listBlockedSources() {
    return [...this.blocked]
  }

  async addBlockedSource(host: string, reason: string) {
    if (!this.blocked.some((b) => b.host === host)) this.blocked.push({ host, reason, createdAt: nowIso() })
  }

  async removeBlockedSource(host: string) {
    const before = this.blocked.length
    this.blocked = this.blocked.filter((b) => b.host !== host)
    return this.blocked.length < before
  }

  async logAction(action: AdminAction) {
    this.actions.push(action)
  }

  async counts() {
    return { candidates: countBy(this.candidates, (c) => c.status) }
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL 저장소
// ---------------------------------------------------------------------------

const toDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v))
const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

const candidateFromRow = (r: Record<string, any>): PopupCandidate => ({
  id: String(r.id),
  status: r.status,
  title: r.title,
  category: r.category,
  startDate: toDate(r.start_date),
  endDate: toDate(r.end_date),
  location: r.location,
  venueName: r.venue_name,
  admission: r.admission,
  summary: r.summary,
  officialUrl: r.official_url,
  sourceName: r.source_name,
  sourceUrl: r.source_url,
  corroboratingUrls: r.corroborating_urls || [],
  checks: r.checks || [],
  score: r.score,
  duplicateOf: r.duplicate_of,
  popupId: r.popup_id,
  collectedAt: toIso(r.collected_at) as string,
  updatedAt: toIso(r.updated_at) as string,
})

const isId = (id: string) => /^\d{1,18}$/.test(id)

class PostgresIntakeRepository implements IntakeRepository {
  constructor(private db: NonNullable<typeof pool>) {}

  async insertCandidates(candidates: NewCandidate[]) {
    let inserted = 0
    for (const c of candidates) {
      const { rowCount } = await this.db.query(
        `INSERT INTO popup_candidates (title, category, start_date, end_date, location, venue_name, admission, summary,
           official_url, source_name, source_url, corroborating_urls, checks, score, duplicate_of)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (source_url, title) DO NOTHING`,
        [c.title, c.category, c.startDate, c.endDate, c.location, c.venueName, c.admission, c.summary, c.officialUrl,
         c.sourceName, c.sourceUrl, JSON.stringify(c.corroboratingUrls), JSON.stringify(c.checks), c.score, c.duplicateOf]
      )
      inserted += rowCount ?? 0
    }
    return { inserted, skipped: candidates.length - inserted }
  }

  async getCandidate(id: string) {
    if (!isId(id)) return null
    const { rows } = await this.db.query("SELECT * FROM popup_candidates WHERE id = $1", [id])
    return rows[0] ? candidateFromRow(rows[0]) : null
  }

  async listCandidates({ status }: { status?: CandidateStatus }) {
    const { rows } = await this.db.query(
      "SELECT * FROM popup_candidates WHERE ($1::text IS NULL OR status = $1) ORDER BY collected_at DESC, score DESC LIMIT 500",
      [status ?? null]
    )
    return rows.map(candidateFromRow)
  }

  async updateCandidate(id: string, patch: CandidatePatch) {
    if (!isId(id)) return null
    const map: [keyof CandidatePatch, string][] = [["status", "status"], ["duplicateOf", "duplicate_of"], ["popupId", "popup_id"]]
    const fields = map.filter(([f]) => patch[f] !== undefined)
    if (!fields.length) return this.getCandidate(id)
    const { rows } = await this.db.query(
      `UPDATE popup_candidates SET ${fields.map(([, c], i) => `${c} = $${i + 2}`).join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...fields.map(([f]) => patch[f])]
    )
    return rows[0] ? candidateFromRow(rows[0]) : null
  }

  async listBlockedSources() {
    const { rows } = await this.db.query("SELECT * FROM popup_blocked_sources ORDER BY created_at DESC")
    return rows.map((r) => ({ host: r.host, reason: r.reason, createdAt: toIso(r.created_at) as string }))
  }

  async addBlockedSource(host: string, reason: string) {
    await this.db.query("INSERT INTO popup_blocked_sources (host, reason) VALUES ($1, $2) ON CONFLICT (host) DO NOTHING", [host, reason])
  }

  async removeBlockedSource(host: string) {
    const { rowCount } = await this.db.query("DELETE FROM popup_blocked_sources WHERE host = $1", [host])
    return (rowCount ?? 0) > 0
  }

  async logAction(a: AdminAction) {
    await this.db.query(
      `INSERT INTO popup_admin_actions (target_type, target_id, action, from_status, to_status, reason, admin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.targetType, a.targetId, a.action, a.fromStatus, a.toStatus, a.reason, a.adminId]
    )
  }

  async counts() {
    const { rows } = await this.db.query("SELECT status, COUNT(*)::int AS n FROM popup_candidates GROUP BY status")
    return { candidates: Object.fromEntries(rows.map((r: any) => [r.status, r.n])) }
  }
}

export const intakeRepository: IntakeRepository = pool ? new PostgresIntakeRepository(pool) : new MemoryIntakeRepository()

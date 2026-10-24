import { db } from "../../shared/db/require-database"
import type { PublicSiteNotice, SiteNotice, SiteNoticeInput } from "./types"

const iso = (d: Date | null) => (d ? d.toISOString() : null)

const fromRow = (r: any): SiteNotice => ({
  id: Number(r.id),
  name: r.name,
  placement: r.placement,
  template: r.template,
  title: r.title,
  body: r.body,
  imageUrl: r.image_url,
  mobileImageUrl: r.mobile_image_url,
  linkUrl: r.link_url,
  linkLabel: r.link_label,
  linkNewTab: r.link_new_tab,
  pages: r.pages,
  audience: r.audience,
  device: r.device,
  dismiss: r.dismiss,
  priority: r.priority,
  startsAt: iso(r.starts_at),
  endsAt: iso(r.ends_at),
  status: r.status,
  contractId: r.contract_id === null || r.contract_id === undefined ? null : Number(r.contract_id),
  viewCount: Number(r.view_count),
  clickCount: Number(r.click_count),
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
})

const toPublic = ({ name, status, contractId, viewCount, clickCount, createdAt, updatedAt, ...rest }: SiteNotice): PublicSiteNotice => rest

const COLUMNS = [
  "name", "placement", "template", "title", "body", "image_url", "mobile_image_url", "link_url", "link_label", "link_new_tab",
  "pages", "audience", "device", "dismiss", "priority", "starts_at", "ends_at", "status", "contract_id",
]
const values = (i: SiteNoticeInput) => [
  i.name, i.placement, i.template, i.title, i.body, i.imageUrl, i.mobileImageUrl, i.linkUrl, i.linkLabel, i.linkNewTab,
  i.pages, i.audience, i.device, i.dismiss, i.priority, i.startsAt, i.endsAt, i.status, i.contractId,
]

async function logAction(a: {
  targetId: number
  action: "create" | "update" | "status" | "delete"
  fromStatus: string | null
  toStatus: string | null
  adminId: string
}) {
  await db().query(
    `INSERT INTO notices.admin_actions (target_type, target_id, action, from_status, to_status, admin_id)
     VALUES ('item', $1, $2, $3, $4, $5)`,
    [a.targetId, a.action, a.fromStatus, a.toStatus, a.adminId]
  )
}

export const siteNoticesRepository = {
  // 지금 노출 중인 것 (게시 + 기간 안). 우선순위 높은 것 → 최근 등록 순
  // 기간(종료 일시)이 지나면 여기서 빠져 공지·광고가 저절로 내려감 (따로 끄는 스케줄러 없음)
  async listLive() {
    const { rows } = await db().query(
      `SELECT * FROM notices.items
       WHERE status = 'published'
         AND template IN ('image', 'basic')
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY priority DESC, id DESC`
    )
    return rows.map(fromRow).map(toPublic)
  },

  async listAll() {
    const { rows } = await db().query(`SELECT * FROM notices.items ORDER BY status = 'published' DESC, priority DESC, id DESC`)
    return rows.map(fromRow)
  },

  async get(id: number) {
    const { rows } = await db().query(`SELECT * FROM notices.items WHERE id = $1`, [id])
    return rows[0] ? fromRow(rows[0]) : null
  },

  async create(input: SiteNoticeInput, adminId: string) {
    const { rows } = await db().query(
      `INSERT INTO notices.items (${COLUMNS.join(", ")})
       VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      values(input)
    )
    const notice = fromRow(rows[0])
    await logAction({ targetId: notice.id, action: "create", fromStatus: null, toStatus: notice.status, adminId })
    return notice
  },

  async update(existing: SiteNotice, input: SiteNoticeInput, adminId: string) {
    const { rows } = await db().query(
      `UPDATE notices.items SET ${COLUMNS.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [existing.id, ...values(input)]
    )
    const notice = fromRow(rows[0])
    const statusChanged = existing.status !== notice.status
    await logAction({
      targetId: notice.id,
      action: statusChanged ? "status" : "update",
      fromStatus: existing.status,
      toStatus: notice.status,
      adminId,
    })
    return notice
  },

  async remove(existing: SiteNotice, adminId: string) {
    await db().query(`DELETE FROM notices.items WHERE id = $1`, [existing.id])
    await logAction({ targetId: existing.id, action: "delete", fromStatus: existing.status, toStatus: null, adminId })
  },

  // 계약 기간이 바뀌거나 취소되면 그 계약으로 건 공지·광고의 기간을 맞춤 (취소면 숨김)
  async syncContract(contractId: number, period: { startsAt: string; endsAt: string } | null, adminId: string) {
    const { rows } = await db().query(
      period
        ? `UPDATE notices.items SET starts_at = $2, ends_at = $3, updated_at = NOW() WHERE contract_id = $1 RETURNING id, status`
        : `UPDATE notices.items SET status = 'hidden', updated_at = NOW() WHERE contract_id = $1 AND status <> 'hidden' RETURNING id, status`,
      period ? [contractId, period.startsAt, period.endsAt] : [contractId]
    )
    for (const r of rows) {
      await logAction({ targetId: Number(r.id), action: period ? "update" : "status", fromStatus: period ? r.status : null, toStatus: r.status, adminId })
    }
    return rows.length
  },

  // 노출·클릭 집계 (게시 중인 것만)
  async count(id: number, kind: "view" | "click") {
    const column = kind === "view" ? "view_count" : "click_count"
    const { rowCount } = await db().query(
      `UPDATE notices.items SET ${column} = ${column} + 1 WHERE id = $1 AND status = 'published'`,
      [id]
    )
    return (rowCount ?? 0) > 0
  },
}

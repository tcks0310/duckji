import { randomBytes } from "node:crypto"
import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember } from "../../shared/auth/require-member"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { db } from "../../shared/db/require-database"
import { existingItemIds } from "./mall-items"
import { cleanAttachments, inquiryAttachments } from "./storage"
import { DATE_RE, todayKst } from "./time"
import { isEmail } from "./validation"

// 견적·제작 문의 (b2b.inquiries)
// 공개: POST /api/b2b/inquiries  — 덕지몰 견적 요청(mall_quote), 커스텀샵 제작 의뢰(custom_order)
// 관리자: GET /api/b2b/admin/inquiries (?item=<품목 id>|none, ?kind, ?status), PATCH /api/b2b/admin/inquiries/:id
// 첨부(시안·참고 사진)는 비공개 저장소(private/b2b-inquiries)에 올리고 관리자 화면에서만 서명 주소로 봄

export const INQUIRY_KINDS = ["mall_quote", "custom_order"] as const
export const INQUIRY_STATUSES = ["received", "contacted", "quoted", "done", "cancelled"] as const
export const INQUIRY_STATUS_LABELS: Record<(typeof INQUIRY_STATUSES)[number], string> = {
  received: "접수",
  contacted: "연락함",
  quoted: "견적·시안 보냄",
  done: "완료",
  cancelled: "취소",
}

type Kind = (typeof INQUIRY_KINDS)[number]
const PHONE_RE = /^[0-9+\-() ]{8,20}$/
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

// 품목: 이름·수량과 몇 가지 옵션만 받음 (가격은 화면 계산값이라 참고용 details 로만)
function cleanItems(v: unknown) {
  if (!Array.isArray(v)) return []
  return v.slice(0, 50).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return []
    const r = raw as Record<string, unknown>
    const name = str(r.name, 150)
    const quantity = Math.min(Math.max(Math.floor(Number(r.quantity)) || 0, 0), 100000)
    if (!name || !quantity) return []
    const item: Record<string, unknown> = { name, quantity }
    for (const key of ["id", "serviceType", "size", "coating", "finish", "text", "fileName"]) {
      const val = str(r[key], 200)
      if (val) item[key] = val
    }
    return [item]
  })
}

const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : "")

function cleanDetails(kind: Kind, v: unknown, origin: string) {
  const r = v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  const attachments = cleanAttachments(r.attachments, origin)
  if (kind === "mall_quote") {
    let eventStart = date(r.eventStart)
    let eventEnd = date(r.eventEnd)
    if (eventStart && eventEnd && eventEnd < eventStart) [eventStart, eventEnd] = [eventEnd, eventStart]
    return {
      eventStart,
      eventEnd,
      installDate: date(r.installDate),
      eventLocation: str(r.eventLocation, 200),
      needInstallService: r.needInstallService === true,
      attachments,
    }
  }
  const total = Math.max(Math.floor(Number(r.estimatedTotal)) || 0, 0)
  return { address: str(r.address, 300), ...(total ? { estimatedTotal: total } : {}), attachments }
}

const newCode = (kind: Kind) =>
  `${kind === "mall_quote" ? "Q" : "C"}-${todayKst().replace(/-/g, "")}-${randomBytes(2).toString("hex").toUpperCase()}`

type Row = {
  id: string
  code: string
  kind: Kind
  status: string
  company_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  items: unknown[]
  item_ids: string[]
  details: Record<string, unknown>
  message: string
  member_id: string | null
  admin_memo: string
  created_at: Date
  updated_at: Date
}

// 비공개 첨부는 볼 때마다 서명 주소로
async function withSignedAttachments(r: Row) {
  const list = Array.isArray(r.details?.attachments) ? (r.details.attachments as string[]) : []
  if (!list.length) return fromRow(r)
  const attachments = await Promise.all(list.map((u) => inquiryAttachments.viewUrl(u)))
  return { ...fromRow(r), details: { ...r.details, attachments } }
}

const fromRow = (r: Row) => ({
  id: Number(r.id),
  code: r.code,
  kind: r.kind,
  status: r.status,
  statusLabel: INQUIRY_STATUS_LABELS[r.status as keyof typeof INQUIRY_STATUS_LABELS] || r.status,
  companyName: r.company_name,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  contactEmail: r.contact_email,
  items: r.items,
  itemIds: (r.item_ids || []).map(Number),
  details: r.details,
  message: r.message,
  memberId: r.member_id,
  adminMemo: r.admin_memo,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const inquiriesRoute = new Hono()

inquiriesRoute.post("/", async (c) => {
  if (!(await consumeQuota("b2b-inquiry", clientIp(c), 10, 86400)))
    return c.json({ success: false, error: "문의가 너무 많습니다. 내일 다시 시도해 주세요." }, 429)
  const body = (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
  // 봇이 채우는 숨은 필드가 있으면 접수한 척만 함
  if (typeof body.website === "string" && body.website) return c.json({ success: true, inquiry: null }, 201)
  const kind = body.kind as Kind
  if (!INQUIRY_KINDS.includes(kind)) return c.json({ success: false, error: "문의 종류가 올바르지 않습니다." }, 400)
  const contactName = str(body.contactName, 100)
  const contactPhone = str(body.contactPhone, 30)
  const contactEmail = str(body.contactEmail, 200).toLowerCase()
  const companyName = str(body.companyName, 100)
  const items = cleanItems(body.items)
  const message = str(body.message, 3000)
  const errors: string[] = []
  if (!contactName) errors.push("담당자(신청자) 이름을 입력해 주세요.")
  if (!PHONE_RE.test(contactPhone)) errors.push("연락처를 확인해 주세요.")
  if (!isEmail(contactEmail)) errors.push("이메일을 확인해 주세요.")
  if (kind === "mall_quote" && !companyName) errors.push("회사명·브랜드명을 입력해 주세요.")
  // 덕지몰은 품목 없이 일반 문의도 받음 (대신 내용은 있어야 함)
  if (!items.length && (kind === "custom_order" || !message)) errors.push(kind === "custom_order" ? "요청 품목이 없습니다." : "문의 내용을 적어 주세요.")
  if (errors.length) return c.json({ success: false, error: errors[0], errors }, 400)
  const member = getOptionalMember(c)
  // 품목별로 모아 보도록 실제 덕지몰 품목 id 를 따로 남김
  const itemIds =
    kind === "mall_quote" ? await existingItemIds([...new Set(items.map((i) => Number(i.id)).filter((n) => Number.isSafeInteger(n) && n > 0))]) : []
  const { rows } = await db().query<Row>(
    `INSERT INTO b2b.inquiries (code, kind, company_name, contact_name, contact_phone, contact_email, items, details, message, member_id, item_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      newCode(kind),
      kind,
      companyName,
      contactName,
      contactPhone,
      contactEmail,
      JSON.stringify(items),
      JSON.stringify(cleanDetails(kind, body.details, new URL(c.req.url).origin)),
      message,
      member?.id ?? null,
      itemIds,
    ]
  )
  return c.json({ success: true, inquiry: { code: rows[0].code } }, 201)
})

// ---- 관리자 ----

export const adminInquiriesRoute = new Hono()
adminInquiriesRoute.use("*", requireAdmin)

// ?item=<품목 id> 그 품목이 담긴 요청만, ?item=none 품목 없이 온 덕지몰 일반 문의만
adminInquiriesRoute.get("/", async (c: Context) => {
  const kind = c.req.query("kind")
  const status = c.req.query("status")
  const item = c.req.query("item")
  const itemId = item && /^\d{1,15}$/.test(item) ? Number(item) : null
  const { rows } = await db().query<Row>(
    `SELECT * FROM b2b.inquiries
     WHERE ($1::text IS NULL OR kind = $1) AND ($2::text IS NULL OR status = $2)
       AND ($3::bigint IS NULL OR $3 = ANY(item_ids))
       AND (NOT $4::boolean OR (kind = 'mall_quote' AND cardinality(item_ids) = 0))
     ORDER BY created_at DESC LIMIT 300`,
    [
      INQUIRY_KINDS.includes(kind as Kind) ? kind : null,
      INQUIRY_STATUSES.includes(status as any) ? status : null,
      itemId,
      item === "none",
    ]
  )
  // 묶음별 건수: 종류·상태별 + 품목 없는 덕지몰 문의
  const { rows: counts } = await db().query<{ kind: string; status: string; n: number; no_item: number }>(
    `SELECT kind, status, count(*)::int AS n, count(*) FILTER (WHERE cardinality(item_ids) = 0)::int AS no_item
     FROM b2b.inquiries GROUP BY kind, status`
  )
  return c.json({
    success: true,
    inquiries: await Promise.all(rows.map(withSignedAttachments)),
    counts: counts.map((r) => ({ kind: r.kind, status: r.status, n: r.n, noItem: r.no_item })),
    statuses: INQUIRY_STATUS_LABELS,
  })
})

adminInquiriesRoute.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const body = (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
  const sets: string[] = []
  const values: unknown[] = [id]
  if (body.status !== undefined) {
    if (!INQUIRY_STATUSES.includes(body.status as any)) return c.json({ success: false, error: "상태가 올바르지 않습니다." }, 400)
    values.push(body.status)
    sets.push(`status = $${values.length}`)
  }
  if (typeof body.adminMemo === "string") {
    values.push(body.adminMemo.trim().slice(0, 3000))
    sets.push(`admin_memo = $${values.length}`)
  }
  if (!sets.length) return c.json({ success: false, error: "바꿀 내용이 없습니다." }, 400)
  const { rows } = await db().query<Row>(
    `UPDATE b2b.inquiries SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values
  )
  if (!rows[0]) return c.json({ success: false, error: "문의를 찾을 수 없습니다." }, 404)
  return c.json({ success: true, inquiry: await withSignedAttachments(rows[0]) })
})

// 취소한 요청만 삭제 (테스트로 넣었다 취소한 요청 정리, hj 2026-10-16). 첨부 사진(비공개 S3)도 먼저 지우고, 다 지워져야 요청을 지움
adminInquiriesRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const { rows } = await db().query<Row>("SELECT * FROM b2b.inquiries WHERE id = $1", [id])
  const row = rows[0]
  if (!row) return c.json({ success: false, error: "문의를 찾을 수 없습니다." }, 404)
  if (row.status !== "cancelled") return c.json({ success: false, error: "취소 상태로 바꾼 요청만 지울 수 있어요." }, 409)
  const files = Array.isArray(row.details?.attachments) ? (row.details.attachments as string[]) : []
  try {
    await Promise.all(files.map((u) => inquiryAttachments.remove(u)))
  } catch (e) {
    console.error("inquiry attachment delete failed", id, e)
    return c.json({ success: false, error: "첨부 사진을 지우지 못해 요청을 지우지 않았어요. 잠시 후 다시 시도해 주세요." }, 502)
  }
  await db().query("DELETE FROM b2b.inquiries WHERE id = $1 AND status = 'cancelled'", [id])
  return c.json({ success: true })
})

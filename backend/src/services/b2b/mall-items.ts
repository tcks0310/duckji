import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { db } from "../../shared/db/require-database"

// 덕지몰 품목 (b2b.mall_items)
// 공개: GET /api/b2b/mall/items (노출 중인 품목만)
// 관리자: GET·POST /api/b2b/admin/mall/items, PATCH·DELETE /api/b2b/admin/mall/items/:id

// 분류는 코드에 고정 (화면 frontend/lib/mall.ts 와 같게)
export const MALL_CATEGORIES = {
  acrylic_display: "아크릴·진열장",
  photozone_sign: "포토존·사인·조명",
  operation_queue: "현장 운영·차단봉",
  shop_fixtures: "굿즈 매대·행거·가챠",
  packaging: "포장재·쇼핑백",
  etc: "기타",
} as const
export const SUPPLY_TYPES = ["렌탈", "구매", "맞춤제작"] as const

type Row = {
  id: string
  category: string
  name: string
  description: string
  spec: string
  supply_types: string[]
  image_urls: string[]
  sort_order: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

const fromRow = (r: Row) => ({
  id: Number(r.id),
  category: r.category,
  categoryName: MALL_CATEGORIES[r.category as keyof typeof MALL_CATEGORIES] || r.category,
  name: r.name,
  description: r.description,
  spec: r.spec,
  supplyTypes: r.supply_types,
  imageUrls: r.image_urls,
  sortOrder: r.sort_order,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
// 관리자가 붙여 넣은 주소도 받음 (http(s):// 또는 사이트 안 /경로)
const imageUrl = (v: unknown) => {
  const s = str(v, 1000)
  return /^https?:\/\//i.test(s) || /^\/[^/]/.test(s) ? s : ""
}

type Input = {
  category: string
  name: string
  description: string
  spec: string
  supplyTypes: string[]
  imageUrls: string[]
  sortOrder: number
  isActive: boolean
}

// 보낸 필드만 검사해 돌려줌 (partial = 수정)
function validate(body: Record<string, unknown>, partial: boolean): { ok: true; value: Partial<Input> } | { ok: false; error: string } {
  const v: Partial<Input> = {}
  const has = (k: string) => body[k] !== undefined
  if (!partial || has("name")) {
    v.name = str(body.name, 150)
    if (!v.name) return { ok: false, error: "품목 이름을 입력해 주세요." }
  }
  if (!partial || has("category")) {
    v.category = str(body.category, 30)
    if (!(v.category in MALL_CATEGORIES)) return { ok: false, error: "분류를 골라 주세요." }
  }
  if (!partial || has("supplyTypes")) {
    const list = Array.isArray(body.supplyTypes) ? body.supplyTypes : []
    v.supplyTypes = SUPPLY_TYPES.filter((t) => list.includes(t))
    if (!v.supplyTypes.length) return { ok: false, error: "공급 방식(렌탈·구매·맞춤제작)을 하나 이상 골라 주세요." }
  }
  if (!partial || has("description")) v.description = str(body.description, 3000)
  if (!partial || has("spec")) v.spec = str(body.spec, 300)
  if (!partial || has("imageUrls")) {
    const list = Array.isArray(body.imageUrls) ? body.imageUrls : []
    v.imageUrls = list.map(imageUrl).filter(Boolean).slice(0, 8)
  }
  if (!partial || has("sortOrder")) v.sortOrder = Math.min(Math.max(Math.floor(Number(body.sortOrder)) || 0, -100000), 100000)
  if (!partial || has("isActive")) v.isActive = body.isActive === undefined ? true : body.isActive === true
  return { ok: true, value: v }
}

const COLUMNS: Record<keyof Input, string> = {
  category: "category",
  name: "name",
  description: "description",
  spec: "spec",
  supplyTypes: "supply_types",
  imageUrls: "image_urls",
  sortOrder: "sort_order",
  isActive: "is_active",
}

// ---- 공개 ----

export const mallItemsRoute = new Hono()

mallItemsRoute.get("/", async (c) => {
  const { rows } = await db().query<Row>(
    "SELECT * FROM b2b.mall_items WHERE is_active ORDER BY sort_order, id DESC"
  )
  c.header("Cache-Control", "public, max-age=60")
  return c.json({ success: true, items: rows.map(fromRow), categories: MALL_CATEGORIES })
})

// ---- 관리자 ----

export const adminMallItemsRoute = new Hono()
adminMallItemsRoute.use("*", requireAdmin)

const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
const json = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)

// 품목 + 들어온 요청 수 (전체·새 요청)
adminMallItemsRoute.get("/", async (c) => {
  const { rows } = await db().query<Row & { total: number; fresh: number }>(
    `SELECT m.*, COALESCE(q.total, 0)::int AS total, COALESCE(q.fresh, 0)::int AS fresh
     FROM b2b.mall_items m
     LEFT JOIN (
       SELECT item_id, count(*) AS total, count(*) FILTER (WHERE status = 'received') AS fresh
       FROM b2b.inquiries, unnest(item_ids) AS item_id GROUP BY item_id
     ) q ON q.item_id = m.id
     ORDER BY m.is_active DESC, m.sort_order, m.id DESC`
  )
  return c.json({
    success: true,
    items: rows.map((r) => ({ ...fromRow(r), requests: { total: r.total, new: r.fresh } })),
    categories: MALL_CATEGORIES,
    supplyTypes: SUPPLY_TYPES,
  })
})

adminMallItemsRoute.post("/", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validate(body, false)
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  const v = result.value as Input
  const { rows } = await db().query<Row>(
    `INSERT INTO b2b.mall_items (category, name, description, spec, supply_types, image_urls, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [v.category, v.name, v.description, v.spec, v.supplyTypes, v.imageUrls, v.sortOrder, v.isActive]
  )
  return c.json({ success: true, item: fromRow(rows[0]) }, 201)
})

// 수정·숨김 — 보낸 필드만 바뀜
adminMallItemsRoute.patch("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validate(body, true)
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  const values: unknown[] = [id]
  const sets = Object.entries(result.value).map(([k, val]) => {
    values.push(val)
    return `${COLUMNS[k as keyof Input]} = $${values.length}`
  })
  if (!sets.length) return c.json({ success: false, error: "바꿀 내용이 없습니다." }, 400)
  const { rows } = await db().query<Row>(
    `UPDATE b2b.mall_items SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values
  )
  if (!rows[0]) return c.json({ success: false, error: "품목을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, item: fromRow(rows[0]) })
})

// 삭제는 요청이 하나도 없는 품목만 (요청이 있으면 숨김으로)
adminMallItemsRoute.delete("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const { rows: used } = await db().query("SELECT 1 FROM b2b.inquiries WHERE $1 = ANY(item_ids) LIMIT 1", [id])
  if (used[0]) return c.json({ success: false, error: "이 품목으로 들어온 요청이 있어 지울 수 없습니다. 숨김으로 바꿔 주세요." }, 409)
  const { rowCount } = await db().query("DELETE FROM b2b.mall_items WHERE id = $1", [id])
  if (!rowCount) return c.json({ success: false, error: "품목을 찾을 수 없습니다." }, 404)
  return c.json({ success: true })
})

// 견적 요청에 담긴 품목 id 중 실제 품목만 (숨긴 품목도 포함: 담아 둔 뒤 숨겼을 수 있음)
export async function existingItemIds(ids: number[]): Promise<number[]> {
  if (!ids.length) return []
  const { rows } = await db().query<{ id: string }>("SELECT id FROM b2b.mall_items WHERE id = ANY($1::bigint[])", [ids])
  return rows.map((r) => Number(r.id))
}

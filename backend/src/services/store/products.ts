import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { db } from "../../shared/db/require-database"
import { isMissingRelation, listCategories } from "./categories"
import { cartCounts, wishCounts } from "./shared-tables"

// 굿즈 상품 (store.products). 가격은 DP (1 DP = 1원), 가격이 없으면 '가격 공개 예정'(찜만, 구매 불가)
// 공개: GET /api/store/products (판매 중인 상품 + 분류 + 랭킹용 판매·별점), GET /api/store/products/:id
// 관리자: GET·POST /api/store/admin/products, PATCH·DELETE /api/store/admin/products/:id
// 분류는 관리자가 정함 (categories.ts). 품절 = 관리자 품절 처리(sold_out) 또는 재고 0

export const BADGES = ["한정판", "BEST", "HOT", "NEW", "사전예약", "품절임박"] as const

export type ProductRow = {
  id: string
  category: string
  name: string
  series: string
  description: string
  specs: string[]
  image_urls: string[]
  detail_image_urls?: string[] // 045 전에는 없음
  sold_out?: boolean
  price_dp: number | null
  stock: number | null
  max_per_order: number
  badge: string
  sort_order: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// 랭킹·목록용 숫자: 판매 수량(취소 제외, 최근 1·7·30일·전체), 후기 평균 별점·개수
export type ProductStats = { sales: { d1: number; d7: number; d30: number; all: number }; rating: number | null; reviewCount: number }
const noStats = (): ProductStats => ({ sales: { d1: 0, d7: 0, d30: 0, all: 0 }, rating: null, reviewCount: 0 })

export const fromRow = (r: ProductRow, wish = 0, stats: ProductStats = noStats(), categories: Map<string, string> = new Map()) => ({
  id: Number(r.id),
  category: r.category,
  categoryName: categories.get(r.category) || "",
  name: r.name,
  series: r.series,
  description: r.description,
  specs: r.specs,
  imageUrls: r.image_urls,
  detailImageUrls: r.detail_image_urls ?? [],
  priceDp: r.price_dp,
  stock: r.stock,
  soldOut: Boolean(r.sold_out) || r.stock === 0,
  manualSoldOut: Boolean(r.sold_out),
  maxPerOrder: r.max_per_order,
  badge: r.badge,
  sortOrder: r.sort_order,
  isActive: r.is_active,
  wishCount: wish,
  ...stats,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

async function productStats(ids: number[]): Promise<Map<number, ProductStats>> {
  const map = new Map<number, ProductStats>()
  if (!ids.length) return map
  const get = (id: number) => map.get(id) ?? (map.set(id, noStats()), map.get(id)!)
  const { rows } = await db().query<{ product_id: string; d1: number; d7: number; d30: number; total: number }>(
    `SELECT i.product_id,
            COALESCE(SUM(i.quantity) FILTER (WHERE o.created_at > NOW() - INTERVAL '1 day'), 0)::int AS d1,
            COALESCE(SUM(i.quantity) FILTER (WHERE o.created_at > NOW() - INTERVAL '7 days'), 0)::int AS d7,
            COALESCE(SUM(i.quantity) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days'), 0)::int AS d30,
            SUM(i.quantity)::int AS total
     FROM store.order_items i JOIN store.orders o ON o.id = i.order_id AND o.status <> 'canceled'
     WHERE i.product_id = ANY($1::bigint[]) GROUP BY i.product_id`,
    [ids]
  )
  for (const r of rows) get(Number(r.product_id)).sales = { d1: r.d1, d7: r.d7, d30: r.d30, all: r.total }
  try {
    const { rows: rv } = await db().query<{ product_id: string; avg: string; n: number }>(
      "SELECT product_id, AVG(rating) AS avg, COUNT(*)::int AS n FROM store.reviews WHERE NOT is_hidden AND product_id = ANY($1::bigint[]) GROUP BY product_id",
      [ids]
    )
    for (const r of rv) Object.assign(get(Number(r.product_id)), { rating: Math.round(Number(r.avg) * 10) / 10, reviewCount: r.n })
  } catch (e) {
    if (!isMissingRelation(e)) throw e
  }
  return map
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
// 관리자가 붙여 넣은 주소도 받음 (http(s):// 또는 사이트 안 /경로)
const imageUrl = (v: unknown) => {
  const s = str(v, 1000)
  return /^https?:\/\//i.test(s) || /^\/[^/]/.test(s) ? s : ""
}
// 빈 값 = null, 아니면 범위 안 정수
const optInt = (v: unknown, min: number, max: number): number | null | "bad" => {
  if (v === null || v === "" || v === undefined) return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : "bad"
}

type Input = {
  category: string
  name: string
  series: string
  description: string
  specs: string[]
  imageUrls: string[]
  detailImageUrls: string[]
  soldOut: boolean
  priceDp: number | null
  stock: number | null
  maxPerOrder: number
  badge: string
  sortOrder: number
  isActive: boolean
}

// 보낸 필드만 검사해 돌려줌 (partial = 수정)
function validate(body: Record<string, unknown>, partial: boolean, categoryCodes: string[]): { ok: true; value: Partial<Input> } | { ok: false; error: string } {
  const v: Partial<Input> = {}
  const has = (k: string) => body[k] !== undefined
  if (!partial || has("name")) {
    v.name = str(body.name, 150)
    if (!v.name) return { ok: false, error: "상품 이름을 입력해 주세요." }
  }
  if (!partial || has("category")) {
    v.category = str(body.category, 20)
    if (!categoryCodes.includes(v.category)) return { ok: false, error: "분류를 골라 주세요. 분류가 없으면 분류 관리에서 먼저 만들어 주세요." }
  }
  if (!partial || has("priceDp")) {
    const n = optInt(body.priceDp, 1, 10_000_000)
    if (n === "bad") return { ok: false, error: "가격은 1 DP 이상 정수로 입력해 주세요. (비우면 가격 공개 예정)" }
    v.priceDp = n
  }
  if (!partial || has("stock")) {
    const n = optInt(body.stock, 0, 1_000_000)
    if (n === "bad") return { ok: false, error: "재고는 0 이상 정수로 입력해 주세요. (비우면 수량 제한 없음)" }
    v.stock = n
  }
  if (!partial || has("maxPerOrder")) {
    const n = optInt(body.maxPerOrder, 1, 99)
    if (n === "bad") return { ok: false, error: "1회 최대 구매 수량은 1~99 사이로 입력해 주세요." }
    v.maxPerOrder = n ?? 10
  }
  if (!partial || has("badge")) {
    const b = str(body.badge, 20)
    v.badge = (BADGES as readonly string[]).includes(b) ? b : ""
  }
  if (!partial || has("series")) v.series = str(body.series, 100)
  if (!partial || has("description")) v.description = str(body.description, 3000)
  if (!partial || has("specs")) {
    const list = Array.isArray(body.specs) ? body.specs : []
    v.specs = list.map((s) => str(s, 200)).filter(Boolean).slice(0, 20)
  }
  if (!partial || has("imageUrls")) {
    const list = Array.isArray(body.imageUrls) ? body.imageUrls : []
    v.imageUrls = list.map(imageUrl).filter(Boolean).slice(0, 8)
  }
  if (!partial || has("detailImageUrls")) {
    const list = Array.isArray(body.detailImageUrls) ? body.detailImageUrls : []
    v.detailImageUrls = list.map(imageUrl).filter(Boolean).slice(0, 20)
  }
  if (!partial || has("soldOut")) v.soldOut = body.soldOut === true
  if (!partial || has("sortOrder")) v.sortOrder = Math.min(Math.max(Math.floor(Number(body.sortOrder)) || 0, -100000), 100000)
  if (!partial || has("isActive")) v.isActive = body.isActive === undefined ? true : body.isActive === true
  return { ok: true, value: v }
}

const COLUMNS: Record<keyof Input, string> = {
  category: "category",
  name: "name",
  series: "series",
  description: "description",
  specs: "specs",
  imageUrls: "image_urls",
  detailImageUrls: "detail_image_urls",
  soldOut: "sold_out",
  priceDp: "price_dp",
  stock: "stock",
  maxPerOrder: "max_per_order",
  badge: "badge",
  sortOrder: "sort_order",
  isActive: "is_active",
}

const withStats = async (rows: ProductRow[]) => {
  const ids = rows.map((r) => Number(r.id))
  const [wish, stats, categories] = await Promise.all([wishCounts(db(), ids), productStats(ids), listCategories()])
  const names = new Map(categories.map((c) => [c.code, c.name]))
  return rows.map((r) => fromRow(r, wish.get(Number(r.id)) ?? 0, stats.get(Number(r.id)), names))
}

const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
const json = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)

// ---- 공개 ----

export const productsRoute = new Hono()

productsRoute.get("/", async (c) => {
  const { rows } = await db().query<ProductRow>("SELECT * FROM store.products WHERE is_active ORDER BY sort_order, id DESC")
  c.header("Cache-Control", "public, max-age=30")
  return c.json({ success: true, products: await withStats(rows), categories: await listCategories() })
})

productsRoute.get("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  const { rows } = await db().query<ProductRow>("SELECT * FROM store.products WHERE id = $1 AND is_active", [id])
  if (!rows[0]) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, product: (await withStats(rows))[0] })
})

// ---- 관리자 ----

export const adminProductsRoute = new Hono()
adminProductsRoute.use("*", requireAdmin)

// 상품 + 판매·찜·장바구니 숫자
adminProductsRoute.get("/", async (c) => {
  const { rows } = await db().query<ProductRow>("SELECT * FROM store.products ORDER BY is_active DESC, sort_order, id DESC")
  const products = await withStats(rows)
  const carts = await cartCounts(db(), products.map((p) => p.id))
  return c.json({
    success: true,
    products: products.map((p) => ({ ...p, sold: p.sales.all, cartQty: carts.get(p.id)?.qty ?? 0, cartMembers: carts.get(p.id)?.members ?? 0 })),
    categories: await listCategories(),
    badges: BADGES,
  })
})

adminProductsRoute.post("/", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validate(body, false, (await listCategories()).map((x) => x.code))
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  const v = result.value as Input
  const { rows } = await db().query<ProductRow>(
    `INSERT INTO store.products (category, name, series, description, specs, image_urls, detail_image_urls, sold_out, price_dp, stock, max_per_order, badge, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [v.category, v.name, v.series, v.description, v.specs, v.imageUrls, v.detailImageUrls, v.soldOut, v.priceDp, v.stock, v.maxPerOrder, v.badge, v.sortOrder, v.isActive]
  )
  return c.json({ success: true, product: (await withStats(rows))[0] }, 201)
})

// 수정·숨김 — 보낸 필드만 바뀜
adminProductsRoute.patch("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validate(body, true, (await listCategories()).map((x) => x.code))
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  const values: unknown[] = [id]
  const sets = Object.entries(result.value).map(([k, val]) => {
    values.push(val)
    return `${COLUMNS[k as keyof Input]} = $${values.length}`
  })
  if (!sets.length) return c.json({ success: false, error: "바꿀 내용이 없습니다." }, 400)
  const { rows } = await db().query<ProductRow>(
    `UPDATE store.products SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values
  )
  if (!rows[0]) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, product: (await withStats(rows))[0] })
})

// 삭제는 주문이 하나도 없는 상품만 (주문이 있으면 숨김으로)
adminProductsRoute.delete("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const { rows: used } = await db().query("SELECT 1 FROM store.order_items WHERE product_id = $1 LIMIT 1", [id])
  if (used[0]) return c.json({ success: false, error: "이 상품의 주문이 있어 지울 수 없습니다. 숨김으로 바꿔 주세요." }, 409)
  const { rowCount } = await db().query("DELETE FROM store.products WHERE id = $1", [id])
  if (!rowCount) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  return c.json({ success: true })
})

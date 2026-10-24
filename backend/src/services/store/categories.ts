import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { db } from "../../shared/db/require-database"

// 굿즈샵 분류 (store.categories). 굿즈샵 위 탭에 '랭킹' 다음으로 이 순서대로 보임
// 공개 목록은 GET /api/store/products 에 같이 실림. 관리자: GET·POST /api/store/admin/categories, PATCH·DELETE /:code

export type Category = { code: string; name: string; sortOrder: number }

// 045 적용 전 운영 DB 에서도 굿즈샵이 열리도록 예전 고정 분류로 대신함
const LEGACY: Category[] = [
  { code: "stationery", name: "컬렉션 카드·잡화", sortOrder: 1 },
  { code: "acrylic", name: "아크릴 스탠드", sortOrder: 2 },
  { code: "apparel", name: "의류·패션", sortOrder: 3 },
  { code: "figure", name: "피규어·소품", sortOrder: 4 },
  { code: "etc", name: "기타", sortOrder: 5 },
]

export const isMissingRelation = (e: unknown) => ["42P01", "42703"].includes((e as { code?: string })?.code ?? "")

export async function listCategories(): Promise<Category[]> {
  try {
    const { rows } = await db().query<{ code: string; name: string; sort_order: number }>(
      "SELECT code, name, sort_order FROM store.categories ORDER BY sort_order, created_at, code"
    )
    return rows.map((r) => ({ code: r.code, name: r.name, sortOrder: r.sort_order }))
  } catch (e) {
    if (isMissingRelation(e)) return LEGACY
    throw e
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const json = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)

export const adminCategoriesRoute = new Hono()
adminCategoriesRoute.use("*", requireAdmin)

// 분류 + 분류별 상품 수
adminCategoriesRoute.get("/", async (c) => {
  const categories = await listCategories()
  const { rows } = await db().query<{ category: string; n: number }>("SELECT category, COUNT(*)::int AS n FROM store.products GROUP BY category")
  const counts = new Map(rows.map((r) => [r.category, r.n]))
  return c.json({ success: true, categories: categories.map((cat) => ({ ...cat, productCount: counts.get(cat.code) ?? 0 })) })
})

adminCategoriesRoute.post("/", async (c) => {
  const body = await json(c)
  const name = str(body?.name, 40)
  if (!name) return c.json({ success: false, error: "분류 이름을 입력해 주세요." }, 400)
  const { rows: same } = await db().query("SELECT 1 FROM store.categories WHERE name = $1", [name])
  if (same[0]) return c.json({ success: false, error: "같은 이름의 분류가 있어요." }, 409)
  const { rows } = await db().query<{ code: string; name: string; sort_order: number }>(
    `INSERT INTO store.categories (code, name, sort_order)
     VALUES ('c' || nextval('store.category_code_seq'), $1, COALESCE((SELECT MAX(sort_order) FROM store.categories), 0) + 1)
     RETURNING code, name, sort_order`,
    [name]
  )
  return c.json({ success: true, category: { code: rows[0].code, name: rows[0].name, sortOrder: rows[0].sort_order } }, 201)
})

// 이름 바꾸기·순서 바꾸기 { name?, sortOrder? }
adminCategoriesRoute.patch("/:code", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const name = body.name === undefined ? null : str(body.name, 40)
  if (name === "") return c.json({ success: false, error: "분류 이름을 입력해 주세요." }, 400)
  const sort = body.sortOrder === undefined ? null : Math.min(Math.max(Math.floor(Number(body.sortOrder)) || 0, -1000), 1000)
  const { rows } = await db().query<{ code: string; name: string; sort_order: number }>(
    "UPDATE store.categories SET name = COALESCE($2, name), sort_order = COALESCE($3, sort_order) WHERE code = $1 RETURNING code, name, sort_order",
    [c.req.param("code"), name, sort]
  )
  if (!rows[0]) return c.json({ success: false, error: "분류를 찾을 수 없습니다." }, 404)
  return c.json({ success: true, category: { code: rows[0].code, name: rows[0].name, sortOrder: rows[0].sort_order } })
})

// 상품이 남아 있는 분류는 지우지 않음 (상품을 다른 분류로 옮긴 뒤)
adminCategoriesRoute.delete("/:code", async (c) => {
  const code = c.req.param("code")
  const { rows } = await db().query<{ n: number }>("SELECT COUNT(*)::int AS n FROM store.products WHERE category = $1", [code])
  if (rows[0].n > 0) return c.json({ success: false, error: `이 분류에 상품이 ${rows[0].n}개 있어요. 상품을 다른 분류로 옮긴 뒤 지워 주세요.` }, 409)
  const { rowCount } = await db().query("DELETE FROM store.categories WHERE code = $1", [code])
  if (!rowCount) return c.json({ success: false, error: "분류를 찾을 수 없습니다." }, 404)
  return c.json({ success: true })
})

import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { requireAdmin } from "../../shared/auth/require-admin"
import { MEMBER_SESSION_COOKIE, verifyMemberSessionToken } from "../../shared/auth/member-session"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db } from "../../shared/db/require-database"
import { isMissingRelation } from "./categories"
import { memberNames } from "./shared-tables"

// 상품 후기·별점 (store.reviews). 그 상품을 주문한(취소 제외) 회원만, 상품당 하나 (다시 쓰면 고침)
// 공개: GET /api/store/products/:id/reviews   회원: PUT·DELETE /api/store/reviews/:productId
// 관리자: GET /api/store/admin/reviews, PATCH /api/store/admin/reviews/:id { hidden }

type ReviewRow = { id: string; product_id: string; member_id: string; rating: number; content: string; is_hidden: boolean; created_at: Date }

// 이름 가운데 가림: 덕지팬 → 덕*팬, 홍길 → 홍*
const mask = (name: string) => {
  const n = [...(name || "회원")]
  if (n.length <= 1) return n.join("") + "*"
  if (n.length === 2) return n[0] + "*"
  return n[0] + "*".repeat(n.length - 2) + n[n.length - 1]
}

const fromRow = (r: ReviewRow, names: Map<string, string>, me?: string) => ({
  id: Number(r.id),
  productId: Number(r.product_id),
  rating: r.rating,
  content: r.content,
  author: names.has(r.member_id) ? mask(names.get(r.member_id)!) : "탈퇴한 회원",
  mine: me === r.member_id,
  createdAt: r.created_at,
})

const productId = (c: Context) => {
  const id = Number(c.req.param("id") ?? c.req.param("productId"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

// 상품 상세 아래 후기 목록 (최근 100개) + 로그인했으면 내가 쓸 수 있는지
export const productReviewsRoute = new Hono()
productReviewsRoute.get("/:id/reviews", async (c) => {
  const id = productId(c)
  if (!id) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  const me = verifyMemberSessionToken(getCookie(c, MEMBER_SESSION_COOKIE))?.id
  try {
    const { rows } = await db().query<ReviewRow>(
      "SELECT * FROM store.reviews WHERE product_id = $1 AND (NOT is_hidden OR member_id = $2) ORDER BY id DESC LIMIT 100",
      [id, me ?? ""]
    )
    const names = await memberNames(db(), [...new Set(rows.map((r) => r.member_id))])
    let canWrite = false
    if (me) {
      const { rows: bought } = await db().query(
        `SELECT 1 FROM store.order_items i JOIN store.orders o ON o.id = i.order_id
         WHERE o.member_id = $1 AND i.product_id = $2 AND o.status <> 'canceled' LIMIT 1`,
        [me, id]
      )
      canWrite = Boolean(bought[0])
    }
    return c.json({ success: true, reviews: rows.map((r) => fromRow(r, names, me)), canWrite, loggedIn: Boolean(me) })
  } catch (e) {
    if (isMissingRelation(e)) return c.json({ success: true, reviews: [], canWrite: false, loggedIn: Boolean(me) })
    throw e
  }
})

export const reviewsRoute = new Hono<MemberEnv>()
reviewsRoute.use("*", requireMember)

// 쓰기·고치기 { rating 1~5, content }
reviewsRoute.put("/:productId", async (c) => {
  const id = productId(c)
  if (!id) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  const memberId = c.get("member").id
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const rating = Number(body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return c.json({ success: false, error: "별점을 1~5점으로 골라 주세요." }, 400)
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 1000) : ""
  const { rows: bought } = await db().query(
    `SELECT 1 FROM store.order_items i JOIN store.orders o ON o.id = i.order_id
     WHERE o.member_id = $1 AND i.product_id = $2 AND o.status <> 'canceled' LIMIT 1`,
    [memberId, id]
  )
  if (!bought[0]) return c.json({ success: false, error: "이 상품을 주문한 회원만 후기를 쓸 수 있어요." }, 403)
  const { rows } = await db().query<ReviewRow>(
    `INSERT INTO store.reviews (product_id, member_id, rating, content) VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id, member_id) DO UPDATE SET rating = EXCLUDED.rating, content = EXCLUDED.content, updated_at = NOW()
     RETURNING *`,
    [id, memberId, rating, content]
  )
  const names = await memberNames(db(), [memberId])
  return c.json({ success: true, review: fromRow(rows[0], names, memberId) })
})

reviewsRoute.delete("/:productId", async (c) => {
  const id = productId(c)
  if (!id) return c.json({ success: false, error: "상품을 찾을 수 없습니다." }, 404)
  await db().query("DELETE FROM store.reviews WHERE product_id = $1 AND member_id = $2", [id, c.get("member").id])
  return c.json({ success: true })
})

// ---- 관리자: 최근 후기 300개, 숨기기
export const adminReviewsRoute = new Hono()
adminReviewsRoute.use("*", requireAdmin)

adminReviewsRoute.get("/", async (c) => {
  try {
    const { rows } = await db().query<ReviewRow & { product_name: string | null }>(
      `SELECT r.*, p.name AS product_name FROM store.reviews r LEFT JOIN store.products p ON p.id = r.product_id ORDER BY r.id DESC LIMIT 300`
    )
    const names = await memberNames(db(), [...new Set(rows.map((r) => r.member_id))])
    return c.json({
      success: true,
      reviews: rows.map((r) => ({ ...fromRow(r, names), productName: r.product_name ?? "", memberId: r.member_id, memberName: names.get(r.member_id) ?? "", hidden: r.is_hidden })),
    })
  } catch (e) {
    if (isMissingRelation(e)) return c.json({ success: true, reviews: [] })
    throw e
  }
})

adminReviewsRoute.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!Number.isSafeInteger(id) || typeof body?.hidden !== "boolean") return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const { rowCount } = await db().query("UPDATE store.reviews SET is_hidden = $2 WHERE id = $1", [id, body.hidden])
  if (!rowCount) return c.json({ success: false, error: "후기를 찾을 수 없습니다." }, 404)
  return c.json({ success: true })
})

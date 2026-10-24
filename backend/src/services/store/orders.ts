import { randomInt } from "crypto"
import { Hono, type Context } from "hono"
import type { PoolClient } from "pg"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { db } from "../../shared/db/require-database"
import type { ProductRow } from "./products"
import { DpError, refundDp, removeFromCart, spendDp } from "./shared-tables"
import { tx } from "./tx"

// 굿즈 주문 (store.orders·order_items). 주문 = DP 결제 완료. 결제사(PG)는 DP 충전에만 붙음
// 회원: POST /api/store/orders, GET /api/store/orders, GET /api/store/orders/:orderNo, POST /api/store/orders/:orderNo/cancel
// 관리자: GET /api/store/admin/orders, PATCH /api/store/admin/orders/:id, POST /api/store/admin/orders/:id/cancel
// 상태: paid(결제 완료) → shipped(발송) → delivered(배송 완료). 회원은 발송 전(paid)만 취소, 관리자는 배송 완료 전까지 취소. 취소 = DP 환불 + 재고 복구

export const ORDER_STATUSES = ["paid", "shipped", "delivered", "canceled"] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]
const MAX_LINES = 30

export class OrderError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message)
  }
}

type OrderRow = {
  id: string
  order_no: string
  member_id: string
  status: OrderStatus
  total_dp: number
  recipient_name: string
  recipient_phone: string
  postcode: string
  address: string
  address_detail: string
  request_note: string
  tracking_no: string
  admin_memo: string
  created_at: Date
  updated_at: Date
  canceled_at: Date | null
}
type ItemRow = { order_id: string; product_id: string | null; name: string; image_url: string; price_dp: number; quantity: number }

const fromRow = (r: OrderRow, items: ItemRow[], admin = false) => ({
  id: Number(r.id),
  orderNo: r.order_no,
  status: r.status,
  totalDp: r.total_dp,
  recipient: {
    name: r.recipient_name,
    phone: r.recipient_phone,
    postcode: r.postcode,
    address: r.address,
    addressDetail: r.address_detail,
  },
  requestNote: r.request_note,
  trackingNo: r.tracking_no,
  items: items
    .filter((i) => i.order_id === r.id)
    .map((i) => ({ productId: i.product_id === null ? null : Number(i.product_id), name: i.name, imageUrl: i.image_url, priceDp: i.price_dp, quantity: i.quantity })),
  createdAt: r.created_at,
  canceledAt: r.canceled_at,
  ...(admin ? { memberId: r.member_id, adminMemo: r.admin_memo, updatedAt: r.updated_at } : {}),
})

async function withItems(q: Pick<PoolClient, "query">, rows: OrderRow[], admin = false) {
  if (!rows.length) return []
  const { rows: items } = await q.query<ItemRow>(
    "SELECT order_id, product_id, name, image_url, price_dp, quantity FROM store.order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id",
    [rows.map((r) => r.id)]
  )
  return rows.map((r) => fromRow(r, items, admin))
}

// 주문 번호 DJ-YYMMDD-XXXXXX (한국 날짜, 헷갈리는 0·O·1·I 뺀 6자리)
const NO_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
function newOrderNo() {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString()
  const ymd = d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10)
  let tail = ""
  for (let i = 0; i < 6; i++) tail += NO_CHARS[randomInt(NO_CHARS.length)]
  return `DJ-${ymd}-${tail}`
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

type OrderInput = {
  lines: { productId: number; quantity: number }[]
  recipient: { name: string; phone: string; postcode: string; address: string; addressDetail: string }
  requestNote: string
  fromCart: boolean
}

function validateOrder(body: Record<string, unknown>): { ok: true; value: OrderInput } | { ok: false; error: string } {
  const raw = Array.isArray(body.items) ? body.items : []
  const merged = new Map<number, number>()
  for (const it of raw.slice(0, MAX_LINES)) {
    const productId = Number((it as Record<string, unknown>)?.productId)
    const quantity = Number((it as Record<string, unknown>)?.quantity)
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      return { ok: false, error: "주문할 상품과 수량을 확인해 주세요." }
    merged.set(productId, (merged.get(productId) ?? 0) + quantity)
  }
  if (!merged.size) return { ok: false, error: "주문할 상품을 골라 주세요." }
  const r = (body.recipient ?? {}) as Record<string, unknown>
  const recipient = {
    name: str(r.name, 50),
    phone: str(r.phone, 30),
    postcode: str(r.postcode, 10),
    address: str(r.address, 300),
    addressDetail: str(r.addressDetail, 200),
  }
  if (!recipient.name) return { ok: false, error: "받는 분 이름을 입력해 주세요." }
  if (!/^[0-9+\-\s]{9,20}$/.test(recipient.phone)) return { ok: false, error: "받는 분 연락처를 확인해 주세요." }
  if (!recipient.address) return { ok: false, error: "배송 주소를 입력해 주세요." }
  return {
    ok: true,
    value: {
      lines: [...merged].map(([productId, quantity]) => ({ productId, quantity })),
      recipient,
      requestNote: str(body.requestNote, 200),
      fromCart: body.fromCart === true,
    },
  }
}

// 주문 만들기: 상품 행을 잠그고 가격·재고를 서버 값으로 다시 확인 → 재고 차감 → DP 결제를 한 트랜잭션으로
async function placeOrder(memberId: string, input: OrderInput) {
  return tx(async (q) => {
    const ids = input.lines.map((l) => l.productId)
    const { rows: products } = await q.query<ProductRow>(
      "SELECT * FROM store.products WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE",
      [ids]
    )
    const byId = new Map(products.map((p) => [Number(p.id), p]))
    let total = 0
    for (const line of input.lines) {
      const p = byId.get(line.productId)
      if (!p || !p.is_active) throw new OrderError(409, "판매가 끝난 상품이 있어요. 목록을 새로 고쳐 주세요.")
      if (p.sold_out) throw new OrderError(409, `'${p.name}'은(는) 품절이에요.`)
      if (p.price_dp === null) throw new OrderError(409, `'${p.name}'은(는) 아직 가격 공개 전이라 살 수 없어요.`)
      if (line.quantity > p.max_per_order) throw new OrderError(409, `'${p.name}'은(는) 한 번에 ${p.max_per_order}개까지 살 수 있어요.`)
      if (p.stock !== null && p.stock < line.quantity)
        throw new OrderError(409, p.stock === 0 ? `'${p.name}'은(는) 품절이에요.` : `'${p.name}'은(는) ${p.stock}개 남았어요.`)
      total += p.price_dp * line.quantity
    }
    if (total > 100_000_000) throw new OrderError(400, "한 번에 주문할 수 있는 금액을 넘었어요.")

    const orderNo = newOrderNo()
    const r = input.recipient
    const { rows } = await q.query<OrderRow>(
      `INSERT INTO store.orders (order_no, member_id, total_dp, recipient_name, recipient_phone, postcode, address, address_detail, request_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [orderNo, memberId, total, r.name, r.phone, r.postcode, r.address, r.addressDetail, input.requestNote]
    )
    for (const line of input.lines) {
      const p = byId.get(line.productId)!
      await q.query(
        "INSERT INTO store.order_items (order_id, product_id, name, image_url, price_dp, quantity) VALUES ($1, $2, $3, $4, $5, $6)",
        [rows[0].id, p.id, p.name, p.image_urls[0] ?? "", p.price_dp, line.quantity]
      )
      if (p.stock !== null) await q.query("UPDATE store.products SET stock = stock - $2, updated_at = NOW() WHERE id = $1", [p.id, line.quantity])
    }
    const first = byId.get(input.lines[0].productId)!.name
    const memo = input.lines.length > 1 ? `${orderNo} · ${first} 외 ${input.lines.length - 1}건` : `${orderNo} · ${first}`
    const balance = await spendDp(q, memberId, total, orderNo, memo)
    if (input.fromCart) await removeFromCart(q, memberId, ids)
    return { order: (await withItems(q, rows))[0], dpBalance: balance }
  })
}

// 취소: DP 환불 + 재고 복구. allowed = 취소할 수 있는 상태
async function cancelOrder(where: { id?: number; orderNo?: string; memberId?: string }, allowed: OrderStatus[], memo: string) {
  return tx(async (q) => {
    const { rows } = await q.query<OrderRow>(
      `SELECT * FROM store.orders WHERE ${where.id ? "id = $1" : "order_no = $1"} ${where.memberId ? "AND member_id = $2" : ""} FOR UPDATE`,
      where.memberId ? [where.id ?? where.orderNo, where.memberId] : [where.id ?? where.orderNo]
    )
    const order = rows[0]
    if (!order) throw new OrderError(404, "주문을 찾을 수 없습니다.")
    if (order.status === "canceled") throw new OrderError(409, "이미 취소한 주문입니다.")
    if (!allowed.includes(order.status))
      throw new OrderError(409, order.status === "shipped" ? "이미 발송한 주문이라 취소할 수 없어요. 고객센터로 문의해 주세요." : "취소할 수 없는 주문입니다.")
    const { rows: items } = await q.query<ItemRow>("SELECT * FROM store.order_items WHERE order_id = $1", [order.id])
    for (const i of items) {
      if (i.product_id !== null)
        await q.query("UPDATE store.products SET stock = stock + $2, updated_at = NOW() WHERE id = $1 AND stock IS NOT NULL", [i.product_id, i.quantity])
    }
    const balance = await refundDp(q, order.member_id, order.order_no, `${order.order_no} · ${memo}`)
    const { rows: updated } = await q.query<OrderRow>(
      "UPDATE store.orders SET status = 'canceled', canceled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [order.id]
    )
    return { order: (await withItems(q, updated, !where.memberId))[0], dpBalance: balance }
  })
}

const fail = (c: Context, e: unknown) => {
  if (e instanceof OrderError || e instanceof DpError) return c.json({ success: false, error: e.message }, e.status)
  throw e
}
const json = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)

// ---- 회원 ----

export const ordersRoute = new Hono<MemberEnv>()
ordersRoute.use("*", requireMember)

ordersRoute.post("/", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validateOrder(body)
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  try {
    return c.json({ success: true, ...(await placeOrder(c.get("member").id, result.value)) }, 201)
  } catch (e) {
    return fail(c, e)
  }
})

ordersRoute.get("/", async (c) => {
  const { rows } = await db().query<OrderRow>("SELECT * FROM store.orders WHERE member_id = $1 ORDER BY id DESC LIMIT 100", [
    c.get("member").id,
  ])
  return c.json({ success: true, orders: await withItems(db(), rows) })
})

ordersRoute.get("/:orderNo", async (c) => {
  const { rows } = await db().query<OrderRow>("SELECT * FROM store.orders WHERE order_no = $1 AND member_id = $2", [
    c.req.param("orderNo"),
    c.get("member").id,
  ])
  if (!rows[0]) return c.json({ success: false, error: "주문을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, order: (await withItems(db(), rows))[0] })
})

ordersRoute.post("/:orderNo/cancel", async (c) => {
  try {
    const result = await cancelOrder({ orderNo: c.req.param("orderNo"), memberId: c.get("member").id }, ["paid"], "회원 취소")
    return c.json({ success: true, ...result })
  } catch (e) {
    return fail(c, e)
  }
})

// ---- 관리자 ----

export const adminOrdersRoute = new Hono()
adminOrdersRoute.use("*", requireAdmin)

const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

// 주문 내역 관리: ?status=paid|shipped|delivered|canceled &sort=new|old &from=YYYY-MM-DD &to=YYYY-MM-DD &q=주문번호·받는 분·회원 이름·연락처
// 날짜는 한국 시간 기준. 최대 500건. counts 는 기간·검색 조건 안의 상태별 건수, 합계 DP 는 취소 제외
adminOrdersRoute.get("/", async (c) => {
  const status = ORDER_STATUSES.find((s) => s === c.req.query("status")) ?? null
  const old = c.req.query("sort") === "old"
  const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const from = day(c.req.query("from"))
  const to = day(c.req.query("to"))
  const q = str(c.req.query("q"), 50) || null
  const where = `($1::date IS NULL OR o.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Seoul'))
     AND ($2::date IS NULL OR o.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul'))
     AND ($3::text IS NULL OR o.order_no ILIKE '%' || $3 || '%' OR o.recipient_name ILIKE '%' || $3 || '%' OR u.name ILIKE '%' || $3 || '%'
          OR regexp_replace(o.recipient_phone, '[^0-9]', '', 'g') LIKE '%' || regexp_replace($3, '[^0-9]', '', 'g') || '%' AND regexp_replace($3, '[^0-9]', '', 'g') <> '')`
  const { rows } = await db().query<OrderRow & { member_name: string | null }>(
    `SELECT o.*, u.name AS member_name FROM store.orders o LEFT JOIN dukji_users u ON u.id = o.member_id
     WHERE ${where} AND ($4::text IS NULL OR o.status = $4)
     ORDER BY o.id ${old ? "ASC" : "DESC"} LIMIT 500`,
    [from, to, q, status]
  )
  const { rows: counts } = await db().query<{ status: string; n: number; dp: number }>(
    `SELECT o.status, COUNT(*)::int AS n, COALESCE(SUM(o.total_dp), 0)::int AS dp
     FROM store.orders o LEFT JOIN dukji_users u ON u.id = o.member_id WHERE ${where} GROUP BY o.status`,
    [from, to, q]
  )
  const orders = await withItems(db(), rows, true)
  return c.json({
    success: true,
    orders: orders.map((o, i) => ({ ...o, memberName: rows[i].member_name ?? "" })),
    counts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
    totalDp: counts.filter((r) => r.status !== "canceled").reduce((a, r) => a + r.dp, 0),
  })
})

// 발송·배송 완료 처리, 송장 번호·메모 { status?: shipped|delivered, trackingNo?, adminMemo? }
adminOrdersRoute.patch("/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  const body = await json(c)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const status = body.status === undefined ? null : (["shipped", "delivered"] as const).find((s) => s === body.status)
  if (status === undefined) return c.json({ success: false, error: "상태는 발송(shipped)·배송 완료(delivered)만 바꿀 수 있어요. 취소는 취소 버튼으로." }, 400)
  const tracking = body.trackingNo === undefined ? null : str(body.trackingNo, 60)
  const memo = body.adminMemo === undefined ? null : str(body.adminMemo, 500)
  const { rows } = await db().query<OrderRow>(
    `UPDATE store.orders SET status = COALESCE($2, status), tracking_no = COALESCE($3, tracking_no), admin_memo = COALESCE($4, admin_memo), updated_at = NOW()
     WHERE id = $1 AND status <> 'canceled' RETURNING *`,
    [id, status, tracking, memo]
  )
  if (!rows[0]) return c.json({ success: false, error: "주문을 찾을 수 없거나 취소된 주문입니다." }, 404)
  return c.json({ success: true, order: (await withItems(db(), rows, true))[0] })
})

adminOrdersRoute.post("/:id/cancel", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 ID 입니다." }, 404)
  try {
    return c.json({ success: true, ...(await cancelOrder({ id }, ["paid", "shipped"], "관리자 취소")) })
  } catch (e) {
    return fail(c, e)
  }
})

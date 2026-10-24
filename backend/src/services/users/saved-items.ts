import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { requireDatabase } from "../../shared/db/require-database"
import { pool } from "../../shared/db/pool"

// 회원별 찜·장바구니·팝업 알림 신청 (/api/users/me/saved). 로그인한 회원 본인 것만 읽고 씀
export const savedItemsRoute = new Hono<MemberEnv>()

savedItemsRoute.use("*", requireDatabase, requireMember)

const LIKE_KINDS = ["popup", "goods", "course"] as const
type LikeKind = (typeof LIKE_KINDS)[number]
const MAX_LIKES_PER_KIND = 500
const MAX_CART_ITEMS = 100
const MAX_QUANTITY = 99
const MAX_ALERTS = 200
const ALERT_CHANNELS = ["email", "kakao"] as const
const ID_RE = /^[A-Za-z0-9가-힣_.:-]{1,100}$/

const db = () => pool!
const memberId = (c: Context<MemberEnv>) => c.get("member").id
const isKind = (v: string): v is LikeKind => (LIKE_KINDS as readonly string[]).includes(v)

// 장바구니에 담을 때의 상품 정보 (화면 표시용). 알려진 항목만, 길이 제한해서 저장
const SNAPSHOT_TEXT_FIELDS = ["name", "series", "popupEventId", "popupTitle", "priceDisplay", "badge", "category", "categoryLabel", "imageUrl", "description"]
function cleanSnapshot(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {}
  const src = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of SNAPSHOT_TEXT_FIELDS) {
    if (typeof src[key] === "string") out[key] = (src[key] as string).slice(0, key === "description" ? 500 : 300)
  }
  for (const key of ["price", "originalPrice"]) {
    const n = Number(src[key])
    if (src[key] !== undefined && Number.isFinite(n) && n >= 0 && n <= 100_000_000) out[key] = Math.round(n)
  }
  return out
}

type CartRow = { goods_id: string; quantity: number; snapshot: Record<string, unknown> }
const toCartItem = (r: CartRow) => ({ goodsId: r.goods_id, quantity: r.quantity, snapshot: r.snapshot })

async function listCart(id: string) {
  const { rows } = await db().query<CartRow>(
    "SELECT goods_id, quantity, snapshot FROM member_cart_items WHERE member_id = $1 ORDER BY added_at, goods_id",
    [id]
  )
  return rows.map(toCartItem)
}

type AlertRow = { popup_id: string; channel: string; created_at: Date }
const toAlert = (r: AlertRow) => ({ popupId: r.popup_id, channel: r.channel, createdAt: r.created_at.toISOString() })

async function listAlerts(id: string) {
  // 표·칸이 아직 없으면 빈 목록 (찜·장바구니는 그대로 동작)
  const { rows: found } = await db().query("SELECT to_regclass('member_popup_alerts') AS t")
  if (!found[0].t) return []
  const { rows } = await db().query<AlertRow>(
    "SELECT popup_id, channel, created_at FROM member_popup_alerts WHERE member_id = $1 ORDER BY created_at DESC",
    [id]
  )
  return rows.map(toAlert)
}

// 내 찜·장바구니·알림 신청 전체
savedItemsRoute.get("/", async (c) => {
  const id = memberId(c)
  const { rows } = await db().query<{ kind: LikeKind; item_id: string }>(
    "SELECT kind, item_id FROM member_likes WHERE member_id = $1 ORDER BY created_at, item_id",
    [id]
  )
  const likes: Record<LikeKind, string[]> = { popup: [], goods: [], course: [] }
  for (const r of rows) likes[r.kind]?.push(r.item_id)
  return c.json({ success: true, likes, cart: await listCart(id), alerts: await listAlerts(id) })
})

// 팝업 오픈·티켓팅 알림 신청 { channel: email | kakao } (다시 보내면 채널만 바뀜)
savedItemsRoute.put("/alerts/:popupId", async (c) => {
  const popupId = c.req.param("popupId")
  const body = await c.req.json<{ channel?: unknown }>().catch(() => null)
  const channel = body?.channel
  if (!ID_RE.test(popupId) || !(ALERT_CHANNELS as readonly unknown[]).includes(channel)) {
    return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  }
  const id = memberId(c)
  const { rows } = await db().query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM member_popup_alerts WHERE member_id = $1 AND popup_id <> $2",
    [id, popupId]
  )
  if (rows[0].n >= MAX_ALERTS) return c.json({ success: false, error: `알림 신청은 ${MAX_ALERTS}개까지 할 수 있습니다.` }, 400)
  // 공개된 팝업에만 신청 (팝업 테이블은 같은 DB, 읽기만)
  const { rows: popup } = await db().query("SELECT 1 FROM popups WHERE id = $1 AND is_published", [popupId])
  if (!popup.length) return c.json({ success: false, error: "알림을 신청할 수 없는 팝업입니다." }, 404)
  await db().query(
    `INSERT INTO member_popup_alerts (member_id, popup_id, channel) VALUES ($1, $2, $3)
     ON CONFLICT (member_id, popup_id) DO UPDATE SET channel = EXCLUDED.channel, updated_at = NOW()`,
    [id, popupId, channel]
  )
  return c.json({ success: true, alerts: await listAlerts(id) })
})

savedItemsRoute.delete("/alerts/:popupId", async (c) => {
  const popupId = c.req.param("popupId")
  if (!ID_RE.test(popupId)) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const id = memberId(c)
  await db().query("DELETE FROM member_popup_alerts WHERE member_id = $1 AND popup_id = $2", [id, popupId])
  return c.json({ success: true, alerts: await listAlerts(id) })
})

// 찜하기 / 찜 해제
savedItemsRoute.put("/likes/:kind/:itemId", async (c) => {
  const kind = c.req.param("kind")
  const itemId = c.req.param("itemId")
  if (!isKind(kind) || !ID_RE.test(itemId)) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const id = memberId(c)
  const { rows } = await db().query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM member_likes WHERE member_id = $1 AND kind = $2",
    [id, kind]
  )
  if (rows[0].n >= MAX_LIKES_PER_KIND) return c.json({ success: false, error: `찜은 ${MAX_LIKES_PER_KIND}개까지 할 수 있습니다.` }, 400)
  await db().query(
    "INSERT INTO member_likes (member_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [id, kind, itemId]
  )
  return c.json({ success: true })
})

savedItemsRoute.delete("/likes/:kind/:itemId", async (c) => {
  const kind = c.req.param("kind")
  const itemId = c.req.param("itemId")
  if (!isKind(kind) || !ID_RE.test(itemId)) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  await db().query("DELETE FROM member_likes WHERE member_id = $1 AND kind = $2 AND item_id = $3", [memberId(c), kind, itemId])
  return c.json({ success: true })
})

// 장바구니 담기·수량 변경 { quantity, snapshot }
savedItemsRoute.put("/cart/:goodsId", async (c) => {
  const goodsId = c.req.param("goodsId")
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  const quantity = Number(body?.quantity)
  if (!ID_RE.test(goodsId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return c.json({ success: false, error: `수량은 1~${MAX_QUANTITY}개여야 합니다.` }, 400)
  }
  const id = memberId(c)
  const { rows } = await db().query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM member_cart_items WHERE member_id = $1 AND goods_id <> $2",
    [id, goodsId]
  )
  if (rows[0].n >= MAX_CART_ITEMS) return c.json({ success: false, error: `장바구니에는 ${MAX_CART_ITEMS}종류까지 담을 수 있습니다.` }, 400)
  await db().query(
    `INSERT INTO member_cart_items (member_id, goods_id, quantity, snapshot) VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id, goods_id) DO UPDATE SET quantity = EXCLUDED.quantity, snapshot = EXCLUDED.snapshot, updated_at = NOW()`,
    [id, goodsId, quantity, JSON.stringify(cleanSnapshot(body?.snapshot))]
  )
  return c.json({ success: true, cart: await listCart(id) })
})

savedItemsRoute.delete("/cart/:goodsId", async (c) => {
  const goodsId = c.req.param("goodsId")
  if (!ID_RE.test(goodsId)) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  await db().query("DELETE FROM member_cart_items WHERE member_id = $1 AND goods_id = $2", [memberId(c), goodsId])
  return c.json({ success: true })
})

// 장바구니 비우기
savedItemsRoute.delete("/cart", async (c) => {
  await db().query("DELETE FROM member_cart_items WHERE member_id = $1", [memberId(c)])
  return c.json({ success: true })
})

// 관리자: 굿즈별 찜·장바구니 집계 (사전 수요조사 탭), 팝업별 알림 신청 수 (/api/users/admin/saved-stats)
export const adminSavedStatsRoute = new Hono()
adminSavedStatsRoute.use("*", requireDatabase, requireAdmin)
adminSavedStatsRoute.get("/", async (c) => {
  const { rows: goods } = await db().query<{ id: string; likes: number; cart_members: number; cart_quantity: number }>(
    `SELECT id, SUM(likes)::int AS likes, SUM(cart_members)::int AS cart_members, SUM(cart_quantity)::int AS cart_quantity FROM (
       SELECT item_id AS id, COUNT(*) AS likes, 0 AS cart_members, 0 AS cart_quantity FROM member_likes WHERE kind = 'goods' GROUP BY item_id
       UNION ALL
       SELECT goods_id, 0, COUNT(*), SUM(quantity) FROM member_cart_items GROUP BY goods_id
     ) t GROUP BY id ORDER BY 2 DESC, 4 DESC`
  )
  const { rows: found } = await db().query("SELECT to_regclass('member_popup_alerts') AS t")
  const alerts = found[0].t
    ? (
        await db().query<{ popup_id: string; total: number; email: number; kakao: number }>(
          `SELECT popup_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE channel = 'email')::int AS email,
                  COUNT(*) FILTER (WHERE channel = 'kakao')::int AS kakao
           FROM member_popup_alerts GROUP BY popup_id ORDER BY total DESC`
        )
      ).rows
    : []
  return c.json({
    success: true,
    goods: goods.map((g) => ({ goodsId: g.id, likes: g.likes, cartMembers: g.cart_members, cartQuantity: g.cart_quantity })),
    popupAlerts: alerts.map((a) => ({ popupId: a.popup_id, total: a.total, email: a.email, kakao: a.kakao })),
  })
})

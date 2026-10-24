import type { PoolClient } from "pg"

// store 가 다른 서비스 소유 테이블·함수에 닿는 곳은 이 파일에만 모아 둡니다.
// 지금은 같은 RDS 를 쓰니 SQL 로 쓰지만, DB 를 분리하면 이 파일만 API·메시지 큐로 바꾸면 됩니다.

// ---- DP 결제 (users 서비스 소유 원장, DB 함수 dp_spend·dp_refund). 무료 DP 부터 빠지고 환불은 쓴 그대로
export const PAY_REASON = "store_order"
export const REFUND_REASON = "store_refund"

export class DpError extends Error {
  constructor(public status: 409 | 503, message: string) {
    super(message)
  }
}

// 주문 1건 결제. refId = 주문 번호. 모자라면 DpError(409). 돌려주는 값 = 결제 후 잔액
export async function spendDp(client: PoolClient, memberId: string, amount: number, orderNo: string, memo: string) {
  try {
    const { rows } = await client.query<{ balance: number }>("SELECT dp_spend($1, $2, $3, $4, $5) AS balance", [
      memberId,
      amount,
      PAY_REASON,
      orderNo,
      memo.slice(0, 200),
    ])
    return rows[0].balance
  } catch (e) {
    const err = e as { code?: string; message?: string }
    const m = /^DP_INSUFFICIENT:(\d+)/.exec(err.message ?? "")
    if (m) throw new DpError(409, `DP 가 부족해요. 결제할 DP ${amount.toLocaleString()}, 보유 ${Number(m[1]).toLocaleString()} DP`)
    if (err.message === "DP_DUPLICATE") throw new DpError(409, "이미 결제한 주문입니다.")
    if (err.code === "42883") throw new DpError(503, "DP 결제를 준비 중이에요. 잠시 후 다시 시도해 주세요.")
    throw e
  }
}

// 주문 1건 환불. 결제 기록이 없거나 이미 돌려줬으면 null
export async function refundDp(client: PoolClient, memberId: string, orderNo: string, memo: string) {
  const { rows } = await client.query<{ balance: number | null }>("SELECT dp_refund($1, $2, $3, $4, $5) AS balance", [
    memberId,
    PAY_REASON,
    REFUND_REASON,
    orderNo,
    memo.slice(0, 200),
  ])
  return rows[0].balance
}

// 장바구니에서 주문한 상품은 장바구니에서 뺌 (users 서비스 소유 member_cart_items, 상품 id 를 문자열로 저장)
export async function removeFromCart(client: PoolClient, memberId: string, productIds: number[]) {
  await client.query("DELETE FROM member_cart_items WHERE member_id = $1 AND goods_id = ANY($2::text[])", [
    memberId,
    productIds.map(String),
  ])
}

// 상품별 '사고 싶어요' 찜 수 (users 서비스 소유 member_likes, kind = goods)
export async function wishCounts(client: Pick<PoolClient, "query">, productIds: number[]): Promise<Map<number, number>> {
  if (!productIds.length) return new Map()
  const { rows } = await client.query<{ item_id: string; n: number }>(
    "SELECT item_id, COUNT(*)::int AS n FROM member_likes WHERE kind = 'goods' AND item_id = ANY($1::text[]) GROUP BY item_id",
    [productIds.map(String)]
  )
  return new Map(rows.map((r) => [Number(r.item_id), r.n]))
}

// 상품별 장바구니에 담긴 수량·담은 회원 수 (users 서비스 소유 member_cart_items, 관리자 굿즈샵 관리용)
export async function cartCounts(client: Pick<PoolClient, "query">, productIds: number[]): Promise<Map<number, { qty: number; members: number }>> {
  if (!productIds.length) return new Map()
  const { rows } = await client.query<{ goods_id: string; qty: number; members: number }>(
    "SELECT goods_id, SUM(quantity)::int AS qty, COUNT(*)::int AS members FROM member_cart_items WHERE goods_id = ANY($1::text[]) GROUP BY goods_id",
    [productIds.map(String)]
  )
  return new Map(rows.map((r) => [Number(r.goods_id), { qty: r.qty, members: r.members }]))
}

// 후기 작성자 이름 (users 서비스 소유 dukji_users). 화면에는 가운데를 가려서 보여 줌
export async function memberNames(client: Pick<PoolClient, "query">, memberIds: string[]): Promise<Map<string, string>> {
  if (!memberIds.length) return new Map()
  const { rows } = await client.query<{ id: string; name: string | null }>("SELECT id, name FROM dukji_users WHERE id = ANY($1::text[])", [memberIds])
  return new Map(rows.map((r) => [r.id, r.name || ""]))
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { EmptyState } from "@/components/mypage/saved-panels"
import { DIVIDE, LINE, productHref } from "@/components/shop/shop-ui"
import { loadPoints } from "@/lib/member-points"
import { cancelMyOrder, dp, fetchMyOrders, ORDER_STATUS_LABEL, type OrderStatus, type StoreOrder } from "@/lib/store"

// 마이페이지 '주문 내역' 탭: 굿즈샵 주문 (backend store 서비스 /api/store/orders)
// 주문마다 카드 한 장: 주문일·주문 번호, 상태, 상품(누르면 상품 상세), 받는 분, 송장 번호
// 발송 전(결제 완료) 주문은 직접 취소 → DP 가 바로 돌아옴. 취소하지 않은 주문의 상품은 '후기 쓰기'로 상세 페이지 후기로

const STATUS_STYLE: Record<OrderStatus, string> = {
  paid: "bg-sky-500/15 text-sky-300",
  shipped: "bg-amber-500/15 text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-300",
  canceled: "bg-zinc-700/50 text-zinc-400",
}
const FILTERS: ("all" | OrderStatus)[] = ["all", "paid", "shipped", "delivered", "canceled"]

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })

export function OrdersPanel() {
  const [orders, setOrders] = useState<StoreOrder[] | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [filter, setFilter] = useState<"all" | OrderStatus>("all")

  const load = async () => {
    const r = await fetchMyOrders()
    if (r.status === "ok") {
      setOrders(r.data.orders)
      setError("")
    } else {
      setOrders([])
      setError(r.status === "login" ? "로그인이 필요합니다." : r.error)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cancel = async (o: StoreOrder) => {
    if (!window.confirm(`주문 ${o.orderNo} 을(를) 취소할까요? 결제한 ${dp(o.totalDp)} 가 돌아와요.`)) return
    setBusy(o.orderNo)
    const r = await cancelMyOrder(o.orderNo)
    setBusy("")
    if (r.status !== "ok") return window.alert(r.status === "login" ? "로그인이 필요합니다." : r.error)
    loadPoints()
    load()
  }

  if (orders === null) return <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>

  const count = (f: "all" | OrderStatus) => (f === "all" ? orders.length : orders.filter((o) => o.status === f).length)
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter)

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {orders.length === 0 ? (
        <EmptyState text="아직 주문한 굿즈가 없어요." href="/store/goods/" linkLabel="굿즈샵 둘러보기" />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap ${
                  filter === f ? "bg-white text-black" : "bg-zinc-900 text-zinc-300 hover:text-white border border-white/[0.08]"
                }`}
              >
                {f === "all" ? "전체" : ORDER_STATUS_LABEL[f]} {count(f)}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">이 상태의 주문이 없어요.</p>
          ) : (
            <div className="space-y-4">
              {shown.map((o) => (
                <OrderCard key={o.orderNo} order={o} busy={busy === o.orderNo} onCancel={() => cancel(o)} />
              ))}
            </div>
          )}
        </>
      )}
      <p className="text-sm text-zinc-500">발송한 뒤에는 고객센터로 문의해 주세요. 취소하면 결제한 DP 가 그대로 돌아와요.</p>
    </div>
  )
}

function OrderCard({ order: o, busy, onCancel }: { order: StoreOrder; busy: boolean; onCancel: () => void }) {
  const canceled = o.status === "canceled"
  return (
    <article className={`rounded-xl bg-zinc-900/60 border ${LINE} overflow-hidden`}>
      <header className={`px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b ${LINE} bg-white/[0.02]`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold text-white">{fmtDate(o.createdAt)}</span>
          <span className="text-xs text-zinc-500">주문 번호 {o.orderNo}</span>
        </div>
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
      </header>

      <ul className={`divide-y ${DIVIDE}`}>
        {o.items.map((i, idx) => {
          const href = i.productId ? productHref(i.productId) : undefined
          const thumb = (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
              {i.imageUrl && <img src={i.imageUrl} alt="" className={`w-full h-full object-cover ${canceled ? "opacity-50" : ""}`} />}
            </div>
          )
          return (
            <li key={idx} className="px-4 sm:px-5 py-4 flex gap-4">
              {href ? <Link href={href}>{thumb}</Link> : thumb}
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link href={href} className={`text-sm font-bold line-clamp-2 hover:underline underline-offset-2 ${canceled ? "text-zinc-400" : "text-white"}`}>
                      {i.name}
                    </Link>
                  ) : (
                    <span className={`text-sm font-bold line-clamp-2 ${canceled ? "text-zinc-400" : "text-white"}`}>{i.name}</span>
                  )}
                  <div className="mt-1 text-sm text-zinc-400 tabular-nums">
                    {dp(i.priceDp * i.quantity)} <span className="text-zinc-600">·</span> {i.quantity}개
                  </div>
                </div>
                {!canceled && href && (
                  <Link
                    href={`${href}#reviews`}
                    className={`self-start sm:self-center h-9 px-3 inline-flex items-center rounded-lg border ${LINE} text-sm text-zinc-200 hover:bg-white/5 shrink-0`}
                  >
                    후기 쓰기
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <footer className={`px-4 sm:px-5 py-3 border-t ${LINE} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="min-w-0 space-y-0.5 text-sm">
          <div className="text-zinc-300 truncate">
            <span className="text-zinc-500">받는 분</span> {o.recipient.name}
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-400">{o.recipient.address}</span>
          </div>
          {o.trackingNo && (
            <div className="text-zinc-300">
              <span className="text-zinc-500">송장 번호</span> <span className="font-bold tabular-nums">{o.trackingNo}</span>
            </div>
          )}
          {canceled && o.canceledAt && <div className="text-zinc-500">{fmtDate(o.canceledAt)} 취소 · DP 환불 완료</div>}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <div className="text-right">
            <span className="text-xs text-zinc-500 mr-2">결제</span>
            <span className={`text-base font-black tabular-nums ${canceled ? "text-zinc-500 line-through" : "text-white"}`}>{dp(o.totalDp)}</span>
          </div>
          {o.status === "paid" && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={`h-9 px-3 rounded-lg border ${LINE} text-sm text-zinc-300 hover:text-white hover:bg-white/5 disabled:opacity-50`}
            >
              {busy ? "취소 중..." : "주문 취소"}
            </button>
          )}
        </div>
      </footer>
    </article>
  )
}

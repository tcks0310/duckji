"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react"
import { adminInput, fmtDateTime, loginOr } from "@/components/admin/goods-shared"
import { adminCancelOrder, adminFetchOrders, adminUpdateOrder, dp, ORDER_STATUS_LABEL, type OrderStatus, type StoreOrder } from "@/lib/store"

// 굿즈샵 관리 > 주문 내역 관리 (backend store 서비스 /api/store/admin/orders)
// 처리 상태별 탭(건수) + 기간·검색·정렬. 주문 = DP 결제 완료 → 발송(송장 번호) → 배송 완료
// 배송 완료 전에는 취소 가능 (DP 환불·재고 복구)

const STATUS_TABS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "paid", label: "결제 완료 · 발송 대기" },
  { id: "shipped", label: "발송" },
  { id: "delivered", label: "배송 완료" },
  { id: "canceled", label: "취소·환불" },
]
const STATUS_STYLE: Record<OrderStatus, string> = {
  paid: "bg-sky-900/50 text-sky-300",
  shipped: "bg-zinc-800 text-zinc-200",
  delivered: "bg-zinc-800 text-zinc-400",
  canceled: "bg-zinc-900 text-zinc-500 border border-zinc-800",
}

type Period = "today" | "7" | "30" | "all" | "custom"
const PERIODS: { id: Exclude<Period, "custom">; label: string }[] = [
  { id: "today", label: "오늘" },
  { id: "7", label: "7일" },
  { id: "30", label: "30일" },
  { id: "all", label: "전체" },
]

// 한국 날짜 YYYY-MM-DD (오늘에서 days 일 전)
const kstDay = (daysAgo = 0) => new Date(Date.now() + 9 * 3600_000 - daysAgo * 86400_000).toISOString().slice(0, 10)
const periodRange = (p: Period): { from: string; to: string } =>
  p === "today" ? { from: kstDay(), to: kstDay() } : p === "7" ? { from: kstDay(6), to: kstDay() } : p === "30" ? { from: kstDay(29), to: kstDay() } : { from: "", to: "" }

export function GoodsOrdersPanel({ onOpenMember }: { onOpenMember?: (memberId: string) => void }) {
  const [status, setStatus] = useState<OrderStatus | "all">("all")
  const [period, setPeriod] = useState<Period>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<"new" | "old">("new")
  const [orders, setOrders] = useState<StoreOrder[] | null>(null)
  const [counts, setCounts] = useState<Partial<Record<OrderStatus, number>>>({})
  const [totalDp, setTotalDp] = useState(0)
  const [error, setError] = useState("")

  const load = async () => {
    const r = await adminFetchOrders({ status: status === "all" ? undefined : status, sort, from, to, q })
    if (r.status === "ok") {
      setOrders(r.data.orders)
      setCounts(r.data.counts)
      setTotalDp(r.data.totalDp)
      setError("")
    } else {
      setOrders([])
      setError(loginOr(r))
    }
  }
  useEffect(() => {
    setOrders(null)
    load()
  }, [status, sort, from, to, q])

  // 검색어는 입력을 멈추고 잠시 뒤에 적용
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(t)
  }, [qInput])

  const pickPeriod = (p: Exclude<Period, "custom">) => {
    const r = periodRange(p)
    setPeriod(p)
    setFrom(r.from)
    setTo(r.to)
  }

  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg ${on ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`

  return (
    <div className="space-y-4">
      {/* 처리 상태 탭 */}
      <div className="flex flex-wrap gap-1.5 text-sm">
        {STATUS_TABS.map((t) => {
          const n = t.id === "all" ? total : counts[t.id] ?? 0
          return (
            <button key={t.id} onClick={() => setStatus(t.id)} className={chip(status === t.id)}>
              {t.label} <span className="tabular-nums">{n}</span>
            </button>
          )
        })}
      </div>

      {/* 기간·검색·정렬 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => pickPeriod(p.id)} className={chip(period === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value)
              setPeriod("custom")
            }}
            className={`${adminInput} w-auto py-1.5 text-xs`}
            aria-label="시작일"
          />
          <span className="text-zinc-500">~</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value)
              setPeriod("custom")
            }}
            className={`${adminInput} w-auto py-1.5 text-xs`}
            aria-label="종료일"
          />
        </div>
        <label className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${adminInput} pl-9 py-1.5`}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="주문번호·받는 분·회원 이름·연락처"
          />
        </label>
        <div className="flex gap-1">
          <button onClick={() => setSort("new")} className={chip(sort === "new")}>
            최신순
          </button>
          <button onClick={() => setSort("old")} className={chip(sort === "old")}>
            오래된순
          </button>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800" aria-label="새로고침" title="새로고침">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="text-zinc-300">
          <span className="text-white font-semibold tabular-nums">{orders?.length ?? 0}건</span>
          <span className="text-zinc-500"> · </span>
          결제 합계 <span className="text-white font-semibold tabular-nums">{dp(totalDp)}</span>
          <span className="text-xs text-zinc-500"> (이 기간·검색 조건, 취소 제외)</span>
        </p>
        {orders && orders.length >= 500 && <p className="text-xs text-zinc-500">최대 500건까지 보여요. 기간을 좁혀 주세요.</p>}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-950/60 whitespace-nowrap">
              <th className="p-3 w-8" />
              <th className="p-3">주문 시각</th>
              <th className="p-3">주문 번호</th>
              <th className="p-3">회원</th>
              <th className="p-3">상품</th>
              <th className="p-3 text-right">결제</th>
              <th className="p-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {orders === null && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-500">
                  불러오는 중...
                </td>
              </tr>
            )}
            {orders?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  조건에 맞는 주문이 없어요.
                </td>
              </tr>
            )}
            {orders?.map((o) => <OrderRow key={o.id} order={o} onChanged={load} onOpenMember={onOpenMember} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrderRow({ order: o, onChanged, onOpenMember }: { order: StoreOrder; onChanged: () => void; onOpenMember?: (memberId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tracking, setTracking] = useState(o.trackingNo)
  const [memo, setMemo] = useState(o.adminMemo ?? "")
  const [busy, setBusy] = useState(false)
  useEffect(() => setTracking(o.trackingNo), [o.trackingNo])
  useEffect(() => setMemo(o.adminMemo ?? ""), [o.adminMemo])

  const run = async (fn: () => Promise<{ status: string; error?: string }>) => {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (r.status !== "ok") return window.alert(loginOr(r))
    onChanged()
  }
  const cancel = () => {
    if (window.confirm(`주문 ${o.orderNo} 을(를) 취소하고 ${dp(o.totalDp)} 를 회원에게 돌려줄까요? 재고도 복구됩니다.`)) run(() => adminCancelOrder(o.id))
  }

  const first = o.items[0]
  const qty = o.items.reduce((a, i) => a + i.quantity, 0)
  const r = o.recipient
  const member = o.memberName || o.memberId || "-"
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <>
      <tr onClick={() => setOpen(!open)} className={`border-t border-zinc-800 cursor-pointer ${open ? "bg-zinc-900" : "hover:bg-zinc-900/60"}`}>
        <td className="p-3 text-zinc-500">
          <Chevron className="w-4 h-4" />
        </td>
        <td className="p-3 whitespace-nowrap text-zinc-300 tabular-nums">{fmtDateTime(o.createdAt)}</td>
        <td className="p-3 whitespace-nowrap text-zinc-400 tabular-nums">{o.orderNo}</td>
        <td className="p-3 whitespace-nowrap">
          {onOpenMember && o.memberId ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenMember(o.memberId!)
              }}
              className="text-zinc-200 underline underline-offset-2 hover:text-white"
            >
              {member}
            </button>
          ) : (
            <span className="text-zinc-300">{member}</span>
          )}
        </td>
        <td className="p-3 min-w-[12rem]">
          <span className="text-white">{first?.name}</span>
          {o.items.length > 1 && <span className="text-zinc-400"> 외 {o.items.length - 1}건</span>}
          <span className="text-xs text-zinc-500"> · {qty}개</span>
        </td>
        <td className="p-3 whitespace-nowrap text-right text-zinc-100 tabular-nums">{dp(o.totalDp)}</td>
        <td className="p-3 whitespace-nowrap">
          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[o.status]}`}>{o.status === "paid" ? "발송 대기" : ORDER_STATUS_LABEL[o.status]}</span>
        </td>
      </tr>
      {open && (
        <tr className="bg-zinc-900/60">
          <td />
          <td colSpan={6} className="px-3 pb-5 pt-2">
            <div className="grid lg:grid-cols-2 gap-5 text-sm text-zinc-300">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-400">주문 상품</p>
                <ul className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                  {o.items.map((i, idx) => (
                    <li key={idx} className="flex items-center gap-3 px-3 py-2">
                      <div className="w-9 h-9 rounded bg-zinc-800 overflow-hidden shrink-0">{i.imageUrl && <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
                      <span className="flex-1 min-w-0 text-zinc-200">{i.name}</span>
                      <span className="text-zinc-400 tabular-nums whitespace-nowrap">
                        {dp(i.priceDp)} × {i.quantity}
                      </span>
                      <span className="w-24 text-right text-zinc-100 tabular-nums whitespace-nowrap">{dp(i.priceDp * i.quantity)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 text-zinc-400">
                    <span>합계</span>
                    <span className="text-white font-semibold tabular-nums">{dp(o.totalDp)}</span>
                  </li>
                </ul>
              </div>
              <dl className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-400 mb-2">배송 정보</p>
                {(
                  [
                    ["주문 번호", o.orderNo],
                    ["받는 분", r.name],
                    ["연락처", <a key="t" href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="underline underline-offset-2">{r.phone}</a>],
                    ["주소", `${r.postcode ? `(${r.postcode}) ` : ""}${r.address} ${r.addressDetail}`],
                    ["요청 사항", o.requestNote || "-"],
                    ...(o.trackingNo ? [["송장 번호", o.trackingNo]] : []),
                    ...(o.canceledAt ? [["취소 시각", fmtDateTime(o.canceledAt)]] : []),
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-20 shrink-0 text-zinc-500">{k}</dt>
                    <dd className="min-w-0 break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {o.status !== "canceled" && o.status !== "delivered" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="송장 번호 (택배사·번호)" className={`${adminInput} w-60 py-1.5`} />
                  {o.status === "paid" && (
                    <button
                      disabled={busy}
                      onClick={() => run(() => adminUpdateOrder(o.id, { status: "shipped", trackingNo: tracking }))}
                      className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold disabled:opacity-50"
                    >
                      발송 처리
                    </button>
                  )}
                  {o.status === "shipped" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => run(() => adminUpdateOrder(o.id, { trackingNo: tracking }))}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
                      >
                        송장 저장
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => run(() => adminUpdateOrder(o.id, { status: "delivered" }))}
                        className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold disabled:opacity-50"
                      >
                        배송 완료 처리
                      </button>
                    </>
                  )}
                  <button disabled={busy} onClick={cancel} className="ml-auto px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-300 disabled:opacity-50">
                    주문 취소 · DP 환불
                  </button>
                </div>
              )}
              {o.status === "delivered" && <p className="text-xs text-zinc-500">배송 완료된 주문은 취소할 수 없어요.</p>}
              {o.status === "canceled" ? (
                o.adminMemo && <p className="text-zinc-400 whitespace-pre-wrap">관리자 메모: {o.adminMemo}</p>
              ) : (
                <div className="flex gap-2">
                  <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="관리자 메모 (회원에게 안 보임)" className={`${adminInput} min-h-[56px]`} />
                  <button
                    disabled={busy}
                    onClick={() => run(() => adminUpdateOrder(o.id, { adminMemo: memo }))}
                    className="px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold shrink-0 disabled:opacity-50"
                  >
                    메모 저장
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { GoodsProductsPanel } from "@/components/admin/goods-products-panel"
import { GoodsOrdersPanel } from "@/components/admin/goods-orders-panel"
import { adminInput, fmtDateTime, IconBtn, loginOr } from "@/components/admin/goods-shared"
import {
  adminAddCategory,
  adminDeleteCategory,
  adminFetchCategories,
  adminFetchReviews,
  adminHideReview,
  adminUpdateCategory,
  loadStoreProducts,
  type AdminCategory,
  type AdminReview,
} from "@/lib/store"

// 관리자 '스토어 > 굿즈샵 관리' 탭 (backend store 서비스 /api/store/admin/*)
// 안쪽 탭: 상품 관리(products) · 주문 내역 관리(orders) · 분류 관리(categories) · 후기 관리(reviews)
// 회원은 덕지 포인트(DP, 1 DP = 1원)로 결제

type Section = "products" | "orders" | "categories" | "reviews"
const SECTIONS: { id: Section; label: string }[] = [
  { id: "products", label: "상품 관리" },
  { id: "orders", label: "주문 내역 관리" },
  { id: "categories", label: "분류 관리" },
  { id: "reviews", label: "후기 관리" },
]

export function GoodsShopManager({ onOpenMember }: { onOpenMember?: (memberId: string) => void }) {
  const [section, setSection] = useState<Section>("products")

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-lg text-white">굿즈샵</h3>
        <p className="text-xs text-zinc-400">굿즈샵의 상품·주문·분류·후기를 관리합니다. 회원은 덕지 포인트(DP)로 결제합니다.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`px-3.5 py-2 rounded-lg text-sm ${section === s.id ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "products" && <GoodsProductsPanel onGoCategories={() => setSection("categories")} />}
      {section === "orders" && <GoodsOrdersPanel onOpenMember={onOpenMember} />}
      {section === "categories" && <CategoriesPanel />}
      {section === "reviews" && <ReviewsPanel onOpenMember={onOpenMember} />}
    </div>
  )
}

// ---- 분류 관리: 추가·이름 바꾸기·순서·삭제 (상품이 남은 분류는 서버가 지우지 않음)

function CategoriesPanel() {
  const [list, setList] = useState<AdminCategory[] | null>(null)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<{ code: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await adminFetchCategories()
    if (r.status === "ok") setList(r.data.categories)
    else {
      setList([])
      setError(loginOr(r))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const run = async (fn: () => Promise<{ status: string; error?: string }>) => {
    setBusy(true)
    setError("")
    const r = await fn()
    setBusy(false)
    if (r.status !== "ok") setError(loginOr(r))
    await load()
    loadStoreProducts()
    return r.status === "ok"
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (await run(() => adminAddCategory(name.trim()))) setName("")
  }

  // 순서는 목록 순서대로 1, 2, 3... 으로 다시 매김 (바뀐 분류만 저장)
  const move = (i: number, d: -1 | 1) => {
    if (!list) return
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setList(next)
    run(async () => {
      for (let idx = 0; idx < next.length; idx++) {
        const c = next[idx]
        if (c.sortOrder === idx + 1) continue
        const r = await adminUpdateCategory(c.code, { sortOrder: idx + 1 })
        if (r.status !== "ok") return r
      }
      return { status: "ok" }
    })
  }

  const rename = async () => {
    if (!editing?.name.trim()) return
    if (await run(() => adminUpdateCategory(editing.code, { name: editing.name.trim() }))) setEditing(null)
  }

  const remove = (c: AdminCategory) => {
    if (window.confirm(`'${c.name}' 분류를 지울까요?`)) run(() => adminDeleteCategory(c.code))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-zinc-400">굿즈샵 위 탭에 '랭킹' 다음으로 이 순서대로 보입니다.</p>
      <form onSubmit={add} className="flex gap-2">
        <input className={adminInput} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="새 분류 이름 (예: 아크릴 스탠드)" />
        <button type="submit" disabled={busy || !name.trim()} className="inline-flex items-center gap-1 px-4 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-semibold text-white shrink-0 disabled:opacity-50">
          <Plus className="w-4 h-4" />
          분류 추가
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
        {list === null && <li className="p-4 text-center text-sm text-zinc-500">불러오는 중...</li>}
        {list?.length === 0 && <li className="p-6 text-center text-sm text-zinc-500">아직 분류가 없어요. 위에서 분류를 추가해 주세요.</li>}
        {list?.map((c, i) => (
          <li key={c.code} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 text-sm">
            <span className="w-6 text-zinc-500 tabular-nums">{i + 1}</span>
            {editing?.code === c.code ? (
              <span className="flex flex-1 min-w-0 gap-1.5">
                <input
                  autoFocus
                  className={adminInput}
                  maxLength={40}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename()
                    if (e.key === "Escape") setEditing(null)
                  }}
                />
                <IconBtn label="이름 저장" onClick={rename} disabled={busy}>
                  <Check className="w-4 h-4" />
                </IconBtn>
                <IconBtn label="취소" onClick={() => setEditing(null)}>
                  <X className="w-4 h-4" />
                </IconBtn>
              </span>
            ) : (
              <span className="flex-1 min-w-0">
                <span className="text-white font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-zinc-500">상품 {c.productCount}개</span>
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto">
              <IconBtn label="위로" onClick={() => move(i, -1)} disabled={busy || i === 0}>
                <ArrowUp className="w-4 h-4" />
              </IconBtn>
              <IconBtn label="아래로" onClick={() => move(i, 1)} disabled={busy || i === list.length - 1}>
                <ArrowDown className="w-4 h-4" />
              </IconBtn>
              <IconBtn label="이름 바꾸기" onClick={() => setEditing({ code: c.code, name: c.name })}>
                <Pencil className="w-4 h-4" />
              </IconBtn>
              {c.productCount > 0 ? (
                <span className="px-2 text-xs text-zinc-500" title="상품을 다른 분류로 옮기거나 지운 뒤 지울 수 있어요.">
                  상품이 있어 삭제 불가
                </span>
              ) : (
                <IconBtn label="삭제" onClick={() => remove(c)} disabled={busy} danger>
                  <Trash2 className="w-4 h-4" />
                </IconBtn>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- 후기 관리: 최근 후기, 숨기면 상품 상세에서 안 보임

function ReviewsPanel({ onOpenMember }: { onOpenMember?: (memberId: string) => void }) {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | "shown" | "hidden">("all")

  const load = async () => {
    const r = await adminFetchReviews()
    if (r.status === "ok") setReviews(r.data.reviews)
    else {
      setReviews([])
      setError(loginOr(r))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const toggle = async (rv: AdminReview) => {
    const r = await adminHideReview(rv.id, !rv.hidden)
    if (r.status !== "ok") return setError(loginOr(r))
    setReviews((prev) => prev?.map((x) => (x.id === rv.id ? { ...x, hidden: !rv.hidden } : x)) ?? null)
  }

  const all = reviews ?? []
  const shown = all.filter((r) => (filter === "all" ? true : filter === "hidden" ? r.hidden : !r.hidden))
  const chips: { id: typeof filter; label: string; n: number }[] = [
    { id: "all", label: "전체", n: all.length },
    { id: "shown", label: "보이는 후기", n: all.filter((r) => !r.hidden).length },
    { id: "hidden", label: "숨긴 후기", n: all.filter((r) => r.hidden).length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg ${filter === c.id ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {c.label} <span className="tabular-nums">{c.n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">숨긴 후기는 상품 상세 페이지와 별점 평균에서 빠집니다.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-950/60 whitespace-nowrap">
              <th className="p-3">상품</th>
              <th className="p-3">별점</th>
              <th className="p-3">내용</th>
              <th className="p-3">회원</th>
              <th className="p-3">작성일</th>
              <th className="p-3 text-right">노출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {reviews === null && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  불러오는 중...
                </td>
              </tr>
            )}
            {reviews && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-zinc-500">
                  후기가 없어요.
                </td>
              </tr>
            )}
            {shown.map((rv) => (
              <tr key={rv.id} className={rv.hidden ? "opacity-50" : ""}>
                <td className="p-3 text-zinc-200 whitespace-nowrap max-w-[14rem] truncate">{rv.productName}</td>
                <td className="p-3 whitespace-nowrap text-amber-300" aria-label={`별점 ${rv.rating}`}>
                  {"★".repeat(rv.rating)}
                  <span className="text-zinc-700">{"★".repeat(Math.max(0, 5 - rv.rating))}</span>
                </td>
                <td className="p-3 text-zinc-300 min-w-[16rem] whitespace-pre-wrap break-words">{rv.content}</td>
                <td className="p-3 whitespace-nowrap">
                  {onOpenMember && rv.memberId ? (
                    <button onClick={() => onOpenMember(rv.memberId)} className="text-zinc-200 underline underline-offset-2 hover:text-white">
                      {rv.memberName || rv.memberId}
                    </button>
                  ) : (
                    <span className="text-zinc-300">{rv.memberName || rv.author}</span>
                  )}
                </td>
                <td className="p-3 text-zinc-400 whitespace-nowrap tabular-nums">{fmtDateTime(rv.createdAt)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => toggle(rv)} className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
                    {rv.hidden ? "다시 보이기" : "숨기기"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

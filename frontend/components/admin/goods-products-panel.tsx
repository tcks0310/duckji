"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Search } from "lucide-react"
import { ImageListUploadField } from "@/components/admin/image-upload-field"
import { adminInput, loginOr } from "@/components/admin/goods-shared"
import {
  adminDeleteProduct,
  adminFetchProducts,
  adminSaveProduct,
  dp,
  loadStoreProducts,
  STORE_BADGES,
  type AdminProduct,
  type StoreCategory,
} from "@/lib/store"

// 굿즈샵 관리 > 상품 관리 (backend store 서비스 /api/store/admin/products)
// 목록: 판매 상태·판매량·찜·장바구니를 한눈에, 줄마다 판매 등록/중지·품절 처리. 상품 추가·수정은 목록 자리에 넓게 엶
// 가격을 비우면 '가격 공개 예정'(찜만 받음), 재고를 비우면 수량 제한 없음

type State = "selling" | "soldout" | "hidden" | "upcoming"
const STATE_LABEL: Record<State, string> = { selling: "판매 중", soldout: "품절", hidden: "숨김", upcoming: "가격 공개 전" }
const STATE_STYLE: Record<State, string> = {
  selling: "bg-sky-900/50 text-sky-300",
  soldout: "bg-amber-900/40 text-amber-300",
  hidden: "bg-zinc-800 text-zinc-400",
  upcoming: "bg-zinc-800 text-zinc-300",
}
const stateOf = (p: AdminProduct): State => (!p.isActive ? "hidden" : p.soldOut ? "soldout" : p.priceDp === null ? "upcoming" : "selling")

type SortKey = "name" | "price" | "stock" | "sold" | "sold7" | "wish" | "cart" | "rating"
const sortValue: Record<SortKey, (p: AdminProduct) => number | string> = {
  name: (p) => p.name,
  price: (p) => p.priceDp ?? -1,
  stock: (p) => p.stock ?? Number.MAX_SAFE_INTEGER,
  sold: (p) => p.sales?.all ?? p.sold,
  sold7: (p) => p.sales?.d7 ?? 0,
  wish: (p) => p.wishCount,
  cart: (p) => p.cartQty,
  rating: (p) => p.rating ?? -1,
}

type Form = {
  id: number | null
  category: string
  name: string
  series: string
  description: string
  specs: string
  imageUrls: string[]
  detailImageUrls: string[]
  priceDp: string
  stock: string
  maxPerOrder: string
  badge: string
  sortOrder: number
  isActive: boolean
  soldOut: boolean
}

const emptyForm = (category: string): Form => ({
  id: null,
  category,
  name: "",
  series: "",
  description: "",
  specs: "",
  imageUrls: [],
  detailImageUrls: [],
  priceDp: "",
  stock: "",
  maxPerOrder: "10",
  badge: "",
  sortOrder: 0,
  isActive: true,
  soldOut: false,
})

const toForm = (p: AdminProduct): Form => ({
  id: p.id,
  category: p.category,
  name: p.name,
  series: p.series,
  description: p.description,
  specs: p.specs.join("\n"),
  imageUrls: p.imageUrls,
  detailImageUrls: p.detailImageUrls ?? [],
  priceDp: p.priceDp === null ? "" : String(p.priceDp),
  stock: p.stock === null ? "" : String(p.stock),
  maxPerOrder: String(p.maxPerOrder),
  badge: p.badge,
  sortOrder: p.sortOrder,
  isActive: p.isActive,
  soldOut: p.manualSoldOut,
})

export function GoodsProductsPanel({ onGoCategories }: { onGoCategories: () => void }) {
  const [products, setProducts] = useState<AdminProduct[] | null>(null)
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [badges, setBadges] = useState<string[]>([...STORE_BADGES])
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Form | null>(null)
  const [category, setCategory] = useState("")
  const [state, setState] = useState<State | "all">("all")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async () => {
    const r = await adminFetchProducts()
    if (r.status === "ok") {
      setProducts(r.data.products)
      setCategories(r.data.categories)
      if (r.data.badges?.length) setBadges(r.data.badges)
      setError("")
    } else {
      setProducts([])
      setError(loginOr(r))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const all = products ?? []
  const summary = useMemo(
    () => ({
      selling: all.filter((p) => stateOf(p) === "selling").length,
      soldout: all.filter((p) => stateOf(p) === "soldout").length,
      hidden: all.filter((p) => stateOf(p) === "hidden").length,
      upcoming: all.filter((p) => stateOf(p) === "upcoming").length,
      wish: all.reduce((a, p) => a + p.wishCount, 0),
      cartQty: all.reduce((a, p) => a + p.cartQty, 0),
      cartProducts: all.filter((p) => p.cartQty > 0).length,
    }),
    [products]
  )

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = all.filter(
      (p) =>
        (!category || p.category === category) &&
        (state === "all" || stateOf(p) === state) &&
        (!term || p.name.toLowerCase().includes(term) || p.series.toLowerCase().includes(term))
    )
    if (!sort) return list
    const get = sortValue[sort.key]
    return [...list].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      const c = typeof x === "string" ? x.localeCompare(String(y), "ko") : x - (y as number)
      return sort.desc ? -c : c
    })
  }, [products, category, state, q, sort])

  const patch = async (p: AdminProduct, body: Record<string, unknown>) => {
    setBusyId(p.id)
    const r = await adminSaveProduct(p.id, body)
    setBusyId(null)
    if (r.status !== "ok") return setError(loginOr(r))
    setError("")
    load()
    loadStoreProducts()
  }

  const remove = async (p: AdminProduct) => {
    if (!window.confirm(`'${p.name}' 상품을 지울까요? 되돌릴 수 없습니다.`)) return
    const r = await adminDeleteProduct(p.id)
    if (r.status !== "ok") return setError(loginOr(r))
    setError("")
    load()
    loadStoreProducts()
  }

  if (editing)
    return (
      <ProductEditor
        initial={editing}
        categories={categories}
        badges={badges}
        onGoCategories={onGoCategories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
          loadStoreProducts()
        }}
      />
    )

  const sortHead = (key: SortKey, label: string, right = true) => {
    const on = sort?.key === key
    return (
      <th className={`p-3 ${right ? "text-right" : ""}`} aria-sort={on ? (sort!.desc ? "descending" : "ascending") : undefined}>
        <button
          onClick={() => setSort(on ? (sort!.desc ? { key, desc: false } : null) : { key, desc: key !== "name" })}
          className={`inline-flex items-center gap-0.5 hover:text-white ${on ? "text-white" : ""}`}
        >
          {label}
          {on && (sort!.desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
        </button>
      </th>
    )
  }

  const cards: { label: string; value: string; hint?: string; filter?: State }[] = [
    { label: "판매 중", value: `${summary.selling}개`, hint: summary.upcoming ? `가격 공개 전 ${summary.upcoming}개 별도` : undefined, filter: "selling" },
    { label: "품절", value: `${summary.soldout}개`, hint: "품절 처리 또는 재고 0", filter: "soldout" },
    { label: "숨김", value: `${summary.hidden}개`, hint: "굿즈샵에 안 보임", filter: "hidden" },
    { label: "찜 합계", value: summary.wish.toLocaleString(), hint: "회원이 찜한 횟수" },
    { label: "장바구니 수량 합계", value: `${summary.cartQty.toLocaleString()}개`, hint: `상품 ${summary.cartProducts}종이 담겨 있음` },
  ]

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {cards.map((c) => {
          const body = (
            <>
              <dt className="text-xs text-zinc-400">{c.label}</dt>
              <dd className="text-xl font-bold text-white tabular-nums">{c.value}</dd>
              {c.hint && <dd className="text-xs text-zinc-500">{c.hint}</dd>}
            </>
          )
          return c.filter ? (
            <button
              key={c.label}
              onClick={() => setState(state === c.filter ? "all" : c.filter!)}
              className={`text-left rounded-xl border px-4 py-3 ${state === c.filter ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"}`}
            >
              {body}
            </button>
          ) : (
            <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              {body}
            </div>
          )
        })}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${adminInput} w-auto`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="분류">
          <option value="">모든 분류</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(["all", "selling", "soldout", "hidden", "upcoming"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`px-3 py-1.5 rounded-lg ${state === s ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {s === "all" ? "전체" : STATE_LABEL[s]} <span className="tabular-nums">{s === "all" ? all.length : summary[s]}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${adminInput} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품 이름·작품 검색" />
        </label>
        <button
          onClick={() => setEditing(emptyForm(category || categories[0]?.code || ""))}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-semibold text-white"
        >
          <Plus className="w-4 h-4" />
          상품 추가
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400 bg-zinc-950/60">
              {sortHead("name", "상품", false)}
              <th className="p-3">분류</th>
              {sortHead("price", "가격")}
              {sortHead("stock", "재고")}
              <th className="p-3">판매 상태</th>
              {sortHead("sold", "판매 누적")}
              {sortHead("sold7", "7일")}
              {sortHead("wish", "찜")}
              {sortHead("cart", "장바구니")}
              {sortHead("rating", "별점")}
              <th className="p-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {products === null && (
              <tr>
                <td colSpan={11} className="p-4 text-center text-zinc-500">
                  불러오는 중...
                </td>
              </tr>
            )}
            {products && shown.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-zinc-500">
                  {all.length === 0 ? "아직 등록한 상품이 없어요. '상품 추가'로 올려 주세요." : "조건에 맞는 상품이 없어요."}
                </td>
              </tr>
            )}
            {shown.map((p) => {
              const st = stateOf(p)
              const busy = busyId === p.id
              return (
                <tr key={p.id} className="hover:bg-zinc-900/60">
                  <td className="p-3">
                    <button onClick={() => setEditing(toForm(p))} className="flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                        {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className={`w-full h-full object-cover ${p.isActive ? "" : "opacity-50"}`} />}
                      </div>
                      <div className="min-w-0 max-w-[16rem]">
                        <div className={`font-medium truncate ${p.isActive ? "text-white" : "text-zinc-400"}`}>{p.name}</div>
                        <div className="text-xs text-zinc-500 truncate">
                          {[p.series, p.badge].filter(Boolean).join(" · ") || " "}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="p-3 text-zinc-300">{p.categoryName}</td>
                  <td className="p-3 text-right text-zinc-200 tabular-nums">{p.priceDp === null ? <span className="text-zinc-500">공개 예정</span> : dp(p.priceDp)}</td>
                  <td className={`p-3 text-right tabular-nums ${p.stock === 0 ? "text-amber-300" : "text-zinc-300"}`}>
                    {p.stock === null ? <span className="text-zinc-500">제한 없음</span> : `${p.stock.toLocaleString()}개`}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATE_STYLE[st]}`}>{STATE_LABEL[st]}</span>
                    {st === "soldout" && !p.manualSoldOut && <span className="ml-1.5 text-xs text-zinc-500">재고 0</span>}
                  </td>
                  <td className="p-3 text-right text-zinc-200 tabular-nums">{(p.sales?.all ?? p.sold).toLocaleString()}개</td>
                  <td className="p-3 text-right text-zinc-400 tabular-nums">{(p.sales?.d7 ?? 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-zinc-200 tabular-nums">{p.wishCount.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">
                    <span className="text-zinc-200">{p.cartQty.toLocaleString()}개</span>
                    <span className="text-xs text-zinc-500"> / {p.cartMembers.toLocaleString()}명</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {p.rating === null ? (
                      <span className="text-zinc-600">-</span>
                    ) : (
                      <>
                        <span className="text-amber-300">★</span> <span className="text-zinc-200">{p.rating.toFixed(1)}</span>
                        <span className="text-xs text-zinc-500"> ({p.reviewCount})</span>
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1 text-xs">
                      <button
                        disabled={busy}
                        onClick={() => patch(p, { isActive: !p.isActive })}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
                      >
                        {p.isActive ? "판매 중지" : "판매 등록"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => patch(p, { soldOut: !p.manualSoldOut })}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
                      >
                        {p.manualSoldOut ? "품절 해제" : "품절 처리"}
                      </button>
                      <button onClick={() => setEditing(toForm(p))} className="px-2.5 py-1 rounded-lg text-sky-400 hover:bg-zinc-800">
                        수정
                      </button>
                      <button onClick={() => remove(p)} className="px-2.5 py-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        장바구니는 지금 회원 장바구니에 담긴 수량 / 담은 회원 수, 판매는 취소를 뺀 수량입니다. 주문이 있는 상품은 지울 수 없으니 판매 중지로 숨겨 주세요.
      </p>
    </div>
  )
}

// ---- 상품 추가·수정 (목록 자리에 넓게)

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-4">
      <div>
        <h5 className="font-semibold text-white">{title}</h5>
        {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function ProductEditor({
  initial,
  categories,
  badges,
  onGoCategories,
  onClose,
  onSaved,
}: {
  initial: Form
  categories: StoreCategory[]
  badges: string[]
  onGoCategories: () => void
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  const close = () => {
    if (!dirty || window.confirm("저장하지 않은 내용이 있어요. 닫을까요?")) onClose()
  }
  const noCategory = categories.length === 0
  const unknownCategory = f.category && !categories.some((c) => c.code === f.category)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.category) return setError("분류를 골라 주세요.")
    setSaving(true)
    setError("")
    const { id, specs, priceDp, stock, maxPerOrder, ...rest } = f
    const r = await adminSaveProduct(id, {
      ...rest,
      specs: specs.split("\n").map((s) => s.trim()).filter(Boolean),
      priceDp: priceDp.trim() === "" ? null : Number(priceDp),
      stock: stock.trim() === "" ? null : Number(stock),
      maxPerOrder: Number(maxPerOrder) || 10,
    })
    setSaving(false)
    if (r.status === "ok") onSaved()
    else setError(loginOr(r))
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={close} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          <h4 className="font-semibold text-white text-base">{f.id ? `상품 수정 · ${initial.name}` : "새 상품"}</h4>
        </div>
        {f.id && (
          <a
            href={`/store/goods/detail/?id=${f.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white underline underline-offset-2"
          >
            상세 페이지 미리 보기
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {noCategory && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          <span>아직 분류가 없어요. 분류 관리에서 분류를 먼저 만들어 주세요.</span>
          <button type="button" onClick={onGoCategories} className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold">
            분류 관리로 가기
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Section title="기본 정보">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="분류 *">
                <select className={adminInput} value={f.category} onChange={(e) => set("category", e.target.value)} disabled={noCategory}>
                  {(!f.category || unknownCategory) && <option value={f.category}>{unknownCategory ? `${f.category} (없는 분류)` : "분류 선택"}</option>}
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="표시 배지">
                <select className={adminInput} value={f.badge} onChange={(e) => set("badge", e.target.value)}>
                  <option value="">없음</option>
                  {badges.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="상품 이름 *" className="sm:col-span-2">
                <input className={adminInput} required maxLength={150} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 2026 한정판 아크릴 스탠드" />
              </Field>
              <Field label="작품·시리즈" className="sm:col-span-2">
                <input className={adminInput} maxLength={100} value={f.series} onChange={(e) => set("series", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="판매 설정">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="가격 (DP)">
                <input className={adminInput} type="number" min={1} value={f.priceDp} onChange={(e) => set("priceDp", e.target.value)} placeholder="비우면 가격 공개 예정" />
              </Field>
              <Field label="재고">
                <input className={adminInput} type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} placeholder="비우면 제한 없음" />
              </Field>
              <Field label="1회 최대 구매 수량">
                <input className={adminInput} type="number" min={1} max={99} value={f.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} />
              </Field>
              <Field label="순서 (작을수록 앞)">
                <input type="number" className={adminInput} value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                판매 등록 (굿즈샵에 보이기)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={f.soldOut} onChange={(e) => set("soldOut", e.target.checked)} />
                품절 처리
              </label>
            </div>
            <p className="text-xs text-zinc-500">가격을 비우면 '가격 공개 예정'으로 찜만 받아요. 재고가 0이 되면 품절 처리를 하지 않아도 품절로 보여요.</p>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="상품 이미지" hint="첫 장이 목록·장바구니에 쓰이는 대표 사진입니다.">
            <ImageListUploadField label="상품 사진" value={f.imageUrls} onChange={(v) => set("imageUrls", v)} target="store" max={8} reorder firstLabel="대표" />
          </Section>
          <Section title="상세 설명 이미지" hint="상세 페이지 '상품 정보'에 위에서 아래로 이 순서대로 보입니다.">
            <ImageListUploadField label="상세 이미지" value={f.detailImageUrls} onChange={(v) => set("detailImageUrls", v)} target="store" max={20} reorder />
          </Section>
        </div>
      </div>

      <Section title="상세 설명">
        <Field label="설명">
          <textarea className={`${adminInput} min-h-[120px]`} maxLength={3000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="구성·규격 (한 줄에 하나)">
          <textarea className={`${adminInput} min-h-[80px]`} value={f.specs} onChange={(e) => set("specs", e.target.value)} placeholder={"크기 10 x 15cm\n아크릴 3T"} />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || noCategory} className="px-5 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "저장 중..." : f.id ? "수정 저장" : "상품 올리기"}
        </button>
        <button type="button" onClick={close} className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">
          취소
        </button>
      </div>
    </form>
  )
}

"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { GOODS_REQUEST_GALLERY_HREF } from "@/lib/gallery-links"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, FileText, ImageOff, Minus, PackageOpen, Plus, Search, Trash2, X } from "lucide-react"

import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import {
  MALL_CATEGORIES,
  SUPPLY_TYPES,
  fetchMallItems,
  loadQuoteCart,
  saveQuoteCart,
  type MallItem,
  type QuoteCartItem,
  type SupplyType,
} from "@/lib/mall"

// 스토어 › 덕지몰: 팝업스토어 집기·비품 렌탈/구매/맞춤제작 견적
// 품목은 관리자가 올림 (backend b2b /api/b2b/mall/items). 견적함에 담아 /store/mall/quote 에서 신청

const STEPS = ["필요한 품목을 견적함에 담기", "견적 신청서에 일정·장소 적기", "담당자가 확인 후 견적서 보내기"]

const FAQ = [
  { q: "며칠짜리 짧은 팝업도 렌탈할 수 있나요?", a: "네. 행사 기간에 맞춰 렌탈 기간을 잡고, 견적서에 기간별 금액을 적어 드립니다." },
  { q: "현장 설치와 철거도 맡길 수 있나요?", a: "견적 신청서에서 '현장 설치·철거 필요'를 체크해 주세요. 장소와 일정을 보고 가능 여부와 비용을 함께 안내합니다." },
  { q: "로고를 넣은 맞춤 제작은 얼마나 걸리나요?", a: "품목과 수량에 따라 다릅니다. 시안이나 참고 사진을 첨부하면 제작 기간을 더 정확히 알려 드릴 수 있어요." },
  { q: "결제와 세금계산서는 어떻게 하나요?", a: "사이트에서 결제하지 않습니다. 견적을 확정할 때 담당자가 결제 방법과 세금계산서 발행을 안내합니다." },
]

export default function PopupMallPage() {
  const [items, setItems] = useState<MallItem[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [category, setCategory] = useState("all")
  const [supply, setSupply] = useState<"all" | SupplyType>("all")
  const [query, setQuery] = useState("")
  const [detail, setDetail] = useState<MallItem | null>(null)
  const [cart, setCart] = useState<QuoteCartItem[]>([])

  useEffect(() => {
    setCart(loadQuoteCart())
    fetchMallItems().then((r) => {
      if (r.ok) setItems(r.items)
      else {
        setItems([])
        setLoadError(r.error)
      }
    })
  }, [])

  const updateCart = (next: QuoteCartItem[]) => {
    setCart(next)
    saveQuoteCart(next)
  }

  const addToCart = (item: MallItem, serviceType: SupplyType = item.supplyTypes[0] || "렌탈", quantity = 1) => {
    const existing = cart.find((c) => c.id === item.id)
    updateCart(
      existing
        ? cart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + quantity, serviceType } : c))
        : [
            ...cart,
            { id: item.id, name: item.name, categoryName: item.categoryName, imageUrl: item.imageUrls[0] || "", quantity, serviceType },
          ]
    )
  }
  const changeQty = (id: number, delta: number) =>
    updateCart(cart.map((c) => (c.id === id ? { ...c, quantity: Math.min(Math.max(1, c.quantity + delta), 9999) } : c)))
  const removeFromCart = (id: number) => updateCart(cart.filter((c) => c.id !== id))

  const list = items || []
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of list) m[i.category] = (m[i.category] || 0) + 1
    return m
  }, [list])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((i) => {
      if (category !== "all" && i.category !== category) return false
      if (supply !== "all" && !i.supplyTypes.includes(supply)) return false
      if (q && ![i.name, i.description, i.spec, i.categoryName].some((v) => v.toLowerCase().includes(q))) return false
      return true
    })
  }, [list, category, supply, query])

  const cartCount = cart.reduce((a, c) => a + c.quantity, 0)

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <SubPageHeader
        groupId="store"
        itemId="mall"
        actions={
          <div className="flex items-center gap-2">
          <Link href={GOODS_REQUEST_GALLERY_HREF} className="inline-flex items-center px-4 py-2 rounded-full border border-zinc-600 hover:border-zinc-400 text-zinc-100 text-sm font-semibold">
            굿즈 요청
          </Link>
          <Link
            href="/store/mall/quote"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-bold"
          >
            <FileText className="w-4 h-4" />
            견적 신청{cart.length > 0 && ` (${cart.length})`}
          </Link>
          </div>
        }
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-10">
        {/* 소개 */}
        <header className="space-y-8 pb-2">
          <div className="space-y-2 max-w-3xl">
            <p className="text-sm text-emerald-300">팝업스토어 집기·비품 B2B</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">덕지몰</h1>
            <p className="text-base text-zinc-300 leading-relaxed break-keep">
              진열대, 포토존, 차단봉, 포장재까지 팝업 운영에 필요한 집기를 렌탈·구매·맞춤제작으로 준비해 드립니다. 가격은 일정과 수량에
              따라 달라서, 견적을 신청하면 담당자가 확인한 뒤 견적서를 보내 드려요.
            </p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-x-8 gap-y-4 text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-baseline gap-3 border-t border-zinc-700 pt-4">
                <span className="text-sm text-emerald-300 tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-zinc-200">{s}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 items-start">
          {/* 품목 */}
          <section className="space-y-5 min-w-0">
            {list.length > 0 && (
              <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {[{ id: "all", label: "전체" }, ...MALL_CATEGORIES.filter((c) => counts[c.id])].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`px-3.5 py-2 rounded-lg text-sm whitespace-nowrap border ${
                        category === c.id
                          ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold"
                          : "text-zinc-300 border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      {c.label}
                      <span className={`ml-1.5 text-xs ${category === c.id ? "text-zinc-600" : "text-zinc-500"}`}>
                        {c.id === "all" ? list.length : counts[c.id]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="품목 이름, 규격으로 찾기"
                      className="w-full bg-transparent border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="flex rounded-lg border border-zinc-700 p-1 text-sm">
                    {(["all", ...SUPPLY_TYPES] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSupply(t)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md whitespace-nowrap ${
                          supply === t ? "bg-zinc-700 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t === "all" ? "전체" : t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {items === null ? (
              <div className="py-20 text-center text-sm text-zinc-500">품목을 불러오는 중...</div>
            ) : list.length === 0 ? (
              <EmptyState error={loadError} />
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center border-y border-zinc-800 space-y-1">
                <p className="text-base text-zinc-200">조건에 맞는 품목이 없어요.</p>
                <p className="text-sm text-zinc-500">분류나 검색어를 바꿔 보세요.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((item) => {
                  const inCart = cart.some((c) => c.id === item.id)
                  return (
                    <li key={item.id} className="flex flex-col min-w-0">
                      <button onClick={() => setDetail(item)} className="block text-left rounded-xl overflow-hidden" aria-label={`${item.name} 자세히 보기`}>
                        <ItemImage src={item.imageUrls[0]} alt={item.name} className="w-full aspect-[4/3]" />
                      </button>
                      <div className="flex-1 flex flex-col gap-3 pt-3">
                        <div className="space-y-1">
                          <p className="text-xs text-zinc-400">{item.categoryName}</p>
                          <h3 className="text-base font-bold text-white leading-snug">
                            <button onClick={() => setDetail(item)} className="text-left hover:underline underline-offset-4">
                              {item.name}
                            </button>
                          </h3>
                          {item.spec && <p className="text-sm text-zinc-400">{item.spec}</p>}
                          {item.description && <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed">{item.description}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {item.supplyTypes.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-md border border-zinc-700 text-xs text-zinc-300">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setDetail(item)}
                            className="py-2.5 rounded-full text-sm font-semibold border border-zinc-600 hover:border-zinc-400 text-zinc-100"
                          >
                            자세히
                          </button>
                          <button
                            onClick={() => addToCart(item)}
                            className={`py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-1 ${
                              inCart ? "border border-emerald-400/50 text-emerald-300 hover:bg-emerald-400/10" : "bg-emerald-400 hover:bg-emerald-300 text-zinc-950"
                            }`}
                          >
                            {inCart ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {inCart ? "담음 (+1)" : "견적함에 담기"}
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* 견적함: 데스크톱은 오른쪽 고정, 모바일은 담은 게 있을 때만 품목 위에 */}
          <aside className={`order-first lg:order-none lg:sticky lg:top-28 ${cart.length ? "" : "hidden lg:block"}`}>
            <div className="rounded-xl border border-zinc-700 bg-white/[0.03]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h2 className="text-base font-bold text-white">견적함</h2>
                <span className="text-sm text-zinc-400">{cart.length}종 · {cartCount}개</span>
              </div>
              {cart.length === 0 ? (
                <p className="px-4 py-8 text-sm text-zinc-400 text-center leading-relaxed">
                  담은 품목이 없어요.
                  <br />
                  품목 없이 바로 문의해도 됩니다.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800 max-h-[50vh] overflow-y-auto">
                  {cart.map((c) => (
                    <li key={c.id} className="flex gap-3 px-4 py-3">
                      <ItemImage src={c.imageUrl} alt={c.name} className="w-12 h-12 rounded-md shrink-0" small />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-400">{c.serviceType}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => changeQty(c.id, -1)} className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white" aria-label="수량 빼기">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm tabular-nums">{c.quantity}</span>
                            <button onClick={() => changeQty(c.id, 1)} className="p-1 rounded bg-zinc-800 text-zinc-300 hover:text-white" aria-label="수량 더하기">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeFromCart(c.id)} className="p-1 ml-1 text-zinc-500 hover:text-red-400" aria-label="견적함에서 빼기">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-4 border-t border-zinc-800">
                <Link
                  href="/store/mall/quote"
                  className="block w-full py-3 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-bold text-center"
                >
                  {cart.length ? "견적 신청하기" : "품목 없이 문의하기"}
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* 자주 묻는 질문 */}
        <section className="space-y-3 border-t border-zinc-800 pt-10 max-w-4xl">
          <h2 className="text-base font-bold text-white">자주 묻는 질문</h2>
          <div className="border-t border-white/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-white/10">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm text-zinc-200 hover:text-white [&::-webkit-details-marker]:hidden">
                  <span className="text-zinc-500 font-semibold">Q</span>
                  <span className="flex-1">{f.q}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className="flex gap-3 pb-4 pl-0 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  <span className="text-zinc-600 font-semibold">A</span>
                  <span className="flex-1">{f.a}</span>
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {detail && (
          <ItemDetail
            item={detail}
            onClose={() => setDetail(null)}
            onAdd={(t, q) => {
              addToCart(detail, t, q)
              setDetail(null)
            }}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}

function ItemImage({ src, alt, className, small }: { src?: string; alt: string; className: string; small?: boolean }) {
  if (!src)
    return (
      <div className={`${className} bg-zinc-800/60 flex items-center justify-center text-zinc-600`}>
        <ImageOff className={small ? "w-4 h-4" : "w-8 h-8"} />
      </div>
    )
  return <img src={src} alt={alt} loading="lazy" className={`${className} object-cover bg-zinc-800`} />
}

function EmptyState({ error }: { error: string }) {
  return (
    <div className="py-16 px-6 text-center border-y border-zinc-800 space-y-3">
      <PackageOpen className="w-10 h-10 text-zinc-600 mx-auto" />
      <p className="text-base font-semibold text-zinc-200">{error ? "품목을 불러오지 못했어요." : "아직 등록된 품목이 없어요."}</p>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {error || "품목을 준비하고 있습니다."} 필요한 집기가 있다면 견적 신청서로 먼저 문의해 주세요.
      </p>
      <Link href="/store/mall/quote" className="inline-block mt-1 px-5 py-2.5 rounded-full bg-emerald-400 text-zinc-950 text-sm font-semibold hover:bg-emerald-300">
        견적 문의하기
      </Link>
    </div>
  )
}

function ItemDetail({ item, onClose, onAdd }: { item: MallItem; onClose: () => void; onAdd: (t: SupplyType, q: number) => void }) {
  const [image, setImage] = useState(0)
  const [type, setType] = useState<SupplyType>(item.supplyTypes[0] || "렌탈")
  const [qty, setQty] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 grid md:grid-cols-2"
      >
        <div className="bg-zinc-950">
          <ItemImage src={item.imageUrls[image]} alt={item.name} className="w-full aspect-square" />
          {item.imageUrls.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {item.imageUrls.map((u, i) => (
                <button key={u + i} onClick={() => setImage(i)} className={`shrink-0 rounded-md overflow-hidden border-2 ${i === image ? "border-emerald-400" : "border-transparent"}`}>
                  <img src={u} alt="" className="w-14 h-14 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-zinc-400">{item.categoryName}</p>
              <h3 className="text-xl font-bold text-white leading-snug">{item.name}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
          </div>
          {item.spec && (
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm">
              <span className="text-zinc-400 mr-2">규격</span>
              <span className="text-zinc-100">{item.spec}</span>
            </div>
          )}
          {item.description && <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{item.description}</p>}

          <div className="mt-auto space-y-3 pt-2 border-t border-zinc-800">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-zinc-200">공급 방식</p>
              <div className="flex gap-2">
                {item.supplyTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      type === t ? "border-emerald-400 text-emerald-300 bg-emerald-400/10" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">수량</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1.5 rounded-md bg-zinc-800 text-zinc-300" aria-label="수량 빼기">
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), 9999))}
                  className="w-16 bg-zinc-950 border border-zinc-700 rounded-md py-1.5 text-center text-sm text-white"
                  aria-label="수량"
                />
                <button onClick={() => setQty((q) => Math.min(q + 1, 9999))} className="p-1.5 rounded-md bg-zinc-800 text-zinc-300" aria-label="수량 더하기">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button onClick={() => onAdd(type, qty)} className="w-full py-3 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
              견적함에 담기
            </button>
            <p className="text-xs text-zinc-500">가격은 일정·수량에 따라 달라 견적서로 안내합니다.</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

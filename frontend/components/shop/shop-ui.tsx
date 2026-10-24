"use client"

import * as React from "react"
import Link from "next/link"
import { Heart, Minus, Plus, Star } from "lucide-react"
import { goToLogin } from "@/lib/member-auth"
import { toggleLike, useSavedItems } from "@/lib/saved-items"
import { dp, loadStoreProducts, type StoreProduct } from "@/lib/store"

// 굿즈샵 화면들이 같이 쓰는 작은 조각: 상품 카드, 별점, 수량 버튼, 찜, 정렬
// 테두리는 사이트 공통 금색(globals.css 의 border-zinc-*) 대신 차분한 흰색 반투명선을 씀 (쇼핑 화면은 상품 사진이 주인공)

export const LINE = "border-white/[0.08]"
export const DIVIDE = "divide-white/[0.08]"
export const PANEL = "rounded-xl bg-white/[0.03] border border-white/[0.1]"
export const FIELD =
  "w-full h-11 px-3 rounded-lg bg-zinc-950 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/40"

export const productHref = (id: number | string) => `/store/goods/detail/?id=${id}`

// ---- 찜 (회원 계정에 저장, 비로그인이면 로그인 페이지로)

// 찜 수가 바뀌면 잠시 뒤 상품 목록을 다시 불러와 서버 집계를 반영
let reloadTimer: ReturnType<typeof setTimeout> | null = null
const reloadSoon = () => {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => loadStoreProducts(), 800)
}

export function useWish() {
  const saved = useSavedItems()
  const liked = (id: number | string) => saved.likes.goods.includes(String(id))
  const toggle = async (id: number | string) => {
    const r = await toggleLike("goods", String(id))
    if (r === "login") return goToLogin()
    if (r === "error") return window.alert("저장하지 못했어요. 잠시 후 다시 시도해 주세요.")
    reloadSoon()
  }
  return { liked, toggle, count: saved.likes.goods.length }
}

// ---- 별점

export function Stars({ value, size = "w-3.5 h-3.5" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`별점 ${value.toFixed(1)}점`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)))
        return (
          <span key={n} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-zinc-600`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${size} fill-amber-400 text-amber-400`} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

// 카드·목록용 한 줄: ★ 4.5 (12)
export function RatingLine({ product }: { product: StoreProduct }) {
  if (!product.reviewCount || product.rating === null) return <span className="text-xs text-zinc-500">후기 없음</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      <span className="font-bold text-zinc-200">{product.rating.toFixed(1)}</span>
      <span>({product.reviewCount.toLocaleString()})</span>
    </span>
  )
}

// ---- 수량 버튼

export function QtyStepper({ value, max, onChange, small }: { value: number; max: number; onChange: (n: number) => void; small?: boolean }) {
  const box = small ? "w-8 h-8" : "w-10 h-10"
  return (
    <div className={`inline-flex items-center rounded-lg border ${LINE} bg-zinc-950`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className={`${box} flex items-center justify-center text-zinc-300 hover:text-white disabled:text-zinc-600`}
        aria-label="하나 빼기"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className={`${small ? "w-8" : "w-10"} text-center text-sm font-bold text-white tabular-nums`}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${box} flex items-center justify-center text-zinc-300 hover:text-white disabled:text-zinc-600`}
        aria-label="하나 더하기"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// 한 번에 살 수 있는 최대 수량 (관리자가 정한 1회 최대, 남은 재고 중 작은 값)
export const maxQty = (p: StoreProduct) => Math.max(1, Math.min(p.maxPerOrder || 99, p.stock ?? 99, 99))
export const canBuy = (p: StoreProduct) => p.priceDp !== null && !p.soldOut

// ---- 정렬

export type SalesPeriod = "d1" | "d7" | "d30" | "all"
export const SALES_PERIODS: { id: SalesPeriod; label: string }[] = [
  { id: "d1", label: "실시간" },
  { id: "d7", label: "주간" },
  { id: "d30", label: "월간" },
  { id: "all", label: "전체" },
]

export type ListSort = "new" | "sales" | "rating" | "price_asc" | "price_desc"
export const LIST_SORTS: { id: ListSort; label: string }[] = [
  { id: "new", label: "신상품순" },
  { id: "sales", label: "판매순" },
  { id: "rating", label: "별점순" },
  { id: "price_asc", label: "낮은 가격순" },
  { id: "price_desc", label: "높은 가격순" },
]

const time = (p: StoreProduct) => new Date(p.createdAt).getTime() || 0
const byNew = (a: StoreProduct, b: StoreProduct) => time(b) - time(a)
const byRating = (a: StoreProduct, b: StoreProduct) =>
  (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount || b.sales.all - a.sales.all || byNew(a, b)
const bySales = (period: SalesPeriod) => (a: StoreProduct, b: StoreProduct) =>
  b.sales[period] - a.sales[period] || b.sales.all - a.sales.all || b.wishCount - a.wishCount || byNew(a, b)
// 가격 공개 전 상품은 가격순에서 맨 뒤
const priceOf = (p: StoreProduct, missing: number) => (p.priceDp === null ? missing : p.priceDp)

export function sortProducts(list: StoreProduct[], sort: ListSort | "sales", period: SalesPeriod = "all") {
  const copy = [...list]
  if (sort === "new") return copy.sort(byNew)
  if (sort === "rating") return copy.sort(byRating)
  if (sort === "sales") return copy.sort(bySales(period))
  if (sort === "price_asc") return copy.sort((a, b) => priceOf(a, Infinity) - priceOf(b, Infinity) || byNew(a, b))
  return copy.sort((a, b) => priceOf(b, -1) - priceOf(a, -1) || byNew(a, b))
}

// ---- 상품 카드

export function ProductCard({ product: p, rank }: { product: StoreProduct; rank?: number }) {
  const wish = useWish()
  const liked = wish.liked(p.id)
  return (
    <Link href={productHref(p.id)} className="group block min-w-0">
      <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900">
        {p.imageUrls[0] ? (
          <img src={p.imageUrls[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">이미지 준비 중</div>
        )}
        {rank !== undefined && (
          <span
            className={`absolute top-0 left-0 min-w-8 h-8 px-2 flex items-center justify-center rounded-br-xl text-sm font-black tabular-nums ${
              rank <= 3 ? "bg-amber-400 text-black" : "bg-black/70 text-white"
            }`}
          >
            {rank}
          </span>
        )}
        {p.badge && (
          <span className={`absolute ${rank !== undefined ? "top-10" : "top-2"} left-2 px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white`}>{p.badge}</span>
        )}
        {p.soldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full border border-white/40 text-sm font-bold text-white">품절</span>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            wish.toggle(p.id)
          }}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
          aria-label={liked ? "찜 해제" : "찜하기"}
          aria-pressed={liked}
        >
          <Heart className={`w-[18px] h-[18px] ${liked ? "fill-red-500 text-red-500" : ""}`} />
        </button>
      </div>
      <div className="pt-3 space-y-1">
        {p.series && <div className="text-xs text-zinc-400 truncate">{p.series}</div>}
        <div className="text-sm text-zinc-100 leading-snug line-clamp-2 group-hover:underline underline-offset-2">{p.name}</div>
        <div className={`text-base font-semibold ${p.priceDp === null ? "text-zinc-400 text-sm font-bold" : "text-white"}`}>
          {p.priceDp === null ? "가격 공개 예정" : dp(p.priceDp)}
        </div>
        <RatingLine product={p} />
      </div>
    </Link>
  )
}

export function ProductGrid({ products, ranked }: { products: StoreProduct[]; ranked?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  )
}

// 빈 화면·안내 상자
export function ShopNotice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`${PANEL} py-20 px-5 text-center space-y-4`}>
      <p className="text-sm text-zinc-400">{children}</p>
      {action}
    </div>
  )
}

export const ghostButton = `inline-flex h-10 items-center justify-center px-5 rounded-lg border ${LINE} text-sm text-zinc-200 hover:bg-white/5`

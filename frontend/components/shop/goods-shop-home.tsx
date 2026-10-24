"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Footer } from "@/components/footer"
import { GoodsShopHeader, goodsTabHref } from "@/components/shop/goods-shop-header"
import { ghostButton, LIST_SORTS, ProductGrid, SALES_PERIODS, ShopNotice, sortProducts, type ListSort, type SalesPeriod } from "@/components/shop/shop-ui"
import { loadStoreProducts, useStoreProducts, type StoreProduct } from "@/lib/store"

// 굿즈샵 첫 화면 (/store/goods/)
//   ?tab=ranking (기본)           랭킹: 판매순(실시간·주간·월간·전체) / 별점순 / 신상품순
//   ?cat=<분류 코드>               분류별 상품: 신상품순·판매순·별점순·가격순
//   &sort=...&period=...          정렬 (주소에 남겨 뒤로 가기·공유 때 그대로)

type RankSort = "sales" | "rating" | "new"
const RANK_SORTS: { id: RankSort; label: string }[] = [
  { id: "sales", label: "판매순" },
  { id: "rating", label: "별점순" },
  { id: "new", label: "신상품순" },
]
const RANK_DESC: Record<string, string> = {
  d1: "최근 24시간 동안 많이 팔린 굿즈예요.",
  d7: "최근 7일 동안 많이 팔린 굿즈예요.",
  d30: "최근 30일 동안 많이 팔린 굿즈예요.",
  all: "지금까지 가장 많이 팔린 굿즈예요.",
  rating: "후기 별점이 높은 굿즈예요. 별점이 같으면 후기가 많은 순서예요.",
  new: "가장 최근에 들어온 굿즈예요.",
}
const RANK_LIMIT = 100

export function GoodsShopHome() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { status, products, categories } = useStoreProducts()
  const cat = params.get("cat")

  // 정렬을 바꾸면 주소만 바꿈 (화면 위치는 그대로)
  const setParams = (next: Record<string, string>) => {
    const q = new URLSearchParams(params.toString())
    Object.entries(next).forEach(([k, v]) => q.set(k, v))
    router.replace(`${pathname}?${q}`, { scroll: false })
  }

  const active = cat ? `cat:${cat}` : "ranking"

  let body: React.ReactNode
  if (status === "idle" || status === "loading") body = <p className="py-24 text-center text-sm text-zinc-400">상품을 불러오는 중...</p>
  else if (status === "error")
    body = (
      <ShopNotice
        action={
          <button type="button" onClick={() => loadStoreProducts()} className={ghostButton}>
            다시 불러오기
          </button>
        }
      >
        상품 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
      </ShopNotice>
    )
  else if (cat) {
    const category = categories.find((c) => c.code === cat)
    body = category ? (
      <CategoryView
        name={category.name}
        products={products.filter((p) => p.category === cat)}
        sort={(LIST_SORTS.find((s) => s.id === params.get("sort"))?.id ?? "new") as ListSort}
        onSort={(sort) => setParams({ sort })}
      />
    ) : (
      <ShopNotice
        action={
          <Link href={goodsTabHref("ranking")} className={ghostButton}>
            랭킹 보기
          </Link>
        }
      >
        없는 분류예요. 분류 이름이 바뀌었거나 없어졌을 수 있어요.
      </ShopNotice>
    )
  } else {
    const sort = (RANK_SORTS.find((s) => s.id === params.get("sort"))?.id ?? "sales") as RankSort
    const period = (SALES_PERIODS.find((s) => s.id === params.get("period"))?.id ?? "d7") as SalesPeriod
    body = <RankingView products={products} sort={sort} period={period} onChange={setParams} />
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <GoodsShopHeader active={active} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">{body}</main>
      <Footer />
    </div>
  )
}

const chip = (on: boolean) =>
  `h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
    on ? "bg-white text-black" : "bg-zinc-900 text-zinc-300 hover:text-white border border-white/[0.08]"
  }`

function RankingView({
  products,
  sort,
  period,
  onChange,
}: {
  products: StoreProduct[]
  sort: RankSort
  period: SalesPeriod
  onChange: (next: Record<string, string>) => void
}) {
  const ranked = sortProducts(products, sort, period).slice(0, RANK_LIMIT)
  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">굿즈 랭킹</h1>
          <p className="mt-1 text-sm text-zinc-400">{RANK_DESC[sort === "sales" ? period : sort]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-zinc-900 p-1 border border-white/[0.08]" role="tablist" aria-label="랭킹 기준">
            {RANK_SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sort === s.id}
                onClick={() => onChange({ sort: s.id })}
                className={`h-8 px-4 rounded-md text-sm font-bold transition-colors ${sort === s.id ? "bg-emerald-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {sort === "sales" && (
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SALES_PERIODS.map((p) => (
                <button key={p.id} type="button" onClick={() => onChange({ period: p.id })} className={chip(period === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {ranked.length === 0 ? <ShopNotice>아직 판매 중인 굿즈가 없어요. 곧 새 굿즈로 찾아올게요.</ShopNotice> : <ProductGrid products={ranked} ranked />}
    </section>
  )
}

function CategoryView({ name, products, sort, onSort }: { name: string; products: StoreProduct[]; sort: ListSort; onSort: (s: ListSort) => void }) {
  const list = sortProducts(products, sort)
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            총 <span className="font-bold text-zinc-200">{products.length.toLocaleString()}</span>개
          </p>
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as ListSort)}
          aria-label="정렬"
          className="h-9 pl-3 pr-8 rounded-lg bg-zinc-900 border border-white/15 text-sm text-zinc-200 focus:outline-none focus:border-white/40 shrink-0"
        >
          {LIST_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 ? <ShopNotice>이 분류에는 아직 상품이 없어요.</ShopNotice> : <ProductGrid products={list} />}
    </section>
  )
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { ProductGrid, productHref } from "@/components/shop/shop-ui"
import { dp, useStoreProducts, type StoreProduct } from "@/lib/store"
import { categoryLabel, fetchMallItems, type MallItem } from "@/lib/mall"

// 스토어 대분류 메인 (/store/): 펀딩 메인(/funding/)과 같은 구성
// 소개·숫자(왼쪽) + 이번 주 많이 팔린 굿즈(오른쪽) → 굿즈샵·덕지몰 두 갈래 → 새로 들어온 굿즈 → 덕지몰 품목 → 펀딩·DP 연결
// 굿즈샵(/store/goods)·덕지몰(/store/mall) 화면은 그대로 두고 여기서는 이어 주기만 함

export function StoreMain() {
  const { products, status } = useStoreProducts()
  const [mall, setMall] = useState<MallItem[] | null>(null)

  useEffect(() => {
    fetchMallItems().then((r) => setMall(r.ok ? r.items.filter((i) => i.isActive !== false) : []))
  }, [])

  const ready = status === "ready" || status === "error"
  const onSale = products.filter((p) => !p.soldOut)
  const weekly = [...products]
    .filter((p) => p.sales.d7 > 0)
    .sort((a, b) => b.sales.d7 - a.sales.d7)
    .slice(0, 5)
  const best = weekly.length
    ? weekly
    : [...products]
        .filter((p) => p.sales.all > 0)
        .sort((a, b) => b.sales.all - a.sales.all)
        .slice(0, 5)
  const fresh = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="store" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-20 sm:space-y-24">
        {/* 소개 + 많이 팔린 굿즈 (상단 오른쪽) */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start">
          <div className="space-y-5 lg:pt-6">
            <p className="text-sm text-emerald-300">덕지 스토어</p>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.2] break-keep">
              갖고 싶은 굿즈는 바로 사고,
              <br />
              필요한 건 함께 만들어요
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl break-keep">
              굿즈샵에서는 덕지 공식·한정 굿즈를 DP 로 바로 살 수 있어요. 팝업이나 행사에 필요한 집기와 맞춤 굿즈는 덕지몰에서 견적을 받아요.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/store/goods/" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold">
                굿즈샵 가기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/store/mall" className="inline-flex items-center h-12 px-6 rounded-full border border-zinc-600 hover:border-zinc-400 text-white">
                덕지몰 견적 받기
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-6 pt-8 mt-4 border-t border-zinc-800 max-w-xl">
              <Stat label="판매 중 굿즈" value={ready ? `${onSale.length}종` : "-"} />
              <Stat label="덕지몰 품목" value={mall ? `${mall.length}개` : "-"} />
              <Stat label="결제" value="1 DP = 1원" small />
            </dl>
          </div>

          <aside className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{weekly.length ? "이번 주 많이 팔린 굿즈" : "많이 팔린 굿즈"}</h2>
              <Link href="/store/goods/" className="text-xs text-zinc-400 hover:text-white">
                랭킹 전체
              </Link>
            </div>
            {!ready ? (
              <p className="py-4 text-sm text-zinc-500 border-y border-zinc-800">불러오는 중...</p>
            ) : best.length === 0 ? (
              <p className="py-4 text-sm text-zinc-400 border-y border-zinc-800">아직 판매 기록이 없어요. 굿즈샵에서 새 굿즈를 먼저 만나 보세요.</p>
            ) : (
              <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
                {best.map((p, i) => (
                  <RankRow key={p.id} product={p} rank={i + 1} />
                ))}
              </ol>
            )}
          </aside>
        </section>

        {/* 두 갈래 */}
        <section className="grid md:grid-cols-2 gap-px bg-zinc-800 border-y border-zinc-800">
          <KindLink
            href="/store/goods/"
            title="굿즈샵"
            desc="덕지 공식·한정 굿즈를 DP 로 바로 사요. 찜해 두면 재입고와 가격 공개 소식을 놓치지 않아요."
            note={ready ? `${onSale.length}종 판매 중` : ""}
          />
          <KindLink
            href="/store/mall"
            title="덕지몰"
            desc="팝업·행사에 필요한 집기와 맞춤 굿즈를 렌탈·구매·제작으로 견적 받아요. 펀딩에 넣는 굿즈도 여기 품목이에요."
            note={mall ? `${mall.length}개 품목` : ""}
          />
        </section>

        {/* 새로 들어온 굿즈 */}
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">새로 들어온 굿즈</h2>
            <Link href="/store/goods/" className="text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1">
              굿즈샵 전체
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {!ready ? (
            <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
          ) : fresh.length === 0 ? (
            <p className="py-10 text-base text-zinc-300 border-y border-zinc-800">아직 판매 중인 굿즈가 없어요.</p>
          ) : (
            <ProductGrid products={fresh} />
          )}
        </section>

        {/* 덕지몰 품목 */}
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">덕지몰에서 견적 받을 수 있어요</h2>
              <p className="text-sm text-zinc-400">담아서 한 번에 견적을 신청하면 담당자가 견적서를 보내 드려요.</p>
            </div>
            <Link href="/store/mall" className="text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1 shrink-0">
              덕지몰 전체
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {mall === null ? (
            <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
          ) : mall.length === 0 ? (
            <p className="py-10 text-base text-zinc-300 border-y border-zinc-800">등록된 품목이 아직 없어요.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {mall.slice(0, 4).map((m) => (
                <Link key={m.id} href="/store/mall" className="group block min-w-0">
                  <div className="aspect-square rounded-xl overflow-hidden bg-zinc-900">
                    {m.imageUrls[0] ? (
                      <img src={m.imageUrls[0]} alt={m.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">이미지 준비 중</div>
                    )}
                  </div>
                  <div className="pt-3 space-y-1">
                    <p className="text-xs text-zinc-400 truncate">{m.categoryName || categoryLabel(m.category)}</p>
                    <p className="text-sm text-zinc-100 leading-snug line-clamp-2 group-hover:underline underline-offset-2">{m.name}</p>
                    <p className="text-xs text-zinc-400">{m.supplyTypes.join(" · ")}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 펀딩·DP 연결 */}
        <section className="grid md:grid-cols-3 gap-8 border-t border-zinc-800 pt-10 text-sm">
          <Connect title="함께 만들고 싶다면" body="혼자 주문하기엔 수량이 많다면, 덕지몰 품목으로 굿즈 공동구매 펀딩을 열어 같은 팬과 함께 만들어요." href="/funding/new" label="펀딩 열기" />
          <Connect title="결제는 DP 로" body="1 DP 는 1원이에요. 무료로 받은 DP 부터 먼저 쓰고, 모자라면 바로 충전할 수 있어요." href="/mypage/charge" label="DP 충전" />
          <Connect title="찜과 장바구니" body="마음에 드는 굿즈는 찜해 두고, 장바구니에 모아 한 번에 주문해요." href="/store/goods/liked" label="찜한 굿즈" />
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className={`${small ? "text-lg sm:text-xl pt-1.5" : "text-2xl sm:text-3xl"} font-semibold text-white tabular-nums mt-1`}>{value}</dd>
    </div>
  )
}

function RankRow({ product: p, rank }: { product: StoreProduct; rank: number }) {
  return (
    <li>
      <Link href={productHref(p.id)} className="flex items-center gap-3 py-3 group">
        <span className={`w-5 text-sm tabular-nums shrink-0 ${rank <= 3 ? "text-emerald-300 font-semibold" : "text-zinc-500"}`}>{rank}</span>
        <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-900 shrink-0">{p.imageUrls[0] ? <img src={p.imageUrls[0]} alt="" className="w-full h-full object-cover" /> : null}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">{p.name}</p>
          <p className="text-xs text-zinc-400 truncate">{p.series || p.categoryName}</p>
        </div>
        <span className="text-sm text-zinc-200 tabular-nums shrink-0">{p.priceDp === null ? "공개 예정" : dp(p.priceDp)}</span>
      </Link>
    </li>
  )
}

function KindLink({ href, title, desc, note }: { href: string; title: string; desc: string; note: string }) {
  return (
    <Link href={href} className="group block bg-[hsl(var(--background))] p-6 sm:p-8 space-y-3 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed break-keep max-w-md">{desc}</p>
      {note && <p className="text-sm text-emerald-300">{note}</p>}
    </Link>
  )
}

function Connect({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed break-keep">{body}</p>
      {/* 앱에서는 DP 충전 링크를 숨김 (결제 화면에서 모자란 금액만 카드로) */}
      <Link href={href} className={`inline-block text-emerald-300 hover:text-emerald-200 underline underline-offset-4 ${href.startsWith("/mypage/charge") ? "app-hide" : ""}`}>
        {label}
      </Link>
    </div>
  )
}

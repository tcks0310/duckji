"use client"

import * as React from "react"
import Link from "next/link"
import { Heart, MessageSquarePlus, ShoppingBag, Trophy } from "lucide-react"
import { GOODS_REQUEST_GALLERY_HREF } from "@/lib/gallery-links"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { useSavedItems } from "@/lib/saved-items"
import { useStoreProducts } from "@/lib/store"

// 굿즈샵 공통 머리: 사이트 상단 메뉴(스토어 › 굿즈샵) 아래 굿즈샵 전용 탭 줄
// 왼쪽 탭: 랭킹(/store/goods/?tab=ranking) → 관리자가 정한 분류 순서대로(/store/goods/?cat=<분류 코드>)
// 오른쪽: 찜 목록(/store/goods/liked), 장바구니(/store/goods/cart)
// active: "ranking" | "cat:<코드>" | "liked" | "cart" | "" (상세·주문 화면처럼 어느 탭도 아닌 곳)

export const goodsTabHref = (tab: "ranking" | { cat: string }) =>
  tab === "ranking" ? "/store/goods/?tab=ranking" : `/store/goods/?cat=${encodeURIComponent(tab.cat)}`

export function GoodsShopHeader({ active }: { active: string }) {
  const { categories } = useStoreProducts()
  const saved = useSavedItems()
  const cartCount = saved.cart.reduce((sum, i) => sum + i.quantity, 0)
  const likeCount = saved.likes.goods.length
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  const tab = (key: string, href: string, label: React.ReactNode) => {
    const on = active === key
    return (
      <li key={key}>
        <Link
          href={href}
          aria-current={on ? "page" : undefined}
          className={`h-12 px-3 sm:px-4 inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold border-b-2 -mb-px transition-colors ${
            on ? "border-red-500 text-white" : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          {label}
        </Link>
      </li>
    )
  }

  const side = (key: string, href: string, icon: React.ReactNode, label: string, count: number) => (
    <Link
      href={href}
      aria-label={`${label} ${count}개`}
      aria-current={active === key ? "page" : undefined}
      className={`relative h-10 px-2 sm:px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
        active === key ? "text-white bg-white/10" : "text-zinc-300 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold inline-flex items-center justify-center tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )

  return (
    <SubPageHeader groupId="store" itemId="goods">
      <nav aria-label="굿즈샵 메뉴" className="flex items-stretch border-b border-white/[0.08]">
        <ul className="flex-1 min-w-0 flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tab(
            "ranking",
            goodsTabHref("ranking"),
            <>
              <Trophy className="w-4 h-4 text-amber-400" />
              랭킹
            </>
          )}
          {sorted.map((c) => tab(`cat:${c.code}`, goodsTabHref({ cat: c.code }), c.name))}
        </ul>
        <div className="shrink-0 flex items-center gap-0.5 pl-2 ml-1 border-l border-white/[0.08]">
          <Link href={GOODS_REQUEST_GALLERY_HREF} className="h-10 px-2 sm:px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold whitespace-nowrap text-zinc-300 hover:text-white hover:bg-white/5">
            <MessageSquarePlus className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline">굿즈 요청</span>
          </Link>
          {side("liked", "/store/goods/liked/", <Heart className="w-[18px] h-[18px]" />, "찜", likeCount)}
          {side("cart", "/store/goods/cart/", <ShoppingBag className="w-[18px] h-[18px]" />, "장바구니", cartCount)}
        </div>
      </nav>
    </SubPageHeader>
  )
}

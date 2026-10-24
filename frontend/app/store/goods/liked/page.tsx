"use client"

import * as React from "react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { GoodsShopHeader, goodsTabHref } from "@/components/shop/goods-shop-header"
import { ghostButton, LINE, ProductGrid, ShopNotice } from "@/components/shop/shop-ui"
import { goToLogin } from "@/lib/member-auth"
import { useSavedItems } from "@/lib/saved-items"
import { useStoreProducts } from "@/lib/store"

// 굿즈 찜 목록 (/store/goods/liked): 굿즈샵 안에서 하트를 누른 상품. 최근에 찜한 것부터
// 팝업·덕지순례까지 모아 보는 곳은 마이페이지 찜 목록(/mypage/liked)

export default function GoodsLikedPage() {
  const saved = useSavedItems()
  const { products, status } = useStoreProducts()
  const byId = new Map(products.map((p) => [String(p.id), p]))
  const list = [...saved.likes.goods].reverse().flatMap((id) => byId.get(id) ?? [])
  // 판매 목록에서 내려간 상품은 카드로 보여 줄 정보가 없어 수만 안내
  const gone = saved.likes.goods.length - list.length

  const loading = saved.status === "unknown" || saved.status === "loading" || status === "idle" || status === "loading"

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <GoodsShopHeader active="liked" />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-5">
        <div className={`pb-3 border-b ${LINE}`}>
          <h1 className="text-2xl font-black text-white">찜 목록</h1>
          {saved.status === "member" && (
            <p className="mt-1 text-sm text-zinc-400">
              찜한 굿즈 <span className="font-bold text-zinc-200">{list.length}</span>개
            </p>
          )}
        </div>

        {loading ? (
          <p className="py-24 text-center text-sm text-zinc-400">불러오는 중...</p>
        ) : saved.status === "guest" ? (
          <ShopNotice
            action={
              <button type="button" onClick={() => goToLogin()} className="h-10 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
                로그인하기
              </button>
            }
          >
            로그인하면 찜한 굿즈를 어느 기기에서든 볼 수 있어요.
          </ShopNotice>
        ) : list.length === 0 ? (
          <ShopNotice
            action={
              <Link href={goodsTabHref("ranking")} className={ghostButton}>
                굿즈 둘러보기
              </Link>
            }
          >
            {gone > 0 ? "찜한 굿즈가 모두 판매 목록에서 내려갔어요." : "아직 찜한 굿즈가 없어요. 마음에 드는 상품에서 하트를 눌러 보세요."}
          </ShopNotice>
        ) : (
          <>
            <ProductGrid products={list} />
            {gone > 0 && <p className="text-sm text-zinc-500">판매 목록에서 내려간 굿즈 {gone}개는 보이지 않아요.</p>}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

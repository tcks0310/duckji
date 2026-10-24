import type { Metadata } from "next"
import { Suspense } from "react"
import { GoodsShopHome } from "@/components/shop/goods-shop-home"

export const metadata: Metadata = { title: "굿즈샵" }

// 굿즈샵 (/store/goods/?tab=ranking | ?cat=<분류 코드>): 랭킹과 분류별 상품 목록. 화면은 components/shop/goods-shop-home.tsx
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <GoodsShopHome />
    </Suspense>
  )
}

import type { Metadata } from "next"
import { Suspense } from "react"
import { GoodsDetail } from "@/components/shop/goods-detail"

export const metadata: Metadata = { title: "굿즈 상세" }

// 정적 배포(S3)용: /store/goods/detail/?id=<상품 id> (화면은 components/shop/goods-detail.tsx)
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <GoodsDetail />
    </Suspense>
  )
}

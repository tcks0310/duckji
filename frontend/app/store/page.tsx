import type { Metadata } from "next"
import { StoreMain } from "@/components/portal/store-main"

export const metadata: Metadata = { title: "스토어" }

// 대분류 페이지: 스토어 (펀딩 메인과 같은 구성, components/portal/store-main.tsx). 예전 소분류 바로가기 화면은 archive/frontend/app/store/page.tsx
export default function Page() {
  return <StoreMain />
}

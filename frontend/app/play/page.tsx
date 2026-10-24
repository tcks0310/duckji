import type { Metadata } from "next"
import { PlayMain } from "@/components/portal/play-main"

export const metadata: Metadata = { title: "운세·놀이" }

// 대분류 페이지: 운세·놀이 (펀딩·스토어 메인과 같은 구성, components/portal/play-main.tsx). 예전 바로가기 화면은 archive/frontend/app/play/page.tsx
// 모든 방문자에게 전면 공개
export default function Page() {
  return <PlayMain />
}

import type { Metadata } from "next"
import { SajuAiPage } from "@/components/saju-ai/saju-ai-page"

export const metadata: Metadata = { title: "덕지 도사 AI 사주" }

// 소분류 페이지: 덕지 도사 AI 사주 (운세·놀이 맨 위, 로그인 회원 전용 / 메뉴 목록은 lib/site-menu.ts)
export default function Page() {
  return <SajuAiPage />
}

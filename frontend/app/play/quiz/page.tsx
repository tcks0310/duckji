import type { Metadata } from "next"
import { QuizPage } from "@/components/play/quiz-page"

export const metadata: Metadata = { title: "덕력 퀴즈" }

// 소분류 페이지: 덕력 퀴즈 (메뉴 목록은 lib/site-menu.ts)
export default function Page() {
  return <QuizPage />
}

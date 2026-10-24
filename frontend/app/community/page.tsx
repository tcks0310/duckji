import type { Metadata } from "next"
import { MoveTo } from "@/components/gallery/move-to"

export const metadata: Metadata = { title: "커뮤니티" }

// 커뮤니티는 덕지 갤러리가 메인: /community 로 오면 바로 갤러리로
export default function Page() {
  return <MoveTo to="/community/gallery/" />
}

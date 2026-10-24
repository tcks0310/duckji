import type { Metadata } from "next"
import { Suspense } from "react"
import { PopupDetailPage } from "@/components/events/popup-detail-page"

export const metadata: Metadata = { title: "팝업 상세" }

// 정적 배포(S3)용: /popups/detail/?id=<팝업 id> (화면은 서버에서 팝업을 받아 그림)
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PopupDetailPage />
    </Suspense>
  )
}

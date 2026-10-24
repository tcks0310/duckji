import type { Metadata } from "next"
import { PortalPage } from "@/components/portal/portal-page"

export const metadata: Metadata = { title: "팝업" }

// 대분류 페이지: 팝업 (메뉴 목록은 lib/site-menu.ts)
export default function Page() {
  return <PortalPage view="popup" />
}

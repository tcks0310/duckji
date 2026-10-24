import type { Metadata } from "next"
import { PortalPage } from "@/components/portal/portal-page"

export const metadata: Metadata = { title: "팝업 캘린더" }

export default function Page() {
  return <PortalPage view="popup-calendar" />
}

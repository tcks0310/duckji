import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "위치기반서비스 이용약관 | DUCKJI" }

export default function LocationTermsPage() {
  return <LegalPage doc="location" />
}

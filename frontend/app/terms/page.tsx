import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "서비스 이용약관 | DUCKJI" }

export default function TermsPage() {
  return <LegalPage doc="terms" />
}

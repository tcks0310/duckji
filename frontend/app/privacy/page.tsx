import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "개인정보처리방침 | DUCKJI" }

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />
}

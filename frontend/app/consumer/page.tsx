import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "전자상거래 소비자보호안내 | DUCKJI" }

export default function ConsumerPage() {
  return <LegalPage doc="consumer" />
}

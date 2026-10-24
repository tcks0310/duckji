import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "청약철회(환불)·분쟁해결기준 | DUCKJI" }

export default function RefundPage() {
  return <LegalPage doc="refund" />
}

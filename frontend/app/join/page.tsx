import type { Metadata } from "next"
import { JoinTypePicker } from "@/components/auth/join-type-picker"

export const metadata: Metadata = { title: "회원가입" }

export default function JoinPage() {
  return <JoinTypePicker />
}

import type { Metadata } from "next"
import { EmailSignup } from "@/components/auth/email-signup"

export const metadata: Metadata = { title: "회원가입" }

export default function KoreanSignupPage() {
  return <EmailSignup />
}

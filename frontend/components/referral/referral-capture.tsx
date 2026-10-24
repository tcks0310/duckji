"use client"

import { useEffect } from "react"
import { rememberReferralFromUrl } from "@/lib/referral"

// 추천 링크(?invite=DJXXXXXX)로 들어오면 가입할 때 쓰려고 추천인 ID 를 기억해 둠. 화면에는 아무것도 안 그림
export function ReferralCapture() {
  useEffect(() => {
    rememberReferralFromUrl()
  }, [])
  return null
}

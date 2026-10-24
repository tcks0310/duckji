"use client"

import { useEffect } from "react"

// 예전 파티 캘린더 주소 (/funding/party). 2026-10-16 부터 펀딩 메인(/funding)의 파티 캘린더로 합쳐서 그쪽으로 보냄
// 예전 페이지 코드는 archive/frontend/app/funding/party/page.tsx
export default function PartyCalendarRedirect() {
  useEffect(() => {
    window.location.replace("/funding/#party")
  }, [])
  return null
}

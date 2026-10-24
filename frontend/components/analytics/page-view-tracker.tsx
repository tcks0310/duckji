"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { trackPageview } from "@/lib/analytics"

// 모든 화면 공통: 페이지를 열거나 사이트 안에서 이동할 때 방문 통계에 기록 (관리자 화면 제외)
export function PageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    trackPageview()
  }, [pathname])
  return null
}

"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

// 관리자 센터(/admin)에서는 배경음악·골드 테두리·마우스 효과·베타 배지 같은 사이트 장식을 띄우지 않음
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/admin")) return null
  return <>{children}</>
}

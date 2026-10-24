"use client"

import { useEffect, useState, type ReactNode } from "react"
import { detectApp } from "@/lib/app-mode"

// 덕지 앱(웹뷰)에서는 그리지 않음 (배경 음악·마우스 효과 등). 웹은 그대로
export function HideInApp({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false)
  useEffect(() => setShow(!detectApp()), [])
  return show ? <>{children}</> : null
}

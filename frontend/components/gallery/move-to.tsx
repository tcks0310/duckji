"use client"

import * as React from "react"
import { useEffect } from "react"

// 정적 사이트라 화면에서 다른 주소로 넘김 (/community → 덕지 갤러리)
export function MoveTo({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-sm text-zinc-500">
      <a href={to} className="underline underline-offset-2">
        덕지 갤러리로 이동하는 중...
      </a>
    </div>
  )
}

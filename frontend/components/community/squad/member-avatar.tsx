"use client"

import * as React from "react"

// 회원 프로필 사진 (없으면 이름 첫 글자)
export function MemberAvatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="rounded-full object-cover border border-zinc-700 shrink-0" />
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(12, Math.round(size * 0.4)) }}
      className="rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold inline-flex items-center justify-center shrink-0"
      aria-hidden
    >
      {(name || "?").trim().slice(0, 1)}
    </span>
  )
}

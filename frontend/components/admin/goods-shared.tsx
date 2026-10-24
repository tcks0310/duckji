"use client"

import * as React from "react"

// 굿즈샵 관리 탭들이 같이 쓰는 입력칸 스타일·오류 문구·날짜 표시·아이콘 버튼

export const adminInput =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
export const loginOr = (r: { status: string; error?: string }) => (r.status === "error" ? r.error || "처리하지 못했습니다." : "관리자 로그인이 필요합니다.")

export function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent ${danger ? "hover:text-red-400" : "hover:text-white"}`}
    >
      {children}
    </button>
  )
}

// YYYY.MM.DD HH:mm (한국 시간)
export function fmtDateTime(s: string) {
  const d = new Date(new Date(s).getTime() + 9 * 3600_000)
  if (Number.isNaN(d.getTime())) return s
  const iso = d.toISOString()
  return `${iso.slice(0, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)} ${iso.slice(11, 16)}`
}

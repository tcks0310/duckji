"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { NotificationList } from "@/components/notifications/notification-list"
import { useUnreadCount } from "@/lib/notifications"

// 상단 스피커 버튼 오른쪽 종 아이콘 (로그인한 뒤에만). 누르면 최근 알림, 아래 '전체 보기'는 알림 페이지(/notifications)
// 관리자 화면은 scope="admin" 으로 관리자 알림을 봄
export function NotificationBell({ scope = "member", onNavigate }: { scope?: "member" | "admin"; onNavigate?: (link: string) => boolean }) {
  const unread = useUnreadCount(scope)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const label = unread > 0 ? `알림 ${unread}개 안 읽음` : "알림"
  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors hover:bg-zinc-800/60 ${
          open ? "text-white bg-zinc-800/60" : "text-zinc-300 hover:text-white"
        }`}
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 text-[9px] font-bold leading-[15px] text-white text-center tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-4 sm:right-0 top-16 sm:top-10 z-[60] w-[calc(100vw-2rem)] sm:w-[360px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden">
          <NotificationList
            scope={scope}
            compact
            onNavigate={(link) => {
              setOpen(false)
              return onNavigate ? onNavigate(link) : false
            }}
          />
          {scope === "member" && (
            <Link
              href="/notifications/"
              onClick={() => setOpen(false)}
              className="block border-t border-zinc-800 py-3 text-center text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/[0.03]"
            >
              전체 보기
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { User, Edit3, LogOut, Settings, Heart, Ticket, Zap, ChevronDown } from "lucide-react"
import { UserProfile } from "@/components/auth/types"
import { useIsAdmin } from "@/lib/admin-access"
import { useMemberPoints } from "@/lib/member-points"
import { logoutMember } from "@/lib/member-auth"

export type AuthTab = "login" | "signup"

interface HeaderAuthProps {
  // undefined 면(홈이 아닌 화면) 저장된 로그인 정보를 직접 읽음
  currentUser?: UserProfile | null
  onOpenLogin?: (tab?: AuthTab) => void
  onLogout?: () => void
  likedCount?: number
}

// 상단 오른쪽 로그인·회원가입 버튼 (예전 오른쪽 위 떠 있던 로그인 배너를 대신함)
// 비로그인: 로그인 / 회원가입 버튼, 회원가입에 마우스를 올리면 신규 가입 혜택 안내
// 로그인: 이름·포인트 버튼, 누르면 내 메뉴 (마우스만 올려서는 안 열림) (마이페이지·예약·찜은 각 페이지로 이동)
export function HeaderAuth({
  currentUser,
  onLogout,
  likedCount = 0,
}: HeaderAuthProps) {
  const [storedUser, setStoredUser] = useState<UserProfile | null>(null)
  const [isPerksOpen, setIsPerksOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentUser !== undefined) return
    try {
      const saved = localStorage.getItem("dukji_user")
      if (saved) setStoredUser(JSON.parse(saved))
    } catch (e) {
      console.error(e)
    }
  }, [currentUser])

  const user = currentUser === undefined ? storedUser : currentUser
  // 덕지 포인트·관리자 버튼: 로그인한 회원만 서버 기준으로 표시
  const userPoints = useMemberPoints().balance ?? 0
  const isAdmin = useIsAdmin(user?.id)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
        setIsPerksOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false)
        setIsPerksOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // 로그인은 /login, 회원가입은 /join(내국인·외국인 선택) 페이지로 이동

  const handleLogout = async () => {
    setIsMenuOpen(false)
    if (onLogout) {
      onLogout()
      return
    }
    try {
      await logoutMember()
    } catch (e) {
      console.error(e)
    }
    try {
      localStorage.removeItem("dukji_user")
    } catch (e) {
      console.error(e)
    }
    setStoredUser(null)
    window.location.reload()
  }

  if (!user) {
    return (
      <div ref={rootRef} className="flex items-center gap-1 shrink-0">
        <a
          href="/login"
          onClick={() => setIsPerksOpen(false)}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors whitespace-nowrap"
        >
          <User className="w-3.5 h-3.5 sm:hidden" />
          <span>로그인</span>
        </a>

        <div
          className="relative hidden sm:block"
          onMouseEnter={() => setIsPerksOpen(true)}
          onMouseLeave={() => setIsPerksOpen(false)}
        >
          <a
            href="/join/"
            onClick={() => setIsPerksOpen(false)}
            onFocus={() => setIsPerksOpen(true)}
            onBlur={() => setIsPerksOpen(false)}
            aria-describedby="signup-perks"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-black text-white bg-red-600 hover:bg-red-500 transition-colors whitespace-nowrap"
          >
            <span>회원가입</span>
          </a>

          {/* 신규 가입 혜택 (hover·키보드 포커스 시) */}
          <AnimatePresence>
            {isPerksOpen && (
              <motion.div
                id="signup-perks"
                role="tooltip"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute top-full right-0 pt-2 z-50 w-[260px]"
              >
                <div className="bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-2xl p-3 shadow-xl space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-white">신규 가입 이벤트</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <span>신규 가입 즉시 350 DP 증정</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-snug">
                      카카오·네이버로 3초 만에 시작하고 팝업 사전예약 &amp; MBTI 무료 분석을 즐겨보세요.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] text-center font-bold text-zinc-300">
                    <div className="p-1 rounded-lg bg-zinc-900 border border-zinc-800">+350 DP</div>
                    <div className="p-1 rounded-lg bg-zinc-900 border border-zinc-800">사전예약</div>
                    <div className="p-1 rounded-lg bg-zinc-900 border border-zinc-800">무료 MBTI</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  const menuItem =
    "w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors"

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
    >
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label="내 정보"
        className="flex items-center gap-1.5 h-8 p-0.5 xl:pl-1 xl:pr-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 text-xs font-bold text-white transition-colors"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black">
            {user.name?.[0]}
          </div>
        )}
        {/* 좁은 화면(사이드탭을 쓰는 폭)에서는 프로필 사진만 */}
        <span className="hidden xl:inline max-w-[80px] truncate">{user.name}</span>
        <span className="hidden xl:inline text-emerald-400 font-black">{userPoints}P</span>
        <ChevronDown className={`hidden xl:block w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute top-full right-0 pt-2 z-50 w-60"
          >
            <div className="bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/90 rounded-2xl p-2 shadow-2xl shadow-black/90 ring-1 ring-white/10 space-y-1">
              <div className="px-2 pt-1 pb-2 border-b border-zinc-900">
                <div className="font-extrabold text-xs text-white truncate">{user.name}</div>
                <div className="text-[10px] text-zinc-400 truncate">{user.email}</div>
              </div>

              <div className="p-2 rounded-xl bg-zinc-900 border border-emerald-500/30 flex items-center justify-between">
                <a href="/mypage/?tab=points" className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 fill-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-400 font-bold uppercase">보유 덕지포인트</div>
                    <div className="text-xs font-black text-emerald-400">{userPoints} DP</div>
                  </div>
                </a>
              </div>

              <a role="menuitem" href="/mypage/" className={menuItem}>
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>마이페이지</span>
              </a>
              <a role="menuitem" href="/mypage/?tab=tickets" className={menuItem}>
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                <span>예약·웨이팅</span>
              </a>
              <a role="menuitem" href="/mypage/liked/" className={menuItem}>
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>찜한 항목 ({likedCount})</span>
              </a>
              {isAdmin && (
                <a role="menuitem" href="/admin" className={`app-hide ${menuItem} text-red-400 hover:text-red-300`}>
                  <Settings className="w-3.5 h-3.5 text-red-400" />
                  <span>관리자 센터</span>
                </a>
              )}
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Calendar, 
  MapPin, 
  Heart, 
  Bell, 
  Menu, 
  X, 
  Compass, 
  Flame, 
  User, 
  LogOut, 
  Edit3, 
  Settings, 
  Crown, 
  Ticket, 
  Zap, 

  ChevronDown,
  Store,
  Palette,
  ArrowRight,
  Camera,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserProfile } from "@/components/auth/types"
import { LanguageSelector } from "@/components/ui/language-selector"
import { EffectsToggle } from "@/components/effects/effects-toggle"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { HeaderAuth, AuthTab } from "@/components/auth/header-auth"
import { HeaderSearch } from "@/components/search/header-search"
import { useIsAdmin } from "@/lib/admin-access"
import { useMemberPoints } from "@/lib/member-points"
import { logoutMember } from "@/lib/member-auth"
import { useSavedItems } from "@/lib/saved-items"
import { BrandTagline } from "@/components/ui/brand-tagline"
import { SITE_MENU, PARTNER_MENU, MENU_TONES, MenuAction, MenuGroup, MenuItem } from "@/lib/site-menu"

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  // 찜·장바구니 수는 회원 저장 목록(lib/saved-items)에서 직접 읽음. 하트는 찜 페이지, 가방은 장바구니 페이지로 이동
  cartCount?: number
  onOpenCart?: () => void
  likedCount?: number
  onOpenLiked?: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  onOpenLogin?: (tab?: AuthTab) => void
  currentUser?: UserProfile | null
  onLogout?: () => void
  onOpenProfile?: () => void // 사용하지 않음: 마이페이지는 /mypage 페이지로 이동
  onOpenMyTickets?: () => void // 사용하지 않음: 예약·웨이팅은 마이페이지에서
  onOpenSquadInvite?: () => void
  userPoints?: number | null // 사용하지 않음: 잔액은 서버(lib/member-points)에서 직접 읽음
}

export function Navbar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenLogin,
  currentUser,
  onLogout,
  onOpenSquadInvite,
}: NavbarProps) {
  // 덕지 포인트: 로그인한 회원만 서버 잔액을 표시 (비로그인 영역에서는 쓰지 않음)
  const userPoints = useMemberPoints().balance ?? 0
  const saved = useSavedItems()
  const likedCount = saved.likes.popup.length + saved.likes.goods.length + saved.likes.course.length
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  // 관리자 메뉴는 서버가 관리자 세션을 확인한 경우에만 표시
  // 홈이 아닌 화면은 currentUser 를 넘기지 않으므로 저장된 로그인 정보를 직접 읽음 (사이드탭 맨 아래 카드용)
  const [storedUser, setStoredUser] = useState<UserProfile | null>(null)
  useEffect(() => {
    if (currentUser !== undefined) return
    try {
      const saved = localStorage.getItem("dukji_user")
      if (saved) setStoredUser(JSON.parse(saved))
    } catch (e) {
      console.error(e)
    }
  }, [currentUser])
  const sidebarUser = currentUser === undefined ? storedUser : currentUser
  const handleSidebarLogout = async () => {
    if (onLogout) {
      onLogout()
      return
    }
    try {
      await logoutMember()
      localStorage.removeItem("dukji_user")
    } catch (e) {
      console.error(e)
    }
    setStoredUser(null)
    window.location.reload()
  }
  const isAdmin = useIsAdmin(sidebarUser?.id)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  
  // Desktop Dropdown State
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Mobile Accordion State
  const [mobileExpanded, setMobileExpanded] = useState<{ [key: string]: boolean }>({})
  // 사이드 탭: 마우스를 올린(또는 키보드로 들어간) 대분류만 소분류를 펼친다. 터치는 화살표로 펼치기.
  const [hoverGroup, setHoverGroup] = useState<string | null>(null)

  const navbarRef = React.useRef<HTMLElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null)
      }
    }
    window.addEventListener("scroll", handleScroll)
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("scroll", handleScroll)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 사이드바가 열려 있는 동안 뒤 화면 스크롤 잠금, Esc 로 닫기
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isMobileMenuOpen])

  const toggleMobileAccordion = (id: string) => {
    // 한 번에 대분류 하나만 펼침 (여러 개를 펼치면 사이드탭이 너무 길어짐)
    setMobileExpanded((prev) => (prev[id] ? {} : { [id]: true }))
  }

  const handleNavClick = (id: string) => {
    setActiveTab(id)
    setActiveDropdown(null)
    setIsMobileMenuOpen(false)
    const targetElement = document.getElementById(
      id === "calendar" ? "section-calendar" :
      id === "shop" ? "section-shop" : "section-events"
    )
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  // 소분류 누름: 홈 팝업창(action) → 같은 페이지 섹션 스크롤 → 페이지 이동(href) 순서
  const actionHandlers: Record<MenuAction, (() => void) | undefined> = {
    squad: onOpenSquadInvite,
  }

  const runMenuItem = (item: MenuItem, e?: React.MouseEvent) => {
    const handler = item.action ? actionHandlers[item.action] : undefined
    if (handler) {
      e?.preventDefault()
      setActiveDropdown(null)
      setIsMobileMenuOpen(false)
      handler()
      return
    }
    // 지금 보고 있는 페이지 안의 섹션이면 이동 없이 스크롤
    const [path, hash] = item.href.split("#")
    const target = hash && typeof window !== "undefined" ? document.getElementById(hash) : null
    if (target && (path === "" || path === window.location.pathname)) {
      e?.preventDefault()
      if (item.homeTab) setActiveTab(item.homeTab)
      setActiveDropdown(null)
      setIsMobileMenuOpen(false)
      target.scrollIntoView({ behavior: "smooth" })
      return
    }
    setActiveDropdown(null)
    setIsMobileMenuOpen(false)
  }

  const isItemActive = (item: MenuItem) => Boolean(item.homeTab && activeTab === item.homeTab)
  // 지금 보고 있는 주소가 대분류 페이지나 그 소분류 페이지면 그 대분류에 표시
  const [currentPath, setCurrentPath] = useState("")
  // 홈(/)과 검색 결과 페이지(/search)는 화면 안에 검색창이 있어 상단 검색창을 숨김
  const showHeaderSearch = currentPath !== "" && currentPath !== "/" && !/^\/search(\/|$)/.test(currentPath)
  useEffect(() => setCurrentPath(window.location.pathname), [])
  const isGroupActive = (group: MenuGroup) =>
    Boolean(currentPath) &&
    (currentPath.startsWith(group.href.replace(/\/?$/, "/")) ||
      group.items.some((item) => !item.action && item.href.split(/[?#]/)[0].replace(/\/?$/, "/") === currentPath))

  // 대분류 버튼 모양: 펀딩·운세·놀이는 기존 강조색, 나머지는 기본 모양
  const groupButtonClass = (group: MenuGroup, open: boolean) => {
    const active = open || isGroupActive(group)
    return `relative inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-bold leading-none whitespace-nowrap transition-colors ${
      active ? "text-white bg-zinc-800/80" : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
    }`
  }

  // 앱·휴대폰 브라우저에서는 홈에서만 상단 줄(로고·알림)을 보이고, 다른 화면은 하단 탭이 대신함 (대분류 메뉴는 마이 탭 안으로)
  const onHome = usePathname() === "/"

  return (
    <header
      ref={navbarRef}
      className={`${onHome ? "" : "phone-hide "}fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[#4a0b14]/95 backdrop-blur-xl border-b border-amber-400/30 shadow-2xl shadow-black/40 py-2 sm:py-2.5"
          : "bg-[#5a0f1c]/90 backdrop-blur-md border-b border-amber-400/20 py-2.5 sm:py-3"
      }`}
    >
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Official DUKJI Brand Logo (Gold) */}
        <div 
          onClick={() => {
            // 홈이 아닌 화면(펀딩·갤러리·몰 등)에서는 홈으로 이동
            if (window.location.pathname !== "/") {
              window.location.href = "/"
              return
            }
            setActiveTab("all")
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
          className="flex items-center gap-2.5 cursor-pointer group select-none py-0.5 flex-shrink-0"
        >
          <div className="relative flex items-center transition-all duration-300">
            {/* 로고 그림 바로 아래 가운데에 '덕후들의 성지' */}
            <div className="inline-flex flex-col items-stretch">
              <img
                src="/images/logo-gold.png"
                alt="덕후들의 성지 덕지 (DUCKJI)"
                className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto object-contain drop-shadow-[0_2px_12px_rgba(250,213,144,0.45)] transition-transform duration-200 group-hover:scale-105"
              />
              <BrandTagline className="-mt-0.5 text-[8px] sm:text-[9px]" />
            </div>
          </div>
        </div>

        {/* 상단 메뉴: 대분류에 마우스를 올리거나 누르면 소분류 (메뉴 목록은 lib/site-menu.ts) */}
        <nav aria-label="주요 메뉴" className="hidden xl:flex items-center gap-1 shrink-0">
          {SITE_MENU.map((group) => {
            const tone = MENU_TONES[group.tone]
            const open = activeDropdown === group.id
            return (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setActiveDropdown(group.id)}
                onMouseLeave={() => setActiveDropdown((prev) => (prev === group.id ? null : prev))}
              >
                <a
                  href={group.href}
                  onFocus={() => setActiveDropdown(group.id)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  className={groupButtonClass(group, open)}
                >
                  <span className="tracking-tight">{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </a>

                <AnimatePresence>
                  {open && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="absolute top-full left-0 pt-2 z-50 w-72"
                    >
                      {/* 포털 사이트식 하위 메뉴: 대분류 왼쪽 끝에서 바로 아래로 열림. 테두리 상자 대신 어두운 판 + 위쪽 대분류 색 줄 (마우스를 올리면 왼쪽에 색 막대) */}
                      <div className="overflow-hidden rounded-b-lg bg-[#0e0b0c]/[0.97] backdrop-blur-xl shadow-2xl shadow-black/70">
                      <span aria-hidden className={`block h-[2px] bg-current ${tone.active}`} />
                      <ul className="p-1.5 max-h-[460px] overflow-y-auto">
                        {group.items.map((item) => {
                          const active = isItemActive(item)
                          return (
                            <li key={item.id}>
                              <a
                                role="menuitem"
                                href={item.href}
                                onClick={(e) => runMenuItem(item, e)}
                                aria-current={active ? "page" : undefined}
                                className={`group/item relative block pl-4 pr-3 py-2.5 rounded-lg transition-colors ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.05]"}`}
                              >
                                <span
                                  aria-hidden
                                  className={`absolute left-1 top-2.5 bottom-2.5 w-[3px] rounded-full bg-current ${tone.active} transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"}`}
                                />
                                <span className={`flex items-center gap-1.5 text-[14px] font-semibold tracking-tight leading-snug ${active ? tone.active : "text-zinc-50"}`}>
                                  {item.label}
                                  {item.badge && (
                                    <span className={`px-1.5 py-px rounded text-[10px] font-bold leading-tight ${tone.badge.replace(/\s?border-\S+/g, "")}`}>{item.badge.replace(/^★/, "")}</span>
                                  )}
                                </span>
                                <span className="block mt-0.5 text-[12px] leading-snug text-zinc-400 group-hover/item:text-zinc-300 break-keep">{item.desc}</span>
                              </a>
                              {/* 소분류 아래 단계 (예: 덕지덕순 물상 카드 › 4성향 분석) */}
                              {item.children && (
                                <ul className="ml-4 mb-1 pl-3 border-l border-white/10">
                                  {item.children.map((sub) => (
                                    <li key={sub.id}>
                                      <a
                                        role="menuitem"
                                        href={sub.href}
                                        className="block px-2.5 py-1.5 rounded-md text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                                      >
                                        {sub.label}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        {/* Right Actions (Language, Search, Wishlist, Cart & Mobile Toggle) */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 z-20">
          {/* 세계관: 대분류 메뉴와 섞이지 않게 오른쪽 묶음 맨 앞에 (사이드탭을 쓰는 폭에서는 사이드탭 로고 옆) */}
          <a
            href="/about"
            className={`hidden xl:inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-bold leading-none whitespace-nowrap transition-colors ${
              currentPath === "/about"
                ? "text-red-300 bg-red-500/15 border-red-500/40"
                : "text-amber-200 border-amber-400/30 hover:text-white hover:border-amber-300/60 hover:bg-zinc-800/60"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            세계관
          </a>
          {/* Multi-Language Translation Selector (EN, JA, ZH, KO) */}
          {/* 휴대폰 폭에서는 사이드탭 안의 언어 선택을 씀 (상단 공간 부족) */}
          <div className="hidden sm:block app-hide">
            <LanguageSelector />
          </div>

          {/* 노래·마우스 포인터 켜고 끄기 (앱에서는 노래·마우스 효과가 없어 숨김) */}
          <div className="app-hide">
            <EffectsToggle />
          </div>

          {/* 알림 (로그인한 뒤에만) */}
          {sidebarUser && <NotificationBell />}

          {/* 검색창: 누르면 불이 들어오고 아래로 인기 검색어. 휴대폰 폭에서는 사이드탭 맨 위에 있음
              홈에서는 가운데 큰 통합 검색창 하나만 씀 */}
          {showHeaderSearch && (
            <div className="hidden md:block">
              <HeaderSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
          )}

          {/* 찜한 항목은 로그인하면 내 정보 메뉴 안에 있음 (로그아웃 상태에서는 보이지 않음) */}

          {/* 장바구니·찜은 굿즈샵 안의 탭 줄 오른쪽에 있음 (components/shop/goods-shop-header.tsx) */}

          {/* 로그인 / 회원가입 (회원가입 hover 시 신규 가입 혜택), 로그인 후엔 내 메뉴 */}
          {/* 사이드탭을 쓰는 폭(1280px 미만): 로그인 전 버튼은 사이드탭 맨 아래에 있어 숨기고, 로그인 후엔 프로필 사진 버튼만 */}
          {/* 앱에서는 하단 '마이' 탭이 대신해서 숨김 */}
          <div className={`app-hide phone-hide ${sidebarUser ? "block" : "hidden xl:block"}`}>
          <HeaderAuth
            currentUser={currentUser}
            onOpenLogin={onOpenLogin}
            onLogout={onLogout}
            likedCount={likedCount}
          />
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="iconSm"
            className="xl:hidden phone-hide rounded-full text-zinc-300 ml-1 shrink-0 hover:bg-zinc-800/60"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Sidebar with Expandable Accordions
          헤더가 스크롤 시 backdrop-blur 로 fixed 기준이 바뀌므로 body 에 포털로 띄움 */}
      {isMounted && createPortal(
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="xl:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
        )}
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="전체 메뉴"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="xl:hidden fixed top-0 right-0 bottom-0 z-[61] w-[85vw] max-w-sm flex flex-col [&>*]:shrink-0 bg-[#520e1a]/98 border-l border-amber-500/30 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] space-y-3 backdrop-blur-2xl overflow-y-auto overscroll-contain shadow-2xl shadow-black/60"
          >
            {/* 맨 위: 덕지 로고 (Gold) + 닫기 */}
            <div className="flex items-center justify-between pb-1">
              <a href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-1.5 shrink-0">
                <img
                  src="/images/logo-gold.png"
                  alt="덕후들의 성지 덕지 (DUCKJI)"
                  className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_2px_10px_rgba(250,213,144,0.35)]"
                />
              </a>
              {/* 언어 선택: 로고 옆 (휴대폰 상단에는 자리가 없음) */}
              <div className="ml-auto mr-1.5 sm:hidden">
                <LanguageSelector />
              </div>
              {/* 세계관: 머리줄 오른쪽 끝 (닫기 버튼 옆) */}
              <a
                href="/about"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`sm:ml-auto mr-1 shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11px] font-bold whitespace-nowrap transition-colors ${
                  currentPath === "/about"
                    ? "text-red-300 bg-red-500/15 border-red-500/40"
                    : "text-amber-200 border-amber-400/30 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <Sparkles className="w-3 h-3 hidden min-[400px]:block" />
                세계관
              </a>
              <Button
                variant="ghost"
                size="iconSm"
                className="rounded-full text-zinc-300 hover:bg-zinc-800/60"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* 휴대폰 폭: 상단에 검색창 자리가 없어 사이드탭 맨 위에 둠 */}
            {showHeaderSearch && (
              <div className="md:hidden">
                <HeaderSearch value={searchQuery} onChange={setSearchQuery} variant="panel" onDone={() => setIsMobileMenuOpen(false)} />
              </div>
            )}

            {/* 대분류·소분류 아코디언 (상단 메뉴와 같은 목록: lib/site-menu.ts) */}
            {SITE_MENU.map((group) => {
              const tone = MENU_TONES[group.tone]
              const GroupIcon = group.icon
              const expanded = Boolean(mobileExpanded[group.id]) || hoverGroup === group.id
              return (
                <div
                  key={group.id}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") setHoverGroup(group.id) }}
                  onPointerLeave={(e) => { if (e.pointerType === "mouse") setHoverGroup((g) => (g === group.id ? null : g)) }}
                  onFocus={() => setHoverGroup(group.id)}
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverGroup((g) => (g === group.id ? null : g)) }}
                >
                  {/* 대분류 이름을 누르면 대분류 페이지로. 마우스는 올리면 소분류가 펼쳐지고, 터치 화면은 오른쪽 화살표로 펼치기 */}
                  <div className="flex items-center">
                    <a
                      href={group.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex-1 flex items-center gap-2 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <GroupIcon className={`w-4 h-4 ${tone.icon}`} />
                      <span className="font-black text-sm text-white">{group.label}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleMobileAccordion(group.id)}
                      aria-expanded={expanded}
                      aria-label={`${group.label} 소분류 ${expanded ? "접기" : "펼치기"}`}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors [@media(hover:hover)]:hidden"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-[15px] pl-3 mb-1 border-l border-white/10 overflow-hidden"
                      >
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const active = isItemActive(item)
                          const isSpecial = Boolean(item.highlighted)
                          return (
                            <React.Fragment key={item.id}>
                            <a
                              href={item.href}
                              onClick={(e) => runMenuItem(item, e)}
                              aria-current={active ? "page" : undefined}
                              className={`relative flex items-start gap-2.5 py-2 pl-1 pr-2 text-sm transition-colors ${
                                active ? "text-emerald-300" : isSpecial ? "text-amber-200 hover:text-amber-100" : "text-zinc-200 hover:text-white"
                              }`}
                            >
                              {active && <span className="absolute -left-[13px] top-2 bottom-2 w-0.5 rounded-full bg-emerald-400" />}
                              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? "text-emerald-400" : isSpecial ? "text-amber-300" : "text-zinc-500"}`} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 font-semibold">
                                  {item.label}
                                  {item.badge && (
                                    <span className={`text-[9px] font-extrabold ${isSpecial ? "text-amber-300" : "text-emerald-400"}`}>{item.badge}</span>
                                  )}
                                </span>
                                <span className={`block text-[11px] leading-snug ${active ? "text-emerald-300/70" : isSpecial ? "text-amber-200/70" : "text-zinc-500"}`}>{item.desc}</span>
                              </span>
                            </a>
                            {item.children && (
                              <div className="ml-7 space-y-0.5 pb-1">
                                {item.children.map((sub) => (
                                  <a
                                    key={sub.id}
                                    href={sub.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center justify-between gap-2 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                                  >
                                    <span>{sub.label}</span>
                                    {sub.badge && <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full border ${tone.badge}`}>{sub.badge}</span>}
                                  </a>
                                ))}
                              </div>
                            )}
                            </React.Fragment>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            {/* 파트너(B2B): 입점·광고 신청, 제휴 문의 */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" />
                <span>파트너 (B2B)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3">
                {PARTNER_MENU.map((item) => {
                  const Icon = item.icon
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      onClick={(e) => runMenuItem(item, e)}
                      className="flex items-center gap-1.5 px-1 py-2 text-xs font-semibold text-zinc-300 hover:text-amber-200 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </a>
                  )
                })}
              </div>
            </div>

            {/* 관리자 센터: 파트너와 떼어 따로 (관리자 권한 회원만) */}
            {isAdmin && (
              <div className="app-hide pt-2 border-t border-red-500/30 space-y-1">
                <div className="flex items-center gap-1.5 px-1 text-[10px] font-black text-red-400 uppercase tracking-wider">
                  <Settings className="w-3.5 h-3.5" />
                  <span>관리자</span>
                </div>
                <a
                  href="/admin"
                  className="flex items-center gap-1.5 px-1 py-2 text-xs font-bold text-red-400 hover:text-red-300"
                >
                  <span>관리자 센터</span>
                </a>
              </div>
            )}

            <div className="!mt-auto pt-3">
            {/* 맨 아래: 로그인·회원가입 (로그인 후엔 내 정보 카드) */}
            {sidebarUser ? (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-2.5">
                  {sidebarUser.avatarUrl ? (
                    <img
                      src={sidebarUser.avatarUrl}
                      alt={sidebarUser.name}
                      className="w-10 h-10 rounded-xl object-cover border border-emerald-400/60 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black font-black flex items-center justify-center text-sm">
                      {sidebarUser.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{sidebarUser.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">{sidebarUser.email}</div>
                    <a href="/mypage/?tab=points" className="block text-[10px] font-bold text-emerald-400 mt-0.5 hover:underline">보유: {userPoints} DP</a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      window.location.href = "/mypage/"
                    }}
                    className="flex-1 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8 font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    마이페이지
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      handleSidebarLogout()
                    }}
                    className="text-xs text-red-400 hover:bg-red-500/10 h-8"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    로그아웃
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* 상단(넓은 화면)과 같은 로그인 / 회원가입 버튼 두 개 */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-2xl text-sm font-bold text-zinc-200 bg-zinc-900 border border-zinc-700 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>로그인</span>
                  </a>
                  <a
                    href="/join/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center h-11 rounded-2xl text-sm font-black text-white bg-red-600 hover:bg-red-500 transition-colors"
                  >
                    회원가입
                  </a>
                </div>
                {/* 화면이 터치라 hover 대신 가입 혜택을 한 줄로 */}
                <div className="text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1">
                  <span>신규 가입 즉시 350 DP 증정</span>
                </div>
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </header>
  )
}

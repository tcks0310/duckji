"use client"

import { logoutMember } from "@/lib/member-auth"
import { clearPoints, loadPoints, useMemberPoints } from "@/lib/member-points"
import { clearSavedItems, loadSavedItems, toggleLike, useSavedItems, type SaveResult } from "@/lib/saved-items"
import * as React from "react"
import { useState, useMemo, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  ArrowDown, 
  Bell, 
  SlidersHorizontal,
  Compass,
  Zap,
  Ticket,
  Users,
  QrCode,
  HelpCircle,
  ChevronRight
} from "lucide-react"

import { PopupEvent } from "@/data/popup-data"
import { fetchPastPopups, goToPopupDetail, popupDetailHref, usePopupList } from "@/lib/popup-service"

import { Navbar } from "@/components/navbar"
import { CategoryHeader, CategoryBreadcrumb } from "@/components/portal/category-tiles"
import { Footer } from "@/components/footer"
import { PopupCard } from "@/components/ui/popup-card"
import { EventFilter } from "@/components/events/event-filter"
import { PopupScheduleMap } from "@/components/events/popup-schedule-map"
import { AlertModal } from "@/components/events/alert-modal"
import type { UserProfile } from "@/components/auth/types"
import { goToLogin } from "@/lib/member-auth"
import { GroupFundingSection } from "@/components/community/group-funding-section"
import { Button } from "@/components/ui/button"

// Home Revamp Components
import { HomeShowcase } from "@/components/home/home-showcase"
import { IntegratedSearchBar } from "@/components/home/integrated-search-bar"
import { AD_APPLY_HREF, BottomAdSlot, WingAdSlot } from "@/components/home/home-ad-slot"
import { PopupHero } from "@/components/portal/popup-hero"

// 대분류 페이지(store·community·play)는 소분류 바로가기만, 소분류 페이지는 그 섹션 하나만 보여 줌
// 팝업 대분류(/popups/)는 바로가기 대신 '지금 뜨는 팝업' 목록을 바로 보여 줌
export type PortalHubView = "popup" | "store" | "community" | "play"
export type PortalSubView = "popup-calendar" | "store-goods" | "group-buy"
export type PortalView = "home" | PortalHubView | PortalSubView

// 소분류 페이지 → [대분류 id, 소분류 id] (lib/site-menu.ts)
const SUB_VIEW_MENU: Record<PortalSubView, [string, string]> = {
  "popup-calendar": ["popup", "calendar"],
  "store-goods": ["store", "goods"],
  "group-buy": ["funding", "group-buy"],
}
const HUB_VIEWS: PortalView[] = ["store", "community", "play"]

// 홈과 대분류 페이지(팝업·스토어·커뮤니티·운세·놀이)가 같이 쓰는 화면
// 찜·장바구니·로그인 같은 상태와 창은 공통이고, view 에 따라 보여 줄 섹션만 다름 (팝업 상세는 /popups/detail 페이지)
export function PortalPage({ view = "home" }: { view?: PortalView }) {
  // 팝업 목록 (서버 DB). 못 받으면 popupStatus 가 error — 예시 팝업으로 채우지 않음
  const { events: popupEvents, status: popupStatus } = usePopupList()
  // 팝업 일정·지도 달력은 종료 처리된 지난 팝업까지 함께 보여 줌 (지금 뜨는 팝업 목록에는 없음)
  const [pastPopups, setPastPopups] = useState<PopupEvent[]>([])
  useEffect(() => {
    if (view !== "popup-calendar") return
    fetchPastPopups()
      .then((r) => setPastPopups(r.popups))
      .catch(() => setPastPopups([]))
  }, [view])
  const calendarEvents = useMemo(() => {
    const ids = new Set(popupEvents.map((e) => e.id))
    return [...popupEvents, ...pastPopups.filter((e) => !ids.has(e.id))]
  }, [popupEvents, pastPopups])

  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedRegion, setSelectedRegion] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("popular")

  // Modal States
  const [alertEvent, setAlertEvent] = useState<PopupEvent | null>(null)

  // 예전 입점 신청 창 주소(/?open=b2b)는 입점·광고 신청 페이지로 보냄
  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get("open")
    // 3인 스쿼드·덕력 퀴즈는 소분류 페이지로 옮겨서 예전 /?open=... 링크는 열지 않음
    if (open === "b2b") window.location.replace(AD_APPLY_HREF)
    // 다른 화면의 상단 검색창에서 검색하면 /?q=검색어 로 와서 팝업 목록을 거름
    const q = new URLSearchParams(window.location.search).get("q")
    if (q) setSearchQuery(q)
  }, [])

  // 덕지 포인트(DP): 로그인한 회원만, 서버 원장 기준 (lib/member-points). 비로그인이면 null
  const userPoints = useMemberPoints().balance

  // User Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("dukji_user")
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // 예전 팝업 바로가기 /?popup=<id>(&ref=qr) 는 팝업 상세 페이지로 옮김 (현장 QR 유입 기록은 상세 페이지에서)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const popupId = params.get("popup")
    if (!popupId) return
    window.location.replace(`${popupDetailHref(popupId)}${params.get("ref") === "qr" ? "&ref=qr" : ""}`)
  }, [])

  const handleLogout = () => {
    try {
      logoutMember()
      localStorage.removeItem("dukji_user")
      setCurrentUser(null)
      clearSavedItems()
      clearPoints()
    } catch (e) {
      console.error(e)
    }
  }

  // 찜·장바구니: 로그인한 회원 계정에 저장 (lib/saved-items). 비로그인이면 로그인 창을 엶
  const saved = useSavedItems()
  const likedIds = saved.likes.popup

  const handleSaveResult = (result: SaveResult) => {
    if (result === "login") goToLogin()
    else if (result === "error") window.alert("저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
    return result === "ok"
  }

  // Like Toggle Handler
  const handleToggleLike = async (eventId: string) => handleSaveResult(await toggleLike("popup", eventId))


  // Filtered Events
  const filteredEvents = useMemo(() => {
    return popupEvents.filter((ev) => {
      // 끝난 팝업은 목록에서 빼고 팝업 일정·지도 달력에서만 보여 줌
      if (ev.status === "ended") return false
      // Category filter
      if (selectedCategory !== "all" && ev.category !== selectedCategory) return false
      // Region filter
      if (selectedRegion !== "all" && !ev.location.includes(selectedRegion)) return false
      // Status filter
      if (selectedStatus !== "all" && ev.status !== selectedStatus) return false
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTitle = ev.title.toLowerCase().includes(query)
        const matchSubtitle = ev.subTitle.toLowerCase().includes(query)
        const matchLocation = ev.location.toLowerCase().includes(query)
        const matchVenue = ev.venueName.toLowerCase().includes(query)
        if (!matchTitle && !matchSubtitle && !matchLocation && !matchVenue) return false
      }
      return true
    }).sort((a, b) => {
      if (sortBy === "popular") return b.likeCount - a.likeCount
      if (sortBy === "latest") return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      if (sortBy === "closing") return a.dDay - b.dDay
      return 0
    })
  }, [popupEvents, selectedCategory, selectedRegion, selectedStatus, searchQuery, sortBy])

  // 섹션이 다른 대분류 페이지로 옮겨졌으면 그 페이지로 이동
  const SECTION_PAGES: Record<string, string> = {
    "section-events": "/popups/",
    "section-calendar": "/popups/calendar/",
    "section-map": "/popups/calendar/",
    "section-shop": "/store/goods/",
    "section-funding": "/funding/",
  }
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth" })
    else if (SECTION_PAGES[id]) window.location.href = `${SECTION_PAGES[id]}#${id}`
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col selection:bg-amber-400 selection:text-black">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
          if (tab === "anime") setSelectedCategory("anime")
          else if (tab === "all") setSelectedCategory("all")
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenLogin={(tab) => (tab === "signup" ? (window.location.href = "/join/") : goToLogin())}
        currentUser={currentUser}
        onLogout={handleLogout}
        userPoints={userPoints}
      />

      {view === "home" && (
      <>
      {/* 1. 상단 파노라마 와이드 레이아웃: 맨 위 통합검색 + 왼쪽 광고 + 가운데 큰 카드 + 오른쪽 광고 */}
      <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 pt-24 sm:pt-28 lg:pt-32 pb-8">
        {/* 맨 위 통합 검색창: 좌우 배너까지 이어지는 포털식 긴 검색창 */}
        <section id="section-search" className="relative z-40 w-full mb-4 lg:mb-5">
          <IntegratedSearchBar onSearch={(q) => setSearchQuery(q)} />
        </section>

        <div className="flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-5 xl:gap-6">
          {/* 왼쪽 광고 자리 (1024px 이상, 좁으면 가운데 배너 아래로). 광고는 관리자 센터 › 공지 팝업·광고 배너 */}
          <WingAdSlot slot="ad_left" className="hidden lg:block" />

          {/* 중앙: 확장형 메인 인터페이스 (Hero Carousel + 네이버/구글 스타일 통합검색 + 3D 러너) */}
          <div className="flex-1 min-w-0 w-full max-w-full xl:max-w-[1040px] 2xl:max-w-[1160px] flex flex-col items-center space-y-6">
            {/* 가운데 큰 카드 5화면: 오늘의 덕지(날짜별 팝업·이벤트) · 지금 팝업 · 덕지순례 · 갤러리 인기글 · SNS 핫클립 (왼쪽 아래 동그라미로 바꿔 봄) */}
            <section id="section-home-showcase" className="w-full">
              <HomeShowcase popups={popupEvents} />
            </section>

            {/* 좁은 화면(1024px 미만): 좌우 칸을 옆이 아니라 배너 아래 가로 두 칸으로 */}
            <section id="section-side-banners" className="lg:hidden w-full grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <WingAdSlot slot="ad_left" />
              <WingAdSlot slot="ad_right" />
            </section>
          </div>

          {/* 오른쪽 광고 자리 (예전 AI 길라잡이 칸, 빠른 질문은 검색창 'AI 대화' 안으로 옮김) */}
          <WingAdSlot slot="ad_right" className="hidden lg:block" />
        </div>
      </div>


      </>
      )}

      {/* Main Content Body */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 w-full ${view === "home" ? "space-y-20" : "space-y-10 pt-28 pb-12 app-nav-offset"}`}>
        {/* 대분류 페이지: 제목 + 소분류 바로가기 */}
        {HUB_VIEWS.includes(view) && (
          <CategoryHeader groupId={view} />
        )}

        {/* 팝업 대분류 = 지금 뜨는 팝업: 대분류 이름과 소분류(일정·지도, 덕지순례, TIF) 칩 */}
        {view === "popup" && <CategoryBreadcrumb groupId="popup" />}

        {/* 소분류 페이지: 대분류 › 소분류 위치와 같은 대분류의 다른 소분류 */}
        {view in SUB_VIEW_MENU && (
          <CategoryBreadcrumb
            groupId={SUB_VIEW_MENU[view as PortalSubView][0]}
            itemId={SUB_VIEW_MENU[view as PortalSubView][1]}
          />
        )}

        {/* 팝업 대분류 메인: 소개·숫자 + 곧 끝나요·곧 열려요 (펀딩 메인과 같은 구성) */}
        {view === "popup" && <PopupHero events={popupEvents} status={popupStatus} />}

        {view === "popup" && (
        <>
        {/* 3. Events Curation & Map Hover Showcase Section */}
        <section id="section-events" className="space-y-6 scroll-mt-28">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-t border-zinc-800 pt-10">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">지금 뜨는 팝업</h2>
              <p className="text-sm text-zinc-400">진행 중이거나 곧 열리는 팝업 {filteredEvents.length}개</p>
            </div>
            <a href={AD_APPLY_HREF} className="self-start sm:self-auto text-sm text-zinc-300 hover:text-white underline underline-offset-4">
              팝업 주최사라면 입점·광고 신청
            </a>
          </div>

          <EventFilter
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            sortBy={sortBy}
            setSortBy={setSortBy}
            totalCount={filteredEvents.length}
          />

          {popupStatus !== "ok" ? (
            // 서버에서 목록을 못 받으면 예시 팝업 대신 안내만
            <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-zinc-800 text-zinc-400 space-y-2">
              <p className="text-base font-semibold">
                {popupStatus === "loading" ? "팝업 목록을 불러오는 중입니다." : "팝업 목록을 불러오지 못했습니다."}
              </p>
              {popupStatus === "error" && <p className="text-sm text-zinc-500">잠시 후 다시 시도해주세요.</p>}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-zinc-800 text-zinc-500 space-y-3">
              <Compass className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-base font-semibold">조건에 맞는 팝업스토어가 없습니다.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all")
                  setSelectedRegion("all")
                  setSelectedStatus("all")
                  setSearchQuery("")
                }}
                className="rounded-xl"
              >
                필터 초기화
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEvents.map((event) => (
                <PopupCard
                  key={event.id}
                  event={event}
                  isLiked={likedIds.includes(event.id)}
                  onToggleLike={(e) => {
                    e.stopPropagation()
                    handleToggleLike(event.id)
                  }}
                  onSelect={() => goToPopupDetail(event.id)}
                  onOpenAlertModal={(e) => {
                    e.stopPropagation()
                    setAlertEvent(event)
                  }}
                />
              ))}
            </div>
          )}
        </section>
        </>
        )}

        {view === "popup-calendar" && <PopupScheduleMap events={calendarEvents} status={popupStatus} />}

        {view === "group-buy" && (
        <>
        {/* 4.5. 수요집중형 단독 공구 & 한정판 수입 펀딩 게이지 섹션 */}
        <GroupFundingSection />
        </>
        )}

        {/* 굿즈샵(store-goods)은 /store/goods 페이지가 직접 그림 (components/shop/goods-shop-*.tsx) */}

        {/* 홈 아래 광고 자리 (푸터 위) */}
        {view === "home" && <BottomAdSlot />}

      </main>

      {/* Footer */}
      <Footer />



      <AlertModal
        event={alertEvent}
        isOpen={Boolean(alertEvent)}
        onClose={() => setAlertEvent(null)}
        onRequireLogin={() => goToLogin()}
      />

    </div>
  )
}

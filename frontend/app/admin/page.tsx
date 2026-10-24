"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { 
  BarChart3,
  Gift,
  ClipboardList,
  ShoppingBag,
  TrendingUp, 
  Users, 
  Ticket, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Search, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Flame, 
  Sparkles, 
  ArrowLeft,
  ChevronRight,
  Filter,
  Eye,
  Bell,
  SlidersHorizontal,
  ExternalLink,
  Crown,
  AlertTriangle,
  MapPin,
  MessageSquare,
  CalendarDays,
  Megaphone,
  Send,
  Menu,
  X,
  LayoutDashboard,
  HelpCircle,
  PlayCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PopupManager } from "@/components/admin/popup-manager"
import { GalleryManager } from "@/components/admin/gallery-manager"
import { adminGallery } from "@/lib/community-api"
import { FundingManager } from "@/components/admin/funding-manager"
import { PartyEventManager } from "@/components/admin/party-event-manager"
import { B2bManager } from "@/components/admin/b2b-manager"
import { AdMessageManager } from "@/components/admin/ad-message-manager"
import { NotificationManager } from "@/components/admin/notification-manager"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { RewardsManager } from "@/components/admin/rewards-manager"
import { QuizManager } from "@/components/admin/quiz-manager"
import { HotClipManager } from "@/components/admin/hot-clip-manager"
import { PilgrimageManager } from "@/components/admin/pilgrimage-manager"
import { GoodsShopManager } from "@/components/admin/goods-shop-manager"
import { MallManager } from "@/components/admin/mall-manager"
import { MembersManager } from "@/components/admin/members-manager"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { SiteNoticeManager } from "@/components/admin/site-notice-manager"
import { OwnPopupBookingManager } from "@/components/admin/own-popup-booking-manager"
import { fundingService } from "@/lib/funding-service"
import type { FundingProject } from "@/types/funding"
import { userService, DukjiUser } from "@/lib/user-service"
import { apiFetch } from "@/lib/api"
import { fetchAdminSession, refreshAdminFromMember } from "@/lib/admin-access"
import { fetchB2bApplications } from "@/lib/b2b-service"

export default function AdminPage() {
  type AdminTab = "dashboard" | "members" | "popups" | "gallery" | "waiting" | "partners" | "funding" | "party" | "notices" | "rewards" | "quiz" | "pilgrimage" | "goodsShop" | "mall" | "adMessages" | "hotClips" | "notifications"
  const [activeTab, setActiveTabState] = useState<AdminTab>("dashboard")
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  // 스쿼드 관리에서 '회원 정보'를 누르면 회원 관리 탭에서 그 회원을 바로 엶
  const [memberFocus, setMemberFocus] = useState<string | null>(null)
  const setActiveTab = (tab: AdminTab) => {
    if (tab !== "members") setMemberFocus(null)
    setActiveTabState(tab)
    setIsAdminMenuOpen(false)
  }
  const [searchQuery, setSearchQuery] = useState("")
  // 관리자 알림 링크(/admin/?tab=goodsShop)와 주소의 ?tab= 로 바로 그 탭을 엶
  const ADMIN_TABS: AdminTab[] = ["dashboard", "members", "popups", "gallery", "waiting", "partners", "funding", "party", "notices", "rewards", "quiz", "pilgrimage", "goodsShop", "mall", "adMessages", "hotClips", "notifications"]
  const tabFromLink = (link: string) => {
    const m = /^\/admin\/?\?(?:.*&)?tab=([A-Za-z]+)/.exec(link)
    return m && (ADMIN_TABS as string[]).includes(m[1]) ? (m[1] as AdminTab) : null
  }
  const openAdminLink = (link: string) => {
    const tab = tabFromLink(link)
    if (!tab) return false
    setActiveTab(tab)
    return true
  }
  useEffect(() => {
    const tab = tabFromLink(window.location.pathname + window.location.search)
    if (tab) setActiveTabState(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminIdInput, setAdminIdInput] = useState("")
  const [adminPwInput, setAdminPwInput] = useState("")
  const [authError, setAuthError] = useState("")
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  // Central User Database Management State (100% Real Users)
  const [users, setUsers] = useState<DukjiUser[]>([])
  // 회원 DB 기준 숫자: 실 가입자 / 가입 미완료 / 탈퇴 / 탈퇴 포함 전체 이력
  const [memberStats, setMemberStats] = useState<{
    registered: number
    incomplete: number
    withdrawn: number
    sanctioned: number
    total: number
    today: number
    byMethod: Record<string, number>
  } | null>(null)

  const loadUserData = async () => {
    // 서버 회원 DB 기준
    setUsers(await userService.fetchServerUsers())

    try {
      const res = await apiFetch("/api/users/admin/member-stats", { cache: "no-store" })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success) setMemberStats(body.stats)
    } catch (e) {
      console.warn("Member stats warning:", e)
    }
  }

  // 관리자 세션은 서버(httpOnly 쿠키)에서 확인
  // 세션이 없으면 로그인한 회원의 역할(회원 DB role = admin)을 다시 확인해 관리자 세션을 받아 봄
  useEffect(() => {
    fetchAdminSession()
      .then((ok) => ok || refreshAdminFromMember())
      .then((ok) => {
        if (ok) {
          setIsAdminAuthenticated(true)
          loadUserData()
          loadFundingData()
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setIsAuthChecking(false))
  }, [])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    try {
      const res = await apiFetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminIdInput, password: adminPwInput }),
      })
      if (res.ok) {
        setIsAdminAuthenticated(true)
        setAdminPwInput("")
        loadUserData()
        loadFundingData()
      } else {
        setAuthError("관리자 아이디 또는 비밀번호가 올바르지 않습니다.")
      }
    } catch {
      setAuthError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  const handleAdminLogout = async () => {
    await apiFetch("/api/admin/session", { method: "DELETE" }).catch(() => {})
    setIsAdminAuthenticated(false)
    setAdminIdInput("")
    setAdminPwInput("")
  }

  // 대시보드 펀딩 숫자 (자세한 화면은 FundingManager)
  const [fundingProjects, setFundingProjects] = useState<FundingProject[]>([])
  const loadFundingData = async () => {
    try {
      const { projects } = await fundingService.adminList()
      setFundingProjects(projects)
    } catch {
      // 관리자 로그인 전에는 401
    }
  }

  useEffect(() => {
    loadFundingData()
    loadUserData()
  }, [])

  // 덕지 갤러리 오늘 숫자 (gallery 서비스). 탭 내용은 components/admin/gallery-manager.tsx
  const [gallerySummary, setGallerySummary] = useState<Awaited<ReturnType<typeof adminGallery.summary>> | null>(null)
  useEffect(() => {
    if (!isAdminAuthenticated) return
    adminGallery.summary().then(setGallerySummary).catch(() => {})
  }, [isAdminAuthenticated])

  // B2B 입점 신청 건수 (backend b2b 서비스, 탭 목록은 B2bManager)
  const [partnerCount, setPartnerCount] = useState(0)
  useEffect(() => {
    if (!isAdminAuthenticated) return
    fetchB2bApplications().then((r) => {
      if (r.success) setPartnerCount(r.total)
    })
  }, [isAdminAuthenticated])





  // 1. 관리자 보안 인증 게이트 (미인증 시 로그인 화면 렌더링)
  if (isAuthChecking) {
    return (
      <div className="admin-calm min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-xs font-bold">
        확인 중...
      </div>
    )
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="admin-calm min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="absolute top-6 left-6 z-20">
          <a
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>사이트로 돌아가기</span>
          </a>
        </div>

        <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 z-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-white">덕지 관리자 로그인</h2>
          </div>

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 font-bold mb-1">관리자 아이디</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={adminIdInput}
                  onChange={(e) => setAdminIdInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
                />
                <Users className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-bold mb-1">관리자 비밀번호</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPwInput}
                  onChange={(e) => setAdminPwInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
                />
                <ShieldCheck className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-sky-700 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl text-xs transition-all cursor-pointer"
            >
              로그인
            </Button>
          </form>

          {/* Helper Notice */}
          <div className="mt-6 pt-4 border-t border-zinc-800 text-center space-y-1 text-xs text-zinc-500">
            <div>관리자 권한이 있는 회원 계정으로 로그인하면 바로 들어올 수 있습니다.</div>
          </div>
        </div>
      </div>
    )
  }

  // 관리자 메뉴 (대분류·소분류). 사이트 메뉴(lib/site-menu.ts)와 같은 대분류 이름을 씀
  const adminMenu: { group: string; items: { id: AdminTab; label: string; icon: typeof Users; sample?: boolean }[] }[] = [
    {
      group: "",
      items: [{ id: "dashboard", label: "대시보드", icon: LayoutDashboard }],
    },
    {
      group: "회원",
      items: [
        { id: "members", label: `회원 (${memberStats ? memberStats.registered : users.length}명)`, icon: Users },
      ],
    },
    {
      group: "팝업",
      items: [
        { id: "popups", label: "팝업", icon: MapPin },
        { id: "waiting", label: "팝업 예약·웨이팅", icon: Ticket },
        { id: "pilgrimage", label: "덕지순례", icon: MapPin },
      ],
    },
    {
      group: "펀딩",
      items: [
        { id: "party", label: "이벤트 캘린더", icon: CalendarDays },
        { id: "funding", label: "펀딩", icon: Sparkles },
      ],
    },
    {
      group: "스토어",
      items: [
        { id: "goodsShop", label: "굿즈샵", icon: ShoppingBag },
        { id: "mall", label: "덕지몰", icon: ClipboardList },
      ],
    },
    {
      group: "커뮤니티",
      items: [
        { id: "gallery", label: "덕지 갤러리 (스쿼드 포함)", icon: MessageSquare },
      ],
    },
    {
      group: "컨텐츠",
      items: [
        { id: "quiz", label: "덕력 퀴즈", icon: HelpCircle },
        { id: "rewards", label: "보상 코드", icon: Gift },
        { id: "hotClips", label: "핫클립", icon: PlayCircle },
      ],
    },
    {
      group: "파트너 및 운영",
      items: [
        { id: "notices", label: "공지 팝업·광고 배너", icon: Megaphone },
        { id: "partners", label: `B2B 제휴 (${partnerCount})`, icon: Building2 },
        { id: "adMessages", label: "광고 메시지 보내기", icon: Send },
        { id: "notifications", label: "알림 관리", icon: Bell },
      ],
    },
  ]

  const AdminSideMenu = () => (
    <nav aria-label="관리자 메뉴" className="p-3 space-y-4 text-xs">
      {adminMenu.map((section) => (
        <div key={section.group} className="space-y-1">
          {section.group && <div className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{section.group}</div>}
          {section.items.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`w-full px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-left ${
                  active ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.sample && <span className="shrink-0 ml-auto"><SampleBadge /></span>}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )

  // 2. 인증 완료된 관리자 대시보드 렌더링
  return (
    <div className="admin-calm min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-sky-700 selection:text-white">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminMenuOpen(true)}
            aria-label="관리자 메뉴 열기"
            className="lg:hidden p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
          <a
            href="/"
            className="text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>사이트로</span>
          </a>

          <h1 className="border-l border-zinc-700 pl-3 font-semibold text-sm sm:text-base text-white">덕지 관리자</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* 관리자 알림 (새 주문·펀딩 신청·견적·신고 ...). 누르면 그 관리 탭으로 */}
          <NotificationBell scope="admin" onNavigate={openAdminLink} />
          <button
            onClick={handleAdminLogout}
            className="text-zinc-400 hover:text-white text-sm transition-colors cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <div className="flex-1 flex w-full">
        {/* 왼쪽 메뉴 (대분류·소분류). 좁은 화면에서는 상단 ≡ 버튼으로 엶 */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-zinc-800 bg-zinc-950">
          <div className="sticky top-[61px] max-h-[calc(100vh-61px)] overflow-y-auto">
            <AdminSideMenu />
          </div>
        </aside>

        {isAdminMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAdminMenuOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[80vw] max-w-xs bg-zinc-950 border-r border-zinc-800 overflow-y-auto overscroll-contain shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="font-semibold text-sm text-white">관리자 메뉴</span>
                <button onClick={() => setIsAdminMenuOpen(false)} aria-label="메뉴 닫기" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <AdminSideMenu />
            </div>
          </div>
        )}

      <main className="min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8 flex-1">
        {/* 대시보드: 운영 현황(누르면 해당 화면) + 방문 통계 */}
        {activeTab === "dashboard" && (
          <AdminDashboard
            stats={[
              {
                label: "가입 회원",
                value: `${(memberStats ? memberStats.registered : users.length).toLocaleString()}명`,
                detail: memberStats
                  ? `오늘 +${memberStats.today} · 카카오 ${memberStats.byMethod.kakao || 0} · 네이버 ${memberStats.byMethod.naver || 0} · 구글 ${memberStats.byMethod.google || 0} · 이메일 ${memberStats.byMethod.email || 0}`
                  : undefined,
                sub: memberStats
                  ? `탈퇴 ${memberStats.withdrawn} · 가입 미완료 ${memberStats.incomplete}${memberStats.sanctioned > 0 ? ` · 정지 ${memberStats.sanctioned}` : ""}`
                  : undefined,
                onClick: () => setActiveTab("members"),
              },
              {
                label: "오늘 덕지 갤러리 글",
                value: `${(gallerySummary?.todayPosts ?? 0).toLocaleString()}개`,
                detail: gallerySummary ? `댓글 ${gallerySummary.todayComments} · 신고 ${gallerySummary.openReports} · 개설 요청 ${gallerySummary.pendingRequests}` : undefined,
                onClick: () => setActiveTab("gallery"),
              },
              {
                label: "펀딩",
                value: `${fundingProjects.filter((p) => p.status === "live").length}개 진행 중`,
                detail: `견적 전 ${fundingProjects.filter((p) => p.status === "pending").length} · 오픈 준비 ${fundingProjects.filter((p) => p.status === "preparing").length}`,
                onClick: () => setActiveTab("funding"),
              },
              { label: "B2B 제휴 신청", value: `${partnerCount}건`, onClick: () => setActiveTab("partners") },
            ]}
          />
        )}

        {activeTab === "popups" && <PopupManager />}


        {activeTab === "gallery" && (
          <GalleryManager
            onOpenMember={(id) => {
              setMemberFocus(id)
              setActiveTab("members")
            }}
          />
        )}


        {activeTab === "party" && <PartyEventManager />}


        {activeTab === "rewards" && <RewardsManager />}

        {activeTab === "quiz" && <QuizManager />}

        {activeTab === "hotClips" && <HotClipManager />}

        {activeTab === "pilgrimage" && <PilgrimageManager />}

        {activeTab === "mall" && <MallManager />}

        {activeTab === "goodsShop" && (
          <GoodsShopManager
            onOpenMember={(id) => {
              setMemberFocus(id)
              setActiveTab("members")
            }}
          />
        )}

        {activeTab === "notices" && <SiteNoticeManager />}
        {activeTab === "adMessages" && <AdMessageManager />}
        {activeTab === "notifications" && <NotificationManager />}

        {activeTab === "members" && <MembersManager key={memberFocus || ""} focusMemberId={memberFocus} />}

        {/* 이달의 굿즈 투표 (서버 연결) */}

        {/* TAB 3: RESERVATIONS & LIVE WAITING QUEUE */}
        {activeTab === "waiting" && <OwnPopupBookingManager />}

        {/* TAB 4: B2B PARTNERS APPLICATION BOX */}
        {activeTab === "partners" && <B2bManager onCountChange={setPartnerCount} />}

        {activeTab === "funding" && <FundingManager />}


      </main>
      </div>

    </div>
  )
}

// 예시 데이터 표시: 서버 기능이 아직 없어 화면에 박힌 예시 숫자를 보여 주는 곳에 붙임.
// 실제 기능을 연결하면 그 화면의 SampleBadge·SampleNotice 를 지움.
function SampleBadge() {
  return (
    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/40">
      예시
    </span>
  )
}

function SampleNotice() {
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
      예시 데이터입니다. 아직 서버 기능이 연결되지 않아 화면의 숫자와 목록은 실제 운영 데이터가 아닙니다.
    </div>
  )
}

"use client"

import * as React from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { getMyInfo, type MyInfo } from "@/lib/member-auth"
import { useMemberPoints } from "@/lib/member-points"
import { useSavedItems } from "@/lib/saved-items"
import { fetchMyReservations, type Booking, type Waiting } from "@/lib/popup-booking"
import { usePhoneLayout } from "@/lib/app-mode"
import { AppMyHome, AppSettings, AppTopBar } from "@/components/mypage/app-my"

// 마이페이지 공통 틀: 위쪽 내 정보 요약, 왼쪽(휴대폰은 위쪽 가로) 메뉴, 오른쪽 본문
// /mypage (?tab=...) 와 /mypage/liked 가 같이 씀
// 장바구니(/store/goods/cart)는 펀딩·스토어 정리 때 다시 볼 때까지 메뉴·요약에서 뺌 (페이지·기능은 그대로)

export type MyPageSection =
  | "notifications"
  | "tickets"
  | "liked"
  | "cart"
  | "alerts"
  | "funding"
  | "orders"
  | "points"
  | "invite"
  | "info"
  | "address"
  | "links"
  | "settings"
  | "home" // 앱 마이 첫 화면 (앱에서만)
  | "app" // 앱 설정 (앱에서만)

export const MYPAGE_NAV: { title: string; items: { id: MyPageSection; label: string; href: string }[] }[] = [
  {
    title: "나의 활동",
    items: [
      { id: "tickets", label: "예약·웨이팅", href: "/mypage/?tab=tickets" },
      { id: "liked", label: "찜한 항목", href: "/mypage/liked/" },
      { id: "alerts", label: "알림 신청", href: "/mypage/?tab=alerts" },
      { id: "funding", label: "내 펀딩", href: "/mypage/?tab=funding" },
      { id: "orders", label: "주문 내역", href: "/mypage/?tab=orders" },
      { id: "points", label: "포인트 관리", href: "/mypage/?tab=points" },
      { id: "invite", label: "친구 초대", href: "/mypage/?tab=invite" },
    ],
  },
  {
    title: "계정 설정",
    items: [
      { id: "info", label: "회원 정보 수정", href: "/mypage/?tab=info" },
      { id: "address", label: "배송지 관리", href: "/mypage/?tab=address" },
      { id: "links", label: "로그인 연동", href: "/mypage/?tab=links" },
      { id: "notifications", label: "알림 설정", href: "/mypage/?tab=notifications" },
      { id: "settings", label: "수신 동의·탈퇴", href: "/mypage/?tab=settings" },
    ],
  },
]

type Reservations = { bookings: Booking[]; waitings: Waiting[] } | null

type MyPageContextValue = {
  info: MyInfo
  setInfo: (i: MyInfo) => void
  reload: () => Promise<void>
  reservations: Reservations
  reloadReservations: () => Promise<void>
}

const MyPageContext = createContext<MyPageContextValue | null>(null)

// 본문에서 내 정보 쓰기 (MyPageShell 안에서만)
export function useMyPage() {
  const v = useContext(MyPageContext)
  if (!v) throw new Error("MyPageShell 안에서 써야 합니다.")
  return v
}

// 이용 중인 예약(예약 확정)·웨이팅(대기·호출) 수
export const activeReservationCount = (r: Reservations) =>
  r ? r.bookings.filter((b) => b.status === "booked").length + r.waitings.filter((w) => w.status === "waiting" || w.status === "called").length : 0

export function MyPageShell({
  active,
  title,
  description,
  children,
}: {
  active: MyPageSection
  title: string
  description?: string
  children: React.ReactNode
}) {
  const [info, setInfo] = useState<MyInfo | null | undefined>(undefined)
  const [loadError, setLoadError] = useState("")
  const [reservations, setReservations] = useState<Reservations>(null)

  const reload = useCallback(async () => {
    const r = await getMyInfo()
    if (r.success) {
      setInfo(r.info)
      setLoadError("")
    } else {
      setInfo(null)
      setLoadError(r.status === 401 ? "" : r.error)
    }
  }, [])

  const reloadReservations = useCallback(async () => {
    const r = await fetchMyReservations()
    if (r.status === "ok") setReservations(r.data)
  }, [])

  useEffect(() => {
    reload()
    reloadReservations()
  }, [reload, reloadReservations])

  // 휴대폰 화면(덕지 앱·모바일 웹): 넓은 화면 마이페이지 틀(제목·요약·메뉴·푸터) 대신 앱 화면 모양 (시안 2-하단탭-5개 마이, 3 앱 설정)
  const isApp = usePhoneLayout()
  if (isApp) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <main className="flex-1 px-4 pt-2 pb-10">
          {info === undefined ? (
            <div className="py-24 text-center text-sm text-zinc-400">불러오는 중...</div>
          ) : active === "home" ? (
            <AppMyHome info={info} loadError={loadError} />
          ) : active === "app" ? (
            <AppSettings info={info} />
          ) : info === null ? (
            <AppMyHome info={null} loadError={loadError} />
          ) : (
            <MyPageContext.Provider value={{ info, setInfo, reload, reservations, reloadReservations }}>
              <AppTopBar title={title} back="/mypage/" />
              {description && <p className="mb-5 text-sm text-zinc-400">{description}</p>}
              {children}
            </MyPageContext.Provider>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar activeTab="" setActiveTab={() => {}} searchQuery="" setSearchQuery={() => {}} />
      <main className="flex-1 pt-28 sm:pt-32 pb-20 app-nav-offset">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-white mb-6">마이페이지</h1>

          {info === undefined ? (
            <div className="py-24 text-center text-sm text-zinc-400">불러오는 중...</div>
          ) : info === null ? (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
              <p className="text-sm text-zinc-300">{loadError || "로그인하면 예약, 찜, 포인트를 한 곳에서 볼 수 있어요."}</p>
              <Button asChild className="h-11 px-8 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm">
                <a href="/login/">로그인하기</a>
              </Button>
            </div>
          ) : (
            <MyPageContext.Provider value={{ info, setInfo, reload, reservations, reloadReservations }}>
              <ProfileSummary info={info} reservations={reservations} />

              <div className="mt-8 lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
                <SideNav active={active} />
                <section className="min-w-0">
                  <div className="pb-4 mb-6 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
                  </div>
                  {children}
                </section>
              </div>
            </MyPageContext.Provider>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ProfileSummary({ info, reservations }: { info: MyInfo; reservations: Reservations }) {
  const points = useMemberPoints().balance
  const saved = useSavedItems()
  const likedCount = saved.likes.popup.length + saved.likes.goods.length + saved.likes.course.length

  const stats = [
    { label: "덕지 포인트", value: points === null ? "-" : `${points.toLocaleString()} DP`, href: "/mypage/?tab=points" },
    { label: "예약·웨이팅", value: reservations ? `${activeReservationCount(reservations)}건` : "-", href: "/mypage/?tab=tickets" },
    { label: "찜", value: `${likedCount}개`, href: "/mypage/liked/" },
  ]

  // 박스 없이 위아래 얇은 선만: 왼쪽 프로필, 오른쪽 숫자 3개 (세로 선으로 구분)
  return (
    <div className="py-5 border-y border-zinc-800 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
      <div className="flex items-center gap-4 min-w-0 md:flex-1">
        <img
          src={info.user.avatarUrl || "/images/avatar/female.jpg"}
          alt="프로필 사진"
          className="w-14 h-14 rounded-full object-cover shrink-0"
        />
        <div className="min-w-0">
          <div className="text-base font-bold text-white truncate">{info.user.name} 님</div>
          <div className="text-sm text-zinc-400 truncate">{info.user.email}</div>
          <Link href="/mypage/?tab=info" className="mt-1 inline-flex items-center text-xs text-zinc-400 hover:text-white">
            회원 정보 수정
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-zinc-800 md:w-[420px] shrink-0">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="px-3 first:pl-0 md:px-5 md:first:pl-5 group">
            <div className="text-xs text-zinc-400">{s.label}</div>
            <div className="mt-1 text-base font-bold text-white group-hover:underline">{s.value}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function SideNav({ active }: { active: MyPageSection }) {
  const all = MYPAGE_NAV.flatMap((g) => g.items)
  // 휴대폰 가로 메뉴: 지금 보는 메뉴가 화면 안에 보이도록 가로 스크롤
  const barRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const bar = barRef.current
    const el = bar?.querySelector<HTMLElement>('[aria-current="page"]')
    if (bar && el) bar.scrollLeft = el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2
  }, [active])
  return (
    <>
      {/* 휴대폰·태블릿: 가로로 넘기는 메뉴 */}
      <nav ref={barRef} className="relative lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 mb-5 overflow-x-auto border-b border-zinc-800" aria-label="마이페이지 메뉴">
        <div className="flex gap-1 w-max">
          {all.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active === item.id ? "page" : undefined}
              className={`px-3 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active === item.id ? "border-white text-white font-bold" : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* 넓은 화면: 왼쪽 메뉴 */}
      <nav className="hidden lg:block space-y-7" aria-label="마이페이지 메뉴">
        {MYPAGE_NAV.map((group) => (
          <div key={group.title}>
            <div className="text-sm font-bold text-white pb-2 mb-1 border-b border-zinc-800">{group.title}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`block py-2 text-sm transition-colors ${
                      active === item.id ? "text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}

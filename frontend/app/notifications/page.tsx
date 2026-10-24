"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Settings } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { NotificationList } from "@/components/notifications/notification-list"
import { getSessionMember, goToLogin } from "@/lib/member-auth"

// 알림 (/notifications): 상단 종 아이콘 '전체 보기'로 오는 알림함. 알림 설정은 마이페이지(/mypage/?tab=notifications)

export default function NotificationsPage() {
  const [member, setMember] = useState<"loading" | "member" | "guest">("loading")

  useEffect(() => {
    getSessionMember()
      .then((m) => setMember(m ? "member" : "guest"))
      .catch(() => setMember("guest"))
  }, [])

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <Navbar activeTab="" setActiveTab={() => {}} searchQuery="" setSearchQuery={() => {}} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-24 app-nav-offset">
        <div className="flex items-start justify-between gap-4 pb-5">
          <div>
            <h1 className="text-2xl font-black text-white">알림</h1>
            <p className="mt-1 text-sm text-zinc-400">주문·결제·예약·펀딩 소식과 운영 공지예요.</p>
          </div>
          {member === "member" && (
            <Link href="/mypage/?tab=notifications" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-zinc-400 hover:text-white whitespace-nowrap">
              <Settings className="w-4 h-4" />
              알림 설정
            </Link>
          )}
        </div>

        {member === "loading" ? (
          <p className="py-24 text-center text-sm text-zinc-400">불러오는 중...</p>
        ) : member === "guest" ? (
          <div className="py-20 text-center border-y border-zinc-800">
            <p className="text-sm text-zinc-400">로그인하면 받은 알림을 볼 수 있어요.</p>
            <button
              type="button"
              onClick={() => goToLogin("/notifications/")}
              className="mt-5 h-11 px-10 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors"
            >
              로그인하기
            </button>
          </div>
        ) : (
          <NotificationList />
        )}
      </main>
      <Footer />
    </div>
  )
}

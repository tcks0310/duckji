"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, Settings, ShoppingCart, Ticket, Truck } from "lucide-react"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { LanguageSelector } from "@/components/ui/language-selector"
import { logoutMember, type MyInfo } from "@/lib/member-auth"
import { useMemberPoints } from "@/lib/member-points"
import { useIsApp } from "@/lib/app-mode"

// 휴대폰 화면(덕지 앱 하단 '마이' 탭, 768px 미만 브라우저)의 마이 화면. 넓은 화면 마이페이지는 그대로
// 시안: /mnt/project-files/launch/mobile-app-mockup/2-하단탭-5개.png 의 마이, 3-앱전용화면-아이콘.png 의 앱 설정

const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", naver: "네이버", google: "구글", apple: "Apple", cognito: "이메일" }

const row = "flex items-center justify-between py-3.5 text-[15px] text-zinc-100 active:bg-white/[0.04]"
const sectionTitle = "pt-6 pb-1 text-xs font-bold text-zinc-400"

// 위쪽 머리줄: 큰 제목 + 오른쪽 버튼 (앱 화면에는 사이트 상단 줄이 없음)
export function AppTopBar({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 h-12 mb-2">
      {back && (
        <Link href={back} aria-label="뒤로" className="-ml-2 p-1.5 text-zinc-200">
          <ChevronLeft className="w-6 h-6" />
        </Link>
      )}
      <h1 className="flex-1 min-w-0 truncate text-xl font-bold text-white">{title}</h1>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </div>
  )
}

function SettingsButton() {
  return (
    <Link href="/mypage/?tab=app" aria-label="설정" className="p-2 rounded-full text-zinc-300 hover:bg-zinc-800/60">
      <Settings className="w-5 h-5" />
    </Link>
  )
}

function LinkRow({ href, label, value }: { href: string; label: string; value?: string }) {
  return (
    <Link href={href} className={row}>
      <span>{label}</span>
      <span className="flex items-center gap-1 text-sm text-zinc-400">
        {value}
        <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  )
}

// 앱 마이 첫 화면 (로그인 전에도 설정·전체 메뉴는 보임)
export function AppMyHome({ info, loadError }: { info: MyInfo | null; loadError: string }) {
  const points = useMemberPoints().balance

  return (
    <>
      <AppTopBar
        title="마이"
        right={
          <>
            {info && <NotificationBell />}
            <SettingsButton />
          </>
        }
      />

      {info ? (
        <>
          <Link href="/mypage/?tab=info" className="flex items-center gap-3.5 py-3">
            <img src={info.user.avatarUrl || "/images/avatar/female.jpg"} alt="프로필 사진" className="w-14 h-14 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-white truncate">{info.user.name}</div>
              <div className="flex items-center gap-1 text-[13px] text-zinc-400 truncate">
                {PROVIDER_LABEL[info.user.provider] || info.user.provider} 로그인
                {info.identityVerified && (
                  <>
                    <span aria-hidden>·</span>
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                    본인인증 완료
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          </Link>

          <Link href="/mypage/?tab=points" className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.05] px-5 py-4">
            <span className="text-sm text-zinc-300">보유 DP</span>
            <span className="text-2xl font-black text-amber-300">
              {points === null ? "-" : points.toLocaleString()}
              <span className="ml-1 text-sm font-bold">DP</span>
            </span>
          </Link>

          <div className="mt-4 grid grid-cols-4 text-center">
            {[
              { href: "/mypage/?tab=orders", label: "주문 내역", Icon: Truck },
              { href: "/mypage/liked/", label: "찜", Icon: Heart },
              { href: "/store/goods/cart/", label: "장바구니", Icon: ShoppingCart },
              { href: "/mypage/?tab=tickets", label: "예약", Icon: Ticket },
            ].map(({ href, label, Icon }) => (
              <Link key={label} href={href} className="flex flex-col items-center gap-1.5 py-2 text-xs text-zinc-300">
                <span className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-amber-300">
                  <Icon className="w-5 h-5" />
                </span>
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-3 divide-y divide-zinc-800 border-y border-zinc-800">
            <LinkRow href="/mypage/?tab=funding" label="펀딩 참여 내역" />
            <LinkRow href="/mypage/?tab=alerts" label="알림 신청한 팝업" />
            <LinkRow href="/notifications/" label="받은 알림" />
            <LinkRow href="/mypage/?tab=invite" label="친구 초대" />
            <LinkRow href="/mypage/?tab=address" label="배송지 관리" />
          </div>
        </>
      ) : (
        <div className="py-8 text-center space-y-4">
          <p className="text-sm text-zinc-300">{loadError || "로그인하면 주문, 찜, DP, 예약을 한 곳에서 볼 수 있어요."}</p>
          <a href="/login/?next=%2Fmypage%2F" className="inline-flex h-11 items-center px-8 rounded-xl bg-red-600 text-white font-bold text-sm">
            로그인 · 회원가입
          </a>
        </div>
      )}
    </>
  )
}

// 앱 설정 (마이 오른쪽 위 톱니바퀴)
export function AppSettings({ info }: { info: MyInfo | null }) {
  const isApp = useIsApp()
  const [appVersion, setAppVersion] = useState("")
  useEffect(() => {
    setAppVersion(navigator.userAgent.match(/DuckjiApp\/([\d.]+)/)?.[1] || "")
  }, [])

  const logout = async () => {
    if (!confirm("로그아웃할까요?")) return
    await logoutMember()
    window.location.href = "/mypage/"
  }

  return (
    <>
      <AppTopBar title={isApp ? "앱 설정" : "설정"} back="/mypage/" />

      {info && (
        <>
          <div className={sectionTitle}>알림</div>
          <div className="divide-y divide-zinc-800 border-b border-zinc-800">
            <LinkRow href="/mypage/?tab=notifications" label="알림 종류·밤 알림 끄기" />
          </div>

          <div className={sectionTitle}>계정</div>
          <div className="divide-y divide-zinc-800 border-b border-zinc-800">
            <LinkRow href="/mypage/?tab=info" label="회원 정보 수정" />
            <LinkRow href="/mypage/?tab=links" label="로그인 연동" />
            <LinkRow href="/mypage/?tab=address" label="배송지 관리" />
            <LinkRow href="/mypage/?tab=settings" label="수신 동의·탈퇴" />
          </div>
        </>
      )}

      <div className={sectionTitle}>{isApp ? "앱" : "기타"}</div>
      <div className="divide-y divide-zinc-800 border-b border-zinc-800">
        <div className={row}>
          <span>언어</span>
          <LanguageSelector />
        </div>
        <LinkRow href="/about/" label="덕지 소개" />
        <LinkRow href="/terms/" label="이용약관" />
        <LinkRow href="/privacy/" label="개인정보 처리방침" />
        <LinkRow href="/location-terms/" label="위치기반서비스 이용약관" />
        <LinkRow href="/consumer/" label="소비자 보호 안내" />
        {appVersion && (
          <div className={row}>
            <span>앱 버전</span>
            <span className="text-sm text-zinc-400">{appVersion}</span>
          </div>
        )}
      </div>

      {info && (
        <button type="button" onClick={logout} className="mt-6 py-3 text-[15px] font-semibold text-red-400">
          로그아웃
        </button>
      )}
    </>
  )
}

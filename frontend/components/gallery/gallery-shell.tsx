"use client"

import * as React from "react"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { Footer } from "@/components/footer"
import { CategoryBreadcrumb } from "@/components/portal/category-tiles"
import { memberHref, type AuthorInfo } from "@/lib/community-api"
import { SquadBadge } from "@/components/community/squad-badge"

// 덕지 갤러리 화면 공통 틀 (기존 페이지와 같은 Navbar·Footer·배경)
// breadcrumb: 메뉴 소분류 페이지면 대분류 › 소분류 위치와 같은 대분류 칩을 맨 위에 보여 줌 (lib/site-menu.ts id)
export function GalleryShell({
  children,
  activeTab = "gallery",
  wide = false,
  breadcrumb,
}: {
  children: React.ReactNode
  activeTab?: string
  wide?: boolean
  breadcrumb?: { groupId: string; itemId?: string }
}) {
  const shortcuts = useMyPageShortcuts()
  return (
    <div className="gallery-wine min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      <Navbar activeTab={activeTab} setActiveTab={() => {}} {...shortcuts} searchQuery="" setSearchQuery={() => {}} />
      <main className="flex-1 pt-28 sm:pt-32 pb-20 app-nav-offset">
        <div className={`${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto px-4 sm:px-6 lg:px-8 space-y-6`}>
          {breadcrumb && <CategoryBreadcrumb groupId={breadcrumb.groupId} itemId={breadcrumb.itemId} />}
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

// 덕력 레벨 뱃지 (뱃지 이미지는 디자이너가 레벨별로 교체 예정, 지금은 글자)
export function LevelBadge({ level }: { level?: { level: number; title?: string } | null }) {
  if (!level) return null
  return (
    <span
      data-level={level.level}
      title={level.title ? `덕력 Lv.${level.level} ${level.title}` : `덕력 Lv.${level.level}`}
      className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs leading-none font-bold"
    >
      Lv.{level.level}
    </span>
  )
}

export function StaffBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 text-xs leading-none font-bold">
      운영
    </span>
  )
}

// 프로필 사진 (없으면 이름 첫 글자)
export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : (name || "?").slice(0, 1)}
    </span>
  )
}

// 글쓴이 표시: (프로필 사진) 운영·레벨 뱃지 + 이름 + 스쿼드 배지. 이름을 누르면 그 회원 갤러리 홈
// compact: 사진 카드 아래처럼 좁은 곳. 스쿼드는 이름 앞 아이콘만, 운영진은 이름 뒤 작은 인증 표시, 레벨은 숨김
export function AuthorName({ author, avatar = false, link = true, compact = false }: { author: AuthorInfo; avatar?: boolean; link?: boolean; compact?: boolean }) {
  const isAdminAccount = author.authorId === "admin"
  const name = (
    <span className="font-semibold text-zinc-200 truncate">{author.authorName}</span>
  )
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 min-w-0">
        <SquadBadge squad={author.authorSquad} iconOnly />
        {link && !isAdminAccount ? (
          <Link href={memberHref(author.authorId)} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate hover:underline underline-offset-2">
            {name}
          </Link>
        ) : (
          name
        )}
        {author.isStaff && (
          <span title="덕지 운영진" className="inline-flex shrink-0">
            <BadgeCheck className="w-3.5 h-3.5 text-red-400" aria-label="운영진" />
          </span>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {avatar && <Avatar name={author.authorName} src={author.authorAvatarUrl} size={28} />}
      {author.isStaff ? <StaffBadge /> : <LevelBadge level={author.authorLevel} />}
      {link && !isAdminAccount ? (
        <Link href={memberHref(author.authorId)} onClick={(e) => e.stopPropagation()} className="min-w-0 hover:underline underline-offset-2">
          {name}
        </Link>
      ) : (
        name
      )}
      <SquadBadge squad={author.authorSquad} />
    </span>
  )
}

export function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      className={`p-6 rounded-2xl border text-center text-sm ${
        tone === "error" ? "bg-red-500/5 border-red-500/30 text-red-400" : "bg-zinc-900/60 border-zinc-800 text-zinc-500"
      }`}
    >
      {children}
    </div>
  )
}

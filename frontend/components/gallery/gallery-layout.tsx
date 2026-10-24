"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Hash, Home, LayoutGrid, Lock, PlusCircle, Search, Shield, Trophy, UserRound, Users } from "lucide-react"
import { GalleryShell } from "@/components/gallery/gallery-shell"
import { fetchTree, galleryHref, type Gallery, type GroupWithGalleries } from "@/lib/community-api"

// 갤러리 트리는 여러 화면이 같이 씀 (화면을 옮겨 다닐 때 다시 부르지 않게 잠깐 보관)
let treeCache: { at: number; groups: GroupWithGalleries[]; galleries: Gallery[] } | null = null
export function useGalleryTree() {
  const [tree, setTree] = useState<{ groups: GroupWithGalleries[]; galleries: Gallery[] } | null>(treeCache)
  const [error, setError] = useState("")
  useEffect(() => {
    if (treeCache && Date.now() - treeCache.at < 60_000) return
    fetchTree()
      .then((t) => {
        treeCache = { at: Date.now(), ...t }
        setTree(t)
      })
      .catch((e) => {
        setError(e.message)
        setTree({ groups: [], galleries: [] })
      })
  }, [])
  return { tree, error }
}

export type GalleryNav = "feed" | "me" | "squads" | "mysquad" | "ranking" | "request" | null

// 덕지 갤러리 화면 틀: 왼쪽 메뉴(내 홈·피드·스쿼드 + 대분류 > 갤러리) + 오른쪽 본문
export function GalleryLayout({
  activeSlug = null,
  nav = null,
  children,
}: {
  activeSlug?: string | null
  nav?: GalleryNav
  children: React.ReactNode
}) {
  const { tree, error } = useGalleryTree()
  const [isTreeOpen, setIsTreeOpen] = useState(false)

  return (
    <GalleryShell wide breadcrumb={{ groupId: "community", itemId: "gallery" }}>
      <GalleryTabs nav={nav} />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* 휴대폰·태블릿: 버튼을 누르면 메뉴가 펼쳐짐 */}
        <button
          type="button"
          onClick={() => setIsTreeOpen((v) => !v)}
          aria-expanded={isTreeOpen}
          className="lg:hidden w-full flex items-center justify-between py-3 border-b border-white/10 text-sm font-bold text-white"
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            갤러리 목록
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isTreeOpen ? "rotate-180" : ""}`} />
        </button>

        <aside className={`${isTreeOpen ? "block" : "hidden"} lg:block w-full lg:w-56 shrink-0 lg:sticky lg:top-24 lg:pr-5 lg:border-r lg:border-white/10`}>
          <GalleryTree groups={tree?.groups ?? null} error={error} activeSlug={activeSlug} nav={nav} />
        </aside>

        <div className="flex-1 min-w-0 w-full space-y-6">{children}</div>
      </div>
    </GalleryShell>
  )
}

// 위쪽 탭: 왼쪽은 모두가 보는 피드·스쿼드·덕력 랭킹, 오른쪽은 내 것(내 갤러리 홈·내 스쿼드)
// 갤러리·글 화면은 피드 탭으로 봄. 같은 스쿼드 화면 안에서 탭만 바뀌는 경우가 있어 <a> 로 새로 엶
type TabItem = { nav: Exclude<GalleryNav, null | "request">; href: string; label: string; icon: React.ElementType }
const MAIN_TABS: TabItem[] = [
  { nav: "feed", href: "/community/gallery/", label: "피드", icon: Home },
  { nav: "squads", href: "/community/gallery/squads/?tab=browse", label: "스쿼드", icon: Users },
  { nav: "ranking", href: "/community/gallery/ranking/", label: "덕력 랭킹", icon: Trophy },
]
const MY_TABS: TabItem[] = [
  { nav: "me", href: "/community/gallery/me/", label: "내 갤러리 홈", icon: UserRound },
  { nav: "mysquad", href: "/community/gallery/squads/?tab=mine", label: "내 스쿼드", icon: Shield },
]

function GalleryTabs({ nav }: { nav: GalleryNav }) {
  const current = nav === null || nav === "request" ? "feed" : nav
  const tab = (t: TabItem) => {
    const active = t.nav === current
    const Icon = t.icon
    return (
      <li key={t.nav}>
        <a
          href={t.href}
          aria-current={active ? "page" : undefined}
          className={`relative flex items-center gap-1.5 py-3 text-sm sm:text-[15px] font-bold whitespace-nowrap transition-colors ${
            active ? "text-white" : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <Icon className={`hidden sm:block w-4 h-4 ${active ? "text-emerald-400" : ""}`} />
          {t.label}
          {active && <span className="absolute left-0 right-0 bottom-0 h-0.5 rounded-full bg-emerald-400" />}
        </a>
      </li>
    )
  }
  return (
    <nav aria-label="덕지 갤러리 탭" className="-mx-4 sm:mx-0 px-4 sm:px-0 border-b border-white/10 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center justify-between gap-6 min-w-max">
        <ul className="flex gap-4 sm:gap-8">{MAIN_TABS.map(tab)}</ul>
        <ul className="flex gap-4 sm:gap-6">{MY_TABS.map(tab)}</ul>
      </div>
    </nav>
  )
}

function GalleryTree({
  groups,
  error,
  activeSlug,
  nav,
}: {
  groups: GroupWithGalleries[] | null
  error: string
  activeSlug: string | null
  nav: GalleryNav
}) {
  const [query, setQuery] = useState("")
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      (groups || [])
        .map((g) => ({
          ...g,
          galleries: g.galleries.filter((x) => !q || x.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q) || x.aliases.some((a) => a.toLowerCase().includes(q))),
        }))
        .filter((g) => g.galleries.length > 0 || g.kind === "squad"),
    [groups, q]
  )

  return (
    <nav aria-label="갤러리 메뉴" className="space-y-5 pt-3 lg:pt-0">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="갤러리 찾기"
          className="w-full bg-transparent border-0 border-b border-white/15 rounded-none pl-6 pr-1 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
        />
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-0.5 top-3" />
      </div>

      {groups === null ? (
        <div className="px-2.5 py-3 text-xs text-zinc-500">불러오는 중...</div>
      ) : error ? (
        <div className="px-2.5 py-3 text-xs text-red-400">{error}</div>
      ) : shown.length === 0 ? (
        <div className="px-2.5 py-3 text-xs text-zinc-500">{q ? "찾는 갤러리가 없어요." : "아직 열린 갤러리가 없어요."}</div>
      ) : (
        <ul className="space-y-3">
          {shown.map((group) => {
            const open = Boolean(q) || !collapsed[group.id]
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between pl-3 py-1 text-xs font-bold tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <span>{group.name}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
                {open && (
                  <ul className="mt-0.5">
                    {group.galleries.map((g) => {
                      const active = g.slug === activeSlug
                      return (
                        <li key={g.id}>
                          <Link
                            href={galleryHref(g.slug)}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex items-center gap-1.5 pl-3 py-1.5 text-sm transition-colors ${
                              active ? "text-emerald-300 font-semibold" : "text-zinc-300 hover:text-white"
                            }`}
                          >
                            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-emerald-400" />}
                            <Hash className="w-3 h-3 shrink-0 opacity-50" />
                            <span className="truncate">{g.name}</span>
                            {g.writeRole === "admin" && <Lock className="w-3 h-3 shrink-0 text-zinc-600" aria-label="운영팀만 글쓰기" />}
                            {Boolean(g.today) && <span className="ml-auto text-xs text-emerald-400 shrink-0">+{g.today}</span>}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href="/community/gallery/request/"
        className={`flex items-center gap-1.5 pl-3 pt-3 border-t border-white/10 text-sm font-semibold transition-colors ${
          nav === "request" ? "text-emerald-200" : "text-emerald-400 hover:text-emerald-200"
        }`}
      >
        <PlusCircle className="w-3.5 h-3.5" />
        갤러리 개설 요청
      </Link>
    </nav>
  )
}

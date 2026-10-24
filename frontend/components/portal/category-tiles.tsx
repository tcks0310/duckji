"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { SITE_MENU, MENU_TONES, findMenuEntry, type MenuAction, type MenuGroup, type MenuItem } from "@/lib/site-menu"

// 바로가기 카드: 기존 홈의 "스쿼드·스탬프·코스어·퀴즈" 카드 모양을 그대로 씀
const CARD = "p-4 rounded-2xl bg-gradient-to-r via-zinc-900 to-zinc-900 border transition-all cursor-pointer shadow-lg group flex items-center justify-between"
const TONE_CARD: Record<MenuGroup["tone"], string> = {
  red: "from-red-500/15 border-red-500/30 hover:border-red-500",
  emerald: "from-emerald-500/15 border-emerald-500/30 hover:border-emerald-500",
  amber: "from-amber-500/15 border-amber-500/30 hover:border-amber-500",
  cyan: "from-cyan-500/15 border-cyan-500/30 hover:border-cyan-500",
  purple: "from-purple-500/15 border-purple-500/30 hover:border-purple-500",
}

interface TileProps {
  href: string
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  tone: MenuGroup["tone"]
  badge?: string
  highlighted?: boolean
  onClick?: (e: React.MouseEvent) => void
}

function Tile({ href, title, desc, icon: Icon, tone, badge, highlighted, onClick }: TileProps) {
  const t = MENU_TONES[tone]
  return (
    <a
      href={href}
      onClick={onClick}
      className={`${CARD} ${
        highlighted
          ? "from-amber-500/25 via-zinc-900 to-zinc-900 border-2 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:border-amber-300 ring-1 ring-amber-400/50"
          : TONE_CARD[tone]
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-center shrink-0 ${highlighted ? "text-amber-300 border-amber-400/50 shadow-inner" : t.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className={`font-extrabold text-xs sm:text-sm flex items-center gap-1.5 ${highlighted ? "text-amber-200" : "text-white"}`}>
            <span>{title}</span>
            {badge && (
              <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                highlighted ? "bg-gradient-to-r from-amber-400 to-orange-400 text-black border-amber-300 font-black shadow-sm" : t.badge
              }`}>
                {badge}
              </span>
            )}
          </div>
          <div className={`text-[11px] truncate ${highlighted ? "text-amber-200/80 font-medium" : "text-zinc-400"}`}>{desc}</div>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform ${highlighted ? "text-amber-300" : t.icon}`} />
    </a>
  )
}

// 홈: 대분류 5개 바로가기
export function CategoryTiles() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {SITE_MENU.map((group) => (
        <Tile
          key={group.id}
          href={group.href}
          title={group.label}
          desc={group.desc}
          icon={group.icon}
          tone={group.tone}
        />
      ))}
    </div>
  )
}

// 대분류 페이지 맨 위: 제목 + 소분류 바로가기 (홈 팝업창 기능은 onAction 으로 열기)
export function CategoryHeader({ groupId, onAction }: { groupId: string; onAction?: (action: MenuAction) => void }) {
  const group = SITE_MENU.find((g) => g.id === groupId)
  if (!group) return null
  const t = MENU_TONES[group.tone]
  const GroupIcon = group.icon

  const handleItem = (item: MenuItem) => (e: React.MouseEvent) => {
    if (item.action && onAction) {
      e.preventDefault()
      onAction(item.action)
      return
    }
    // 같은 페이지 안의 섹션이면 부드럽게 스크롤
    const hash = item.href.split("#")[1]
    const el = hash ? document.getElementById(hash) : null
    if (el && item.href.startsWith(window.location.pathname)) {
      e.preventDefault()
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1 ${t.icon}`}>
          <GroupIcon className="w-4 h-4" />
          <span>{group.label}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{group.title}</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">{group.desc}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {group.items.map((item) => (
          <Tile
            key={item.id}
            href={item.href}
            title={item.label}
            desc={item.desc}
            icon={item.icon}
            tone={group.tone}
            badge={item.badge}
            highlighted={item.highlighted}
            onClick={handleItem(item)}
          />
        ))}
      </div>
      {/* 소분류 아래 단계가 있는 메뉴 (예: 덕지 MBTI): 어떤 화면이 딸려 있는지 한 줄로 */}
      {group.items
        .filter((item) => item.children?.length)
        .map((item) => (
          <SubItemChips key={item.id} item={item} />
        ))}
    </section>
  )
}

// 소분류 아래 단계 칩 줄: "덕지 MBTI ›  MBTI 홈 · 4성향 분석 · 22유형 도감 …"
function SubItemChips({ item, activeId }: { item: MenuItem; activeId?: string }) {
  if (!item.children?.length) return null
  const chips = [{ id: item.id, label: `${item.label} 홈`, href: item.href }, ...item.children]
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-zinc-500">
        <span className="text-zinc-700">└</span>
        {item.label}
      </span>
      {chips.map((c) => {
        const active = c.id === activeId
        return (
          <a
            key={c.id}
            href={c.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap transition-colors ${
              active ? "bg-zinc-200 text-black border-zinc-200" : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
            }`}
          >
            {c.label}
          </a>
        )
      })}
    </div>
  )
}

// 소분류 페이지 맨 위: 대분류 › 소분류(› 그 아래 단계) 위치 + 같은 대분류의 다른 소분류로 가는 칩
// itemId 가 없으면(대분류 페이지, 메뉴에 없는 상세 화면) 대분류 이름과 소분류 칩만 보여 줌
export function CategoryBreadcrumb({ groupId, itemId, onAction }: { groupId: string; itemId?: string; onAction?: (action: MenuAction) => void }) {
  const { group, item: current, sub } = findMenuEntry(groupId, itemId)
  if (!group) return null
  const t = MENU_TONES[group.tone]
  const GroupIcon = group.icon

  return (
    <nav aria-label="현재 위치" className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
        <a href={group.href} className={`flex items-center gap-1.5 ${t.icon} hover:text-white transition-colors`}>
          <GroupIcon className="w-4 h-4" />
          <span>{group.label}</span>
        </a>
        {current && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            {sub ? (
              <a href={current.href} className="text-zinc-400 hover:text-white transition-colors">{current.label}</a>
            ) : (
              <span className="text-zinc-300">{current.label}</span>
            )}
          </>
        )}
        {sub && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-zinc-300">{sub.label}</span>
          </>
        )}
      </div>
      {group.items.length > 1 && (
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {group.items.map((item) => {
          const active = item.id === current?.id
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={active && !sub ? "page" : undefined}
              onClick={(e) => {
                if (item.action && onAction) {
                  e.preventDefault()
                  onAction(item.action)
                }
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap transition-colors ${
                active ? "bg-white text-black border-white" : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {item.label}
              {item.children?.length ? <span className={`ml-1 ${active ? "text-black/50" : "text-zinc-500"}`}>+{item.children.length}</span> : null}
            </a>
          )
        })}
      </div>
      )}
      {current?.children?.length ? <SubItemChips item={current} activeId={sub?.id ?? current.id} /> : null}
    </nav>
  )
}

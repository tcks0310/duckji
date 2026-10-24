// 사이트 메뉴 (대분류·소분류) — 상단 메뉴, 오른쪽 사이드탭, 하단 사이트맵이 모두 이 목록을 씁니다.
// 메뉴를 추가·이동할 때는 이 파일만 고치면 됩니다.
//
// 소분류 이동 방법
//   href    : 항상 있음. 다른 화면에서 누르거나 하단 링크에서 쓰는 주소
//   homeTab : 그 섹션이 있는 페이지에서는 이동 없이 스크롤 (navbar 의 handleNavClick)
//   action  : 홈 화면의 팝업창을 엶. 다른 화면에서는 href(/?open=...)로 홈에 와서 엶
import type { LucideIcon } from "lucide-react"
import {
  Flame,
  Calendar,
  Compass,
  Zap,
  Sparkles,
  PlusCircle,
  Package,
  PartyPopper,
  Users,
  ShoppingBag,
  Store,
  Image as ImageIcon,
  Camera,
  Brain,
  Building2,
  Megaphone,
  Mail,
  Heart,
  Gamepad2,
} from "lucide-react"

export type MenuAction = "squad"

export interface MenuItem {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  href: string
  homeTab?: "anime" | "calendar" | "shop"
  action?: MenuAction
  badge?: string
  iconBg: string
  highlighted?: boolean
  // 소분류 아래 한 단계 더 (예: 덕지덕순 물상 카드 › 4성향 분석). 메뉴·사이트맵·위치 표시에서 들여 써서 보여 줌
  children?: MenuSubItem[]
}

export interface MenuSubItem {
  id: string
  label: string
  desc: string
  href: string
  badge?: string
}

export interface MenuGroup {
  id: string
  label: string
  // 대분류 페이지 (대분류 버튼을 누르면 이동)
  href: string
  title: string
  desc: string
  icon: LucideIcon
  // 대분류 버튼·드롭다운 색 (기존 상단 메뉴 색을 그대로 씀)
  tone: "red" | "emerald" | "amber" | "cyan" | "purple"
  items: MenuItem[]
}

export const SITE_MENU: MenuGroup[] = [
  {
    id: "popup",
    label: "팝업",
    href: "/popups/",
    title: "덕지 팝업",
    desc: "지금 뜨는 애니 팝업, 일정·지도와 덕지순례 스탬프",
    icon: Flame,
    tone: "red",
    items: [
      // 지금 뜨는 팝업은 대분류 페이지(/popups/) 자체라 소분류로 두지 않음
      { id: "calendar", label: "팝업 일정·지도", desc: "달력으로 기간을, 지도로 위치를 한 번에", icon: Calendar, href: "/popups/calendar/", homeTab: "calendar", iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
      { id: "pilgrimage", label: "덕지순례", desc: "근처 성지·팝업 원데이 루트 & 현장 스탬프", icon: Compass, href: "/popups/pilgrimage", badge: "스탬프", iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
      { id: "mapniverse", label: "맵니버스 (TIF)", desc: "3D 메타버스 성지 큐레이션", icon: Zap, href: "/popups/mapniverse", badge: "3D", iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
    ],
  },
  {
    id: "funding",
    label: "펀딩",
    href: "/funding",
    title: "덕질 펀딩",
    desc: "장소 대관·굿즈 제작 펀딩과 파티 캘린더",
    icon: Sparkles,
    tone: "emerald",
    items: [
      // 펀딩 소개·파티 캘린더는 대분류 페이지(/funding) 자체라 소분류로 두지 않음
      { id: "funding-browse", label: "펀딩 둘러보기", desc: "지금 열린 대관 펀딩과 굿즈 공동구매", icon: Compass, href: "/funding/browse", iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
      { id: "funding-new", label: "펀딩 열기", desc: "장소 대관·굿즈 제작 펀딩 개설 신청", icon: PlusCircle, href: "/funding/new", iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
      { id: "funding-my", label: "내 펀딩 관리", desc: "내가 연 펀딩과 참여한 펀딩", icon: Heart, href: "/funding/my", iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    ],
  },
  {
    id: "store",
    label: "스토어",
    href: "/store/",
    title: "덕지 스토어",
    desc: "공식 한정 굿즈·커스텀 제작·팝업 집기",
    icon: Store,
    tone: "amber",
    items: [
      { id: "goods", label: "굿즈샵", desc: "공식 한정판 굿즈 & 랜덤 럭키박스", icon: ShoppingBag, href: "/store/goods/", homeTab: "shop", badge: "NEW", iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
      { id: "mall", label: "덕지몰", desc: "팝업스토어 집기·디스플레이 비품 대행", icon: Store, href: "/store/mall", badge: "B2B", iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    ],
  },
  {
    id: "community",
    label: "커뮤니티",
    href: "/community/",
    title: "덕지 커뮤니티",
    desc: "덕지 갤러리: 사진·이달의 코스어·이달의 굿즈·스쿼드",
    icon: ImageIcon,
    tone: "cyan",
    items: [
      { id: "gallery", label: "덕지 갤러리", desc: "사진 피드 · 이달의 코스어·굿즈 · 스쿼드 · 내 갤러리", icon: ImageIcon, href: "/community/gallery/", badge: "NEW", iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    ],
  },
  {
    id: "play",
    label: "운세·놀이",
    href: "/play/",
    title: "덕지 운세·놀이",
    desc: "AI 사주 도사·사주 캐릭터·물상 카드·퀴즈·AR 카드",
    icon: Sparkles,
    tone: "purple",
    items: [
      { id: "saju-ai", label: "덕지 도사 AI 사주", desc: "만세력으로 보는 성격·취향·이성·재물·미래 (회원 전용)", icon: Gamepad2, href: "/play/saju-ai/", badge: "AI", iconBg: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
      { id: "quiz", label: "덕력 퀴즈", desc: "주제별 덕력 퀴즈 풀고 덕지 포인트 받기", icon: Zap, href: "/play/quiz/", iconBg: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
      { id: "saju", label: "덕지 사주 캐릭터", desc: "나의 덕지 사주 캐릭터 & 최애 궁합 운세", icon: Sparkles, href: "/play/saju", badge: "RPG", iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
      {
        id: "tarot",
        label: "덕지덕순 물상 카드",
        desc: "천문물상 MBTI 진단 & 4성향 카드 뽑기",
        icon: Brain,
        href: "/play/mbti",
        badge: "★대표추천",
        highlighted: true,
        iconBg: "bg-gradient-to-br from-amber-500/30 via-rose-500/25 to-purple-500/30 text-amber-300 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
        children: [
          { id: "tarot-draw", label: "4성향 분석", desc: "속마음과 겉모습 물상 카드 4장 분석 (무료)", href: "/play/mbti/draw", badge: "HOT" },
          { id: "tarot-cards", label: "22유형 도감", desc: "유형별 상세 설명 & 합·충 케미 사전", href: "/play/mbti/cards" },
          { id: "tarot-dice", label: "오늘의 12지 주사위", desc: "하루 1회 무료 주사위 굴리기 & 도장", href: "/play/mbti/dice", badge: "미니게임" },
          { id: "tarot-code", label: "현장 QR/코드 등록", desc: "팝업 영수증 시리얼 코드 입력", href: "/play/mbti/code", badge: "특전" },
        ],
      },
      { id: "ar", label: "AR 카드", desc: "실물 포토카드 WebAR 3D 소환", icon: Camera, href: "/play/ar", badge: "WebAR", iconBg: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
    ],
  },
]

// 파트너(B2B): 상단 메뉴에는 넣지 않고 사이드탭 아래와 하단에만 둠
// 회사 소개(/about)·덕지몰은 다른 메뉴에 이미 있어 여기서는 뺌 (2026-10-18, hj)
export const PARTNER_MENU: MenuItem[] = [
  { id: "b2b", label: "입점·광고 신청", desc: "팝업 주최사 입점 / 광고 제휴 신청서", icon: Megaphone, href: "/partners/apply/", iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "contact", label: "제휴 문의", desc: "inc.siaa@gmail.com", icon: Mail, href: "mailto:inc.siaa@gmail.com", iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
]

// 대분류 색 (기존 상단 메뉴 버튼·드롭다운의 색 조합)
export const MENU_TONES: Record<MenuGroup["tone"], { icon: string; hover: string; badge: string; border: string; active: string }> = {
  red: { icon: "text-red-400", hover: "group-hover:text-red-400", badge: "bg-red-500/20 text-red-400 border-red-500/30", border: "border-zinc-800/90", active: "text-red-400" },
  emerald: { icon: "text-emerald-400", hover: "group-hover:text-emerald-300", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", border: "border-emerald-500/40", active: "text-emerald-400" },
  amber: { icon: "text-amber-400", hover: "group-hover:text-amber-400", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", border: "border-zinc-800/90", active: "text-amber-400" },
  cyan: { icon: "text-cyan-400", hover: "group-hover:text-cyan-300", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", border: "border-zinc-800/90", active: "text-cyan-400" },
  purple: { icon: "text-amber-200", hover: "group-hover:text-amber-300", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", border: "border-amber-500/40", active: "text-amber-300" },
}

// 소분류 id 로 찾기 (한 단계 더 아래 항목이면 parent 에 그 소분류가 들어감)
export function findMenuEntry(groupId: string, itemId?: string): { group?: MenuGroup; item?: MenuItem; sub?: MenuSubItem } {
  const group = SITE_MENU.find((g) => g.id === groupId)
  if (!group || !itemId) return { group }
  for (const item of group.items) {
    if (item.id === itemId) return { group, item }
    const sub = item.children?.find((c) => c.id === itemId)
    if (sub) return { group, item, sub }
  }
  return { group }
}

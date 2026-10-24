"use client"

import * as React from "react"
import { Camera, Cat, Crown, Flame, Gamepad2, Ghost, Heart, Leaf, Moon, Music, Rocket, Shield, Sparkles, Star, Swords, Zap, type LucideIcon } from "lucide-react"

// 스쿼드 기본 아이콘·색 (서버 쪽 목록은 backend rewards/rules.ts SQUAD_ICONS·SQUAD_COLORS, 이름을 맞춰 둘 것)

export const SQUAD_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "star", label: "별", Icon: Star },
  { id: "shield", label: "방패", Icon: Shield },
  { id: "flame", label: "불꽃", Icon: Flame },
  { id: "crown", label: "왕관", Icon: Crown },
  { id: "heart", label: "하트", Icon: Heart },
  { id: "swords", label: "검", Icon: Swords },
  { id: "music", label: "음표", Icon: Music },
  { id: "gamepad", label: "게임", Icon: Gamepad2 },
  { id: "camera", label: "카메라", Icon: Camera },
  { id: "sparkles", label: "반짝", Icon: Sparkles },
  { id: "moon", label: "달", Icon: Moon },
  { id: "zap", label: "번개", Icon: Zap },
  { id: "rocket", label: "로켓", Icon: Rocket },
  { id: "ghost", label: "유령", Icon: Ghost },
  { id: "cat", label: "고양이", Icon: Cat },
  { id: "leaf", label: "잎", Icon: Leaf },
]

// Tailwind 가 찾을 수 있게 클래스 이름을 그대로 적어 둠
export const SQUAD_COLORS: { id: string; label: string; tile: string; pill: string; swatch: string }[] = [
  { id: "amber", label: "호박", tile: "bg-amber-500/15 text-amber-300 border-amber-500/40", pill: "bg-amber-500/10 text-amber-200 border-amber-500/30", swatch: "bg-amber-500" },
  { id: "red", label: "빨강", tile: "bg-red-500/15 text-red-300 border-red-500/40", pill: "bg-red-500/10 text-red-200 border-red-500/30", swatch: "bg-red-500" },
  { id: "rose", label: "장미", tile: "bg-rose-500/15 text-rose-300 border-rose-500/40", pill: "bg-rose-500/10 text-rose-200 border-rose-500/30", swatch: "bg-rose-500" },
  { id: "violet", label: "보라", tile: "bg-violet-500/15 text-violet-300 border-violet-500/40", pill: "bg-violet-500/10 text-violet-200 border-violet-500/30", swatch: "bg-violet-500" },
  { id: "sky", label: "하늘", tile: "bg-sky-500/15 text-sky-300 border-sky-500/40", pill: "bg-sky-500/10 text-sky-200 border-sky-500/30", swatch: "bg-sky-500" },
  { id: "emerald", label: "초록", tile: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", pill: "bg-emerald-500/10 text-emerald-200 border-emerald-500/30", swatch: "bg-emerald-500" },
  { id: "teal", label: "청록", tile: "bg-teal-500/15 text-teal-300 border-teal-500/40", pill: "bg-teal-500/10 text-teal-200 border-teal-500/30", swatch: "bg-teal-500" },
  { id: "orange", label: "주황", tile: "bg-orange-500/15 text-orange-300 border-orange-500/40", pill: "bg-orange-500/10 text-orange-200 border-orange-500/30", swatch: "bg-orange-500" },
  { id: "zinc", label: "회색", tile: "bg-zinc-700/40 text-zinc-200 border-zinc-500/50", pill: "bg-zinc-700/40 text-zinc-200 border-zinc-600", swatch: "bg-zinc-400" },
]

export const squadColor = (id?: string | null) => SQUAD_COLORS.find((c) => c.id === id) || SQUAD_COLORS[0]
const isImage = (v?: string | null) => !!v && (/^https?:\/\//.test(v) || v.startsWith("/"))

// 스쿼드 아이콘 칸. icon 은 기본 아이콘 이름 또는 이미지 주소 (imageUrl 이 따로 있으면 그것이 우선)
export function SquadIcon({
  icon,
  imageUrl,
  color,
  size = "md",
  className = "",
}: {
  icon?: string | null
  imageUrl?: string | null
  color?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const box = { xs: "w-4 h-4 rounded", sm: "w-7 h-7 rounded-lg", md: "w-11 h-11 rounded-xl", lg: "w-14 h-14 rounded-2xl", xl: "w-20 h-20 rounded-2xl" }[size]
  const glyph = { xs: "w-2.5 h-2.5", sm: "w-4 h-4", md: "w-5 h-5", lg: "w-7 h-7", xl: "w-9 h-9" }[size]
  const src = imageUrl || (isImage(icon) ? icon : null)
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${box} object-cover border border-zinc-700 shrink-0 ${className}`} />
  }
  const Icon = (SQUAD_ICONS.find((i) => i.id === icon) || SQUAD_ICONS[0]).Icon
  return (
    <span className={`${box} inline-flex items-center justify-center border shrink-0 ${squadColor(color).tile} ${className}`} aria-hidden>
      <Icon className={glyph} />
    </span>
  )
}

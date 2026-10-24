"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { TarotCard, Season } from "@/types/tarot"
import { SEASONS } from "@/lib/tarot-utils"
import { Sparkles } from "lucide-react"

interface TarotCardViewProps {
  card: TarotCard
  season?: Season
  isFlipped?: boolean
  onClick?: () => void
  size?: "sm" | "md" | "lg" | "xl"
  showLabel?: boolean
  positionLabel?: string // 예: "1번 · 나의 속마음"
  isHighlighted?: boolean
  className?: string
}

export function TarotCardView({
  card,
  season = "spring",
  isFlipped = true,
  onClick,
  size = "md",
  showLabel = true,
  positionLabel,
  isHighlighted = false,
  className = "",
}: TarotCardViewProps) {
  const seasonInfo = SEASONS.find(s => s.key === season) || SEASONS[0]

  // Size mapping with precise proportional dimensions
  const sizeClasses = {
    sm: "w-28 h-44 text-[10px]",
    md: "w-36 h-56 sm:w-40 sm:h-64 text-xs",
    lg: "w-48 h-72 sm:w-52 sm:h-80 text-sm",
    xl: "w-60 h-88 sm:w-64 sm:h-96 text-base"
  }[size]

  const avatarBoxSize = {
    sm: "w-14 h-14",
    md: "w-16 h-16 sm:w-20 sm:h-20",
    lg: "w-24 h-24 sm:w-28 sm:h-28",
    xl: "w-32 h-32 sm:w-36 sm:h-36"
  }[size]

  // Character theme color
  const charColor = card.character === "덕지" 
    ? "#4F8CFF" 
    : card.character === "덕순" 
    ? "#FF7EB6" 
    : "#F5C451"

  const isDuckji = card.character === "덕지"
  const isDucksoon = card.character === "덕순"

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {positionLabel && (
        <div className="mb-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700/80 text-[11px] font-bold text-zinc-300 shadow-sm flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>{positionLabel}</span>
        </div>
      )}

      {/* 3D Perspective Container */}
      <div
        onClick={onClick}
        style={{ perspective: "1200px" }}
        className={`relative ${sizeClasses} rounded-2xl cursor-pointer transition-transform duration-300 ${
          isHighlighted ? "scale-105 " : ""
        }`}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 0 : 180 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="w-full h-full relative rounded-2xl shadow-2xl"
        >
          {/* =========================================
              CARD FRONT (0deg)
             ========================================= */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
            }}
            className={`absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-b ${seasonInfo.bgClass} bg-zinc-950 border-2 ${seasonInfo.borderClass} p-3 sm:p-3.5 flex flex-col justify-between overflow-hidden shadow-2xl z-10`}
          >
            {/* Subtle Starry Mesh Background */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:10px_10px]" />

            {/* Top Row: Season Pill + Hanja Pill */}
            <div className="relative z-10 flex items-center justify-between w-full">
              <span 
                className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm bg-black/40 backdrop-blur-sm"
                style={{ borderColor: `${seasonInfo.color}80`, color: seasonInfo.color }}
              >
                {seasonInfo.name} · {String(card.no).padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-[11px] text-zinc-300 font-bold px-2 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-700/80 shadow-sm">
                {card.hanja}
              </span>
            </div>

            {/* Middle: Character Illustration / Portrait */}
            <div className="relative z-10 my-auto flex flex-col items-center justify-center">
              <div 
                className={`${avatarBoxSize} rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/20 relative overflow-hidden transition-transform`}
                style={{ backgroundColor: `${charColor}20`, borderColor: `${charColor}60` }}
              >
                {card.image ? (
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-contain p-1 drop-shadow-md select-none pointer-events-none"
                    loading="lazy"
                  />
                ) : isDuckji ? (
                  <img
                    src="/images/characters/duckji.png"
                    alt="덕지"
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : isDucksoon ? (
                  <img
                    src="/images/characters/ducksoon.png"
                    alt="덕순"
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-1">
                    <span className="text-3xl sm:text-4xl filter drop-shadow-md">
                      ✨
                    </span>
                  </div>
                )}
                
                {/* Character Label Badge */}
                <div 
                  className="absolute bottom-0 inset-x-0 text-[8px] sm:text-[9px] font-black py-0.5 text-center bg-black/85 backdrop-blur-sm text-amber-300 border-t border-white/10 truncate px-1"
                >
                  {card.character}
                </div>
              </div>
            </div>

            {/* Bottom: Card Name, Summary, Keywords */}
            <div className="relative z-10 text-center w-full space-y-1">
              <div className="font-black text-white text-xs sm:text-sm tracking-tight flex items-center justify-center gap-1">
                <span>{card.name}</span>
                <span className="text-[10px] text-zinc-400 font-normal">({card.hanja})</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-300 leading-tight font-medium line-clamp-1">
                {card.short}
              </p>
              {/* Keywords Pills */}
              <div className="flex items-center justify-center gap-1 pt-0.5 flex-wrap">
                {card.keywords.slice(0, 2).map((kw, i) => (
                  <span key={i} className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-900/90 text-amber-300 border border-amber-500/30">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* =========================================
              CARD BACK (180deg)
             ========================================= */}
          <div
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className={`absolute inset-0 w-full h-full rounded-2xl bg-zinc-950 border-2 ${seasonInfo.borderClass} overflow-hidden shadow-2xl flex flex-col items-center justify-center z-10`}
          >
            {/* Celestial Card Back Image */}
            <img
              src="/images/tarot/card-back.jpg"
              alt="천문물상타로 뒷면"
              className="w-full h-full object-cover"
            />
            {/* Golden Overlay Frame Accent */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
            <div className="absolute bottom-2.5 inset-x-2 text-center pointer-events-none">
              <span className="text-[9px] sm:text-[10px] font-black text-amber-300/90 tracking-widest uppercase bg-black/60 px-2 py-0.5 rounded-full border border-amber-400/30 backdrop-blur-sm shadow-md">
                DUCKJI TAROT
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

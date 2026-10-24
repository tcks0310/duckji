"use client"

import * as React from "react"
import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  Share2, 
  Download, 
  Check, 
  Heart, 
  ShoppingBag, 
  MessageSquare, 
  RotateCcw,
  Zap,
  Sword,
  ShieldCheck,
  Star,
  Film,
  BrainCircuit,
  Scroll,
  Tag,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IsekaiProfile } from "@/lib/saju-engine"

interface SajuCardResultProps {
  profile: IsekaiProfile
  onGoToGoodsMaker: () => void
  onGoToGuildBoard: () => void
  onReset: () => void
}

export function SajuCardResult({
  profile,
  onGoToGoodsMaker,
  onGoToGuildBoard,
  onReset,
}: SajuCardResultProps) {
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // 3D holographic tilt calculations
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rX = ((y - centerY) / centerY) * -12
    const rY = ((x - centerX) / centerX) * 12
    setRotateX(rX)
    setRotateY(rY)
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    })
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Top Congratulation Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
          <span>전설의 VIP 이세계 사주 아바타 각성 완료</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          당신의 홀로그램 사주 포토카드
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          카드를 마우스로 움직여 3D 홀로그램 광택을 확인하고, 아크릴 스탠드나 3D 피규어로 제작해보세요!
        </p>
      </div>

      {/* Main Container: 3D Holographic Card + Detail Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: 3D Holographic Photocard (5 cols) */}
        <div className="md:col-span-5 flex justify-center">
          <div
            style={{ perspective: 1200 }}
            className="w-full max-w-xs"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <motion.div
              ref={cardRef}
              animate={{ rotateX, rotateY }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative aspect-[3/4.6] w-full rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-amber-400/60 shadow-2xl p-4 flex flex-col justify-between select-none cursor-pointer"
            >
              {/* Holographic Glare Overlay */}
              <div
                className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300 opacity-60"
                style={{
                  background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.35) 0%, rgba(255,255,255,0) 60%), linear-gradient(135deg, rgba(255,0,128,0.15), rgba(0,255,200,0.15), rgba(255,200,0,0.15))`
                }}
              />

              {/* Card Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{profile.primaryElement?.symbol || "🔥"}</span>
                  <span className="text-[10px] font-extrabold text-amber-400 tracking-wider">
                    DUKJI VIP CARD
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    {profile.mbti || "INFP"}
                  </span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-black shadow-md">
                    {profile.dayMaster?.name || "갑목(甲木)"}
                  </span>
                </div>
              </div>

              {/* Character Avatar Box */}
              <div className="relative z-10 my-2 aspect-square rounded-2xl overflow-hidden border border-zinc-700/80 bg-zinc-950">
                <img
                  src={profile.avatarImage || "/images/avatar/fire.jpg"}
                  alt={profile.heroNickname || "아바타"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-bold">
                  <span className="bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[140px]">
                    {profile.isekaiClass?.name || "전직 클래스"}
                  </span>
                  <span className="text-emerald-400 font-mono">Lv.999</span>
                </div>
              </div>

              {/* Card Info Details */}
              <div className="relative z-10 space-y-1.5">
                <div className="text-center">
                  <div className="text-[10px] text-zinc-400 font-medium">{profile.characterTitle || "VIP 모험가"}</div>
                  <div className="text-sm font-black text-white truncate drop-shadow">
                    {profile.heroNickname || "덕지 히어로"}
                  </div>
                </div>

                {/* Favorite Anime Pills */}
                <div className="flex justify-center gap-1 overflow-hidden">
                  {(profile.favoriteAnimeList || []).slice(0, 2).map((a, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 truncate max-w-[100px]">
                      {a}
                    </span>
                  ))}
                </div>

                {/* Micro Stats Bar */}
                <div className="grid grid-cols-3 gap-1 text-[9px] text-center font-bold">
                  <div className="bg-zinc-900/90 py-1 rounded-lg border border-zinc-800 text-purple-300">
                    <div>마력</div>
                    <div className="font-mono">{profile.stats?.magicPower ?? 90}</div>
                  </div>
                  <div className="bg-zinc-900/90 py-1 rounded-lg border border-zinc-800 text-rose-300">
                    <div>덕력</div>
                    <div className="font-mono">{profile.stats?.deokPower ?? 95}</div>
                  </div>
                  <div className="bg-zinc-900/90 py-1 rounded-lg border border-zinc-800 text-amber-300">
                    <div>가챠운</div>
                    <div className="font-mono">{profile.stats?.gachaLuck ?? 80}</div>
                  </div>
                </div>

                <div className="pt-0.5 text-[8px] text-zinc-500 text-center flex items-center justify-center gap-1">
                  <span>★ DUKJI FATE ARCHIVE • 2026 EDITION ★</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right: Detailed Summary & Next RPG Action CTAs (7 cols) */}
        <div className="md:col-span-7 space-y-5">
          {/* Summary Box */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>공식 사주 감정서 인증</span>
              </span>
              <span className="text-xs text-zinc-400">발행: DUKJI 만세력</span>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  "{profile.heroNickname || "모험가"}" 님의 이세계 스펙
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    MBTI: {profile.mbti || "INFP"}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    일간: {profile.dayMaster?.name || "갑목(甲木)"}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    오행: {profile.primaryElement?.korean || "화(火)"} ({profile.elementRatio?.[profile.primaryElement?.type || "fire"] ?? 40}%)
                  </span>
                </div>
              </div>

              {/* 3 Favorite Anime */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center gap-2">
                <Film className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="text-xs text-zinc-300 flex-1 truncate">
                  <strong className="text-white">최애작 3선:</strong> {(profile.favoriteAnimeList || []).join(" · ")}
                </div>
              </div>

              {/* Crossover & Saju Summary */}
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                {profile.primaryElement?.korean || "화(火)"} 속성의 기운과 {profile.dayMaster?.nature || "불꽃"}의 본원을 타고났으며, {profile.isekaiClass?.name || "전직 클래스"}으로 전생하여 {profile.isekaiClass?.passiveSkill || "패시브 스킬"}과 전용 무기({profile.isekaiClass?.weapon || "마도검"})를 다룹니다.
              </p>
            </div>

            {/* CTAs */}
            <div className="space-y-2.5 pt-2">
              <Button
                onClick={onGoToGoodsMaker}
                className="w-full bg-red-600 hover:bg-red-500 text-black font-black py-3.5 rounded-2xl text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>나만의 굿즈 제작하기 (아크릴/3D피규어/포토카드)</span>
              </Button>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  onClick={onGoToGuildBoard}
                  className="rounded-2xl border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-3 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>모험가 길드 광장</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="rounded-2xl border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-3 flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>복사완료!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>사주 카드 공유</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tarot Connection Banner */}
            <a
              href="/play/mbti"
              className="mt-3 block p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-left transition-all group shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🦆</span>
                  <div>
                    <div className="text-xs font-black text-amber-300 group-hover:text-amber-200 flex items-center gap-1.5">
                      <span>오늘은 카드로도 확인해볼까요?</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-black">무료</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      덕지&amp;덕순 천문물상타로 4장 뽑기로 나의 속마음·겉모습 비교하기 ➔
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </a>
          </div>

          <div className="flex justify-center">
            <button
              onClick={onReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다른 정보로 새로 풀기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


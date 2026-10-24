"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  Sword, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  RotateCcw, 
  Award, 
  Zap, 
  Layers, 
  Film, 
  BrainCircuit, 
  ShoppingBag,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IsekaiProfile } from "@/lib/saju-engine"
import { SAJU_NPCS } from "@/data/saju-data"

interface SajuWebtoonStoryProps {
  profile: IsekaiProfile
  onCompleteToResult: () => void
  onReset: () => void
  onGoToGoodsMaker: () => void
}

export function SajuWebtoonStory({
  profile,
  onCompleteToResult,
  onReset,
  onGoToGoodsMaker,
}: SajuWebtoonStoryProps) {
  const [currentCut, setCurrentCut] = useState<1 | 2 | 3 | 4>(1)

  const cuts = [
    {
      step: 1,
      title: "제1장: 내면의 거울 & 영혼의 본원",
      npcName: "차원 점술사 루나",
      npcAvatar: "/images/npc/luna.jpg",
      npcQuote: "별빛의 궤적과 사주 원국이 당신의 숨겨진 영혼을 비추고 있어요...",
      bgGradient: "from-purple-950/40 via-zinc-950 to-zinc-950"
    },
    {
      step: 2,
      title: "제2장: 오행의 정령 융합 & 기질 각성",
      npcName: "전생 기록관 아카샤",
      npcAvatar: "/images/npc/akasha.jpg",
      npcQuote: "당신의 MBTI와 타고난 오행 에너지가 아카식 서고에서 하나로 공명합니다.",
      bgGradient: "from-emerald-950/40 via-zinc-950 to-zinc-950"
    },
    {
      step: 3,
      title: "제3장: 영혼의 전용 전설 무기 강림",
      npcName: "이세계 여신 아쿠아리아",
      npcAvatar: "/images/npc/aquaria.jpg",
      npcQuote: "용사님을 위해 3대 명작의 정수를 녹여 만든 전용 무기가 완성되었습니다!",
      bgGradient: "from-cyan-950/40 via-zinc-950 to-zinc-950"
    },
    {
      step: 4,
      title: "제4장: 내면의 나 ↔ 아바타 영혼 합일",
      npcName: "전설의 대장장이 헤파이",
      npcAvatar: "/images/npc/hepai.jpg",
      npcQuote: "자네의 영혼과 아바타의 동기화율은 99.9%! 최고위 VIP 만렙으로 각성했네!",
      bgGradient: "from-amber-950/40 via-zinc-950 to-zinc-950"
    }
  ]

  const activeCutMeta = cuts[currentCut - 1]

  const handleNext = () => {
    if (currentCut < 4) {
      setCurrentCut((prev) => (prev + 1) as any)
      window.scrollTo({ top: 120, behavior: "smooth" })
    } else {
      onCompleteToResult()
    }
  }

  const handlePrev = () => {
    if (currentCut > 1) {
      setCurrentCut((prev) => (prev - 1) as any)
      window.scrollTo({ top: 120, behavior: "smooth" })
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Top Episode Progress Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5 rounded-3xl backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              웹툰 컷씬 {currentCut} / 4
            </span>
            <span className="text-xs sm:text-sm font-black text-white">{activeCutMeta.title}</span>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            SYNC {currentCut === 1 ? "25%" : currentCut === 2 ? "50%" : currentCut === 3 ? "75%" : "99.9%"}
          </span>
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentCut(step as any)}
              className={`h-2 rounded-full transition-all ${
                currentCut >= step
                  ? "bg-amber-400"
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Webtoon Comic Panel Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCut}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.35 }}
          className="bg-zinc-900/95 border-2 border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 overflow-hidden relative"
        >
          {/* NPC Narration Bubble */}
          <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-inner">
            <img
              src={activeCutMeta.npcAvatar}
              alt={activeCutMeta.npcName}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-400/60 shadow-lg flex-shrink-0"
            />
            <div className="space-y-1">
              <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{activeCutMeta.npcName}</span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-200 font-medium italic leading-relaxed">
                "{activeCutMeta.npcQuote}"
              </p>
            </div>
          </div>

          {/* =================== CUT 1: Inner Mirror & Saju Origin =================== */}
          {currentCut === 1 && (
            <div className="space-y-6">
              {/* Big Comic Illustration Frame */}
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border-2 border-purple-500/40 shadow-2xl bg-zinc-950 flex flex-col justify-end p-6">
                <img
                  src={profile.avatarImage || "/images/avatar/fire.jpg"}
                  alt="내면의 거울"
                  className="absolute inset-0 w-full h-full object-cover filter brightness-90 contrast-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/30 text-purple-300 text-xs font-black border border-purple-400/50 backdrop-blur-md">
                    <span>사주 일간(日干) 본원 각성</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
                    당신의 영혼 본질: <span className="text-amber-400">{profile.dayMaster?.name}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-200 font-medium line-clamp-2 drop-shadow">
                    자연의 형상: {profile.dayMaster?.nature} • {profile.dayMaster?.title}
                  </p>
                </div>
              </div>

              {/* Concise Saju Reading Card */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-amber-400">사주 원국 4주 8자 요약</span>
                  <span className="text-zinc-500">
                    일주: {profile.fourPillars?.dayPillar?.stem}{profile.fourPillars?.dayPillar?.branch}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium">
                  {profile.sajuReasoning?.originAnalysis || profile.dayMaster?.description}
                </p>
              </div>
            </div>
          )}

          {/* =================== CUT 2: Elemental Aura & MBTI Fusion =================== */}
          {currentCut === 2 && (
            <div className="space-y-6">
              {/* Big Comic Illustration Frame */}
              <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl bg-zinc-950 flex flex-col justify-end p-6">
                <img
                  src="/images/npc/akasha.jpg"
                  alt="오행 융합"
                  className="absolute inset-0 w-full h-full object-cover filter brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-black border border-emerald-400/50 backdrop-blur-md">
                    <span>MBTI [{profile.mbti}] X {profile.primaryElement?.korean} 융합</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
                    {profile.protagonistType}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-200 font-medium drop-shadow">
                    주도 속성 {profile.primaryElement?.korean} ({profile.elementRatio?.[profile.primaryElement?.type || "fire"] ?? 40}%)
                  </p>
                </div>
              </div>

              {/* MBTI X Saju Fusion Reading */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" />
                  <span>내면의 심리 & 덕질 기질 분석</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium">
                  {profile.sajuReasoning?.mbtiFusionAnalysis}
                </p>

                {/* User's 3 Favorite Anime Pills */}
                <div className="pt-2 border-t border-zinc-900 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-bold">융합된 최애작:</span>
                  {(profile.favoriteAnimeList || []).map((anime, i) => (
                    <span key={i} className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-amber-300">
                      #{anime}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =================== CUT 3: Legendary Weapon Awakening =================== */}
          {currentCut === 3 && (
            <div className="space-y-6">
              {/* Legendary Weapon Card */}
              <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-8 rounded-3xl border-2 border-amber-400/80 shadow-2xl space-y-5 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Weapon Rarity Badge */}
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-red-600 text-black text-xs font-black shadow-md">
                    {profile.recommendedWeapon?.rarity || "Mythic"} 전설 무기
                  </span>
                  <span className="text-xs font-mono font-black text-amber-400">
                    ATK +{profile.recommendedWeapon?.attackPower.toLocaleString()}
                  </span>
                </div>

                {/* Weapon Visual Emblem */}
                <div className="w-24 h-24 mx-auto rounded-3xl bg-zinc-950 border-2 border-amber-400/60 flex items-center justify-center text-4xl shadow-xl">
                  ⚔️
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-400">{profile.recommendedWeapon?.type}</span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {profile.recommendedWeapon?.name}
                  </h3>
                </div>

                {/* Lore */}
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-lg mx-auto bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800">
                  {profile.recommendedWeapon?.lore}
                </p>

                {/* Signature Skill */}
                <div className="bg-zinc-900 p-3.5 rounded-2xl border border-amber-400/40 text-left">
                  <div className="text-[11px] font-black text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>전용 필살 오의</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    {profile.recommendedWeapon?.signatureSkill}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================== CUT 4: Fully Synchronized Avatar =================== */}
          {currentCut === 4 && (
            <div className="space-y-6">
              {/* Final Complete Avatar Showcase */}
              <div className="relative aspect-[16/11] rounded-3xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-zinc-950 flex flex-col justify-end p-6 sm:p-8">
                <img
                  src={profile.avatarImage || "/images/avatar/fire.jpg"}
                  alt="완전 각성 아바타"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <div className="relative z-10 space-y-2">
                  <span className="px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-black shadow-md">
                    {profile.characterTitle}
                  </span>
                  <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-lg">
                    "{profile.heroNickname}"
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-200">
                    <span className="bg-black/70 px-2.5 py-1 rounded-lg border border-zinc-700">
                      무기: {profile.recommendedWeapon?.name.split(":")[0]}
                    </span>
                    <span className="bg-black/70 px-2.5 py-1 rounded-lg border border-zinc-700 text-emerald-400">
                      동기화율 99.9% (영혼 합일)
                    </span>
                  </div>
                </div>
              </div>

              {/* 2026 Fortune & Next Action */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>2026 영혼의 가챠 & 덕운 총평</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium">
                  {profile.fortune2026?.overallSummary}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="rounded-2xl border-zinc-800 text-zinc-400 hover:text-white text-xs px-3"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                처음으로
              </Button>

              {currentCut > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="rounded-2xl border-zinc-700 text-zinc-300 hover:text-white text-xs px-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  이전 장면
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentCut === 4 && (
                <Button
                  onClick={onGoToGoodsMaker}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2.5 px-4 rounded-2xl text-xs shadow-lg flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>실물 굿즈 제작</span>
                </Button>
              )}

              <Button
                onClick={handleNext}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black py-2.5 px-5 rounded-2xl text-xs sm:text-sm shadow-xl flex items-center gap-2"
              >
                {currentCut < 4 ? (
                  <>
                    <span>다음 이야기 ({currentCut + 1}장)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>3D 홀로그램 사주 카드 확인</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

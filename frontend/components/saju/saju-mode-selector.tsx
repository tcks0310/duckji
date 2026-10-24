"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Sparkles, Sword, Film, ArrowRight, BookOpen, Compass, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export type SajuExperienceMode = "webtoon_story" | "anime_recommendation"

interface SajuModeSelectorProps {
  onSelectMode: (mode: SajuExperienceMode) => void
}

export function SajuModeSelector({ onSelectMode }: SajuModeSelectorProps) {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 py-4">
      {/* Title Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-lg">
          <span>DUKJI 만세력 사주 캐릭터 포털</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          어떤 방식으로 덕지 사주 캐릭터를 체험하시겠습니까?
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          내면의 영웅 아바타와 전용 전설 무기를 완성하는 <strong>웹툰 스토리형 사주</strong> 또는, 나의 사주와 MBTI에 꼭 맞는 <strong>애니 & 팝업스토어 추천관</strong>을 선택하세요.
        </p>
      </div>

      {/* Dual Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode 1: Webtoon Visual Story Saju */}
        <motion.div
          whileHover={{ y: -6, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          onClick={() => onSelectMode("webtoon_story")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 border-2 border-zinc-800 hover:border-amber-400/80 p-6 sm:p-8 shadow-2xl transition-all flex flex-col justify-between"
        >
          {/* Ambient Glow */}

          <div className="space-y-4 relative z-10">
            {/* Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <BookOpen className="w-3.5 h-3.5" />
                <span>MODE 1 • 웹툰 컷씬형</span>
              </span>
              <span className="text-[11px] font-bold text-zinc-500">추천: 몰입형 서사</span>
            </div>

            {/* Illustration Mockup Thumbnail */}
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 group-hover:border-amber-400/40 transition-colors">
              <img
                src="/images/avatar/fire.jpg"
                alt="웹툰 스토리 사주"
                className="w-full h-full object-cover transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-black">
                <span className="bg-black/70 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-zinc-700">
                  내면의 아바타 & 전설 무기 연성
                </span>
                <span className="text-amber-400 font-mono">Sync 99.9%</span>
              </div>
            </div>

            {/* Content Text */}
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                웹툰 스토리 사주: 내면의 아바타 각성
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                글이 많은 딱딱한 풀이 대신, <strong>큼직한 웹툰 컷씬</strong>으로 내면의 거울 탐색 ➔ 오행 융합 ➔ <strong>나에게 맞는 전설 무기 각성</strong> ➔ 아바타 완성을 차례로 경험합니다.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>웹툰 컷씬 비주얼</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                <Sword className="w-3 h-3 text-red-400" />
                <span>전용 전설 무기 추천</span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-6 relative z-10">
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-2xl text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-transform">
              <span>웹툰 스토리로 내 아바타 각성하기</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Mode 2: Anime X Saju X Popup Curation */}
        <motion.div
          whileHover={{ y: -6, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          onClick={() => onSelectMode("anime_recommendation")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 border-2 border-zinc-800 hover:border-emerald-400/80 p-6 sm:p-8 shadow-2xl transition-all flex flex-col justify-between"
        >
          {/* Ambient Glow */}

          <div className="space-y-4 relative z-10">
            {/* Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Film className="w-3.5 h-3.5" />
                <span>MODE 2 • 큐레이션관</span>
              </span>
              <span className="text-[11px] font-bold text-zinc-500">추천: 명작 탐색 & 팝업 방문</span>
            </div>

            {/* Illustration Mockup Thumbnail */}
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 group-hover:border-emerald-400/40 transition-colors">
              <img
                src="/images/npc/akasha.jpg"
                alt="애니 & 팝업스토어 추천관"
                className="w-full h-full object-cover transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-black">
                <span className="bg-black/70 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-zinc-700">
                  사주 맞춤 애니 & 실시간 팝업 매칭
                </span>
                <span className="text-emerald-400 font-mono">100% 실데이터</span>
              </div>
            </div>

            {/* Content Text */}
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                사주 X MBTI 명작 애니 & 팝업 추천관
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                나의 사주 일간과 MBTI를 결합하여 <strong>인생 애니메이션 TOP 3</strong> 및 <strong>소울메이트 캐릭터</strong>를 추천받고, DUKJI에 등록된 <strong>실제 팝업스토어 행사</strong>를 연계 확인합니다.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>명작 애니 & 소울메이트</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                <Compass className="w-3 h-3 text-emerald-400" />
                <span>연관 팝업스토어 즉시 연계</span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-6 relative z-10">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-2xl text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-transform">
              <span>내 사주 맞춤 애니 & 팝업 추천받기</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

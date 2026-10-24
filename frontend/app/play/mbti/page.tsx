"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  HelpCircle, 
  RefreshCw, 
  MapPin, 
  Award, 
  CheckCircle2, 
  Heart,
  ChevronRight,
  Info
} from "lucide-react"

import { TAROT_CARDS, INTRO_THREE_LINES, DISCLAIMER_TEXT, saveTarotStamp } from "@/lib/tarot-utils"
import { TarotCardView } from "@/components/tarot/tarot-card-view"
import { TarotCard, Season } from "@/types/tarot"
import tarotConfig from "@/data/tarot-config.json"

export default function TarotHomePage() {
  // Single Card Draw State
  const [singleCard, setSingleCard] = useState<TarotCard | null>(null)
  const [singleSeason, setSingleSeason] = useState<Season>("spring")
  const [isSingleFlipped, setIsSingleFlipped] = useState(false)
  const [singleDrawn, setSingleDrawn] = useState(false)
  const [stampNotice, setStampNotice] = useState<string | null>(null)

  const handleDrawSingle = () => {
    const seasons: Season[] = ["spring", "summer", "autumn", "winter"]
    const randomSeason = seasons[Math.floor(Math.random() * seasons.length)]
    const randomCard = TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)]

    setSingleSeason(randomSeason)
    setSingleCard(randomCard)
    setIsSingleFlipped(false)
    setSingleDrawn(true)

    setTimeout(() => {
      setIsSingleFlipped(true)
      const res = saveTarotStamp("single")
      if (res.isNew) {
        setStampNotice(`🎉 오늘의 도장 1개 + ${res.gainedDP} DP가 적립되었습니다!`)
      }
    }, 400)
  }

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* 1. HERO SECTION */}
      <section className="relative text-center pt-6 sm:pt-10 pb-4 overflow-hidden">
        {/* Ambient Glows */}

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-purple-500/20 border-2 border-amber-400/60 text-amber-300 text-xs font-black shadow-lg shadow-amber-500/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>덕지 자체 캐릭터 IP · 덕지덕순 물상 카드</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            덕지덕순 물상 카드
          </h1>

          <p className="text-sm sm:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed">
            22가지 유형 카드, 귀여운 오리 둘이 오늘의 속마음·성향 물상 카드를 읽어줘요
          </p>

          {/* First-time visitor 3-line notice */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 max-w-md mx-auto space-y-1 shadow-inner">
            {INTRO_THREE_LINES.map((line, idx) => (
              <p key={idx} className="font-medium">
                ✨ {line}
              </p>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/play/mbti/draw"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              <span>무료 물상 카드 분석하기 (4성향 진단)</span>
            </Link>

            <Link
              href="/play/mbti/cards"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>22유형 물상 카드 도감 구경하기</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. DUCKJI & DUCKSOON INTRO */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-white">
            마스코트 오리 둘을 소개해요
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            나와 상대의 속마음과 겉모습을 담당하는 든든한 친구들
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Duckji (Yang) */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-950/40 via-zinc-900 to-zinc-900 border border-[#4F8CFF]/40 relative overflow-hidden shadow-xl flex flex-col sm:flex-row items-center gap-5 group hover:border-[#4F8CFF] transition-all">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#4F8CFF]/20 border-2 border-[#4F8CFF]/60 overflow-hidden shadow-lg shrink-0 flex items-center justify-center">
              <img
                src="/images/characters/duckji.png"
                alt="덕지 마스코트"
                className="w-full h-full object-contain p-1 drop-shadow-md"
              />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4F8CFF]/20 text-[#4F8CFF] text-[11px] font-black border border-[#4F8CFF]/30">
                <span>양(陽)의 기운</span>
                <span>·</span>
                <span>직진과 당당함</span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>덕지 (DUCKJI)</span>
                <span className="text-xs font-bold text-[#4F8CFF] px-1.5 py-0.5 rounded bg-[#4F8CFF]/10">남아</span>
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                당당하고 직진하는 오리. 겉으로 드러나는 빛과 행동의 힘을 담당해요.
              </p>
            </div>
          </div>

          {/* Ducksoon (Yin) */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-pink-950/40 via-zinc-900 to-zinc-900 border border-[#FF7EB6]/40 relative overflow-hidden shadow-xl flex flex-col sm:flex-row items-center gap-5 group hover:border-[#FF7EB6] transition-all">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#FF7EB6]/20 border-2 border-[#FF7EB6]/60 overflow-hidden shadow-lg shrink-0 flex items-center justify-center">
              <img
                src="/images/characters/ducksoon.png"
                alt="덕순 마스코트"
                className="w-full h-full object-contain p-1 drop-shadow-md"
              />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7EB6]/20 text-[#FF7EB6] text-[11px] font-black border border-[#FF7EB6]/30">
                <span>음(陰)의 기운</span>
                <span>·</span>
                <span>섬세함과 끈기</span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>덕순 (DUCKSOON)</span>
                <span className="text-xs font-bold text-[#FF7EB6] px-1.5 py-0.5 rounded bg-[#FF7EB6]/10">여아</span>
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                섬세하고 끈기 있는 오리. 조용히 스며드는 깊은 내면의 힘을 담당해요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (3 STEPS) */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-white">
            어떻게 보나요?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            복잡한 과정 없이 30초 만에 속마음과 겉모습을 확인해요
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg font-black">
              1
            </div>
            <h4 className="font-bold text-white text-sm">궁금한 걸 고르고</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              연애, 최애 덕질, 지름, 친구 관계, 티켓팅 중 지금 가장 궁금한 주제 선택
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg font-black">
              2
            </div>
            <h4 className="font-bold text-white text-sm">카드 4장을 뽑으면</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              4계절 덱 88장에서 나 속/겉, 상대 속/겉 자리에 맞게 4장 터치
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-zinc-900/70 border border-zinc-800 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg font-black">
              3
            </div>
            <h4 className="font-bold text-white text-sm">속마음·겉모습 비교</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              한 줄 요약, 코믹 등급 배지, 합·충 관계 분석과 맞춤 덕질 팁 확인!
            </p>
          </div>
        </div>
      </section>

      {/* 4. TODAY'S SINGLE CARD (LIGHTEST ENTRY) */}
      <section className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-amber-500/30 text-center space-y-6 shadow-2xl relative">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>초간단 오늘의 운세</span>
          </div>
          <h3 className="text-xl font-black text-white">오늘의 한 장 뽑기</h3>
          <p className="text-xs text-zinc-400">
            하루 한 번, 나를 위한 작은 한마디와 행운의 아이템을 받아보세요
          </p>
        </div>

        {/* Drawn Card Display */}
        {singleDrawn && singleCard ? (
          <div className="flex flex-col items-center space-y-4">
            <TarotCardView
              card={singleCard}
              season={singleSeason}
              isFlipped={isSingleFlipped}
              size="lg"
            />
            {isSingleFlipped && (
              <div className="space-y-2 pt-2 animate-fade-in">
                <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <div className="text-xs font-black text-amber-400">
                    &ldquo;{singleCard.short}&rdquo;
                  </div>
                  <div className="text-xs text-zinc-300">
                    {singleCard.tip}
                  </div>
                </div>

                {stampNotice && (
                  <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
                    {stampNotice}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center">
            <div 
              onClick={handleDrawSingle}
              className="w-36 h-[222px] rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-lg group"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-amber-300">
                카드 탭하여 뒤집기
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleDrawSingle}
          className="px-6 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{singleDrawn ? "다시 한 장 뽑아보기" : "오늘의 한 장 뽑기"}</span>
        </button>
      </section>

      {/* 5. CARD DICTIONARY PREVIEW (HORIZONTAL SCROLL) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">22유형 성향 도감 미리보기</h2>
            <p className="text-xs text-zinc-400">오리 10유형 + 12지 동물 12유형으로 구성되어 있어요</p>
          </div>
          <Link
            href="/play/mbti/cards"
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline"
          >
            <span>전체보기</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {TAROT_CARDS.slice(0, 8).map((c) => (
            <div key={c.id} className="shrink-0">
              <TarotCardView
                card={c}
                season="autumn"
                size="sm"
                isFlipped={true}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 6. OFFLINE CONNECTION BANNER */}
      <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-950/30 via-zinc-900 to-zinc-900 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
            <MapPin className="w-3.5 h-3.5" />
            <span>오프라인에서 더 깊게</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            팝업 현장 부스에서 1:1 물상 카드 성향 상담을 만나보세요
          </h3>
          <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
            자사 플래그십 및 제휴 팝업스토어에서는 실물 카드로 전문 상담사의 1:1 심층 물상 카드 분석과 현장 전용 굿즈 혜택을 받으실 수 있습니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          <Link
            href="/#section-events"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center transition-all shadow-md"
          >
            현장 팝업 일정 보기
          </Link>
          <Link
            href="/play/mbti/code"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs text-center transition-all"
          >
            현장 QR 코드 등록
          </Link>
        </div>
      </section>

      {/* 7. COMING SOON TEASER (Configurable) */}
      {tarotConfig.teaser2 && (
        <section className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-3">
          <span className="text-xs font-black text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            Coming Soon · 2탄 예고
          </span>
          <h4 className="text-base font-extrabold text-white">
            오행 물상 × 12운성 × 12신살 심화 덱 준비 중!
          </h4>
          <p className="text-xs text-zinc-400">
            더 깊고 재미있는 스토리와 아바타 장비 획득이 가능한 2탄 덱이 곧 찾아옵니다.
          </p>
        </section>
      )}
    </div>
  )
}

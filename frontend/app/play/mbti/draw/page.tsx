"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  RotateCcw, 
  Share2, 
  MapPin, 
  Award, 
  CheckCircle2, 
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ShieldCheck
} from "lucide-react"

import { QUESTIONS, draw4Cards, checkComboType, checkRelationBetweenCards, getComicRankBadge, saveTarotStamp, saveTarotHistory, DISCLAIMER_TEXT } from "@/lib/tarot-utils"
import { DrawnCard, QuestionOption, RelationBadgeInfo } from "@/types/tarot"
import { TarotCardView } from "@/components/tarot/tarot-card-view"
import { TarotShareModal } from "@/components/tarot/tarot-share-modal"
import { Button } from "@/components/ui/button"

export default function TarotDrawPage() {
  // Step State: 'select' -> 'shuffle' -> 'draw' -> 'result'
  const [step, setStep] = useState<"select" | "shuffle" | "draw" | "result">("select")
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionOption>(QUESTIONS[0])
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([])
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false])
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [stampReward, setStampReward] = useState<{ isNew: boolean; gainedDP: number } | null>(null)

  // Start Drawing Flow
  const handleStartDraw = () => {
    setStep("shuffle")
    const newCards = draw4Cards()
    setDrawnCards(newCards)
    setFlippedCards([false, false, false, false])

    setTimeout(() => {
      setStep("draw")
    }, 1200)
  }

  // Flip individual card
  const handleFlipCard = (index: number) => {
    if (flippedCards[index]) return
    const nextFlipped = [...flippedCards]
    nextFlipped[index] = true
    setFlippedCards(nextFlipped)

    // If all 4 are flipped, proceed to result after a short delay
    if (nextFlipped.every(Boolean)) {
      setTimeout(() => {
        setStep("result")
        // Save to stamps and history
        const combo = checkComboType(drawnCards)
        const res = saveTarotStamp("draw", combo)
        setStampReward({ isNew: res.isNew, gainedDP: res.gainedDP })

        const summary = `${drawnCards[0].short}, ${drawnCards[1].short}인 하루!`
        const comicRank = getComicRankBadge(drawnCards)
        const rel = checkRelationBetweenCards(drawnCards[1], drawnCards[3])

        saveTarotHistory({
          id: `tarot-${Date.now()}`,
          timestamp: new Date().toISOString(),
          questionKey: selectedQuestion.key,
          questionLabel: selectedQuestion.label,
          cards: drawnCards,
          summary,
          comicRank,
          comboType: combo,
          relationBadge: rel
        })
      }, 700)
    }
  }

  // Flip all at once
  const handleFlipAll = () => {
    setFlippedCards([true, true, true, true])
    setTimeout(() => {
      setStep("result")
      const combo = checkComboType(drawnCards)
      const res = saveTarotStamp("draw", combo)
      setStampReward({ isNew: res.isNew, gainedDP: res.gainedDP })

      const summary = `${drawnCards[0].short}, ${drawnCards[1].short}인 하루!`
      const comicRank = getComicRankBadge(drawnCards)
      const rel = checkRelationBetweenCards(drawnCards[1], drawnCards[3])

      saveTarotHistory({
        id: `tarot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        questionKey: selectedQuestion.key,
        questionLabel: selectedQuestion.label,
        cards: drawnCards,
        summary,
        comicRank,
        comboType: combo,
        relationBadge: rel
      })
    }, 500)
  }

  const handleReset = () => {
    setStep("select")
    setDrawnCards([])
    setFlippedCards([false, false, false, false])
    setStampReward(null)
  }

  // Result derived data
  const comboType = drawnCards.length === 4 ? checkComboType(drawnCards) : "normal"
  const comicRank = drawnCards.length === 4 ? getComicRankBadge(drawnCards) : "⭐ 슬기로운 덕질러"
  const relationBadge: RelationBadgeInfo = drawnCards.length === 4 
    ? checkRelationBetweenCards(drawnCards[1], drawnCards[3])
    : { type: "평온", emoji: "🍃", title: "평온", description: "", badgeColor: "" }

  // 1-line summary synthesis
  const summaryText = drawnCards.length === 4
    ? `속은 ${drawnCards[0].name}(${drawnCards[0].short})인데, 겉은 ${drawnCards[1].name}(${drawnCards[1].short})의 기운이네요!`
    : ""

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* STEP 1: QUESTION SELECTION */}
      {step === "select" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 py-6"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <span>STEP 1 · 오늘의 질문 선택</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white">
              지금 가장 궁금한 질문을 골라주세요
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              덕지와 덕순이가 4장의 카드로 속마음과 겉모습을 솔직하게 풀어드려요
            </p>
          </div>

          {/* Question Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-3xl mx-auto text-left">
            {QUESTIONS.map((q) => {
              const isSelected = selectedQuestion.key === q.key
              return (
                <div
                  key={q.key}
                  onClick={() => setSelectedQuestion(q)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-amber-500/15 border-amber-400 shadow-lg scale-[1.02]"
                      : "bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{q.emoji}</span>
                    {isSelected && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-black">
                        선택됨
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm text-white">{q.label}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{q.description}</p>
                </div>
              )
            })}
          </div>

          <div className="pt-4">
            <Button
              onClick={handleStartDraw}
              className="px-8 py-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-base shadow-xl transition-all"
            >
              <span>4장 덱 셔플하고 뽑기 시작</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* STEP 2: SHUFFLE ANIMATION */}
      {step === "shuffle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 space-y-6"
        >
          <div className="relative w-28 h-36 mx-auto">
            <motion.div
              animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.05, 0.95, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-full h-full rounded-2xl bg-amber-500 border-2 border-white shadow-2xl flex items-center justify-center text-4xl"
            >
              🦆
            </motion.div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">4계절 88장 덱을 셔플하는 중...</h2>
            <p className="text-xs text-zinc-400">나와 상대의 속마음 카드를 준비하고 있어요</p>
          </div>
        </motion.div>
      )}

      {/* STEP 3: DRAW 4 CARDS INTERACTION */}
      {step === "draw" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-center"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <span>{selectedQuestion.emoji}</span>
              <span>{selectedQuestion.label}</span>
            </div>
            <h2 className="text-2xl font-black text-white">카드를 한 장씩 탭해서 뒤집어주세요</h2>
            <p className="text-xs text-zinc-400">
              1번(나 속) · 2번(나 겉) · 3번(상대 속) · 4번(상대 겉) 순서예요
            </p>
          </div>

          {/* 4 Cards Grid (2x2 on Mobile, 4 in row on Desktop) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 py-4 max-w-3xl mx-auto">
            {drawnCards.map((card, idx) => {
              const posLabel = idx === 0 
                ? "1번 · 나의 속마음" 
                : idx === 1 
                ? "2번 · 나의 겉모습" 
                : idx === 2 
                ? "3번 · 상대의 속마음" 
                : "4번 · 상대의 겉모습"

              return (
                <div key={idx} className="flex flex-col items-center">
                  <TarotCardView
                    card={card}
                    season={card.season}
                    isFlipped={flippedCards[idx]}
                    onClick={() => handleFlipCard(idx)}
                    positionLabel={posLabel}
                    size="md"
                  />
                  <span className="text-[11px] font-bold text-zinc-400 mt-2">
                    {flippedCards[idx] ? "확인 완료" : "탭하여 뒤집기"}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleFlipAll}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold underline py-2"
          >
            한 번에 모두 뒤집기 ➔
          </button>
        </motion.div>
      )}

      {/* STEP 4: FINAL RESULTS DISPLAY */}
      {step === "result" && drawnCards.length === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header Summary Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-amber-500/30 text-center space-y-4 shadow-2xl relative overflow-hidden">

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold border border-amber-500/30">
                {selectedQuestion.emoji} {selectedQuestion.label}
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-white text-xs font-black border border-zinc-700">
                {comicRank}
              </span>
              {comboType !== "normal" && (
                <span className="px-3 py-1 rounded-full bg-pink-500 text-black text-xs font-black shadow-md animate-pulse">
                  {comboType === "all_season" ? "🌈 사계절 풀콤보!" : comboType === "triple" ? "⭐ 금빛 트리플 콤보!" : "✨ 은빛 더블 콤보!"}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white leading-snug max-w-2xl mx-auto">
              &ldquo;{summaryText}&rdquo;
            </h1>

            {/* Stamp DP alert */}
            {stampReward?.isNew && (
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>오늘의 MBTI 도장 1개 + {stampReward.gainedDP} DP가 적립되었습니다!</span>
              </div>
            )}
          </div>

          {/* 4 Cards Visual Presentation */}
          <div className="p-4 sm:p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800">
            <div className="text-center mb-4">
              <span className="text-xs font-black text-amber-300 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                뽑힌 4장의 천문물상 카드
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 justify-items-center max-w-4xl mx-auto">
              {drawnCards.map((card, idx) => {
                const posLabel = idx === 0 
                  ? "1번 · 나 속" 
                  : idx === 1 
                  ? "2번 · 나 겉" 
                  : idx === 2 
                  ? "3번 · 상대 속" 
                  : "4번 · 상대 겉"

                return (
                  <div key={idx} className="flex flex-col items-center">
                    <TarotCardView
                      card={card}
                      season={card.season}
                      isFlipped={true}
                      positionLabel={posLabel}
                      size="sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4 Cards Interpretation Grid (2x2 Structure) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: 나 (1: 속마음, 2: 겉모습) */}
            <div className="space-y-4 p-5 rounded-3xl bg-zinc-900/60 border border-blue-500/30">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-xs font-black text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>나의 에너지 (덕지 포지션)</span>
                </span>
                <span className="text-[11px] text-zinc-500">속마음 &amp; 겉모습</span>
              </div>

              {/* 1. My Inner */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    1번 · 나의 속마음 (Inner)
                  </span>
                  <span className="text-xs font-black text-white">{drawnCards[0].name}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {drawnCards[0].inner}
                </p>
                <div className="text-[11px] text-amber-300/90 pt-1 border-t border-zinc-900">
                  💬 {drawnCards[0].q[selectedQuestion.key]}
                </div>
              </div>

              {/* 2. My Outer */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    2번 · 나의 겉모습 (Outer)
                  </span>
                  <span className="text-xs font-black text-white">{drawnCards[1].name}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {drawnCards[1].outer}
                </p>
                <div className="text-[11px] text-amber-300/90 pt-1 border-t border-zinc-900">
                  💬 {drawnCards[1].q[selectedQuestion.key]}
                </div>
              </div>
            </div>

            {/* Right Column: 상대/상황 (3: 속마음, 4: 겉모습) */}
            <div className="space-y-4 p-5 rounded-3xl bg-zinc-900/60 border border-pink-500/30">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-xs font-black text-pink-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  <span>상대 및 상황 (덕순 포지션)</span>
                </span>
                <span className="text-[11px] text-zinc-500">속마음 &amp; 겉모습</span>
              </div>

              {/* 3. Partner Inner */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">
                    3번 · 상대의 속마음 (Inner)
                  </span>
                  <span className="text-xs font-black text-white">{drawnCards[2].name}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {drawnCards[2].inner}
                </p>
                <div className="text-[11px] text-amber-300/90 pt-1 border-t border-zinc-900">
                  💬 {drawnCards[2].q[selectedQuestion.key]}
                </div>
              </div>

              {/* 4. Partner Outer */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">
                    4번 · 상대의 겉모습 (Outer)
                  </span>
                  <span className="text-xs font-black text-white">{drawnCards[3].name}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {drawnCards[3].outer}
                </p>
                <div className="text-[11px] text-amber-300/90 pt-1 border-t border-zinc-900">
                  💬 {drawnCards[3].q[selectedQuestion.key]}
                </div>
              </div>
            </div>
          </div>

          {/* Relation Badge & Daily Tip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Relation Badge Card */}
            <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="text-xs font-bold text-zinc-400">겉모습 케미 (2번 &amp; 4번 카드 조합)</div>
              <div className="flex items-center gap-2.5 pt-1">
                <span className="text-2xl">{relationBadge.emoji}</span>
                <div>
                  <h4 className="text-sm font-extrabold text-white">{relationBadge.title}</h4>
                  <p className="text-xs text-zinc-300 mt-0.5">{relationBadge.description}</p>
                </div>
              </div>
            </div>

            {/* Daily Tip Card */}
            <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>오늘의 맞춤 행운 팁</span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-200 font-semibold pt-1">
                {drawnCards[0].tip}
              </p>
              <p className="text-[11px] text-zinc-400">
                1번 카드 &lsquo;{drawnCards[0].name}&rsquo;의 기운을 담은 오늘의 조언이에요.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>결과 이미지로 저장 / 공유</span>
            </button>

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>다른 질문으로 다시 뽑기</span>
            </button>

            <Link
              href="/play/mbti/code"
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
            >
              <MapPin className="w-4 h-4 text-purple-400" />
              <span>오프라인 1:1 상담 알아보기</span>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Share Modal */}
      {drawnCards.length === 4 && (
        <TarotShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          question={selectedQuestion}
          cards={drawnCards}
          summary={summaryText}
          comicRank={comicRank}
        />
      )}
    </div>
  )
}

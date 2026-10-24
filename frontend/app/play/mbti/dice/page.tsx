"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sparkles, Dices, RotateCcw, CheckCircle2, Award, Info } from "lucide-react"

import { TAROT_CARDS, saveTarotStamp } from "@/lib/tarot-utils"
import diceLinesData from "@/data/dice-lines.json"
import tarotConfig from "@/data/tarot-config.json"
import { TarotCard } from "@/types/tarot"

export default function TarotDicePage() {
  const [isRolling, setIsRolling] = useState(false)
  const [diceAIndex, setDiceAIndex] = useState<number>(0) // 0~5 (자, 축, 인, 묘, 진, 사)
  const [diceBIndex, setDiceBIndex] = useState<number>(0) // 0~5 (오, 미, 신, 유, 술, 해)
  const [hasRolled, setHasRolled] = useState(false)
  const [stampNotice, setStampNotice] = useState<string | null>(null)

  // Dice A Cards: 10:자, 11:축, 12:인, 13:묘, 14:진, 15:사
  const diceACards: TarotCard[] = TAROT_CARDS.slice(10, 16)
  // Dice B Cards: 16:오, 17:미, 18:신, 19:유, 20:술, 21:해
  const diceBCards: TarotCard[] = TAROT_CARDS.slice(16, 22)

  const handleRollDice = () => {
    if (isRolling) return
    setIsRolling(true)
    setStampNotice(null)

    // Rapid random cycle during roll
    const interval = setInterval(() => {
      setDiceAIndex(Math.floor(Math.random() * 6))
      setDiceBIndex(Math.floor(Math.random() * 6))
    }, 90)

    setTimeout(() => {
      clearInterval(interval)
      const finalA = Math.floor(Math.random() * 6)
      const finalB = Math.floor(Math.random() * 6)
      setDiceAIndex(finalA)
      setDiceBIndex(finalB)
      setIsRolling(false)
      setHasRolled(true)

      const res = saveTarotStamp("dice")
      if (res.isNew) {
        setStampNotice(`🎉 오늘의 주사위 도장 1개 + ${res.gainedDP} DP가 적립되었습니다!`)
      }
    }, 1000)
  }

  const currentA = diceACards[diceAIndex]
  const currentB = diceBCards[diceBIndex]

  // Get combination text from data/dice-lines.json
  const comboKey = `${currentA.id}_${currentB.id}`
  const comboData = (diceLinesData.combinations as Record<string, { text: string; relation: string }>)[comboKey]
  const resultText = comboData ? comboData.text : `${currentA.name}+${currentB.name}: ${currentA.short}, ${currentB.short}인 날!`
  const relType = comboData?.relation || "평온"

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-center py-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
          <Dices className="w-3.5 h-3.5" />
          <span>하루 1회 무료 미니게임</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white">
          오늘의 12지 주사위
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          두 개의 주사위를 굴려 오늘의 동물 케미와 행운의 한마디를 확인해보세요!
        </p>
      </div>

      {/* Dice Container */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-amber-500/30 shadow-2xl space-y-8 relative overflow-hidden">

        {/* Two Dice Visuals */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* Dice A */}
          <motion.div
            animate={isRolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 0.9, 1] } : {}}
            transition={isRolling ? { repeat: Infinity, duration: 0.3 } : {}}
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-blue-950/60 to-zinc-900 border-2 border-blue-400/60 flex flex-col items-center justify-center p-3 shadow-xl select-none"
          >
            <span className="text-[10px] font-bold text-blue-400">주사위 A (자~사)</span>
            <div className="w-14 h-14 sm:w-16 sm:h-16 my-1 flex items-center justify-center">
              {currentA.image ? (
                <img src={currentA.image} alt={currentA.name} className="w-full h-full object-contain drop-shadow" />
              ) : (
                <span className="text-4xl sm:text-5xl">
                  {currentA.id === "ja" ? "🐭" : currentA.id === "chuk" ? "🐮" : currentA.id === "in" ? "🐯" : currentA.id === "myo" ? "🐰" : currentA.id === "jin" ? "🐲" : "🐍"}
                </span>
              )}
            </div>
            <span className="text-xs sm:text-sm font-black text-white truncate max-w-full">
              {currentA.name}
            </span>
          </motion.div>

          <span className="text-2xl font-black text-amber-400">+</span>

          {/* Dice B */}
          <motion.div
            animate={isRolling ? { rotate: [0, -90, -180, -270, -360], scale: [1, 1.1, 0.9, 1] } : {}}
            transition={isRolling ? { repeat: Infinity, duration: 0.3 } : {}}
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-pink-950/60 to-zinc-900 border-2 border-pink-400/60 flex flex-col items-center justify-center p-3 shadow-xl select-none"
          >
            <span className="text-[10px] font-bold text-pink-400">주사위 B (오~해)</span>
            <div className="w-14 h-14 sm:w-16 sm:h-16 my-1 flex items-center justify-center">
              {currentB.image ? (
                <img src={currentB.image} alt={currentB.name} className="w-full h-full object-contain drop-shadow" />
              ) : (
                <span className="text-4xl sm:text-5xl">
                  {currentB.id === "o" ? "🐴" : currentB.id === "mi" ? "🐑" : currentB.id === "sin-monkey" ? "🐵" : currentB.id === "yu" ? "🐔" : currentB.id === "sul" ? "🐶" : "🐷"}
                </span>
              )}
            </div>
            <span className="text-xs sm:text-sm font-black text-white truncate max-w-full">
              {currentB.name}
            </span>
          </motion.div>
        </div>

        {/* Result Area */}
        {hasRolled && !isRolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3 pt-2"
          >
            <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  {relType !== "평온" ? `관계: ${relType}` : "오늘의 케미"}
                </span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-white leading-snug">
                &ldquo;{resultText}&rdquo;
              </p>
            </div>

            {stampNotice && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl">
                {stampNotice}
              </div>
            )}
          </motion.div>
        )}

        {/* Roll Trigger Button */}
        <div>
          <button
            onClick={handleRollDice}
            disabled={isRolling}
            className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-sm sm:text-base inline-flex items-center gap-2 shadow-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <Dices className="w-5 h-5" />
            <span>{isRolling ? "주사위 굴리는 중..." : hasRolled ? "한 번 더 굴려보기" : "주사위 굴리기"}</span>
          </button>
        </div>
      </div>

      {/* Explorer Badge Notice */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <Award className="w-5 h-5 text-amber-400 shrink-0" />
          <span>7일 연속 서로 다른 조합을 모으면 프로필에 <strong>「12지 탐험가」</strong> 배지가 지급됩니다!</span>
        </div>
      </div>
    </div>
  )
}

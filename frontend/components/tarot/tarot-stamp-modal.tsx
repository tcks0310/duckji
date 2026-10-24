"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, Award, Trophy, Info, Gift, CheckCircle2, Flame } from "lucide-react"
import { TarotStampState } from "@/types/tarot"
import { getStoredTarotStamps } from "@/lib/tarot-utils"
import tarotConfig from "@/data/tarot-config.json"

interface TarotStampModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TarotStampModal({ isOpen, onClose }: TarotStampModalProps) {
  const [stampState, setStampState] = useState<TarotStampState>({
    stamps: [],
    collectedCombos: { double: 0, triple: 0, allSeason: 0 }
  })
  const [activeTab, setActiveTab] = useState<"card" | "rank" | "rates">("card")

  useEffect(() => {
    if (isOpen) {
      setStampState(getStoredTarotStamps())
    }
  }, [isOpen])

  if (!isOpen) return null

  // Top 10 Weekly Rankings Mock (Nicknames only)
  const weeklyRankings = [
    { rank: 1, name: "덕지대마왕", stamps: 28, combo: "사계절 풀콤보 1회" },
    { rank: 2, name: "굿즈수집가", stamps: 26, combo: "트리플 2회" },
    { rank: 3, name: "성수동오리", stamps: 24, combo: "더블 4회" },
    { rank: 4, name: "귀칼원픽", stamps: 22, combo: "더블 3회" },
    { rank: 5, name: "홍대너구리", stamps: 20, combo: "더블 2회" },
    { rank: 6, name: "나혼렙마스터", stamps: 19, combo: "더블 1회" },
    { rank: 7, name: "포카장인", stamps: 18, combo: "더블 2회" },
    { rank: 8, name: "바인더부자", stamps: 17, combo: "더블 1회" },
    { rank: 9, name: "슬기로운덕후", stamps: 15, combo: "-" },
    { rank: 10, name: "오픈런1등", stamps: 14, combo: "-" },
  ]

  const totalStamps = stampState.stamps.length

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/40 overflow-y-auto overscroll-contain"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg max-h-[92vh] max-h-[92dvh] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-white overflow-y-auto my-auto scrollbar-thin scrollbar-thumb-zinc-700"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-zinc-800">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <span>덕지 타로 30칸 도장판</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-black font-black">
                  {totalStamps} / 30
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">매일 뽑기와 주사위로 도장을 모아보세요!</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-3 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 mb-5 text-xs font-bold">
            <button
              onClick={() => setActiveTab("card")}
              className={`py-2 rounded-xl transition-all ${
                activeTab === "card" ? "bg-zinc-800 text-amber-300 shadow-md" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              도장판 카드
            </button>
            <button
              onClick={() => setActiveTab("rank")}
              className={`py-2 rounded-xl transition-all ${
                activeTab === "rank" ? "bg-zinc-800 text-amber-300 shadow-md" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              이번 주 TOP 10
            </button>
            <button
              onClick={() => setActiveTab("rates")}
              className={`py-2 rounded-xl transition-all ${
                activeTab === "rates" ? "bg-zinc-800 text-amber-300 shadow-md" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              확률 및 보상 안내
            </button>
          </div>

          {/* TAB 1: Stamp Grid */}
          {activeTab === "card" && (
            <div className="space-y-4">
              {/* 30-Slot Grid */}
              <div className="grid grid-cols-6 sm:grid-cols-6 gap-2 p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800">
                {Array.from({ length: 30 }).map((_, index) => {
                  const stamp = stampState.stamps[index]
                  const isChecked = Boolean(stamp)

                  let stampBg = "bg-zinc-900/60 border-zinc-800 text-zinc-600"
                  let stampIcon = <span className="text-[10px] font-bold">{index + 1}</span>

                  if (isChecked) {
                    if (stamp.combo === "all_season") {
                      stampBg = "bg-pink-500 border-white text-black font-black shadow-lg animate-pulse"
                      stampIcon = <span>🌈</span>
                    } else if (stamp.combo === "triple") {
                      stampBg = "bg-amber-400 border-amber-300 text-black font-black shadow-md"
                      stampIcon = <span>⭐</span>
                    } else if (stamp.combo === "double") {
                      stampBg = "bg-zinc-300 border-zinc-200 text-zinc-900 font-black shadow-sm"
                      stampIcon = <span>✨</span>
                    } else {
                      stampBg = "bg-amber-500/20 border-amber-500/50 text-amber-400"
                      stampIcon = <span>🦆</span>
                    }
                  }

                  return (
                    <div
                      key={index}
                      className={`h-11 rounded-xl border flex flex-col items-center justify-center transition-all ${stampBg}`}
                      title={isChecked ? `${stamp.date} 획득` : `${index + 1}번째 도장`}
                    >
                      <div className="text-sm">{stampIcon}</div>
                      {isChecked && (
                        <span className="text-[8px] opacity-80 leading-none">
                          {stamp.type === "draw" ? "4장" : stamp.type === "single" ? "1장" : "주사위"}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Combo Collection Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="text-xs text-zinc-400 font-bold">은빛 더블</div>
                  <div className="text-base font-black text-zinc-200">{stampState.collectedCombos.double}회</div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="text-xs text-amber-400 font-bold">금빛 트리플</div>
                  <div className="text-base font-black text-amber-400">{stampState.collectedCombos.triple}회</div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                  <div className="text-xs text-pink-400 font-bold">사계절 풀콤보</div>
                  <div className="text-base font-black text-pink-400">{stampState.collectedCombos.allSeason}회</div>
                </div>
              </div>

              {/* How to get stamps */}
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                <div className="text-white font-bold mb-1">💡 도장 모으는 법 (하루 최대 3개)</div>
                <div>• 오늘의 한 장 뽑기 (하루 1회) ➔ 도장 1개 + {tarotConfig.dailySingleCardDP} DP</div>
                <div>• 4장 타로 뽑기 (하루 1회) ➔ 도장 1개 + {tarotConfig.dailyDrawDP} DP</div>
                <div>• 오늘의 주사위 굴리기 (하루 1회) ➔ 도장 1개 + {tarotConfig.dailyDiceDP} DP</div>
              </div>
            </div>
          )}

          {/* TAB 2: Weekly Rankings */}
          {activeTab === "rank" && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
                <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
                <span>이번 주 도장을 가장 많이 모은 열정 덕후 랭킹 (닉네임만 표시)</span>
              </div>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {weeklyRankings.map((user) => (
                  <div
                    key={user.rank}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] ${
                        user.rank === 1 ? "bg-amber-400 text-black" :
                        user.rank === 2 ? "bg-zinc-300 text-black" :
                        user.rank === 3 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {user.rank}
                      </span>
                      <span className="font-bold text-white">{user.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[11px] text-amber-300 font-mono">{user.combo}</span>
                      <span className="text-xs font-black text-white">{user.stamps}개</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Rates & Notice */}
          {activeTab === "rates" && (
            <div className="space-y-3.5 text-xs text-zinc-300">
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="font-black text-amber-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  <span>4계절 덱 (총 88장) 콤보 확률 투명 공개</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-zinc-400 pt-1">
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span>• 4장 중 같은 카드가 2장(더블) 이상 나올 확률</span>
                    <strong className="text-white">약 19.7%</strong>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span>• 4장 중 같은 카드가 3장(트리플) 나올 확률</span>
                    <strong className="text-white">약 0.32%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>• 4장 모두 같은 카드(사계절 풀콤보) 나올 확률</span>
                    <strong className="text-pink-400">약 0.00094% (약 10만 6천 분의 1)</strong>
                  </div>
                </div>
              </div>

              {/* Event Rewards (Only if active) */}
              {tarotConfig.eventRewardActive ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 space-y-1.5">
                  <div className="font-black text-amber-300 flex items-center gap-1.5">
                    <Gift className="w-4 h-4" />
                    <span>{tarotConfig.eventRewardNotice.title}</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    {tarotConfig.eventRewardNotice.description}
                  </p>
                  <div className="text-[10px] text-zinc-400 pt-1">
                    기간: {tarotConfig.eventRewardNotice.period} | 추첨 인원: {tarotConfig.eventRewardNotice.winnerCount}명
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400">
                  🎁 <strong>상시 보상:</strong> 30칸 도장 완주 시 프로필 전용 한정 배지, 500 DP 및 굿즈샵 할인 쿠폰이 자동으로 지급됩니다.
                </div>
              )}
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-5 pt-3 border-t border-zinc-800 text-center text-[10px] text-zinc-500">
            도장 기록은 현재 브라우저에 안전하게 저장됩니다.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

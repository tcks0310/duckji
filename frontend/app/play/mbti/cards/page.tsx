"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X, Heart, ExternalLink, Info, Search } from "lucide-react"

import { TAROT_CARDS, RELATION_BADGE_INFO_MAP } from "@/lib/tarot-utils"
import { TarotCard } from "@/types/tarot"
import { TarotCardView } from "@/components/tarot/tarot-card-view"

export default function TarotCardsPage() {
  const [filter, setFilter] = useState<"all" | "mascot" | "zodiac">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCard, setSelectedCard] = useState<TarotCard | null>(null)

  const filteredCards = TAROT_CARDS.filter((card) => {
    if (filter === "mascot" && (card.no < 0 || card.no > 9)) return false
    if (filter === "zodiac" && (card.no < 10 || card.no > 21)) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = card.name.toLowerCase().includes(q)
      const matchHanja = card.hanja.includes(q)
      const matchKeywords = card.keywords.some(k => k.toLowerCase().includes(q))
      return matchName || matchHanja || matchKeywords
    }
    return true
  })

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>천문물상 카드 아카이브</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white">
          22장 카드 도감
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          오리 덕지·덕순(10장)과 12지 동물(12장)의 숨겨진 의미를 살펴보세요
        </p>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-xs font-bold w-full sm:w-auto">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl transition-all ${
              filter === "all" ? "bg-amber-500 text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            전체 (22장)
          </button>
          <button
            onClick={() => setFilter("mascot")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl transition-all ${
              filter === "mascot" ? "bg-amber-500 text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            덕지·덕순 (10장)
          </button>
          <button
            onClick={() => setFilter("zodiac")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl transition-all ${
              filter === "zodiac" ? "bg-amber-500 text-black shadow-md" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            12지 동물 (12장)
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="카드명, 키워드 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* 22-Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 max-w-5xl mx-auto justify-items-center">
        {filteredCards.map((card) => (
          <div
            key={card.id}
            onClick={() => setSelectedCard(card)}
            className="flex flex-col items-center cursor-pointer group"
          >
            <TarotCardView
              card={card}
              season="autumn"
              size="md"
              isFlipped={true}
            />
          </div>
        ))}
      </div>

      {/* RELATION PICTURE DICTIONARY (합·충 그림 사전) */}
      <section className="pt-8 border-t border-zinc-900 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold border border-zinc-700">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>용어 몰라도 쏙쏙 이해되는</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            합·충 &ldquo;그림 사전&rdquo;
          </h2>
          <p className="text-xs text-zinc-400">
            어려운 명리 한자 대신 귀여운 캐릭터 상황으로 관계를 알아봐요
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Object.values(RELATION_BADGE_INFO_MAP).filter(r => r.type !== "평온").map((rel) => (
            <div
              key={rel.type}
              className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-start gap-3 hover:border-zinc-700 transition-colors"
            >
              <div className="text-2xl p-2 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0">
                {rel.emoji}
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-xs text-white flex items-center gap-1.5">
                  <span>{rel.title}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  {rel.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CARD DETAIL MODAL */}
      <AnimatePresence>
        {selectedCard && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/40 overflow-y-auto overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCard(null)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg max-h-[92vh] max-h-[92dvh] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-white overflow-y-auto my-auto scrollbar-thin scrollbar-thumb-zinc-700"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Card Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-zinc-800">
                <div className="shrink-0">
                  <TarotCardView
                    card={selectedCard}
                    season="autumn"
                    size="md"
                    isFlipped={true}
                  />
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-black">
                      No.{String(selectedCard.no).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {selectedCard.hanja}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    {selectedCard.name}
                  </h3>

                  <p className="text-xs text-amber-300 font-semibold">
                    &ldquo;{selectedCard.short}&rdquo;
                  </p>

                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-1">
                    {selectedCard.keywords.map((kw, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inner / Outer Interpretations */}
              <div className="space-y-3.5 py-4 border-b border-zinc-800 text-xs">
                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-bold text-blue-400">
                    💙 속마음(Inner) 자리일 때
                  </span>
                  <p className="text-zinc-300 leading-relaxed">
                    {selectedCard.inner}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-bold text-pink-400">
                    💖 겉모습(Outer) 자리일 때
                  </span>
                  <p className="text-zinc-300 leading-relaxed">
                    {selectedCard.outer}
                  </p>
                </div>
              </div>

              {/* Question Specific Lines */}
              <div className="space-y-2.5 py-4 border-b border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-400">질문별 한 줄 리딩</h4>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                    <span className="shrink-0">💘 연애:</span>
                    <span className="text-zinc-300">{selectedCard.q.love}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                    <span className="shrink-0">⭐ 덕질:</span>
                    <span className="text-zinc-300">{selectedCard.q.fandom}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                    <span className="shrink-0">💸 지름:</span>
                    <span className="text-zinc-300">{selectedCard.q.money}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                    <span className="shrink-0">🤝 관계:</span>
                    <span className="text-zinc-300">{selectedCard.q.relation}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-start gap-2">
                    <span className="shrink-0">🎫 도전:</span>
                    <span className="text-zinc-300">{selectedCard.q.challenge}</span>
                  </div>
                </div>
              </div>

              {/* Goods URL slot (if available) & Tip */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-amber-400 font-semibold text-center sm:text-left">
                  {selectedCard.tip}
                </div>

                {selectedCard.goodsUrl && (
                  <a
                    href={selectedCard.goodsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shadow-md"
                  >
                    <span>이 카드 굿즈 보기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

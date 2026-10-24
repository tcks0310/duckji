"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Check, Download, Share2, Sparkles, Image as ImageIcon } from "lucide-react"
import { DrawnCard, QuestionOption } from "@/types/tarot"
import { DISCLAIMER_TEXT } from "@/lib/tarot-utils"

interface TarotShareModalProps {
  isOpen: boolean
  onClose: () => void
  question: QuestionOption
  cards: DrawnCard[]
  summary: string
  comicRank: string
}

export function TarotShareModal({
  isOpen,
  onClose,
  question,
  cards,
  summary,
  comicRank,
}: TarotShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [shareRatio, setShareRatio] = useState<"feed" | "story">("feed")

  if (!isOpen) return null

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareNative = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "덕지&덕순 천문물상타로 결과",
          text: `[${question.label}] ${summary}\n나의 타로 등급: ${comicRank}\n덕지(duckji.com)에서 확인해보세요!`,
          url: window.location.href,
        })
      } catch (e) {
        console.error(e)
      }
    } else {
      handleCopyLink()
    }
  }

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
          className="relative w-full max-w-md max-h-[92vh] max-h-[92dvh] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-white overflow-y-auto my-auto scrollbar-thin scrollbar-thumb-zinc-700"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
            <Share2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-extrabold text-white">결과 공유 및 저장</h3>
          </div>

          {/* Ratio Selector */}
          <div className="grid grid-cols-2 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 mb-4 text-xs font-bold">
            <button
              onClick={() => setShareRatio("feed")}
              className={`py-2 rounded-xl transition-all ${
                shareRatio === "feed" ? "bg-zinc-800 text-amber-300 shadow-md" : "text-zinc-400"
              }`}
            >
              인스타 피드 (1080×1350)
            </button>
            <button
              onClick={() => setShareRatio("story")}
              className={`py-2 rounded-xl transition-all ${
                shareRatio === "story" ? "bg-zinc-800 text-amber-300 shadow-md" : "text-zinc-400"
              }`}
            >
              스토리 (1080×1920)
            </button>
          </div>

          {/* Card Preview Simulation */}
          <div className={`w-full ${shareRatio === "feed" ? "aspect-[4/5]" : "aspect-[9/16]"} max-h-[360px] mx-auto bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between text-center relative overflow-hidden shadow-xl mb-5`}>
            {/* Ambient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            {/* Top info */}
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 mb-1">
                <span>{question.emoji}</span>
                <span>{question.label}</span>
              </div>
              <h4 className="text-sm font-black text-white leading-tight">
                덕지&amp;덕순 천문물상타로
              </h4>
            </div>

            {/* 4 Cards Mini Grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-black/50 rounded-xl border border-zinc-800/80 my-1">
              {cards.map((c) => (
                <div key={c.position} className="bg-zinc-900/90 rounded-lg p-1.5 text-center border border-zinc-700/60">
                  <div className="text-[9px] text-zinc-400">
                    {c.position === 1 ? "나 속" : c.position === 2 ? "나 겉" : c.position === 3 ? "상대 속" : "상대 겉"}
                  </div>
                  <div className="text-[11px] font-extrabold text-amber-300 truncate">
                    {c.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary & Comic Badge */}
            <div className="space-y-1">
              <div className="inline-block px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black">
                {comicRank}
              </div>
              <p className="text-[11px] text-zinc-300 font-medium px-2 leading-tight">
                &ldquo;{summary}&rdquo;
              </p>
            </div>

            {/* Bottom Watermark & Disclaimer */}
            <div className="pt-2 border-t border-zinc-800/60">
              <div className="text-[10px] font-black tracking-wider text-amber-400">
                www.duckji.com
              </div>
              <div className="text-[8px] text-zinc-500 truncate mt-0.5">
                {DISCLAIMER_TEXT}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleShareNative}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>결과 바로 공유하기</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "링크가 복사되었습니다!" : "링크 복사하기"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

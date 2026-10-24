"use client"

import * as React from "react"
import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QrCode, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Gift, ShieldCheck } from "lucide-react"
import { redeemCode } from "@/lib/rewards"

function TarotCodeContent() {
  const searchParams = useSearchParams()
  const initialCode = searchParams.get("c") || ""

  const [inputCode, setInputCode] = useState(initialCode)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [resultMessage, setResultMessage] = useState("")
  const [rewardInfo, setRewardInfo] = useState<{ dp: number; item: string } | null>(null)

  // 주소의 ?c= 코드는 한 번만 등록 시도 (개발 모드에서 effect 가 두 번 돌아도)
  const autoTried = useRef("")
  useEffect(() => {
    if (initialCode && autoTried.current !== initialCode) {
      autoTried.current = initialCode
      setInputCode(initialCode)
      handleRedeemCode(initialCode)
    }
  }, [initialCode])

  // 현장 카드 시리얼 코드는 서버(backend rewards 서비스)가 확인. 같은 코드는 계정마다 한 번
  const handleRedeemCode = async (codeToTest?: string) => {
    const target = (codeToTest || inputCode).trim().toUpperCase()
    if (!target) return

    const result = await redeemCode(target)
    if (result.status !== "ok") {
      setStatus("error")
      setResultMessage(result.status === "login" ? "로그인하면 코드를 등록하고 덕지 포인트를 받을 수 있어요." : result.error)
      setRewardInfo(null)
      return
    }
    setStatus("success")
    setResultMessage(`축하합니다! '${result.data.name}' 코드가 등록되었습니다.`)
    setRewardInfo({ dp: result.amount, item: result.data.rewardItem })
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 text-center py-4">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
          <QrCode className="w-3.5 h-3.5" />
          <span>온·오프라인 현장 연동</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white">
          현장 QR / 시리얼 코드 등록
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          팝업 현장에서 받은 카드 뒷면 코드를 넣으면 숨은 아이템이 열려요!
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl text-left space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleRedeemCode()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-2">
              시리얼 코드 입력
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="코드를 입력하세요"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm shadow-md transition-all shrink-0 cursor-pointer"
              >
                등록하기
              </button>
            </div>
          </div>
        </form>

        {/* Status Feedback */}
        <AnimatePresence>
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>{resultMessage}</span>
              </div>
              {rewardInfo && (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/20 text-zinc-200 space-y-1">
                  <div className="font-semibold text-amber-300">🎁 지급된 혜택:</div>
                  <div>• 덕지 포인트: <strong>+{rewardInfo.dp} DP</strong></div>
                  {rewardInfo.item && <div>• 획득 아이템: <strong>{rewardInfo.item}</strong></div>}
                </div>
              )}
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-2 text-xs font-semibold"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{resultMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Offline Booth Info Box */}
        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2 text-xs text-zinc-400">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-purple-400" />
            <span>오프라인 팝업 특전 안내</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            • 팝업스토어 현장 또는 제휴 부스에서 굿즈 구매 및 체험 시 지급되는 포토카드 뒷면에 8자리 고유 시리얼 코드가 인쇄되어 있습니다.
          </p>
          <p className="leading-relaxed text-[11px]">
            • 지급된 덕지 포인트는 마이페이지 포인트 관리에서 확인하실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function TarotCodePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-zinc-500 text-xs">불러오는 중...</div>}>
      <TarotCodeContent />
    </Suspense>
  )
}

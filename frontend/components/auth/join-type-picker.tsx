"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Globe, ShieldCheck, X, Clock } from "lucide-react"
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell"

// 회원가입 첫 단계: 내국인 / 외국인 선택
// 내국인 → /join/korean (휴대폰 본인인증 가입), 외국인 → 해외 회원 가입 준비 전까지 "오픈 준비 중" 안내
export function JoinTypePicker() {
  const [isForeignNoticeOpen, setIsForeignNoticeOpen] = useState(false)

  return (
    <AuthShell wide>
      <AuthTitle title="회원가입" sub="가입 유형을 골라 주세요. 신규 가입하면 350 DP 를 드려요." />
      <div className="space-y-3">
        <Link
          href="/join/korean/"
          className="flex items-center justify-between gap-4 p-5 rounded-lg border border-zinc-700 hover:border-red-500 transition-colors group"
        >
          <div className="flex items-center gap-4 text-left">
            <ShieldCheck className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <div className="text-base font-bold text-white">내국인</div>
              <div className="mt-0.5 text-sm text-zinc-400">한국 휴대폰 번호로 본인인증 후 가입</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-red-400" />
        </Link>
        <button
          type="button"
          onClick={() => setIsForeignNoticeOpen(true)}
          className="w-full flex items-center justify-between gap-4 p-5 rounded-lg border border-zinc-700 hover:border-cyan-500 transition-colors group"
        >
          <div className="flex items-center gap-4 text-left">
            <Globe className="w-6 h-6 text-cyan-400 shrink-0" />
            <div>
              <div className="text-base font-bold text-white">
                외국인 <span className="text-zinc-400 font-normal">Foreigner</span>
              </div>
              <div className="mt-0.5 text-sm text-zinc-400">Sign up without a Korean phone number</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-cyan-400" />
        </button>
      </div>
      <p className="mt-10 text-center text-sm text-zinc-400">
        이미 회원이신가요?{" "}
        <Link href="/login/" className="font-bold text-white underline">
          로그인
        </Link>
      </p>

      {/* 외국인 가입: 준비 전까지 안내 */}
      <AnimatePresence>
        {isForeignNoticeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsForeignNoticeOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="foreign-notice-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setIsForeignNoticeOpen(false)}
                aria-label="닫기"
                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h2 id="foreign-notice-title" className="text-base font-extrabold text-white">해외 회원 가입은 오픈 준비 중입니다</h2>
              <p className="text-xs text-zinc-400 mt-2">조금만 기다려 주세요. 준비되는 대로 열어 드릴게요.</p>
              <p className="text-[11px] text-zinc-500 mt-3">Sign-up for international members is coming soon.</p>
              <button
                type="button"
                onClick={() => setIsForeignNoticeOpen(false)}
                className="mt-5 w-full h-10 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight, Calendar, Compass, RotateCcw, Shirt, Sparkles } from "lucide-react"
import { AI_CHAT_ABILITIES, AI_QUICK_QUESTIONS, type AiChatLink } from "@/lib/ai-chat"
import { searchPageHref } from "@/lib/site-search"

// 홈 검색창 아래로 펼쳐지는 덕지 AI 대화 (검색창이 그대로 대화 입력칸이 됨)
export interface HomeAiMessage {
  role: "user" | "assistant"
  text: string
  links?: AiChatLink[]
  fromAi?: boolean
  fallbackQuery?: string
}

const QUICK_ICONS = [Shirt, Sparkles, Compass, Calendar]

// 빠른 AI 길라잡이 질문 버튼 (빈 대화에서는 크게, 대화 중에는 아래에 작게)
function QuickQuestions({ onAsk, disabled, compact }: { onAsk: (prompt: string) => void; disabled?: boolean; compact?: boolean }) {
  return (
    <div className={compact ? "flex items-center gap-1.5 overflow-x-auto scrollbar-none" : "space-y-2"}>
      <p className={`shrink-0 font-bold text-zinc-400 ${compact ? "text-xs" : "text-xs uppercase tracking-wider"}`}>빠른 AI 길라잡이 질문</p>
      <div className={compact ? "flex gap-1.5" : "grid grid-cols-2 sm:grid-cols-4 gap-2"}>
        {AI_QUICK_QUESTIONS.map((q, i) => {
          const Icon = QUICK_ICONS[i % QUICK_ICONS.length]
          return (
            <button
              key={q.label}
              type="button"
              disabled={disabled}
              onClick={() => onAsk(q.prompt)}
              title={q.prompt}
              className={`flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400 hover:text-amber-300 disabled:opacity-50 whitespace-nowrap ${
                compact ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-amber-300/80" />
              <span>{q.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HomeAiChatThread({
  messages,
  sending,
  onAsk,
  onReset,
  onClose,
}: {
  messages: HomeAiMessage[]
  sending: boolean
  onAsk: (prompt: string) => void
  onReset: () => void
  onClose: () => void
}) {
  const listRef = useRef<HTMLDivElement | null>(null)

  // 새 말이 오면 맨 아래로
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length, sending])

  const empty = messages.length === 0

  return (
    <section aria-label="덕지 AI 대화" className="mt-2 rounded-md border border-zinc-700 bg-zinc-950">
      {/* 머리: 지금 AI 대화 중 · 검색으로 돌아가기 */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/images/characters/duckji.png" alt="" className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 object-contain p-0.5 shrink-0" />
          <p className="text-sm font-bold text-zinc-100 truncate">덕지 AI와 대화</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!empty && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새 대화</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-zinc-700 text-xs sm:text-sm text-zinc-200 hover:text-white hover:border-zinc-500"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>검색으로 돌아가기</span>
          </button>
        </div>
      </div>

      {empty ? (
        // 빈 대화: 할 수 있는 일 + 눌러 볼 질문
        <div className="px-3 sm:px-4 py-4 space-y-3">
          <p className="text-sm text-zinc-300 leading-relaxed">
            덕지에 등록된 팝업·펀딩·팬 파티를 찾아 드리고, 방문 동선도 같이 짜 드려요. 궁금한 걸 위 칸에 적어 보세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {AI_CHAT_ABILITIES.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => onAsk(a.prompt)}
                title={a.hint}
                className="px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 hover:border-amber-400 hover:text-amber-300"
              >
                {a.prompt}
              </button>
            ))}
          </div>
          <QuickQuestions onAsk={onAsk} />
        </div>
      ) : (
        <>
        <div ref={listRef} className="max-h-[60vh] sm:max-h-[440px] overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-lg bg-amber-400 text-zinc-950 px-3 py-2 text-sm font-medium whitespace-pre-line break-words">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[92%] sm:max-w-[85%] rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 leading-relaxed">
                  <p className="whitespace-pre-line break-words">{m.text}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-xs text-zinc-100 hover:border-amber-400 hover:text-amber-300"
                        >
                          <span className="shrink-0 text-amber-300 font-semibold">{l.kind}</span>
                          <span className="truncate">{l.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {m.fallbackQuery && (
                    <a
                      href={searchPageHref(m.fallbackQuery)}
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:underline"
                    >
                      &lsquo;{m.fallbackQuery}&rsquo; 검색 결과 전체 보기
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          )}
          {sending && (
            <div className="flex justify-start">
              <p className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-400">덕지가 찾아보는 중…</p>
            </div>
          )}
        </div>
        <div className="px-3 sm:px-4 py-2.5 border-t border-zinc-800">
          <QuickQuestions onAsk={onAsk} disabled={sending} compact />
        </div>
        </>
      )}
    </section>
  )
}

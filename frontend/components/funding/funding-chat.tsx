"use client"

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import type { FundingMessage } from "@/types/funding"

// 펀딩 개설자 ↔ 덕지 담당자 대화 (개설자 화면과 관리자 화면이 같이 씀)
// me: 이 화면을 보는 쪽 (오른쪽에 붙음). 열려 있는 동안 20초마다 새 메시지를 받아 옴

const time = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })

export function FundingChat({
  me,
  load,
  send,
  placeholder = "메시지를 입력하세요",
  emptyText,
  tone = "site",
}: {
  me: "creator" | "admin"
  load: () => Promise<FundingMessage[]>
  send: (content: string) => Promise<FundingMessage>
  placeholder?: string
  emptyText: string
  tone?: "site" | "admin"
}) {
  const [messages, setMessages] = useState<FundingMessage[] | null>(null)
  const [error, setError] = useState("")
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    load()
      .then((m) => {
        setMessages(m)
        setError("")
      })
      .catch((e) => setError(e?.message || "대화를 불러오지 못했습니다."))
  }, [load])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 20_000)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages?.length])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const m = await send(content)
      setMessages((list) => [...(list || []), m])
      setText("")
    } catch (err: any) {
      setError(err?.message || "보내지 못했습니다.")
    } finally {
      setSending(false)
    }
  }

  const mine = tone === "admin" ? "bg-sky-700 text-white" : "bg-emerald-400 text-zinc-950"
  const theirs = tone === "admin" ? "bg-zinc-800 text-zinc-100" : "bg-white/[0.06] text-zinc-100"

  return (
    <div className="flex flex-col">
      <div ref={listRef} className="h-[360px] overflow-y-auto space-y-3 py-3 pr-1">
        {messages === null ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-400 leading-relaxed">{emptyText}</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender === me
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && <span className="text-xs text-zinc-400 mb-1">{m.senderName || (m.sender === "admin" ? "덕지 담당자" : "개설자")}</span>}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${isMine ? mine : theirs}`}>{m.content}</div>
                <span className="text-[11px] text-zinc-500 mt-1 tabular-nums">{time(m.createdAt)}</span>
              </div>
            )
          })
        )}
      </div>
      {error && <p className="text-sm text-red-300 py-1">{error}</p>}
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-zinc-800 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit(e as unknown as React.FormEvent)
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={placeholder}
          className="flex-1 bg-transparent resize-none text-sm text-white placeholder-zinc-500 focus:outline-none py-1.5"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="보내기"
          className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40 ${tone === "admin" ? "bg-sky-700 text-white" : "bg-emerald-400 text-zinc-950"}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}

"use client"

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Send, Trash2 } from "lucide-react"
import { MemberAvatar } from "@/components/community/squad/member-avatar"
import { deleteSquadMessage, fetchSquadMessages, fmtTime, sendSquadMessage, type SquadMessage } from "@/lib/squads"

// 스쿼드 안 채팅 (팀원만). 웹소켓 없이 화면이 보일 때 몇 초마다 새 메시지를 불러옴
const POLL_MS = 5000

export function SquadChat({ squadName }: { squadName: string }) {
  const [messages, setMessages] = useState<SquadMessage[]>([])
  const [canModerate, setCanModerate] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastId = useRef(0)
  const stickBottom = useRef(true)

  const scrollToBottom = () => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  const merge = useCallback((incoming: SquadMessage[]) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id)
      lastId.current = next[next.length - 1]?.id || lastId.current
      return next
    })
  }, [])

  // 처음: 최근 50개
  useEffect(() => {
    fetchSquadMessages().then((r) => {
      setLoaded(true)
      if (!r.ok) return setError(r.error)
      setCanModerate(r.data.canModerate)
      setHasMore(r.data.messages.length >= 50)
      merge(r.data.messages)
      requestAnimationFrame(scrollToBottom)
    })
  }, [merge])

  // 몇 초마다 새 메시지 (탭이 안 보이면 쉼)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return
      const r = await fetchSquadMessages(lastId.current ? { after: lastId.current } : {})
      if (r.ok && r.data.messages.length) {
        stickBottom.current = isNearBottom()
        merge(r.data.messages)
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [merge])

  const isNearBottom = () => {
    const el = listRef.current
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    if (stickBottom.current) scrollToBottom()
  }, [messages.length])

  const loadOlder = async () => {
    const first = messages[0]?.id
    if (!first) return
    const el = listRef.current
    const before = el ? el.scrollHeight - el.scrollTop : 0
    const r = await fetchSquadMessages({ before: first })
    if (!r.ok) return setError(r.error)
    stickBottom.current = false
    setHasMore(r.data.messages.length >= 50)
    setMessages((prev) => [...r.data.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev])
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before
    })
  }

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError("")
    const r = await sendSquadMessage(body)
    setSending(false)
    if (!r.ok) return setError(r.error)
    setText("")
    stickBottom.current = true
    merge([r.data.message])
  }

  const remove = async (m: SquadMessage) => {
    if (!confirm("이 메시지를 지울까요?")) return
    const r = await deleteSquadMessage(m.id)
    if (!r.ok) return alert(r.error)
    setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, deleted: true, body: "" } : p)))
  }

  return (
    <section className="rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col h-[560px] max-h-[75vh]">
      <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">스쿼드 채팅</h3>
          <p className="text-xs text-zinc-400">{squadName} 팀원만 볼 수 있어요. 5초마다 새 메시지를 불러와요.</p>
        </div>
      </header>

      <div ref={listRef} onScroll={() => (stickBottom.current = isNearBottom())} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {hasMore && (
          <div className="text-center">
            <button onClick={loadOlder} className="text-xs text-zinc-400 hover:text-white underline underline-offset-2">
              이전 메시지 더 보기
            </button>
          </div>
        )}
        {loaded && !messages.length && !error && (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500 text-center">
            아직 메시지가 없어요.
            <br />첫 인사를 남겨 보세요.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`group flex gap-2.5 ${m.isMe ? "flex-row-reverse" : ""}`}>
            {!m.isMe && <MemberAvatar name={m.name} src={m.avatarUrl} size={32} />}
            <div className={`max-w-[78%] min-w-0 ${m.isMe ? "items-end" : "items-start"} flex flex-col`}>
              {!m.isMe && (
                <div className="text-xs text-zinc-400 mb-0.5">
                  {m.name}
                  {m.isLeader && <span className="ml-1 text-amber-400 font-semibold">리더</span>}
                </div>
              )}
              <div className={`flex items-end gap-1.5 ${m.isMe ? "flex-row-reverse" : ""}`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.deleted
                      ? "bg-zinc-900 border border-zinc-800 text-zinc-500 italic"
                      : m.isMe
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-zinc-800 text-zinc-100"
                  }`}
                >
                  {m.deleted ? "삭제된 메시지입니다." : m.body}
                </div>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  {!m.deleted && (m.isMe || canModerate) && (
                    <button
                      onClick={() => remove(m)}
                      aria-label="메시지 지우기"
                      className="p-1 rounded text-zinc-500 hover:text-red-400 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">{fmtTime(m.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="p-3 border-t border-zinc-800 space-y-2">
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="메시지 보내기 (Shift+Enter 줄바꿈)"
            className="flex-1 resize-none rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="보내기"
            className="px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </section>
  )
}

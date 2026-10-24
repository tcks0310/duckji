"use client"

import * as React from "react"
import { useState, useRef, useMemo, useEffect } from "react"
import { Search, X, ArrowRight, TrendingUp, ArrowUp, MessageCircle, ChevronDown } from "lucide-react"
import { popupDetailHref } from "@/lib/popup-service"
import { goToSearch, usePopularKeywords, useSiteSearch } from "@/lib/site-search"
import type { MapRankingItem } from "@/lib/map-stats"
import { AI_CHAT_ABILITIES, OPEN_AI_CHAT_EVENT, askAi, type AiChatTurn } from "@/lib/ai-chat"
import { HomeAiChatThread, type HomeAiMessage } from "@/components/home/home-ai-chat"

export interface SearchSuggestionItem {
  id: string
  category: "popup" | "funding" | "party" | "gallery" | "post"
  categoryLabel: string
  title: string
  subtitle: string
  link: string
}

export interface IntegratedSearchBarProps {
  /** 입력하는 동안 홈 팝업 목록을 거를 때 씀 */
  onSearch?: (query: string) => void
}

// 홈 맨 위 통합 검색창
// - 검색: Enter 를 누르면 검색 결과 페이지(/search/?q=)로 이동. 입력하는 동안엔 덕지 안 결과 몇 개를 미리 보여 줌
// - AI: "AI 대화" 버튼을 누르면 이 검색창이 그대로 덕지 AI 대화 입력칸이 되고, 아래로 대화가 펼쳐짐
export function IntegratedSearchBar({ onSearch }: IntegratedSearchBarProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // AI 대화 (검색으로 돌아갔다 다시 켜도 이어서 볼 수 있게 남겨 둠)
  const [messages, setMessages] = useState<HomeAiMessage[]>([])
  const [sending, setSending] = useState(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const sendingRef = useRef(false)

  const ask = async (prompt: string) => {
    const text = prompt.trim()
    if (!text || sendingRef.current) return
    const next: HomeAiMessage[] = [...messagesRef.current, { role: "user", text }]
    messagesRef.current = next
    setMessages(next)
    setSending(true)
    sendingRef.current = true
    const history: AiChatTurn[] = next.map((m) => ({
      role: m.role,
      content: m.text,
    }))
    const reply = await askAi(history)
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: reply.text,
        links: reply.links,
        fromAi: reply.fromAi,
        fallbackQuery: reply.fallbackQuery,
      },
    ])
    setSending(false)
    sendingRef.current = false
  }

  const openAi = (prompt?: string) => {
    setAiMode(true)
    setQuery("")
    if (onSearch) onSearch("")
    if (prompt) void ask(prompt)
    else inputRef.current?.focus()
  }
  const closeAi = () => {
    setAiMode(false)
    setQuery("")
    inputRef.current?.focus()
  }

  // 오른쪽 길라잡이 칸의 질문 버튼 → 이 검색창을 AI 대화로 바꾸고 검색창으로 올라옴
  const openAiRef = useRef(openAi)
  openAiRef.current = openAi
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      openAiRef.current(prompt)
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    window.addEventListener(OPEN_AI_CHAT_EVENT, handler)
    return () => window.removeEventListener(OPEN_AI_CHAT_EVENT, handler)
  }, [])

  // 실시간 인기 검색어 (서버 집계). 검색창 오른쪽에 1위부터 하나씩 돌려 보여 줌, 집계가 없으면 숨김
  const popular = usePopularKeywords()

  // 입력하는 동안 바로 보여 주는 사이트 안 결과 (서버 DB 검색): 팝업 → 펀딩 → 파티 → 갤러리 → 게시글
  const site = useSiteSearch(query, { limit: 8, enabled: !aiMode })
  const suggestions = useMemo(() => {
    const r = site.result
    if (!r) return []
    const results: SearchSuggestionItem[] = []
    r.popups
      .filter((p) => p.status !== "ended")
      .forEach((pop) =>
        results.push({
          id: pop.id,
          category: "popup",
          categoryLabel: "팝업",
          title: pop.title,
          subtitle: `${pop.venueName} · ${pop.statusLabel}`,
          link: popupDetailHref(pop.id),
        }),
      )
    r.fundings.forEach((f) =>
      results.push({
        id: `funding-${f.id}`,
        category: "funding",
        categoryLabel: "펀딩",
        title: f.title,
        subtitle: `${f.creatorName} · ${f.endDate.slice(0, 10)} 마감`,
        link: `/funding/detail/?id=${encodeURIComponent(f.id)}`,
      }),
    )
    r.parties.forEach((e) =>
      results.push({
        id: `party-${e.id}`,
        category: "party",
        categoryLabel: "파티",
        title: e.title,
        subtitle: `${e.workTitle} · ${e.month}월 ${e.day}일`,
        link: `/funding/party/event?slug=${encodeURIComponent(e.slug)}`,
      }),
    )
    r.galleries.forEach((g) =>
      results.push({
        id: `gallery-${g.id}`,
        category: "gallery",
        categoryLabel: "갤러리",
        title: `${g.name} 갤러리`,
        subtitle: "커뮤니티",
        link: `/community/gallery/board?slug=${encodeURIComponent(g.slug)}`,
      }),
    )
    r.posts.forEach((post) =>
      results.push({
        id: `post-${post.id}`,
        category: "post",
        categoryLabel: "게시글",
        title: post.title,
        subtitle: `${post.galleryName || "갤러리"} · ${post.authorName}`,
        link: `/community/gallery/post/?id=${post.id}`,
      }),
    )
    return results.slice(0, 6)
  }, [site.result])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (aiMode) {
      if (!q || sending) return
      setQuery("")
      void ask(q)
      return
    }
    if (!q) {
      inputRef.current?.focus()
      return
    }
    goToSearch(q)
  }

  const handleClear = () => {
    setQuery("")
    if (onSearch && !aiMode) onSearch("")
    inputRef.current?.focus()
  }

  const showPopularDropdown = isFocused && !aiMode && query.trim().length === 0
  const showSuggestDropdown = isFocused && !aiMode && query.trim().length > 0

  return (
    <div ref={rootRef} className="relative w-full max-w-[960px] mx-auto z-30 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          {/* 검색창 (오른쪽 안에 AI 버튼). AI 를 켜면 같은 칸이 AI 대화 입력칸이 됨 */}
          <form onSubmit={handleSubmit} role={aiMode ? undefined : "search"}>
            <div
              className={`relative flex items-stretch rounded-md border-2 bg-zinc-950 transition-colors ${
                isFocused ? "border-amber-300" : "border-amber-400/90 hover:border-amber-300"
              }`}
            >
              <div className="flex items-center pl-3 sm:pl-4 pr-2 sm:pr-2.5 text-amber-400 shrink-0">
                {aiMode ? (
                  <img src="/images/characters/duckji.png" alt="" className="w-6 h-6 object-contain" />
                ) : (
                  <Search className="w-5 h-5 text-amber-400" />
                )}
              </div>

              <input
                ref={inputRef}
                type={aiMode ? "text" : "search"}
                enterKeyHint={aiMode ? "send" : "search"}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (onSearch && !aiMode) onSearch(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && aiMode) closeAi()
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                placeholder={aiMode ? "덕지에게 물어보세요" : "검색어를 입력해 주세요"}
                aria-label={aiMode ? "덕지 AI에게 물어보기" : "통합 검색"}
                className="w-full min-w-0 py-2.5 pr-2 text-base text-white placeholder-zinc-500 bg-transparent focus:outline-none font-medium [&::-webkit-search-cancel-button]:hidden"
              />

              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="self-center p-1.5 mr-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="지우기"
                  aria-label="지우기"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* AI 대화 중엔 보내기 버튼 */}
              {aiMode && (
                <button
                  type="submit"
                  disabled={!query.trim() || sending}
                  aria-label="보내기"
                  className="self-center p-1.5 mr-1.5 rounded bg-amber-400 text-zinc-950 hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors shrink-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}

              {/* AI 버튼 (검색창 안 오른쪽): 누르면 이 자리에서 덕지 AI 와 대화, 다시 누르면 검색으로 */}
              <div className="relative group self-center mr-2 shrink-0 flex items-center">
                <span aria-hidden className="w-px h-5 bg-zinc-800 mr-1.5" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (aiMode ? closeAi() : openAi())}
                  aria-pressed={aiMode}
                  aria-label={aiMode ? "AI 대화 끄고 검색으로 돌아가기" : "덕지 AI와 대화하기"}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    aiMode ? "text-amber-300" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <MessageCircle className={`w-4 h-4 ${aiMode ? "fill-amber-300/25" : ""}`} />
                  <span>AI 대화</span>
                </button>
                {!aiMode && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-full mt-3 w-64 p-3 rounded-md bg-zinc-950 border border-zinc-700 shadow-xl shadow-black/60 text-xs text-zinc-200 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity"
                  >
                    <p className="font-bold text-amber-300 mb-1.5">누르면 덕지 AI와 대화해요</p>
                    <ul className="space-y-1 text-zinc-300">
                      {AI_CHAT_ABILITIES.map((a) => (
                        <li key={a.label}>· {a.hint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* 빈 칸을 누르면 실시간 인기 검색어 TOP 10 */}
          {showPopularDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 p-3 sm:p-4 rounded-md bg-zinc-950 border border-zinc-700 shadow-xl shadow-black/60 z-50">
              <div className="px-2 pb-2 mb-1 text-sm font-bold text-amber-400 flex items-center gap-1.5 border-b border-zinc-800">
                <TrendingUp className="w-4 h-4" />
                <span>실시간 인기 검색어</span>
              </div>
              {popular.items === null ? (
                <div className="px-2 py-3 text-sm text-zinc-400">불러오는 중…</div>
              ) : popular.items.length === 0 ? (
                <div className="px-2 py-3 text-sm text-zinc-400">
                  {popular.failed ? "인기 검색어를 불러오지 못했어요." : "아직 집계된 검색어가 없어요."}
                </div>
              ) : (
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                  {popular.items.map((item) => (
                    <li key={item.target}>
                      <a
                        href={`/search/?q=${encodeURIComponent(item.target)}`}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left text-sm text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors"
                      >
                        <span className={`w-4 text-center font-bold ${item.rank <= 3 ? "text-amber-400" : "text-zinc-500"}`}>{item.rank}</span>
                        <span className="truncate">{item.target}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* 입력하는 동안 미리 보는 덕지 안 결과. Enter 나 '전체 결과 보기'는 검색 결과 페이지로 */}
          {showSuggestDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md bg-zinc-950 border border-zinc-700 shadow-xl shadow-black/60 z-50 overflow-hidden">
              {site.loading && suggestions.length === 0 ? (
                <div className="px-4 py-5 text-sm text-zinc-400">덕지 안에서 찾는 중…</div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-5 text-sm text-zinc-400">미리 볼 결과가 없어요. Enter 를 누르면 네이버·구글 결과까지 함께 보여 드려요.</div>
              ) : (
                <ul className="py-1 max-h-80 overflow-y-auto">
                  {suggestions.map((sug) => (
                    <li key={sug.id}>
                      <a
                        href={sug.link}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900 transition-colors"
                      >
                        <span className="w-12 shrink-0 text-xs font-semibold text-amber-300">{sug.categoryLabel}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-100 truncate">{sug.title}</span>
                          <span className="block text-xs text-zinc-400 truncate">{sug.subtitle}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <a
                href={`/search/?q=${encodeURIComponent(query.trim())}`}
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center justify-between gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-100 hover:text-amber-300"
              >
                <span className="truncate">&lsquo;{query.trim()}&rsquo; 전체 검색 결과 보기</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* 검색창 오른쪽: 실시간 인기 검색어 1위부터 차례로, 마우스를 올리면 전체 순위 */}
        {!aiMode && popular.items && popular.items.length > 0 && <PopularTicker items={popular.items} />}
      </div>

      {/* AI 대화: 검색창 바로 아래로 펼쳐짐 */}
      {aiMode && (
        <HomeAiChatThread messages={messages} sending={sending} onAsk={(p) => void ask(p)} onReset={() => setMessages([])} onClose={closeAi} />
      )}
    </div>
  )
}

const TICK_MS = 3000

function PopularTicker({ items }: { items: MapRankingItem[] }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  // 마지막 다음에 1위를 한 번 더 붙여 위로 넘어가듯 돌고, 끝에 닿으면 애니메이션 없이 처음으로
  const [animate, setAnimate] = useState(true)
  const loop = [...items, items[0]]

  useEffect(() => {
    if (open || items.length < 2) return
    const t = setInterval(() => {
      setAnimate(true)
      setIndex((i) => i + 1)
    }, TICK_MS)
    return () => clearInterval(t)
  }, [open, items.length])

  useEffect(() => {
    if (index < items.length) return
    const t = setTimeout(() => {
      setAnimate(false)
      setIndex(0)
    }, 500)
    return () => clearTimeout(t)
  }, [index, items.length])

  const rankCls = (rank: number) => (rank <= 3 ? "text-amber-400" : "text-zinc-500")

  return (
    <div className="relative sm:w-48 shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="실시간 인기 검색어 순위 보기"
        className="w-full flex items-center gap-2 px-1 sm:px-0 text-sm"
      >
        <span className="flex items-center gap-1 shrink-0 text-xs font-bold text-amber-400">
          <TrendingUp className="w-4 h-4" />
          <span>실시간</span>
        </span>
        <span className="relative h-6 flex-1 min-w-0 overflow-hidden text-left">
          <ol className={animate ? "transition-transform duration-500 ease-out" : ""} style={{ transform: `translateY(-${index * 1.5}rem)` }}>
            {loop.map((item, i) => (
              <li key={`${item.target}-${i}`} className="h-6 flex items-center gap-2 text-zinc-100 font-semibold">
                <span className={`w-4 text-center font-bold ${rankCls(item.rank)}`}>{item.rank}</span>
                <MarqueeText text={item.target} />
              </li>
            ))}
          </ol>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full pt-2 z-50">
          <div className="p-2 rounded-md bg-zinc-950 border border-zinc-700 shadow-xl shadow-black/60">
            <div className="px-1.5 pb-2 mb-1 text-sm font-bold text-amber-400 flex items-center gap-1.5 border-b border-zinc-800">
              <TrendingUp className="w-4 h-4" />
              <span>실시간 인기 검색어</span>
            </div>
            <ol className="space-y-0.5">
              {items.map((item) => (
                <li key={item.target}>
                  <a
                    href={`/search/?q=${encodeURIComponent(item.target)}`}
                    className="flex items-center gap-2 px-1.5 py-1.5 rounded text-sm text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    <span className={`w-4 text-center font-bold ${rankCls(item.rank)}`}>{item.rank}</span>
                    <MarqueeText text={item.target} />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

// 칸보다 긴 글자는 잘라 내지 않고 옆으로 천천히 흘려 끝까지 보여 줌
function MarqueeText({ text }: { text: string }) {
  const boxRef = useRef<HTMLSpanElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const box = boxRef.current
    const inner = textRef.current
    if (!box || !inner) return
    const measure = () => setShift(Math.max(0, Math.ceil(inner.scrollWidth - box.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  return (
    <span ref={boxRef} className="block min-w-0 flex-1 overflow-hidden whitespace-nowrap">
      <span
        ref={textRef}
        className={`inline-block ${shift > 0 ? "duckji-marquee" : ""}`}
        style={shift > 0 ? ({ "--marquee-shift": `-${shift}px`, "--marquee-time": `${Math.max(2.5, shift / 30)}s` } as React.CSSProperties) : undefined}
      >
        {text}
      </span>
    </span>
  )
}

"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, TrendingUp, X } from "lucide-react"
import { goToSearch, loadPopularKeywords } from "@/lib/site-search"
import type { MapRankingItem } from "@/lib/map-stats"

interface HeaderSearchProps {
  value: string
  onChange: (q: string) => void
  // inline: 상단에 늘 보이는 검색창 / panel: 좁은 화면에서 검색 버튼을 누르면 헤더 아래로 펼쳐지는 검색창
  variant?: "inline" | "panel"
  autoFocus?: boolean
  onDone?: () => void
}

// 상단 검색창: 누르면 테두리에 불이 들어오고 아래로 인기 검색어 10개
// 입력하는 동안은 그 화면의 팝업 목록을 거르고(onChange), Enter 를 누르면 검색 결과 페이지(/search/?q=)로 이동
export function HeaderSearch({ value, onChange, variant = "inline", autoFocus = false, onDone }: HeaderSearchProps) {
  const [text, setText] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [keywords, setKeywords] = useState<MapRankingItem[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setText(value), [value])

  useEffect(() => {
    if (!isFocused || keywords) return
    loadPopularKeywords()
      .then(setKeywords)
      .catch(() => {
        setLoadFailed(true)
        setKeywords([])
      })
  }, [isFocused, keywords])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsFocused(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [])

  const runSearch = (keyword: string) => {
    const q = keyword.trim()
    setText(q)
    setIsFocused(false)
    inputRef.current?.blur()
    if (!q) return
    setKeywords(null)
    onDone?.()
    // 검색 결과 페이지로 이동 (검색어 집계는 그 페이지에서 한 번만)
    goToSearch(q)
  }

  const isPanel = variant === "panel"

  return (
    <div ref={rootRef} className={`relative ${isPanel ? "w-full" : "w-44 2xl:w-56"}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch(text)
        }}
        className={`flex items-center gap-2 rounded-full border transition-all duration-200 ${isPanel ? "h-10 px-3.5" : "h-8 px-3"} ${
          isFocused
            ? "bg-zinc-950 border-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.25),0_0_18px_rgba(16,185,129,0.35)]"
            : "bg-zinc-900/90 border-zinc-800 hover:border-zinc-700"
        }`}
      >
        <Search className={`w-3.5 h-3.5 shrink-0 transition-colors ${isFocused ? "text-emerald-400" : "text-zinc-400"}`} />
        <input
          ref={inputRef}
          type="search"
          value={text}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            setText(e.target.value)
            onChange(e.target.value)
          }}
          placeholder="팝업, 캐릭터, 위치 검색"
          aria-label="검색"
          className={`w-full min-w-0 bg-transparent text-white placeholder-zinc-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden ${isPanel ? "text-sm" : "text-xs"}`}
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("")
              onChange("")
              inputRef.current?.focus()
            }}
            aria-label="검색어 지우기"
            className="text-zinc-500 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={isPanel ? "pt-2" : "absolute top-full right-0 w-64 pt-2 z-50"}
          >
            <div className="bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/90 rounded-2xl p-2 shadow-2xl shadow-black/90 ring-1 ring-white/10">
              <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-1">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  실시간 인기 검색어
                </span>
                <span className="text-emerald-400 text-[9px] font-extrabold">TOP 10</span>
              </div>
              {keywords === null ? (
                <div className="px-2.5 py-3 text-[11px] text-zinc-500">불러오는 중…</div>
              ) : keywords.length === 0 ? (
                <div className="px-2.5 py-3 text-[11px] text-zinc-500">
                  {loadFailed ? "인기 검색어를 불러오지 못했어요." : "아직 집계된 검색어가 없어요."}
                </div>
              ) : (
                <ol className="space-y-0.5">
                  {keywords.map((item) => (
                    <li key={item.target}>
                      <button
                        type="button"
                        onClick={() => runSearch(item.target)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs text-zinc-200 hover:text-white hover:bg-zinc-900 transition-colors"
                      >
                        <span className={`w-4 text-center font-black ${item.rank <= 3 ? "text-red-400" : "text-zinc-500"}`}>{item.rank}</span>
                        <span className="truncate font-semibold">{item.target}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

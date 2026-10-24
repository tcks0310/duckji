"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { getSessionMember } from "@/lib/member-auth"
import {
  PARTY_EVENT_KIND_LABELS,
  fetchPartyEvents,
  formatDDay,
  nextOccurrence,
  partyFundingHref,
  suggestPartyEvent,
  type PartyEvent,
  type PartyEventKind,
} from "@/lib/party-api"

// 펀딩 메인의 파티 캘린더 (예전 /funding/party 페이지 내용)
// 달력에서 캐릭터 생일·기념일을 보고, 이벤트를 누르면 '파티할래요?' 글과 그날로 펀딩 열기로 이어짐

const WEEK = ["일", "월", "화", "수", "목", "금", "토"]
const eventHref = (e: PartyEvent) => `/funding/party/event?slug=${encodeURIComponent(e.slug)}`

// compact: 펀딩 메인 상단 오른쪽용 (분류·검색 없이 달력 → 이벤트 목록 세로 배치)
export function PartyCalendar({ compact = false }: { compact?: boolean }) {
  const now = new Date()
  const [events, setEvents] = useState<PartyEvent[] | null>(null)
  const [error, setError] = useState("")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState<number | null>(null)
  const [kind, setKind] = useState<PartyEventKind | "all">("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetchPartyEvents()
      .then(setEvents)
      .catch((e) => setError(e?.message || "캘린더를 불러오지 못했습니다."))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (events || []).filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!q || [e.title, e.workTitle, e.characterName || ""].some((v) => v.toLowerCase().includes(q))) &&
        (!e.year || e.year === year)
    )
  }, [events, kind, query, year])

  const monthEvents = useMemo(
    () => filtered.filter((e) => e.month === month).sort((a, b) => a.day - b.day || a.title.localeCompare(b.title)),
    [filtered, month]
  )
  const byDay = useMemo(() => {
    const m = new Map<number, PartyEvent[]>()
    for (const e of monthEvents) m.set(e.day, [...(m.get(e.day) || []), e])
    return m
  }, [monthEvents])

  const first = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const isToday = (d: number) => year === now.getFullYear() && month === now.getMonth() + 1 && d === now.getDate()
  const shown = day ? byDay.get(day) || [] : monthEvents

  const move = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setDay(null)
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact && (
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 overflow-x-auto text-sm">
          {(["all", ...(Object.keys(PARTY_EVENT_KIND_LABELS) as PartyEventKind[])] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 h-8 rounded-full whitespace-nowrap ${kind === k ? "bg-white text-zinc-950 font-semibold" : "text-zinc-300 hover:text-white"}`}
            >
              {k === "all" ? "전체" : PARTY_EVENT_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-0 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="작품·캐릭터 이름으로 찾기"
            className="w-full bg-transparent border-b border-zinc-700 pl-6 pr-1 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
          />
        </label>
      </div>
      )}

      {error && <p className="text-sm text-zinc-300">{error}</p>}

      <div className={compact ? "space-y-4" : "grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-8 lg:gap-12"}>
        {/* 달력 */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <button onClick={() => move(-1)} aria-label="이전 달" className="p-2 -ml-2 text-zinc-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-lg font-semibold text-white tabular-nums">
              {year}년 {month}월
            </p>
            <button onClick={() => move(1)} aria-label="다음 달" className="p-2 -mr-2 text-zinc-400 hover:text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 border-t border-zinc-800 text-center">
            {WEEK.map((w, i) => (
              <div key={w} className={`py-2 text-xs ${i === 0 ? "text-rose-300" : "text-zinc-500"}`}>
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} />
              const list = byDay.get(d) || []
              const active = day === d
              return (
                <button
                  key={d}
                  onClick={() => setDay(active ? null : d)}
                  disabled={!list.length}
                  className={`relative ${compact ? "aspect-[6/5]" : "aspect-square sm:aspect-[5/4]"} flex flex-col items-center justify-start pt-1.5 text-sm transition-colors ${
                    active ? "bg-emerald-400 text-zinc-950 font-semibold" : list.length ? "text-white hover:bg-white/5" : "text-zinc-600"
                  }`}
                >
                  <span className={isToday(d) && !active ? "underline decoration-emerald-400 decoration-2 underline-offset-4" : ""}>{d}</span>
                  {list.length > 0 && (
                    <span className={`mt-1 hidden ${compact ? "" : "sm:block"} max-w-full px-1 truncate text-[11px] leading-tight ${active ? "text-zinc-900" : "text-emerald-300"}`}>
                      {list[0].characterName || list[0].title}
                    </span>
                  )}
                  {list.length > 0 && <span className={`${compact ? "" : "sm:hidden"} mt-1 w-1 h-1 rounded-full ${active ? "bg-zinc-950" : "bg-emerald-400"}`} />}
                  {!compact && list.length > 1 && <span className={`hidden sm:block text-[11px] ${active ? "text-zinc-800" : "text-zinc-500"}`}>+{list.length - 1}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택한 달(날)의 이벤트 */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-zinc-400">
              {day ? `${month}월 ${day}일` : `${month}월`} 이벤트 {events ? `${shown.length}개` : ""}
            </p>
            {day && (
              <button onClick={() => setDay(null)} className="text-sm text-zinc-400 hover:text-white">
                {month}월 전체 보기
              </button>
            )}
          </div>
          {!events && !error ? (
            <p className="py-8 text-sm text-zinc-500">불러오는 중...</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-sm text-zinc-400">이 달에 등록된 이벤트가 없어요. 빠진 이벤트가 있으면 알려 주세요.</p>
          ) : (
            <ul className={`divide-y divide-zinc-800 border-y border-zinc-800 ${compact ? "max-h-[260px]" : "max-h-[460px]"} overflow-y-auto`}>
              {shown.map((e) => {
                const next = nextOccurrence(e)
                return (
                  <li key={e.id} className="flex items-center gap-4 py-3">
                    <div className="w-12 text-center shrink-0">
                      <p className="text-xl font-semibold text-white tabular-nums leading-none">{e.day}</p>
                      <p className="text-[11px] text-zinc-500 mt-1">{PARTY_EVENT_KIND_LABELS[e.kind]}</p>
                    </div>
                    <Link href={eventHref(e)} className="flex-1 min-w-0 group">
                      <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">{e.title}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        {e.workTitle}
                        {e.postCount > 0 && ` · 파티 글 ${e.postCount}`}
                      </p>
                    </Link>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-xs text-zinc-400 tabular-nums">{formatDDay(e)}</p>
                      {next && (
                        <Link href={partyFundingHref(e)} className="text-xs text-emerald-300 hover:text-emerald-200">
                          펀딩 열기
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <SuggestForm compact={compact} />
    </div>
  )
}

// 회원 이벤트 제보 → 관리자 승인 후 캘린더에 올라감
function SuggestForm({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [isMember, setIsMember] = useState<boolean | null>(null)
  const [form, setForm] = useState({ title: "", kind: "birthday" as PartyEventKind, workTitle: "", characterName: "", month: 1, day: 1, source: "" })
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (open && isMember === null) getSessionMember().then((m) => setIsMember(Boolean(m)))
  }, [open, isMember])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    setMessage("")
    try {
      await suggestPartyEvent({ ...form, characterName: form.characterName || undefined })
      setMessage("제보가 접수됐어요. 운영팀 확인 후 캘린더에 올라갑니다.")
      setForm((f) => ({ ...f, title: "", characterName: "", source: "" }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "제보하지 못했습니다.")
    } finally {
      setIsSending(false)
    }
  }

  const input = "w-full bg-transparent border-b border-zinc-700 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 [color-scheme:dark]"

  return (
    <div className="border-t border-zinc-800 pt-4 space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="text-sm text-zinc-300 hover:text-white underline underline-offset-4">
        {open ? "제보 닫기" : "빠진 생일·기념일이 있나요? 이벤트 제보하기"}
      </button>
      {open && isMember === false && (
        <p className="text-sm text-zinc-400">
          로그인 후 제보할 수 있어요.{" "}
          <Link href="/login" className="text-emerald-300 underline underline-offset-4">
            로그인
          </Link>
        </p>
      )}
      {open && isMember && (
        <form onSubmit={submit} className={compact ? "grid sm:grid-cols-2 gap-x-6 gap-y-3" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 max-w-4xl"}>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required placeholder="이벤트 이름 (예: 에렌 예거 생일)" className={input} />
          <input value={form.workTitle} onChange={(e) => set("workTitle", e.target.value)} maxLength={120} required placeholder="작품명" className={input} />
          <input value={form.characterName} onChange={(e) => set("characterName", e.target.value)} maxLength={120} placeholder="캐릭터 (선택)" className={input} />
          <select value={form.kind} onChange={(e) => set("kind", e.target.value as PartyEventKind)} className={input}>
            {(Object.keys(PARTY_EVENT_KIND_LABELS) as PartyEventKind[]).map((k) => (
              <option key={k} value={k}>
                {PARTY_EVENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <select value={form.month} onChange={(e) => set("month", Number(e.target.value))} className={input}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <select value={form.day} onChange={(e) => set("day", Number(e.target.value))} className={input}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
          <input value={form.source} onChange={(e) => set("source", e.target.value)} maxLength={300} placeholder="출처 (공식 설정집 등)" className={input} />
          <div className={`sm:col-span-2 ${compact ? "" : "lg:col-span-3"} flex items-center gap-4 pt-1`}>
            <button type="submit" disabled={isSending} className="px-5 h-10 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold disabled:opacity-50">
              {isSending ? "보내는 중..." : "제보하기"}
            </button>
            {message && <span className="text-sm text-zinc-300">{message}</span>}
          </div>
        </form>
      )}
    </div>
  )
}

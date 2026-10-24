"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, PartyPopper, Sparkles } from "lucide-react"
import type { PopupEvent } from "@/data/popup-data"
import { popupDetailHref } from "@/lib/popup-service"
import { fetchPartyEvents, PARTY_EVENT_KIND_LABELS, partyFundingHref, type PartyEvent } from "@/lib/party-api"

// 홈 첫 화면: 날짜 하나를 골라(기본 오늘) 그날 열려 있는 팝업과 그날의 이벤트(파티 캘린더)를 봄
// 팝업 → 팝업 상세, 이벤트 → 이벤트 페이지(파티할래요? 글 · 이 날로 펀딩 열기) → 펀딩

const WEEK = ["일", "월", "화", "수", "목", "금", "토"]
const pad = (n: number) => String(n).padStart(2, "0")
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shortDate = (s: string) => `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}`

// 이벤트는 월·일(+연도, 없으면 매년). 평년의 2월 29일 이벤트는 2월 28일에 보여 줌
function eventOn(e: PartyEvent, d: Date) {
  if (e.year && e.year !== d.getFullYear()) return false
  const last = new Date(d.getFullYear(), e.month, 0).getDate()
  return e.month === d.getMonth() + 1 && Math.min(e.day, last) === d.getDate()
}

const popupOn = (p: PopupEvent, key: string) => Boolean(p.startDate && p.endDate) && p.startDate <= key && p.endDate >= key

const KIND_TONE: Record<PartyEvent["kind"], string> = {
  birthday: "text-pink-300 border-pink-400/40",
  anniversary: "text-amber-300 border-amber-400/40",
  story: "text-sky-300 border-sky-400/40",
  real: "text-emerald-300 border-emerald-400/40",
}

// 홈은 미리 만들어 둔 정적 페이지라 '오늘'은 방문한 브라우저에서 정함 (만들 때 날짜로 그리면 하루 지나면 틀림)
export function HomeTodayCalendar({ popups }: { popups: PopupEvent[] }) {
  const [today, setToday] = React.useState<Date | null>(null)
  React.useEffect(() => {
    const t = new Date()
    setToday(new Date(t.getFullYear(), t.getMonth(), t.getDate()))
  }, [])
  if (!today) return <div className="h-full" />
  return <TodayCalendar popups={popups} today={today} />
}

function TodayCalendar({ popups, today }: { popups: PopupEvent[]; today: Date }) {
  const [selected, setSelected] = React.useState(today)
  const [month, setMonth] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = React.useState<PartyEvent[] | null>(null)

  React.useEffect(() => {
    let alive = true
    fetchPartyEvents()
      .then((list) => alive && setEvents(list))
      .catch(() => alive && setEvents([]))
    return () => {
      alive = false
    }
  }, [])

  const selectedKey = keyOf(selected)
  const dayPopups = React.useMemo(
    () => popups.filter((p) => popupOn(p, selectedKey)).sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [popups, selectedKey]
  )
  const dayEvents = React.useMemo(() => (events || []).filter((e) => eventOn(e, selected)), [events, selected])

  // 달력 칸: 그 달 1일이 있는 주의 일요일부터 그 달 마지막 날이 있는 주까지 (4~6주)
  const cells = React.useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [month])
  const marks = React.useMemo(() => {
    const m = new Map<string, { popup: boolean; event: boolean }>()
    for (const d of cells) {
      const key = keyOf(d)
      m.set(key, { popup: popups.some((p) => popupOn(p, key)), event: (events || []).some((e) => eventOn(e, d)) })
    }
    return m
  }, [cells, popups, events])

  const pick = (d: Date) => {
    setSelected(d)
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }
  const moveMonth = (dir: -1 | 1) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1))
  const isToday = selectedKey === keyOf(today)

  return (
    <div className="h-full flex flex-col px-4 sm:px-6 pt-4 sm:pt-5 pb-14">
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <CalendarDays className="w-3.5 h-3.5" /> {isToday ? "오늘의 덕지" : "이날의 덕지"}
          </p>
          <h2 className="mt-1 text-lg sm:text-2xl font-black text-white">
            {selected.getMonth() + 1}월 {selected.getDate()}일 ({WEEK[selected.getDay()]})
          </h2>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={() => pick(today)}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors"
          >
            오늘로
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 mt-3 sm:mt-4 flex flex-col md:flex-row gap-3 md:gap-5">
        {/* 달력 */}
        <div className="shrink-0 md:w-[270px] lg:w-[300px]">
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)} className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-zinc-100 tabular-nums">
              {month.getFullYear()}.{pad(month.getMonth() + 1)}
            </span>
            <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)} className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] sm:text-[11px] font-semibold text-zinc-500 mb-0.5">
            {WEEK.map((w, i) => (
              <span key={w} className={i === 0 ? "text-rose-400/80" : i === 6 ? "text-sky-400/80" : ""}>
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7" role="grid" aria-label="날짜 고르기">
            {cells.map((d) => {
              const key = keyOf(d)
              const inMonth = d.getMonth() === month.getMonth()
              const sel = key === selectedKey
              const mark = marks.get(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(d)}
                  aria-pressed={sel}
                  aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일`}
                  className="h-[26px] sm:h-8 md:h-9 flex flex-col items-center justify-center"
                >
                  <span
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs tabular-nums transition-colors ${
                      sel
                        ? "bg-amber-300 text-zinc-950 font-black"
                        : key === keyOf(today)
                        ? "ring-1 ring-amber-300/70 text-white font-bold"
                        : inMonth
                        ? "text-zinc-200 hover:bg-white/10"
                        : "text-zinc-600 hover:bg-white/5"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="h-1 flex gap-0.5 -mt-0.5" aria-hidden>
                    {mark?.popup && <span className="w-1 h-1 rounded-full bg-rose-400" />}
                    {mark?.event && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="hidden md:flex mt-2 items-center gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> 팝업</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 이벤트</span>
          </p>
        </div>

        {/* 고른 날의 팝업 · 이벤트 */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 md:border-l md:border-zinc-800 md:pl-5">
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-bold text-white">
                열려 있는 팝업 <span className="text-zinc-500 font-semibold tabular-nums">{dayPopups.length}</span>
              </h3>
              <Link href="/popups/calendar/" className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-0.5">
                일정·지도 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {dayPopups.length ? (
              <ul className="divide-y divide-zinc-800/80">
                {dayPopups.map((p) => (
                  <li key={p.id}>
                    <a href={popupDetailHref(p.id)} className="group flex items-center gap-3 py-2">
                      <span className="w-10 h-[52px] shrink-0 rounded-md overflow-hidden bg-zinc-800">
                        {p.posterUrl && <img src={p.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-zinc-100 group-hover:text-amber-300 truncate">{p.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400 truncate">
                          <MapPin className="w-3 h-3 shrink-0 text-zinc-500" />
                          <span className="truncate">{p.venueName || p.location}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] text-zinc-500 tabular-nums">
                        {shortDate(p.startDate)} ~ {shortDate(p.endDate)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-xs text-zinc-500">이날 열려 있는 팝업이 없어요.</p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-bold text-white">
                이날의 이벤트 <span className="text-zinc-500 font-semibold tabular-nums">{dayEvents.length}</span>
              </h3>
              <Link href="/funding/party/" className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-0.5">
                이벤트 캘린더 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {events === null ? (
              <p className="py-3 text-xs text-zinc-500">이벤트를 불러오는 중이에요.</p>
            ) : dayEvents.length ? (
              <ul className="divide-y divide-zinc-800/80">
                {dayEvents.map((e) => (
                  <li key={e.slug} className="flex items-center gap-3 py-2">
                    <a href={`/funding/party/event?slug=${encodeURIComponent(e.slug)}`} className="group min-w-0 flex-1 flex items-center gap-3">
                      <span className="w-10 h-10 shrink-0 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-zinc-400">
                        {e.imageUrl ? <img src={e.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <PartyPopper className="w-4 h-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-px rounded border ${KIND_TONE[e.kind]}`}>{PARTY_EVENT_KIND_LABELS[e.kind]}</span>
                          <span className="text-sm font-bold text-zinc-100 group-hover:text-amber-300 truncate">{e.title}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-400 truncate">
                          {e.workTitle}
                          {e.characterName ? ` · ${e.characterName}` : ""}
                        </span>
                      </span>
                    </a>
                    <a
                      href={partyFundingHref(e)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-500/40 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <Sparkles className="w-3 h-3" /> 펀딩 열기
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-xs text-zinc-500">이날 등록된 이벤트가 없어요.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

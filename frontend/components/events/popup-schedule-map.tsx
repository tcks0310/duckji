"use client"

import * as React from "react"
import { useMemo, useRef, useState } from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ExternalLink, MapPin, Navigation } from "lucide-react"
import type { PopupEvent } from "@/data/popup-data"
import { PopupMap } from "@/components/map/popup-map"
import { popupToMarker, type MapFocus } from "@/components/map/types"
import { popupDetailHref } from "@/lib/popup-service"

// 팝업 일정·지도 (/popups/calendar)
// 위: 달력. 한 팝업의 운영 기간은 주마다 이어지는 한 줄 막대로 그려서 같은 팝업임을 알 수 있게 함
// 아래: 가로로 넓은 지도 + 고른 날짜(또는 이 달 전체) 팝업 목록. 막대·목록·지도 표시 어느 것을 눌러도 같은 팝업이 같이 표시됨

const WEEK = ["일", "월", "화", "수", "목", "금", "토"]

const pad = (n: number) => String(n).padStart(2, "0")
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const toDay = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000
const daysBetween = (a: string, b: string) => Math.round(toDay(b) - toDay(a))
const weekdayOf = (s: string) => WEEK[new Date(toDay(s) * 86_400_000).getUTCDay()]
const shortDate = (s: string) => (s ? `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}(${weekdayOf(s)})` : "")
const longDate = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일 (${weekdayOf(s)})`

function todayKey() {
  const t = new Date()
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
}

// 오늘 기준 남은 기간 문구
function periodText(ev: PopupEvent, today: string) {
  if (!ev.startDate || !ev.endDate) return ""
  if (today < ev.startDate) {
    const d = daysBetween(today, ev.startDate)
    return d === 1 ? "내일 오픈" : `${d}일 뒤 오픈`
  }
  if (today > ev.endDate) return "종료"
  const left = daysBetween(today, ev.endDate)
  return left === 0 ? "오늘 마지막 날" : `${left}일 남음`
}

// 팝업마다 다른 차분한 색 (같은 달 안에서 순서대로). 막대·목록 점이 같은 색
const POPUP_COLORS = [
  { bar: "bg-sky-600/85", dot: "bg-sky-500" },
  { bar: "bg-emerald-600/85", dot: "bg-emerald-500" },
  { bar: "bg-amber-600/85", dot: "bg-amber-500" },
  { bar: "bg-rose-600/85", dot: "bg-rose-500" },
  { bar: "bg-violet-600/85", dot: "bg-violet-500" },
  { bar: "bg-teal-600/85", dot: "bg-teal-500" },
  { bar: "bg-orange-600/85", dot: "bg-orange-500" },
  { bar: "bg-indigo-600/85", dot: "bg-indigo-500" },
]
const MAX_LANES = 3 // 한 주에 막대를 몇 줄까지 보여 줄지 (넘치면 날짜 칸에 +N)

type Segment = { ev: PopupEvent; startCol: number; endCol: number; contLeft: boolean; contRight: boolean; lane: number }

// 한 주(7칸)에 걸치는 팝업 막대들: 겹치지 않게 줄(lane)을 나눔
function weekSegments(week: (string | null)[], events: PopupEvent[]): Segment[] {
  const days = week.filter(Boolean) as string[]
  if (!days.length) return []
  const first = days[0]
  const last = days[days.length - 1]
  const segs = events
    .filter((ev) => ev.startDate <= last && ev.endDate >= first)
    .map((ev) => {
      const from = ev.startDate > first ? ev.startDate : first
      const to = ev.endDate < last ? ev.endDate : last
      return { ev, startCol: week.indexOf(from), endCol: week.indexOf(to), contLeft: ev.startDate < first, contRight: ev.endDate > last, lane: 0 }
    })
    .sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol))
  const laneEnds: number[] = []
  for (const seg of segs) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = seg.endCol
    seg.lane = lane
  }
  return segs
}

export function PopupScheduleMap({ events, status }: { events: PopupEvent[]; status: "loading" | "ok" | "error" }) {
  const today = useMemo(todayKey, [])
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1)
  const [selectedDate, setSelectedDate] = useState(today)
  const [scope, setScope] = useState<"day" | "month">("day")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const dated = useMemo(() => events.filter((ev) => ev.startDate && ev.endDate), [events])
  const monthStart = dateKey(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthEnd = dateKey(year, month, daysInMonth)
  const firstWeekday = new Date(year, month, 1).getDay()

  // 이 달에 하루라도 운영하는 팝업 (시작일 순)
  const monthEvents = useMemo(
    () => dated.filter((ev) => ev.startDate <= monthEnd && ev.endDate >= monthStart).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title)),
    [dated, monthStart, monthEnd]
  )
  const colorOf = (id: string) => POPUP_COLORS[Math.max(0, monthEvents.findIndex((ev) => ev.id === id)) % POPUP_COLORS.length]
  const eventsOn = (key: string) => monthEvents.filter((ev) => ev.startDate <= key && ev.endDate >= key)

  // 주 단위 칸 (달 밖의 칸은 null)
  const weeks = useMemo(() => {
    const cells: (string | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => dateKey(year, month, i + 1))]
    while (cells.length % 7) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  }, [year, month, firstWeekday, daysInMonth])

  const listed = scope === "month" ? monthEvents : eventsOn(selectedDate)
  const selected = monthEvents.find((ev) => ev.id === selectedId) || null
  // 지도: 목록에 있는 팝업 + (목록 밖이어도) 고른 팝업
  const mapEvents = [...listed, ...(selected && !listed.includes(selected) ? [selected] : [])].filter((ev) => popupToMarker(ev) !== null)

  const moveMonth = (diff: number) => {
    const d = new Date(year, month + diff, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedId(null)
    // 오늘이 든 달이면 오늘, 아니면 그 달 1일을 고름
    const first = dateKey(d.getFullYear(), d.getMonth(), 1)
    setSelectedDate(today.slice(0, 7) === first.slice(0, 7) ? today : first)
  }

  const goToday = () => {
    setYear(Number(today.slice(0, 4)))
    setMonth(Number(today.slice(5, 7)) - 1)
    setSelectedDate(today)
    setScope("day")
    setSelectedId(null)
  }

  const pickDate = (key: string) => {
    setSelectedDate(key)
    setScope("day")
    setSelectedId(null)
  }

  // 막대·목록·마커에서 팝업을 고르면 지도를 그 위치로 옮김
  const selectPopup = (id: string, scroll: boolean) => {
    const ev = monthEvents.find((x) => x.id === id)
    const marker = ev && popupToMarker(ev)
    setSelectedId(id)
    if (marker) setFocus({ latitude: marker.latitude, longitude: marker.longitude, zoom: 16, key: `${id}-${Date.now()}` })
    if (scroll) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <section id="section-calendar" className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">팝업 일정·지도</h1>
        <p className="text-sm text-zinc-400 mt-1">색 막대 하나가 팝업 하나의 기간이에요. 날짜나 막대를 누르면 지도에서 위치를 바로 볼 수 있어요.</p>
      </div>

      {status !== "ok" && (
        <p className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 text-sm text-zinc-300">
          {status === "loading" ? "팝업 일정을 불러오는 중이에요." : "팝업 일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
        </p>
      )}

      {/* PC: 왼쪽 작은 달력 + 목록, 오른쪽 큰 지도(고정). 모바일: 달력 → 지도 → 목록 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] items-start">
        {/* 달력 */}
        <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="min-w-[7.5rem] text-center text-base sm:text-lg font-bold text-white tabular-nums">
                {year}년 {month + 1}월
              </h2>
              <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">
                팝업 <strong className="text-white font-semibold">{monthEvents.length}</strong>개
              </span>
              <button type="button" onClick={goToday} className="h-8 px-3 rounded-full bg-zinc-800 text-sm text-zinc-100 hover:bg-zinc-700">
                오늘
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs pb-1">
            {WEEK.map((d, i) => (
              <div key={d} className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-zinc-500"}>
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, w) => {
            const segs = weekSegments(week, monthEvents)
            const shown = segs.filter((seg) => seg.lane < MAX_LANES)
            return (
              <div
                key={w}
                className="grid py-0.5"
                style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `1.75rem repeat(${MAX_LANES}, auto) 0.875rem` }}
              >
                {/* 날짜 칸 (막대 뒤 배경) */}
                {week.map((key, col) => {
                  if (!key) return <div key={`blank-${col}`} style={{ gridColumn: col + 1, gridRow: "1 / -1" }} />
                  const day = Number(key.slice(8, 10))
                  const hidden = segs.filter((seg) => seg.lane >= MAX_LANES && seg.startCol <= col && seg.endCol >= col).length
                  const isSelected = scope === "day" && key === selectedDate
                  const isToday = key === today
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickDate(key)}
                      aria-pressed={isSelected}
                      aria-label={`${month + 1}월 ${day}일, 팝업 ${eventsOn(key).length}개`}
                      className={`flex flex-col justify-between items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
                        isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                      }`}
                      style={{ gridColumn: col + 1, gridRow: "1 / -1" }}
                    >
                      <span
                        className={`mt-0.5 inline-flex w-6 h-6 items-center justify-center rounded-full text-xs sm:text-[13px] tabular-nums ${
                          isToday ? "bg-white text-zinc-950 font-bold" : col === 0 ? "text-rose-400" : col === 6 ? "text-sky-400" : "text-zinc-200"
                        } ${key < today && !isToday ? "opacity-40" : ""}`}
                      >
                        {day}
                      </span>
                      <span className="text-[10px] leading-[0.875rem] text-zinc-400">{hidden > 0 ? `+${hidden}` : ""}</span>
                    </button>
                  )
                })}

                {/* 팝업 기간 막대: 주가 바뀌어도 같은 색으로 이어짐 */}
                {shown.map((seg) => {
                  const active = seg.ev.id === selectedId
                  const dim = selectedId !== null && !active
                  return (
                    <button
                      key={`${seg.ev.id}-${w}`}
                      type="button"
                      onClick={() => selectPopup(seg.ev.id, true)}
                      title={`${seg.ev.title} (${shortDate(seg.ev.startDate)} ~ ${shortDate(seg.ev.endDate)})`}
                      aria-label={`${seg.ev.title} 운영 기간`}
                      className={`relative z-10 my-[2px] h-1.5 sm:h-4 min-w-0 text-left text-[10px] font-medium text-white truncate sm:px-1.5 leading-4 transition-opacity ${colorOf(seg.ev.id).bar} ${
                        seg.contLeft ? "" : "rounded-l-full ml-1"
                      } ${seg.contRight ? "" : "rounded-r-full mr-1"} ${active ? "ring-2 ring-white" : ""} ${dim ? "opacity-30" : ""}`}
                      style={{ gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`, gridRow: seg.lane + 2 }}
                    >
                      <span className="hidden sm:inline">{seg.ev.title}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* 지도 (PC 오른쪽, 달력·목록 높이만큼 고정) */}
        <div
          ref={mapRef}
          className="relative h-80 sm:h-[440px] lg:h-[calc(100vh-200px)] lg:min-h-[560px] rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900 scroll-mt-24 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-zinc-500 p-6 text-center">
            <MapPin className="w-8 h-8 opacity-40" />
            <span>{mapEvents.length ? "지도를 불러오는 중이에요" : "지도에 표시할 위치가 있는 팝업이 없어요"}</span>
          </div>
          <PopupMap
            events={mapEvents}
            className="absolute inset-0 w-full h-full"
            onSelectEvent={(ev) => selectPopup(ev.id, false)}
            focus={focus}
            selectedId={selectedId}
          />
          {/* 지도 위 안내: 지금 지도에 무엇이 찍혀 있는지 */}
          <div className="absolute left-3 top-3 z-10 rounded-full bg-zinc-950/85 backdrop-blur px-3 py-1.5 text-sm text-zinc-200 shadow">
            {scope === "day" ? longDate(selectedDate) : `${month + 1}월 전체`} · 지도에 {mapEvents.length}곳
          </div>
          {/* 고른 팝업: 지도 아래쪽에 띄움 */}
          {selected && (
            <div className="absolute left-3 right-3 bottom-3 z-10 sm:left-auto sm:w-[360px]">
              <SelectedCard event={selected} today={today} color={colorOf(selected.id).dot} onClose={() => setSelectedId(null)} />
            </div>
          )}
        </div>

        {/* 고른 날짜(또는 이 달 전체) 팝업 목록 */}
        <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800 lg:col-start-1 lg:row-start-2">
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
            <h2 className="text-sm sm:text-base font-bold text-white">
              {scope === "day" ? longDate(selectedDate) : `${month + 1}월 전체`}
              <span className="ml-1.5 text-zinc-400 font-normal">{listed.length}개</span>
            </h2>
            <div className="inline-flex rounded-full bg-zinc-800 p-0.5 text-xs sm:text-sm">
              {(["day", "month"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => {
                    setScope(sc)
                    setSelectedId(null)
                  }}
                  className={`h-7 px-3 rounded-full ${scope === sc ? "bg-white text-zinc-950 font-semibold" : "text-zinc-300 hover:text-white"}`}
                >
                  {sc === "day" ? "고른 날짜" : "이 달 전체"}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-2">
            {listed.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400 space-y-2">
                <CalendarIcon className="w-7 h-7 mx-auto opacity-40" />
                <p>{scope === "day" ? "이 날 운영하는 팝업이 없어요." : "이 달에 운영하는 팝업이 없어요."}</p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {listed.map((ev) => (
                  <PopupRow key={ev.id} event={ev} today={today} color={colorOf(ev.id).dot} active={ev.id === selectedId} onSelect={() => selectPopup(ev.id, true)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// 목록 한 줄: 포스터 · 이름 · 기간 · 장소
function PopupRow({ event: ev, today, color, active, onSelect }: { event: PopupEvent; today: string; color: string; active: boolean; onSelect: () => void }) {
  const hasMap = popupToMarker(ev) !== null
  const left = periodText(ev, today)
  return (
    <li>
      <button type="button" onClick={onSelect} className={`w-full text-left flex gap-3 py-3 -mx-2 px-2 rounded-xl ${active ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}>
        <img src={ev.posterUrl} alt="" className="w-14 h-14 rounded-xl object-cover bg-zinc-800 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
            <span className="truncate">{ev.title}</span>
          </h3>
          <p className="text-sm text-zinc-300 mt-0.5">
            {shortDate(ev.startDate)} ~ {shortDate(ev.endDate)}
            {left && <span className={left === "종료" ? "text-zinc-500" : "text-zinc-400"}> · {left}</span>}
          </p>
          <p className="text-sm text-zinc-400 truncate">
            {ev.venueName || ev.location}
            {!hasMap && <span className="text-zinc-500"> · 지도 위치 미등록</span>}
          </p>
        </div>
      </button>
    </li>
  )
}

function SelectedCard({ event: ev, today, color, onClose }: { event: PopupEvent; today: string; color: string; onClose: () => void }) {
  const left = periodText(ev, today)
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-950/95 backdrop-blur p-3 space-y-3 shadow-xl">
      <div className="flex gap-3">
        <img src={ev.posterUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-zinc-800 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-start gap-1.5 text-sm font-semibold text-white leading-snug">
            <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${color}`} />
            <span className="line-clamp-2">{ev.title}</span>
          </h3>
          <p className="text-sm text-zinc-300 mt-0.5">
            {shortDate(ev.startDate)} ~ {shortDate(ev.endDate)}
            {left && <span className="text-zinc-400"> · {left}</span>}
          </p>
          <p className="text-sm text-zinc-400 truncate">{[ev.venueName, ev.location].filter(Boolean).join(" · ")}</p>
          {ev.operatingHours && <p className="text-sm text-zinc-400">{ev.operatingHours}</p>}
        </div>
        <button type="button" onClick={onClose} className="self-start text-sm text-zinc-400 hover:text-white">
          닫기
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://map.naver.com/p/search/${encodeURIComponent(ev.location || ev.venueName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          <Navigation className="w-4 h-4" />
          길찾기
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a href={popupDetailHref(ev.id)} className="inline-flex items-center justify-center h-9 rounded-full bg-zinc-100 hover:bg-white text-sm font-semibold text-zinc-950">
          상세 보기
        </a>
      </div>
    </div>
  )
}

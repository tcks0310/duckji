"use client"

// 날짜를 직접 쓰지 않고 달력에서 고르는 공통 입력칸.
// 값은 기존 <input type="date"> 와 같은 "YYYY-MM-DD" 문자열,
// withTime 이면 <input type="datetime-local"> 과 같은 "YYYY-MM-DDTHH:mm" 문자열을 주고받는다.

import * as React from "react"
import { createPortal } from "react-dom"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  withTime?: boolean
  // 시간 선택 간격(분)
  minuteStep?: number
  required?: boolean
  disabled?: boolean
  placeholder?: string
  // 값이 비어 있을 때 처음 보여 줄 달 ("YYYY-MM")
  defaultMonth?: string
  clearable?: boolean
  className?: string
  // 바깥 감싸개 클래스(기본: 한 줄 전체 폭)
  wrapperClassName?: string
  id?: string
  title?: string
  "aria-label"?: string
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
export const todayYmd = () => {
  const t = new Date()
  return ymd(t.getFullYear(), t.getMonth(), t.getDate())
}

function parse(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value || "")
  if (!m) return null
  return { date: `${m[1]}-${m[2]}-${m[3]}`, y: +m[1], m: +m[2] - 1, d: +m[3], time: m[4] ? `${m[4]}:${m[5]}` : "" }
}

function label(value: string, withTime: boolean) {
  const p = parse(value)
  if (!p) return ""
  const w = WEEKDAYS[new Date(p.y, p.m, p.d).getDay()]
  const base = `${p.y}.${pad(p.m + 1)}.${pad(p.d)} (${w})`
  return withTime && p.time ? `${base} ${p.time}` : base
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  withTime = false,
  minuteStep = 10,
  required,
  disabled,
  placeholder = "날짜 선택",
  defaultMonth,
  clearable = true,
  className = "",
  wrapperClassName = "w-full",
  id,
  title,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const parsed = parse(value)
  const minDate = parse(min || "")?.date
  const maxDate = parse(max || "")?.date
  const initialView = () => {
    if (parsed) return { y: parsed.y, m: parsed.m }
    const dm = /^(\d{4})-(\d{2})/.exec(defaultMonth || "")
    if (dm) return { y: +dm[1], m: +dm[2] - 1 }
    const base = parse(minDate && minDate > todayYmd() ? minDate : maxDate && maxDate < todayYmd() ? maxDate : todayYmd())!
    return { y: base.y, m: base.m }
  }

  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState(initialView)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const place = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = 288
    const h = panelRef.current?.offsetHeight || (withTime ? 400 : 350)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    const below = r.bottom + 6
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below
    setPos({ top, left })
  }, [withTime])

  React.useLayoutEffect(() => {
    if (!open) return
    place()
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, place])

  const toggle = () => {
    if (disabled) return
    if (!open) setView(initialView())
    setOpen(!open)
  }

  const outOfRange = (d: string) => (!!minDate && d < minDate) || (!!maxDate && d > maxDate)
  const time = parsed?.time || "12:00"
  const emit = (date: string, t = time) => onChange(withTime ? `${date}T${t}` : date)
  const pick = (date: string) => {
    emit(date)
    if (!withTime) {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }
  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  const thisYear = new Date().getFullYear()
  const yFrom = Math.min(minDate ? +minDate.slice(0, 4) : thisYear - 100, view.y)
  const yTo = Math.max(maxDate ? +maxDate.slice(0, 4) : thisYear + 10, view.y)
  const years: number[] = []
  for (let y = yTo; y >= yFrom; y--) years.push(y)

  const first = new Date(view.y, view.m, 1).getDay()
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const today = todayYmd()

  const hours = Array.from({ length: 24 }, (_, i) => pad(i))
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep))
  const [hh, mm] = time.split(":")
  if (!minutes.includes(mm)) {
    minutes.push(mm)
    minutes.sort()
  }

  const sel = "bg-zinc-900 border border-zinc-700 rounded-md px-1.5 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
  const text = label(value, withTime)

  return (
    <div className={`relative inline-block min-w-0 align-middle ${wrapperClassName}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        title={title}
        aria-label={ariaLabel ? `${ariaLabel}${text ? `: ${text}` : ""}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={`${className} flex w-full items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <Calendar className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <span className={`min-w-0 flex-1 truncate ${text ? "" : "text-zinc-500"}`}>
          {parsed ? (
            <>
              {parsed.date.replace(/-/g, ".")}
              {/* 좁은 화면에선 요일을 빼서 날짜가 잘리지 않게 */}
              <span className="hidden sm:inline"> ({WEEKDAYS[new Date(parsed.y, parsed.m, parsed.d).getDay()]})</span>
              {withTime && parsed.time && ` ${parsed.time}`}
            </>
          ) : (
            placeholder
          )}
        </span>
        {clearable && value && !disabled && !required && (
          <span
            role="button"
            tabIndex={0}
            aria-label="날짜 지우기"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onChange("")
              }
            }}
            className="hidden shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-200 sm:inline-flex"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {required && (
        // 폼 제출 시 브라우저 기본 '필수 입력' 확인을 그대로 쓰기 위한 숨은 칸
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      )}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel || "날짜 선택"}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
            className="z-[20000] rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-100 shadow-2xl shadow-black/60"
          >
            <div className="mb-2 flex items-center gap-1">
              <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-center justify-center gap-1">
                <select aria-label="연도" value={view.y} onChange={(e) => setView({ ...view, y: +e.target.value })} className={sel}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select aria-label="월" value={view.m} onChange={(e) => setView({ ...view, m: +e.target.value })} className={sel}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] text-zinc-500">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={`py-1 ${i === 0 ? "text-rose-400/80" : i === 6 ? "text-sky-400/80" : ""}`}>
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />
                const ds = ymd(view.y, view.m, d)
                const off = outOfRange(ds)
                const on = parsed?.date === ds
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={off}
                    onClick={() => pick(ds)}
                    aria-label={label(ds, false)}
                    aria-pressed={on}
                    className={`h-9 rounded-md text-sm tabular-nums transition-colors ${
                      on
                        ? "bg-zinc-100 font-bold text-zinc-900"
                        : off
                          ? "cursor-not-allowed text-zinc-700"
                          : `hover:bg-zinc-800 ${ds === today ? "font-bold text-amber-400 ring-1 ring-inset ring-zinc-700" : i % 7 === 0 ? "text-rose-300" : i % 7 === 6 ? "text-sky-300" : "text-zinc-200"}`
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>

            {withTime && (
              <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
                <span>시간</span>
                <select aria-label="시" value={hh} disabled={!parsed} onChange={(e) => parsed && emit(parsed.date, `${e.target.value}:${mm}`)} className={`${sel} disabled:opacity-40`}>
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                <select aria-label="분" value={mm} disabled={!parsed} onChange={(e) => parsed && emit(parsed.date, `${hh}:${e.target.value}`)} className={`${sel} disabled:opacity-40`}>
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}분
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
              <button
                type="button"
                disabled={outOfRange(today)}
                onClick={() => {
                  const t = parse(today)!
                  setView({ y: t.y, m: t.m })
                  pick(today)
                }}
                className="rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
              >
                오늘
              </button>
              <div className="flex gap-1">
                {clearable && !required && value && (
                  <button type="button" onClick={() => onChange("")} className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                    지우기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                  className="rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800"
                >
                  {withTime ? "확인" : "닫기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

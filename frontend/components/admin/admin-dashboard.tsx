"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { pageName } from "@/lib/page-names"

// 관리자 첫 화면: 대시보드 (운영 현황 + 방문 통계)
// 방문 통계는 backend analytics 서비스 /api/analytics/admin/... 시간은 한국 시간 기준.
// 예전 방문 통계 탭(analytics-manager)은 archive/frontend/components/admin/ 에 있음.

type Summary = {
  days: number
  totals: { visitors: number; sessions: number; pageviews: number; searches: number; signups: number; signupVisitors: number; conversionRate: number }
  daily: { date: string; visitors: number; sessions: number; pageviews: number; signups: number }[]
  hourly: { hour: number; sessions: number }[]
  countries: { country: string; visitors: number; sessions: number; signups: number }[]
  sources: { source: string; sessions: number; signups: number }[]
  devices: { device: string; sessions: number }[]
  pages: { path: string; pageviews: number; visitors: number }[]
  searches: { query: string; count: number; visitors: number }[]
}

type Session = {
  sessionId: string
  startedAt: string
  endedAt: string
  country: string | null
  device: string | null
  lang: string | null
  entryPath: string
  source: string
  pageviews: number
  searches: string[]
  signedUp: boolean
  returning: boolean
}

type SessionEvent = { kind: string; path: string; searchQuery: string | null; at: string }

export type DashboardStat = { label: string; value: string; detail?: string; sub?: string; onClick: () => void }

const PERIODS = [
  { days: 1, label: "오늘" },
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
]

const DEVICE_LABELS: Record<string, string> = { mobile: "휴대폰", tablet: "태블릿", desktop: "PC", unknown: "알 수 없음" }
const SOURCE_LABELS: Record<string, string> = { direct: "직접 방문·즐겨찾기", qr: "현장 QR" }
// 기기 비율 막대 색 (차분한 계열)
const DEVICE_COLORS = ["bg-sky-500", "bg-sky-300", "bg-zinc-400", "bg-zinc-600"]

let regionNames: Intl.DisplayNames | null = null
try {
  regionNames = new Intl.DisplayNames(["ko"], { type: "region" })
} catch {
  regionNames = null
}
const countryName = (code: string | null) => {
  if (!code || code === "??") return "알 수 없음"
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}

const kst = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

const n = (v: number) => v.toLocaleString()
const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "0%")

// 오늘(한국 시간)부터 거꾸로 days 일의 날짜 목록 (기록 없는 날도 0 으로 그리기 위해)
function kstDates(days: number) {
  const today = new Date(Date.now() + 9 * 3600 * 1000)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  })
}

async function call<T>(path: string): Promise<T> {
  const res = await apiFetch(`/api/analytics/admin${path}`, { cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "방문 통계를 불러오지 못했습니다.")
  return body as T
}

function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-zinc-900 border border-zinc-800 ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Empty({ text = "아직 기록이 없습니다." }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{text}</p>
}

// 비중 막대 + 퍼센트 (표 안 한 칸)
function ShareBar({ part, whole }: { part: number; whole: number }) {
  const w = whole ? Math.max(2, (part / whole) * 100) : 0
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="hidden sm:block w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full bg-sky-500" style={{ width: `${w}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums text-zinc-400">{pct(part, whole)}</span>
    </div>
  )
}

// 방문 추이 차트 (날짜별 방문자·페이지 조회, '오늘'은 시간대별 방문)
function TrendChart({ points }: { points: { label: string; tip: string; a: number; b?: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 220
  const pad = { l: 40, r: 24, t: 12, b: 24 }
  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b ?? 0)))
  const niceMax = (() => {
    const step = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / step) * step
  })()
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih
  const line = (key: "a" | "b") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key] ?? 0).toFixed(1)}`).join(" ")
  const area = `${line("a")} L${x(points.length - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`
  const hasB = points.some((p) => p.b !== undefined)
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(niceMax * r))

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          const i = Math.round(((px - pad.l) / iw) * (points.length - 1))
          setHover(Math.min(points.length - 1, Math.max(0, i)))
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2f2f35" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#71717a">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        <path d={area} fill="rgb(14 165 233 / 0.12)" />
        {hasB && <path d={line("b")} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 3" />}
        <path d={line("a")} fill="none" stroke="#38bdf8" strokeWidth={2} />
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#71717a">
              {p.label}
            </text>
          ) : null
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#52525b" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(points[hover].a)} r={3.5} fill="#38bdf8" />
            {hasB && <circle cx={x(hover)} cy={y(points[hover].b ?? 0)} r={3} fill="#a1a1aa" />}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs text-zinc-300 whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="text-zinc-400 mb-0.5">{points[hover].tip}</div>
          <div>
            <span className="text-sky-300">●</span> {hasB ? "방문자" : "방문"} {n(points[hover].a)}
          </div>
          {hasB && (
            <div>
              <span className="text-zinc-400">●</span> 페이지 조회 {n(points[hover].b ?? 0)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AdminDashboard({ stats }: { stats: DashboardStat[] }) {
  const [days, setDays] = useState(7)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [country, setCountry] = useState("")
  const [signedUpOnly, setSignedUpOnly] = useState(false)
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [sessionEvents, setSessionEvents] = useState<Record<string, SessionEvent[]>>({})
  const [showAllPages, setShowAllPages] = useState(false)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    setError("")
    try {
      const params = new URLSearchParams({ days: String(days), limit: "50" })
      if (country) params.set("country", country)
      if (signedUpOnly) params.set("signedUp", "1")
      const [s, list] = await Promise.all([call<Summary>(`/summary?days=${days}`), call<{ sessions: Session[] }>(`/sessions?${params}`)])
      setSummary(s)
      setSessions(list.sessions)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, country, signedUpOnly])

  const toggleSession = async (id: string) => {
    if (openSession === id) return setOpenSession(null)
    setOpenSession(id)
    if (!sessionEvents[id]) {
      try {
        const r = await call<{ events: SessionEvent[] }>(`/sessions/${id}`)
        setSessionEvents((prev) => ({ ...prev, [id]: r.events }))
      } catch {
        setSessionEvents((prev) => ({ ...prev, [id]: [] }))
      }
    }
  }

  const t = summary?.totals
  // 차트: 오늘은 시간대별 방문, 그 밖은 날짜별 방문자·페이지 조회 (기록 없는 날은 0)
  const trend = useMemo(() => {
    if (days === 1) {
      const hourly = summary?.hourly || Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0 }))
      return hourly.map((h) => ({ label: `${h.hour}시`, tip: `${h.hour}시`, a: h.sessions }))
    }
    const byDate = new Map((summary?.daily || []).map((d) => [d.date, d]))
    return kstDates(days).map((date) => {
      const d = byDate.get(date)
      const [, m, dd] = date.split("-")
      return { label: `${Number(m)}/${Number(dd)}`, tip: `${Number(m)}월 ${Number(dd)}일`, a: d?.visitors || 0, b: d?.pageviews || 0 }
    })
  }, [summary, days])

  const pages = summary?.pages || []
  const shownPages = showAllPages ? pages : pages.slice(0, 10)
  const totalSourceSessions = (summary?.sources || []).reduce((s, r) => s + r.sessions, 0)
  const totalCountrySessions = (summary?.countries || []).reduce((s, r) => s + r.sessions, 0)
  const totalDeviceSessions = (summary?.devices || []).reduce((s, r) => s + r.sessions, 0)
  const maxHour = Math.max(1, ...(summary?.hourly.map((h) => h.sessions) || [0]))
  const periodLabel = PERIODS.find((p) => p.days === days)?.label || ""

  const kpis = [
    { label: "방문자", value: t ? `${n(t.visitors)}명` : "-", sub: t ? `방문 ${n(t.sessions)}회` : undefined },
    { label: "페이지 조회", value: t ? `${n(t.pageviews)}회` : "-", sub: t && t.sessions ? `방문당 ${(t.pageviews / t.sessions).toFixed(1)}페이지` : undefined },
    { label: "검색", value: t ? `${n(t.searches)}회` : "-", sub: t && t.visitors ? `방문자당 ${(t.searches / t.visitors).toFixed(1)}회` : undefined },
    { label: "회원가입", value: t ? `${n(t.signups)}명` : "-", sub: t ? `가입 전환율 ${t.conversionRate}%` : undefined },
  ]

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-white text-lg">대시보드</h2>

      {/* 운영 현황: 누르면 해당 화면으로 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="text-left p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors space-y-1 cursor-pointer"
          >
            <div className="text-sm text-zinc-400">{s.label}</div>
            <div className="text-2xl font-semibold text-white tabular-nums">{s.value}</div>
            {s.detail && <div className="text-sm text-zinc-300">{s.detail}</div>}
            {s.sub && <div className="text-xs text-zinc-500">{s.sub}</div>}
          </button>
        ))}
      </div>

      {/* 방문 통계 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="font-semibold text-white text-base">방문 통계</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${days === p.days ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={busy} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white" title="새로고침" aria-label="새로고침">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-zinc-800">
          {kpis.map((k, i) => (
            <div key={k.label} className={`p-4 space-y-1 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""} border-zinc-800`}>
              <div className="text-sm text-zinc-400">{k.label}</div>
              <div className="text-2xl font-semibold text-white tabular-nums">{k.value}</div>
              <div className="text-xs text-zinc-500 h-4">{k.sub}</div>
            </div>
          ))}
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="text-sm font-semibold text-white">{days === 1 ? "오늘 시간대별 방문" : `${periodLabel} 방문 추이`}</span>
            {days !== 1 && (
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-sky-400" /> 방문자
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 border-t border-dashed border-zinc-400" /> 페이지 조회
                </span>
              </span>
            )}
          </div>
          <TrendChart points={trend} />
        </div>
      </section>

      {/* 페이지별 조회 */}
      <Panel title="페이지별 조회" right={<span className="text-xs text-zinc-500">조회수 많은 순</span>}>
        {pages.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pl-4 pr-2 font-medium w-8">#</th>
                  <th className="py-2 pr-3 font-medium">페이지</th>
                  <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">조회수</th>
                  <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">방문자</th>
                  <th className="hidden sm:table-cell py-2 pr-3 font-medium text-right whitespace-nowrap">방문자당 조회</th>
                  <th className="py-2 pr-4 font-medium text-right">비중</th>
                </tr>
              </thead>
              <tbody>
                {shownPages.map((p, i) => (
                  <tr key={p.path} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30">
                    <td className="py-2.5 pl-4 pr-2 text-zinc-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 pr-3 max-w-[160px] sm:max-w-[280px]">
                      <div className="text-zinc-100 truncate">{pageName(p.path)}</div>
                      <div className="text-xs text-zinc-500 truncate">{p.path}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-100">{n(p.pageviews)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">{n(p.visitors)}</td>
                    <td className="hidden sm:table-cell py-2.5 pr-3 text-right tabular-nums text-zinc-400">{p.visitors ? (p.pageviews / p.visitors).toFixed(1) : "-"}</td>
                    <td className="py-2.5 pr-4">
                      <ShareBar part={p.pageviews} whole={t?.pageviews || 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages.length > 10 && (
              <button onClick={() => setShowAllPages((v) => !v)} className="mt-2 ml-4 text-xs text-sky-400 hover:text-sky-300">
                {showAllPages ? "10개만 보기" : `${pages.length}개 모두 보기`}
              </button>
            )}
          </div>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="유입 경로">
          {(summary?.sources || []).length === 0 ? (
            <Empty />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-3 font-medium">경로</th>
                  <th className="pb-2 pr-3 font-medium text-right">방문</th>
                  <th className="pb-2 pr-3 font-medium text-right">가입</th>
                  <th className="pb-2 font-medium text-right">비중</th>
                </tr>
              </thead>
              <tbody>
                {summary!.sources.map((s) => (
                  <tr key={s.source} className="border-b border-zinc-800/60 last:border-0">
                    <td className="py-2 pr-3 text-zinc-100 truncate max-w-[180px]">{SOURCE_LABELS[s.source] || s.source}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">{n(s.sessions)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">{s.signups || "-"}</td>
                    <td className="py-2">
                      <ShareBar part={s.sessions} whole={totalSourceSessions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="많이 검색한 말">
          {(summary?.searches || []).length === 0 ? (
            <Empty text="아직 검색 기록이 없습니다." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-2 font-medium w-8">#</th>
                  <th className="pb-2 pr-3 font-medium">검색어</th>
                  <th className="pb-2 pr-3 font-medium text-right">검색</th>
                  <th className="pb-2 font-medium text-right">검색한 사람</th>
                </tr>
              </thead>
              <tbody>
                {summary!.searches.slice(0, 10).map((s, i) => (
                  <tr key={s.query} className="border-b border-zinc-800/60 last:border-0">
                    <td className="py-2 pr-2 text-zinc-500 tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-3 text-zinc-100 truncate max-w-[200px]">{s.query}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">{n(s.count)}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-400">{n(s.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className={`grid gap-4 ${days === 1 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        <Panel title="국가">
          {(summary?.countries || []).length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2 text-sm">
              {summary!.countries.slice(0, 8).map((c) => (
                <li key={c.country} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-100 truncate">{countryName(c.country)}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-zinc-300">{n(c.sessions)}</span>
                    <ShareBar part={c.sessions} whole={totalCountrySessions} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="기기">
          {(summary?.devices || []).length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-4">
              <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-800">
                {summary!.devices.map((d, i) => (
                  <div key={d.device} className={DEVICE_COLORS[i % DEVICE_COLORS.length]} style={{ width: `${totalDeviceSessions ? (d.sessions / totalDeviceSessions) * 100 : 0}%` }} />
                ))}
              </div>
              <ul className="space-y-2 text-sm">
                {summary!.devices.map((d, i) => (
                  <li key={d.device} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-zinc-100">
                      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${DEVICE_COLORS[i % DEVICE_COLORS.length]}`} />
                      {DEVICE_LABELS[d.device] || d.device}
                    </span>
                    <span className="tabular-nums text-zinc-300">
                      {n(d.sessions)} <span className="ml-2 text-zinc-500">{pct(d.sessions, totalDeviceSessions)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {days !== 1 && (
          <Panel title="시간대별 방문">
            <div className="flex items-end gap-[3px] h-28">
              {(summary?.hourly || Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0 }))).map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col justify-end h-full" title={`${h.hour}시: ${h.sessions}회`}>
                  <div className="w-full rounded-t-sm bg-sky-500/70" style={{ height: `${(h.sessions / maxHour) * 100}%`, minHeight: h.sessions ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-zinc-500 tabular-nums">
              <span>0시</span>
              <span>6시</span>
              <span>12시</span>
              <span>18시</span>
              <span>23시</span>
            </div>
          </Panel>
        )}
      </div>

      {/* 최근 방문: 줄을 누르면 그 방문에서 본 페이지·검색 순서 */}
      <Panel
        title="최근 방문"
        right={
          <div className="flex items-center gap-2 text-xs">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-zinc-300">
              <option value="">모든 국가</option>
              {(summary?.countries || [])
                .filter((c) => c.country !== "??")
                .map((c) => (
                  <option key={c.country} value={c.country}>
                    {countryName(c.country)}
                  </option>
                ))}
            </select>
            <label className="flex items-center gap-1 text-zinc-400">
              <input type="checkbox" checked={signedUpOnly} onChange={(e) => setSignedUpOnly(e.target.checked)} />
              가입한 방문만
            </label>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pl-4 pr-3 font-medium">접속 시각</th>
                <th className="py-2 pr-3 font-medium">국가</th>
                <th className="py-2 pr-3 font-medium">기기</th>
                <th className="py-2 pr-3 font-medium">유입</th>
                <th className="py-2 pr-3 font-medium">처음 본 페이지</th>
                <th className="py-2 pr-3 font-medium text-right">페이지</th>
                <th className="py-2 pr-3 font-medium">검색어</th>
                <th className="py-2 pr-3 font-medium">가입</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-zinc-500">
                    {busy ? "불러오는 중" : "이 기간에 기록된 방문이 없습니다."}
                  </td>
                </tr>
              )}
              {(showAllSessions ? sessions : sessions.slice(0, 15)).map((s) => (
                <React.Fragment key={s.sessionId}>
                  <tr onClick={() => toggleSession(s.sessionId)} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 cursor-pointer">
                    <td className="py-2 pl-4 pr-3 tabular-nums text-zinc-300 whitespace-nowrap">
                      {kst(s.startedAt)}
                      {s.returning && <span className="ml-1.5 text-xs text-zinc-500">재방문</span>}
                    </td>
                    <td className="py-2 pr-3 text-zinc-300 whitespace-nowrap">{countryName(s.country)}</td>
                    <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">{DEVICE_LABELS[s.device || "unknown"] || s.device}</td>
                    <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">{SOURCE_LABELS[s.source] || s.source}</td>
                    <td className="py-2 pr-3 text-zinc-300 max-w-[180px] truncate" title={s.entryPath}>
                      {pageName(s.entryPath)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">{s.pageviews}</td>
                    <td className="py-2 pr-3 text-zinc-300 max-w-[200px] truncate">{s.searches.join(", ") || "-"}</td>
                    <td className="py-2 pr-3">{s.signedUp ? <span className="text-sky-300">가입</span> : <span className="text-zinc-600">-</span>}</td>
                    <td className="py-2 pr-4 text-zinc-500">{openSession === s.sessionId ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</td>
                  </tr>
                  {openSession === s.sessionId && (
                    <tr className="border-b border-zinc-800/60 bg-zinc-950/60">
                      <td colSpan={9} className="py-2 px-4">
                        {!sessionEvents[s.sessionId] ? (
                          <span className="text-zinc-500">불러오는 중</span>
                        ) : (
                          <ol className="space-y-0.5 text-xs">
                            {sessionEvents[s.sessionId].map((e, i) => (
                              <li key={i} className="text-zinc-400">
                                <span className="tabular-nums text-zinc-500 mr-2">{kst(e.at)}</span>
                                {e.kind === "search" ? (
                                  <span className="text-zinc-200">검색 &ldquo;{e.searchQuery}&rdquo;</span>
                                ) : e.kind === "signup" ? (
                                  <span className="text-sky-300">회원가입 완료</span>
                                ) : (
                                  <span title={e.path}>{pageName(e.path)}</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {sessions.length > 15 && (
            <button onClick={() => setShowAllSessions((v) => !v)} className="mt-2 ml-4 text-xs text-sky-400 hover:text-sky-300">
              {showAllSessions ? "15개만 보기" : `최근 ${sessions.length}개 모두 보기`}
            </button>
          )}
        </div>
      </Panel>
    </div>
  )
}

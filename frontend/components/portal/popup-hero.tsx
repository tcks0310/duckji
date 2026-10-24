"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { PopupEvent } from "@/data/popup-data"
import { popupDetailHref } from "@/lib/popup-service"

// 팝업 대분류 메인(/popups/) 윗부분: 소개 + 숫자 (왼쪽), 곧 끝나요·곧 열려요 (오른쪽)
// 펀딩 메인(/funding/)과 같은 구성. 아래 '지금 뜨는 팝업' 목록은 portal-page.tsx 가 그림

const DAY = 86_400_000
const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dayOf = (s: string) => {
  const t = new Date(s.replace(/\./g, "-")).getTime()
  return Number.isNaN(t) ? null : t
}
const md = (s: string) => {
  const t = dayOf(s)
  if (t === null) return s
  const d = new Date(t)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

export function PopupHero({ events, status }: { events: PopupEvent[]; status: "loading" | "ok" | "error" | string }) {
  const today = startOfToday()
  const live = events.filter((e) => e.status !== "ended")
  const ongoing = live.filter((e) => e.status === "ongoing" || e.status === "closing_soon")
  const upcomingAll = live.filter((e) => e.status === "upcoming")
  const own = live.filter((e) => e.operationType === "own" || e.hasNativeBooking || e.hasNativeWaiting)

  const closing = ongoing
    .map((e) => ({ e, left: ((dayOf(e.endDate) ?? Infinity) - today) / DAY }))
    .filter((x) => x.left >= 0 && x.left <= 14)
    .sort((a, b) => a.left - b.left)
    .slice(0, 4)
  const opening = upcomingAll
    .map((e) => ({ e, left: ((dayOf(e.startDate) ?? Infinity) - today) / DAY }))
    .filter((x) => x.left >= 0)
    .sort((a, b) => a.left - b.left)
    .slice(0, 4)

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start pt-2">
      <div className="space-y-5 lg:pt-6">
        <p className="text-sm text-emerald-300">덕지 팝업</p>
        <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.2] break-keep">
          지금 열린 애니 팝업,
          <br />
          덕지에서 한 번에 찾아요
        </h1>
        <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl break-keep">
          운영팀이 출처를 확인한 팝업스토어·콜라보 카페·전시를 모았어요. 일정과 위치를 보고, 덕지순례 코스로 여러 곳을 하루에 돌아볼 수도 있어요.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a href="#section-events" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold">
            지금 뜨는 팝업
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link href="/popups/calendar/" className="inline-flex items-center h-12 px-6 rounded-full border border-zinc-600 hover:border-zinc-400 text-white">
            일정·지도로 보기
          </Link>
        </div>
        <dl className="grid grid-cols-3 gap-6 pt-8 mt-4 border-t border-zinc-800 max-w-xl">
          <Stat label="진행 중" value={status === "ok" ? `${ongoing.length}개` : "-"} />
          <Stat label="오픈 예정" value={status === "ok" ? `${upcomingAll.length}개` : "-"} />
          <Stat label="덕지 예약·웨이팅" value={status === "ok" ? `${own.length}개` : "-"} />
        </dl>
      </div>

      <aside className="space-y-8">
        <SoonList title="곧 끝나요" empty="2주 안에 끝나는 팝업이 없어요." rows={closing.map(({ e, left }) => ({ e, when: `~${md(e.endDate)}`, tag: left < 1 ? "오늘 마감" : `D-${Math.ceil(left)}` }))} loading={status === "loading"} />
        <SoonList title="곧 열려요" empty="오픈 예정 팝업이 아직 없어요." rows={opening.map(({ e, left }) => ({ e, when: `${md(e.startDate)}~`, tag: left < 1 ? "오늘 오픈" : `D-${Math.ceil(left)}` }))} loading={status === "loading"} />
      </aside>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className="text-2xl sm:text-3xl font-semibold text-white tabular-nums mt-1">{value}</dd>
    </div>
  )
}

function SoonList({ title, empty, rows, loading }: { title: string; empty: string; rows: { e: PopupEvent; when: string; tag: string }[]; loading: boolean }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {loading ? (
        <p className="py-4 text-sm text-zinc-500 border-y border-zinc-800">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-sm text-zinc-400 border-y border-zinc-800">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
          {rows.map(({ e, when, tag }) => (
            <li key={e.id}>
              <Link href={popupDetailHref(e.id)} className="flex items-center gap-3 py-3 group">
                <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-900 shrink-0">
                  {e.posterUrl ? <img src={e.posterUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">{e.title}</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {when} · {e.venueName || e.location}
                  </p>
                </div>
                <span className="text-xs text-emerald-300 tabular-nums shrink-0">{tag}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

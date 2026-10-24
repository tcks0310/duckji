"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import {
  BOOKING_STATUS_LABEL,
  WAITING_STATUS_LABEL,
  createSlots,
  deleteSlot,
  fetchAdminBookings,
  fetchAdminWaitings,
  fetchOwnPopups,
  setBookingStatus,
  setOwnSwitch,
  setWaitingStatus,
  updateSlot,
  type Booking,
  type BookingResult,
  type BookingSlot,
  type OwnPopupSummary,
  type Waiting,
} from "@/lib/popup-booking"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 '팝업 예약·웨이팅' 탭 (backend popups /api/popups/admin/own)
// 자사 팝업 / 제휴 팝업 두 탭. 팝업 관리에서 종류를 '자사'·'제휴'로 둔 팝업만 나옴 (일반 팝업은 예약·웨이팅 없음)

const panel = "p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4"
const input = "bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
const btn = "whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
const btnMain = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40"
const weekday = (d: string) => "일월화수목금토"[new Date(`${d}T00:00:00`).getDay()]
const dayLabel = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}(${weekday(d)})`
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`${btn} ${on ? "border-emerald-500/60 text-emerald-300" : ""}`}>
      {label} {on ? "켜짐" : "꺼짐"}
    </button>
  )
}

const KIND_TABS = [
  { value: "own" as const, label: "자사 팝업" },
  { value: "partner" as const, label: "제휴 팝업" },
]

export function OwnPopupBookingManager() {
  const [kind, setKind] = useState<"own" | "partner">("own")
  const [allPopups, setPopups] = useState<OwnPopupSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [view, setView] = useState<"waiting" | "booking">("waiting")
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitings, setWaitings] = useState<Waiting[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ fromDate: today(), toDate: today(), times: "11:00, 13:00, 15:00, 17:00", durationMin: "60", capacity: "20" })
  const [bookingQuery, setBookingQuery] = useState("")

  const loadPopups = useCallback(async () => {
    const r = await fetchOwnPopups()
    if (r.status === "ok") {
      setPopups(r.data.popups)
    } else setError(r.status === "error" ? r.error : "관리자 로그인이 필요합니다.")
  }, [])

  const popups = allPopups && allPopups.filter((p) => (p.operationType || "own") === kind)
  // 탭을 바꾸거나 목록이 바뀌면 그 탭의 첫 팝업을 고름
  useEffect(() => {
    if (!popups) return
    if (!popups.some((p) => p.id === selectedId)) setSelectedId(popups[0]?.id || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, allPopups])

  const loadDetail = useCallback(async () => {
    if (!selectedId) return
    const [b, w] = await Promise.all([fetchAdminBookings(selectedId), fetchAdminWaitings(selectedId)])
    if (b.status === "ok") {
      setSlots(b.data.slots)
      setBookings(b.data.bookings)
    }
    if (w.status === "ok") setWaitings(w.data.waitings)
  }, [selectedId])

  useEffect(() => {
    void loadPopups()
  }, [loadPopups])
  useEffect(() => {
    void loadDetail()
  }, [loadDetail])
  // 현장 웨이팅은 20초마다 새로고침
  useEffect(() => {
    if (view !== "waiting" || !selectedId) return
    const t = setInterval(() => void loadDetail(), 20_000)
    return () => clearInterval(t)
  }, [view, selectedId, loadDetail])

  const run = async <T,>(r: Promise<BookingResult<T>>, after?: (data: T) => void) => {
    setBusy(true)
    setError("")
    const result = await r
    setBusy(false)
    if (result.status === "ok") after?.(result.data)
    else setError(result.status === "error" ? result.error : "관리자 로그인이 필요합니다.")
    await Promise.all([loadPopups(), loadDetail()])
  }

  const kindLabel = KIND_TABS.find((t) => t.value === kind)!.label
  const tabs = (
    <div className="flex gap-6 border-b border-zinc-800">
      {KIND_TABS.map((t) => (
        <button
          key={t.value}
          onClick={() => setKind(t.value)}
          className={`-mb-px pb-3 text-sm font-semibold border-b-2 ${kind === t.value ? "border-sky-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
        >
          {t.label}
          <span className="ml-1.5 text-xs tabular-nums text-zinc-500">{allPopups ? allPopups.filter((p) => (p.operationType || "own") === t.value).length : ""}</span>
        </button>
      ))}
    </div>
  )

  if (popups === null) return <div className={panel}>{error || "불러오는 중..."}</div>
  if (!popups.length) {
    return (
      <div className={panel}>
        <h3 className="font-semibold text-lg text-white">팝업 예약·웨이팅</h3>
        {tabs}
        <p className="text-xs text-zinc-400">
          {kindLabel}이 없습니다. 팝업 메뉴에서 팝업 종류를 &apos;{kindLabel}&apos;으로 바꾸면 여기서 예약 시간대와 현장 웨이팅을 관리할 수 있어요.
        </p>
      </div>
    )
  }

  const popup = popups.find((p) => p.id === selectedId) || popups[0]
  const activeWaitings = waitings.filter((w) => w.status === "waiting" || w.status === "called")
  const doneWaitings = waitings.filter((w) => !(w.status === "waiting" || w.status === "called"))
  const q = bookingQuery.trim().toUpperCase()
  const shownBookings = q ? bookings.filter((b) => b.code.includes(q) || (b.memberName || "").toUpperCase().includes(q)) : bookings
  const bookingsBySlot = (slotId: number) => shownBookings.filter((b) => b.slotId === slotId)

  return (
    <div className="space-y-5">
      {error && <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>}

      <div className={panel}>
        <div>
          <h3 className="font-semibold text-lg text-white">팝업 예약·웨이팅</h3>
          <p className="text-xs text-zinc-400">예약은 무료 예약이며, 호출 알림톡은 발송 연동 뒤에 붙습니다(지금은 회원 화면에 호출 상태가 보임).</p>
        </div>
        {tabs}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/60">
                <th className="p-3">팝업</th>
                <th className="p-3">기간</th>
                <th className="p-3">오늘 예약</th>
                <th className="p-3">앞으로 예약</th>
                <th className="p-3">지금 대기</th>
                <th className="p-3">오늘 웨이팅 입장</th>
                <th className="p-3">받기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {popups.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} className={`cursor-pointer ${p.id === popup.id ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"}`}>
                  <td className="p-3 text-white">
                    {p.title}
                    {!p.isPublished && <span className="ml-1 text-zinc-500">(비공개)</span>}
                  </td>
                  <td className="p-3 text-zinc-400">
                    {p.startDate} ~ {p.endDate}
                  </td>
                  <td className="p-3 text-zinc-200">{p.todayBookings}건</td>
                  <td className="p-3 text-zinc-200">{p.upcomingBookings}건</td>
                  <td className="p-3 text-zinc-200">{p.waitingNow}팀</td>
                  <td className="p-3 text-zinc-200">{p.enteredToday}팀</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <Switch on={p.bookingOn} label="예약" onChange={(on) => void run(setOwnSwitch(p.id, "booking", on))} />
                      <Switch on={p.waitingOn} label="웨이팅" onChange={(on) => void run(setOwnSwitch(p.id, "waiting", on))} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white truncate">{popup.title}</span>
        <div className="ml-auto flex gap-1.5">
          {(["waiting", "booking"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`${btn} ${view === v ? "bg-zinc-800 text-white" : ""}`}>
              {v === "waiting" ? `현장 웨이팅 (${activeWaitings.length})` : `사전 예약 (${bookings.filter((b) => b.status === "booked").length})`}
            </button>
          ))}
          <button onClick={() => void loadDetail()} className={btn}>
            새로고침
          </button>
        </div>
      </div>

      {view === "waiting" && (
        <div className={panel}>
          <div className="text-xs text-zinc-400">
            오늘 줄 · {popup.waitingOn ? "웨이팅 받는 중" : "웨이팅 꺼짐 (위 표에서 켜기)"} · 날짜가 바뀌면 남은 대기는 자동으로 마감됩니다.
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/60">
                  <th className="p-3">번호</th>
                  <th className="p-3">회원</th>
                  <th className="p-3">인원</th>
                  <th className="p-3">등록</th>
                  <th className="p-3">상태</th>
                  <th className="p-3">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {waitings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-zinc-500">
                      오늘 웨이팅이 없습니다.
                    </td>
                  </tr>
                )}
                {[...activeWaitings, ...doneWaitings].map((w) => (
                  <tr key={w.id} className={w.status === "waiting" || w.status === "called" ? "" : "text-zinc-500"}>
                    <td className="p-3 font-semibold text-white">{w.number}번</td>
                    <td className="p-3">{w.memberName}</td>
                    <td className="p-3">{w.partySize}명</td>
                    <td className="p-3">{new Date(w.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={`p-3 ${w.status === "called" ? "text-amber-300" : ""}`}>{WAITING_STATUS_LABEL[w.status]}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        {w.status === "waiting" && (
                          <button disabled={busy} onClick={() => void run(setWaitingStatus(w.id, "called"))} className={btn}>
                            호출
                          </button>
                        )}
                        {(w.status === "waiting" || w.status === "called") && (
                          <>
                            <button disabled={busy} onClick={() => void run(setWaitingStatus(w.id, "entered"))} className={btn}>
                              입장
                            </button>
                            <button disabled={busy} onClick={() => void run(setWaitingStatus(w.id, "no_show"))} className={btn}>
                              노쇼
                            </button>
                          </>
                        )}
                        {(w.status === "no_show" || w.status === "canceled") && (
                          <button disabled={busy} onClick={() => void run(setWaitingStatus(w.id, "waiting"))} className={btn}>
                            대기로 되돌리기
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "booking" && (
        <>
          <div className={panel}>
            <div className="text-sm font-semibold text-white">예약 시간대 열기</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-zinc-400">
              <label className="space-y-1">
                <div>시작 날짜</div>
                <DatePicker className={`${input} w-full`} value={form.fromDate} max={form.toDate || undefined} onChange={(v) => setForm({ ...form, fromDate: v })} aria-label="시작 날짜" />
              </label>
              <label className="space-y-1">
                <div>끝 날짜</div>
                <DatePicker className={`${input} w-full`} value={form.toDate} min={form.fromDate || undefined} onChange={(v) => setForm({ ...form, toDate: v })} aria-label="끝 날짜" />
              </label>
              <label className="space-y-1 col-span-2 md:col-span-1">
                <div>시작 시간 (쉼표로)</div>
                <input className={`${input} w-full`} value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} />
              </label>
              <label className="space-y-1">
                <div>한 타임 (분)</div>
                <input type="number" className={`${input} w-full`} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
              </label>
              <label className="space-y-1">
                <div>정원 (명)</div>
                <input type="number" className={`${input} w-full`} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={busy}
                className={btnMain}
                onClick={() =>
                  void run(
                    createSlots(popup.id, {
                      fromDate: form.fromDate,
                      toDate: form.toDate,
                      times: form.times.split(/[,\s]+/).filter(Boolean),
                      durationMin: Number(form.durationMin),
                      capacity: Number(form.capacity),
                    }),
                    (d) => window.alert(`시간대 ${d.created}개를 열었습니다.${d.skipped ? ` (이미 있는 ${d.skipped}개는 건너뜀)` : ""}`)
                  )
                }
              >
                시간대 열기
              </button>
              <span className="text-[11px] text-zinc-500">
                {popup.bookingOn ? "예약 받는 중" : "예약 꺼짐 — 위 표에서 켜야 회원 화면에 보입니다"}
              </span>
            </div>
          </div>

          <div className={panel}>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white">시간대별 예약자</div>
              <input
                className={`${input} ml-auto w-48`}
                placeholder="예약 번호·이름 찾기"
                value={bookingQuery}
                onChange={(e) => setBookingQuery(e.target.value)}
              />
            </div>
            {slots.length === 0 && <div className="text-xs text-zinc-500">오늘 이후 열린 시간대가 없습니다.</div>}
            <div className="space-y-3">
              {slots.map((s) => {
                const list = bookingsBySlot(s.id)
                if (q && !list.length) return null
                return (
                  <div key={s.id} className="rounded-xl border border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-950/60 text-xs">
                      <span className="font-semibold text-white">
                        {dayLabel(s.date)} {s.startTime}~{s.endTime}
                      </span>
                      <span className="text-zinc-400">
                        {s.booked}/{s.capacity}명 {!s.isOpen && "· 마감"}
                      </span>
                      <div className="ml-auto flex gap-1.5">
                        <button
                          disabled={busy}
                          className={btn}
                          onClick={() => {
                            const v = window.prompt("새 정원 (명)", String(s.capacity))
                            if (v) void run(updateSlot(s.id, { capacity: Number(v) }))
                          }}
                        >
                          정원 변경
                        </button>
                        <button disabled={busy} className={btn} onClick={() => void run(updateSlot(s.id, { isOpen: !s.isOpen }))}>
                          {s.isOpen ? "마감" : "다시 열기"}
                        </button>
                        <button
                          disabled={busy}
                          className={btn}
                          onClick={() => window.confirm("이 시간대를 지울까요?") && void run(deleteSlot(s.id))}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    {list.length > 0 && (
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-zinc-800">
                          {list.map((b) => (
                            <tr key={b.id} className={b.status === "booked" || b.status === "checked_in" ? "" : "text-zinc-500"}>
                              <td className="p-3 font-mono text-zinc-200">{b.code}</td>
                              <td className="p-3">{b.memberName}</td>
                              <td className="p-3">{b.partySize}명</td>
                              <td className="p-3">{BOOKING_STATUS_LABEL[b.status]}</td>
                              <td className="p-3">
                                <div className="flex gap-1.5 justify-end">
                                  {b.status === "booked" && (
                                    <>
                                      <button disabled={busy} className={btn} onClick={() => void run(setBookingStatus(b.id, "checked_in"))}>
                                        입장
                                      </button>
                                      <button disabled={busy} className={btn} onClick={() => void run(setBookingStatus(b.id, "no_show"))}>
                                        노쇼
                                      </button>
                                      <button
                                        disabled={busy}
                                        className={btn}
                                        onClick={() => window.confirm("이 예약을 취소할까요?") && void run(setBookingStatus(b.id, "canceled"))}
                                      >
                                        취소
                                      </button>
                                    </>
                                  )}
                                  {(b.status === "checked_in" || b.status === "no_show") && (
                                    <button disabled={busy} className={btn} onClick={() => void run(setBookingStatus(b.id, "booked"))}>
                                      되돌리기
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

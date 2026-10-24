"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import {
  BOOKING_STATUS_LABEL,
  WAITING_STATUS_LABEL,
  cancelBooking,
  cancelWaiting,
  type Booking,
  type Waiting,
} from "@/lib/popup-booking"
import { useMyPage } from "@/components/mypage/mypage-shell"
import { EmptyState, lineBtn, listBox, popupHref, viewTab } from "@/components/mypage/saved-panels"

// 마이페이지 '예약·웨이팅': 자사 팝업 사전 예약과 현장 웨이팅 (lib/popup-booking). 취소도 여기서

const weekday = (d: string) => "일월화수목금토"[new Date(`${d}T00:00:00`).getDay()]
const dayLabel = (d: string) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)} (${weekday(d)})`
const isActiveWaiting = (w: Waiting) => w.status === "waiting" || w.status === "called"

const statusTone = (on: boolean, warn = false) => `text-xs font-bold ${warn ? "text-amber-300" : on ? "text-emerald-400" : "text-zinc-500"}`

export function ReservationsPanel() {
  const { reservations, reloadReservations } = useMyPage()
  const [view, setView] = useState<"bookings" | "waitings">("bookings")
  const [busy, setBusy] = useState(false)

  if (!reservations) return <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>

  const act = async (run: () => ReturnType<typeof cancelBooking>) => {
    setBusy(true)
    const r = await run()
    if (r.status === "error") window.alert(r.error)
    if (r.status === "login") window.alert("로그인이 끝났어요. 다시 로그인해주세요.")
    await reloadReservations()
    setBusy(false)
  }

  const onCancelBooking = (b: Booking) => {
    if (window.confirm(`${dayLabel(b.date)} ${b.startTime} 예약을 취소할까요?`)) void act(() => cancelBooking(b.code))
  }
  const onCancelWaiting = (w: Waiting) => {
    if (window.confirm("웨이팅을 취소할까요? 취소하면 순서가 사라져요.")) void act(() => cancelWaiting(w.popupId))
  }

  const bookingCount = reservations.bookings.filter((b) => b.status === "booked").length
  const waitingCount = reservations.waitings.filter(isActiveWaiting).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {(
          [
            ["bookings", `사전 예약 ${bookingCount}`],
            ["waitings", `현장 웨이팅 ${waitingCount}`],
          ] as const
        ).map(([id, label], i) => (
          <React.Fragment key={id}>
            {i > 0 && <span className="w-px h-3 bg-zinc-700" aria-hidden />}
            <button onClick={() => setView(id)} aria-pressed={view === id} className={viewTab(view === id)}>
              {label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {view === "bookings" &&
        (reservations.bookings.length === 0 ? (
          <EmptyState text="예약한 팝업이 없어요." href="/popups/" linkLabel="팝업 둘러보기" />
        ) : (
          <div className={listBox}>
            {reservations.bookings.map((b) => (
              <div key={b.code} className="py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={statusTone(b.status === "booked")}>{BOOKING_STATUS_LABEL[b.status]}</span>
                    <span className="text-xs text-zinc-500">예약 번호 {b.code}</span>
                  </div>
                  <Link href={popupHref(b.popupId)} className="block text-base font-bold text-white hover:underline truncate">
                    {b.popupTitle || "팝업"}
                  </Link>
                  <div className="text-sm text-zinc-300">
                    {dayLabel(b.date)} {b.startTime}~{b.endTime} · {b.partySize}명
                  </div>
                </div>
                {b.status === "booked" && (
                  <button
                    disabled={busy}
                    onClick={() => onCancelBooking(b)}
                    className={`self-start sm:self-center ${lineBtn}`}
                  >
                    예약 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

      {view === "waitings" &&
        (reservations.waitings.length === 0 ? (
          <EmptyState text="웨이팅 기록이 없어요." href="/popups/" linkLabel="팝업 둘러보기" />
        ) : (
          <div className={listBox}>
            {reservations.waitings.map((w) => {
              const active = isActiveWaiting(w)
              return (
                <div key={w.id} className="py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={statusTone(active, w.status === "called")}>{WAITING_STATUS_LABEL[w.status]}</span>
                      <span className="text-xs text-zinc-500">대기 번호 {w.number}번</span>
                    </div>
                    <Link href={popupHref(w.popupId)} className="block text-base font-bold text-white hover:underline truncate">
                      {w.popupTitle || "팝업"}
                    </Link>
                    <div className="text-sm text-zinc-300">
                      {dayLabel(w.day)} · {w.partySize}명
                      {w.status === "waiting" && w.ahead !== undefined && <span className="text-zinc-400"> · 내 앞 {w.ahead}팀</span>}
                    </div>
                    {w.status === "called" && <div className="text-sm font-bold text-amber-300">입장 차례예요. 입구에서 대기 번호를 보여주세요.</div>}
                  </div>
                  {active && (
                    <button
                      disabled={busy}
                      onClick={() => onCancelWaiting(w)}
                      className={`self-start sm:self-center ${lineBtn}`}
                    >
                      웨이팅 취소
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}

      <p className="text-sm text-zinc-500">예약과 웨이팅은 덕지에서 직접 운영하는 팝업에서만 할 수 있어요.</p>
    </div>
  )
}

"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Calendar, CheckCircle2, Clock, RefreshCw, Ticket, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  cancelBooking,
  cancelWaiting,
  createBooking,
  fetchBooking,
  fetchWaiting,
  joinWaiting,
  type BookingOverview,
  type BookingResult,
  type WaitingOverview,
} from "@/lib/popup-booking"

// 자사 팝업 예약·현장 웨이팅 (팝업 상세 페이지 안). 서버: lib/popup-booking
// 결제 연동 전이라 무료 예약만. 호출 알림톡은 발송 연동 뒤 — 지금은 이 화면·내 티켓에서 호출 상태를 확인

const card = "p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3"
const chip = (active: boolean) =>
  `px-3 py-2 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
    active ? "bg-amber-500/20 border-amber-400 text-amber-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
  } disabled:opacity-40 disabled:cursor-not-allowed`
const weekday = (d: string) => "일월화수목금토"[new Date(`${d}T00:00:00`).getDay()]
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${weekday(d)})`

function PartyPicker({ max, value, onChange }: { max: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-400 font-bold shrink-0">인원</span>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className={chip(value === n)}>
          {n}명
        </button>
      ))}
    </div>
  )
}

export function OwnPopupBooking({
  popupId,
  mode,
  onRequireLogin,
  onOpenMyTickets,
}: {
  popupId: string
  mode: "booking" | "waiting"
  onRequireLogin: () => void
  onOpenMyTickets?: () => void
}) {
  const [booking, setBooking] = useState<BookingOverview | null>(null)
  const [waiting, setWaiting] = useState<WaitingOverview | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState("")
  const [slotId, setSlotId] = useState<number | null>(null)
  const [party, setParty] = useState(1)

  const load = useCallback(async () => {
    const [b, w] = await Promise.all([fetchBooking(popupId), fetchWaiting(popupId)])
    if (b.status === "ok") setBooking(b.data)
    if (w.status === "ok") setWaiting(w.data)
    if (b.status === "error") setError(b.error)
  }, [popupId])

  useEffect(() => {
    void load()
  }, [load])

  // 웨이팅 중이면 30초마다 내 순서 새로고침
  useEffect(() => {
    if (mode !== "waiting" || !waiting?.mine) return
    const t = setInterval(() => void load(), 30_000)
    return () => clearInterval(t)
  }, [mode, waiting?.mine, load])

  const handle = async <T,>(r: Promise<BookingResult<T>>) => {
    setBusy(true)
    setError("")
    const result = await r
    setBusy(false)
    if (result.status === "login") return onRequireLogin()
    if (result.status === "error") return setError(result.error)
    await load()
  }

  if (!booking || !waiting) {
    return <div className={`${card} text-center text-zinc-400`}>{error || "불러오는 중..."}</div>
  }

  const errorBox = error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>

  if (mode === "waiting") {
    const mine = waiting.mine
    return (
      <div className="space-y-3">
        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-black text-white">
              <Users className="w-4 h-4 text-amber-400" /> 현장 웨이팅
            </span>
            <button onClick={() => void load()} className="text-zinc-400 hover:text-white" aria-label="새로고침">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-zinc-300">
            지금 대기 <b className="text-white">{waiting.waitingTeams}팀</b> ({waiting.waitingPeople}명)
          </div>
        </div>

        {mine && errorBox}
        {mine ? (
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-2">
            <div className="text-sm text-emerald-300 font-bold">내 대기 번호</div>
            <div className="text-4xl font-black text-white">{mine.number}번</div>
            {mine.status === "called" ? (
              <div className="text-sm font-black text-amber-300">입장 차례입니다. 입구에서 번호를 보여주세요.</div>
            ) : (
              <div className="text-sm text-zinc-300">
                내 앞 <b className="text-white">{mine.ahead ?? 0}팀</b> · {mine.partySize}명
              </div>
            )}
            <p className="text-xs text-zinc-500">차례가 되면 덕지 알림함·앱 푸시·카카오 알림톡으로 알려 드려요. 이 화면이나 내 티켓에서도 순서를 볼 수 있어요.</p>
            <button
              disabled={busy}
              onClick={() => confirm("웨이팅을 취소할까요?") && void handle(cancelWaiting(popupId))}
              className="text-sm text-zinc-400 hover:text-white underline"
            >
              웨이팅 취소
            </button>
          </div>
        ) : waiting.open ? (
          <div className={card}>
            <PartyPicker max={waiting.maxParty} value={party} onChange={setParty} />
            {errorBox}
            <Button
              disabled={busy}
              onClick={() => void handle(joinWaiting(popupId, party))}
              className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm"
            >
              {busy ? "처리 중..." : `${party}명 웨이팅 등록`}
            </Button>
          </div>
        ) : (
          <div className={`${card} text-center text-zinc-400`}>지금은 현장 웨이팅을 받지 않습니다. 운영 시간에 현장에서 등록해주세요.</div>
        )}
      </div>
    )
  }

  // 예약
  const dates = booking.slots.map((s) => s.date).filter((d, i, all) => all.indexOf(d) === i)
  const activeDate = date && dates.includes(date) ? date : dates[0] || ""
  const slots = booking.slots.filter((s) => s.date === activeDate)
  const selected = booking.slots.find((s) => s.id === slotId)

  return (
    <div className="space-y-3">
      {booking.mine.length > 0 && errorBox}
      {booking.mine.map((b) => (
        <div key={b.code} className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-300 font-black">
            <CheckCircle2 className="w-4 h-4" /> 예약 완료
          </div>
          <div className="text-white font-bold">
            {dayLabel(b.date)} {b.startTime}~{b.endTime} · {b.partySize}명
          </div>
          <div className="text-sm text-zinc-300">
            예약 번호 <span className="font-mono font-bold text-amber-300">{b.code}</span> (현장에서 보여주세요)
          </div>
          <div className="flex gap-3 pt-1">
            {onOpenMyTickets && (
              <button onClick={onOpenMyTickets} className="text-sm text-zinc-300 hover:text-white underline">
                내 티켓 보기
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => confirm("예약을 취소할까요?") && void handle(cancelBooking(b.code))}
              className="text-sm text-zinc-400 hover:text-white underline"
            >
              예약 취소
            </button>
          </div>
        </div>
      ))}

      {!booking.enabled ? (
        <div className={`${card} text-center text-zinc-400`}>지금은 예약을 받지 않습니다.</div>
      ) : dates.length === 0 ? (
        <div className={`${card} text-center text-zinc-400`}>예약할 수 있는 시간이 아직 없습니다.</div>
      ) : (
        <div className={card}>
          <div className="flex items-center gap-1.5 font-black text-white">
            <Calendar className="w-4 h-4 text-amber-400" /> 날짜
          </div>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <button key={d} onClick={() => (setDate(d), setSlotId(null))} className={chip(d === activeDate)}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 font-black text-white pt-1">
            <Clock className="w-4 h-4 text-amber-400" /> 시간
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slots.map((s) => (
              <button key={s.id} disabled={!s.isOpen || s.remaining === 0} onClick={() => setSlotId(s.id)} className={chip(s.id === slotId)}>
                <div>
                  {s.startTime}~{s.endTime}
                </div>
                <div className="text-xs font-normal">{!s.isOpen ? "마감" : s.remaining === 0 ? "매진" : `${s.remaining}자리 남음`}</div>
              </button>
            ))}
          </div>
          <PartyPicker max={booking.maxParty} value={party} onChange={setParty} />
          {errorBox}
          <Button
            disabled={busy || !selected}
            onClick={() => selected && void handle(createBooking(popupId, selected.id, party))}
            className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center gap-1.5"
          >
            <Ticket className="w-3.5 h-3.5" />
            {busy ? "처리 중..." : selected ? `${dayLabel(selected.date)} ${selected.startTime} ${party}명 예약하기` : "시간을 골라주세요"}
          </Button>
          <p className="text-xs text-zinc-500">무료 예약입니다. 같은 날에는 한 번만 예약할 수 있어요.</p>
        </div>
      )}
    </div>
  )
}

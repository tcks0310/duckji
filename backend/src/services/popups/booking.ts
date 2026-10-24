import { randomBytes } from "node:crypto"
import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import { memberNames } from "./shared-tables"

// 자사 팝업 예약·현장 웨이팅 (popup_booking_slots / popup_bookings / popup_waitings)
// 자사·제휴 팝업(operation_type = 'own' | 'partner')만 받음. 일반 팝업은 예약·웨이팅 없음
//  - 예약: 관리자가 연 시간대(정원 = 인원)에 회원이 1~4명으로 예약. 같은 팝업·같은 날에는 예약 하나. 결제 없음(무료 예약)
//  - 웨이팅: 관리자가 '웨이팅 받기'를 켠 동안 회원이 줄을 섬. 번호는 팝업·날짜(한국 시간)마다 1번부터

// 덕지에서 예약·웨이팅을 받는 팝업 종류 (일반 팝업은 정보만)
export const takesBooking = (operationType: string) => operationType === "own" || operationType === "partner"

export class BookingError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string, public code?: string) {
    super(message)
  }
}

export const MAX_PARTY = 4
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const newCode = () => "BK-" + Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")

export const seoulDay = (d = new Date()) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
const seoulNow = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16) // HH:MM

async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

const partySize = (v: unknown) => {
  const n = Number(v ?? 1)
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTY) throw new BookingError(400, `인원은 1~${MAX_PARTY}명으로 골라주세요.`)
  return n
}

type PopupRow = { id: string; title: string; operation_type: string; has_native_booking: boolean; has_native_waiting: boolean; is_published: boolean; end_date: Date | string }

async function ownPopup(client: Pick<PoolClient, "query">, popupId: string, lock = false) {
  const { rows } = await client.query<PopupRow>(
    `SELECT id, title, operation_type, has_native_booking, has_native_waiting, is_published, end_date FROM popups WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [popupId]
  )
  const p = rows[0]
  if (!p || !p.is_published) throw new BookingError(404, "팝업을 찾을 수 없습니다.")
  if (!takesBooking(p.operation_type)) throw new BookingError(409, "이 팝업은 덕지에서 예약·웨이팅을 받지 않습니다.", "not_own")
  return p
}

const dateStr = (v: Date | string) => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : String(v).slice(0, 10))
const timeStr = (v: string) => String(v).slice(0, 5)

// ---------------------------------------------------------------- 예약

type SlotRow = { id: string; popup_id: string; slot_date: Date | string; start_time: string; end_time: string; capacity: number; is_open: boolean; booked: number }

const SLOT_SELECT = `
  SELECT s.*, COALESCE((SELECT SUM(b.party_size) FROM popup_bookings b WHERE b.slot_id = s.id AND b.status IN ('booked', 'checked_in')), 0)::int AS booked
  FROM popup_booking_slots s`

const toSlot = (r: SlotRow) => ({
  id: Number(r.id),
  date: dateStr(r.slot_date),
  startTime: timeStr(r.start_time),
  endTime: timeStr(r.end_time),
  capacity: r.capacity,
  booked: r.booked,
  remaining: Math.max(r.capacity - r.booked, 0),
  isOpen: r.is_open,
})

type BookingRow = { id: string; code: string; slot_id: string; popup_id: string; slot_date: Date | string; member_id: string; party_size: number; status: string; created_at: Date; start_time?: string; end_time?: string; title?: string }

const toBooking = (r: BookingRow) => ({
  id: Number(r.id),
  code: r.code,
  popupId: r.popup_id,
  popupTitle: r.title,
  slotId: Number(r.slot_id),
  date: dateStr(r.slot_date),
  startTime: r.start_time ? timeStr(r.start_time) : undefined,
  endTime: r.end_time ? timeStr(r.end_time) : undefined,
  partySize: r.party_size,
  status: r.status,
  createdAt: r.created_at.toISOString(),
})

const BOOKING_SELECT = `
  SELECT b.*, s.start_time, s.end_time, p.title FROM popup_bookings b
  JOIN popup_booking_slots s ON s.id = b.slot_id JOIN popups p ON p.id = b.popup_id`

// 예약 화면: 오늘 이후 시간대 + 내 예약
export async function bookingOverview(popupId: string, memberId: string | null) {
  const { rows: pr } = await db().query<PopupRow>("SELECT * FROM popups WHERE id = $1 AND is_published", [popupId])
  const p = pr[0]
  if (!p) throw new BookingError(404, "팝업을 찾을 수 없습니다.")
  const enabled = takesBooking(p.operation_type) && p.has_native_booking
  const today = seoulDay()
  const { rows } = enabled
    ? await db().query<SlotRow>(`${SLOT_SELECT} WHERE s.popup_id = $1 AND s.slot_date >= $2 ORDER BY s.slot_date, s.start_time`, [popupId, today])
    : { rows: [] as SlotRow[] }
  const now = seoulNow()
  const slots = rows.map(toSlot).filter((s) => !(s.date === today && s.startTime <= now))
  let mine: ReturnType<typeof toBooking>[] = []
  if (memberId) {
    const { rows: b } = await db().query<BookingRow>(
      `${BOOKING_SELECT} WHERE b.popup_id = $1 AND b.member_id = $2 AND b.status = 'booked' AND b.slot_date >= $3 ORDER BY b.slot_date, s.start_time`,
      [popupId, memberId, today]
    )
    mine = b.map(toBooking)
  }
  return { enabled, operationType: p.operation_type, maxParty: MAX_PARTY, slots, mine }
}

export async function createBooking(memberId: string, popupId: string, input: Record<string, unknown>) {
  const slotId = Number(input.slotId)
  if (!Number.isSafeInteger(slotId) || slotId <= 0) throw new BookingError(400, "시간대를 골라주세요.")
  const size = partySize(input.partySize)
  return tx(async (client) => {
    const p = await ownPopup(client, popupId)
    if (!p.has_native_booking) throw new BookingError(409, "지금은 예약을 받지 않습니다.", "closed")
    // 같은 시간대 동시 예약이 정원을 함께 넘지 않게 시간대 행을 잠금
    const { rows } = await client.query<SlotRow>("SELECT *, 0 AS booked FROM popup_booking_slots WHERE id = $1 AND popup_id = $2 FOR UPDATE", [slotId, popupId])
    const slot = rows[0]
    if (!slot) throw new BookingError(404, "없는 시간대입니다.")
    const date = dateStr(slot.slot_date)
    if (!slot.is_open) throw new BookingError(409, "예약이 마감된 시간대입니다.", "closed")
    if (date < seoulDay() || (date === seoulDay() && timeStr(slot.start_time) <= seoulNow())) throw new BookingError(409, "이미 지난 시간대입니다.", "past")
    const { rows: used } = await client.query<{ n: number }>(
      "SELECT COALESCE(SUM(party_size), 0)::int AS n FROM popup_bookings WHERE slot_id = $1 AND status IN ('booked', 'checked_in')",
      [slotId]
    )
    if (used[0].n + size > slot.capacity) throw new BookingError(409, `남은 자리가 ${Math.max(slot.capacity - used[0].n, 0)}명입니다.`, "full")
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await client.query("SAVEPOINT bk")
        const { rows: inserted } = await client.query<{ id: string }>(
          `INSERT INTO popup_bookings (code, slot_id, popup_id, slot_date, member_id, party_size) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [newCode(), slotId, popupId, date, memberId, size]
        )
        const { rows: b } = await client.query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [inserted[0].id])
        return toBooking(b[0])
      } catch (err: any) {
        await client.query("ROLLBACK TO SAVEPOINT bk")
        if (err?.code !== "23505") throw err
        if (err.constraint === "uq_popup_bookings_member_day") throw new BookingError(409, "같은 날 이미 예약하셨습니다. 시간을 바꾸려면 기존 예약을 취소해주세요.", "already_booked")
        // 예약 번호가 겹치면 다시
      }
    }
    throw new Error("booking code collision")
  })
}

export async function cancelBooking(memberId: string, code: string) {
  const { rows } = await db().query<BookingRow>(
    "UPDATE popup_bookings SET status = 'canceled', updated_at = NOW() WHERE code = $1 AND member_id = $2 AND status = 'booked' RETURNING *",
    [code, memberId]
  )
  if (!rows[0]) throw new BookingError(404, "취소할 수 있는 예약이 없습니다.")
  return { code, status: "canceled" }
}

// ---------------------------------------------------------------- 웨이팅

type WaitingRow = { id: string; popup_id: string; day: Date | string; number: number; member_id: string; party_size: number; status: string; created_at: Date; called_at: Date | null; title?: string }

const toWaiting = (r: WaitingRow, ahead?: number) => ({
  id: Number(r.id),
  popupId: r.popup_id,
  popupTitle: r.title,
  day: dateStr(r.day),
  number: r.number,
  partySize: r.party_size,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  calledAt: r.called_at?.toISOString() ?? null,
  ahead,
})

// 어제 이전 날짜에 남은 대기는 마감 처리 (날짜가 바뀌면 줄을 새로)
async function closeOldDays(client: Pick<PoolClient, "query">, popupId: string) {
  await client.query(
    "UPDATE popup_waitings SET status = 'canceled', updated_at = NOW() WHERE popup_id = $1 AND day < $2 AND status IN ('waiting', 'called')",
    [popupId, seoulDay()]
  )
}

async function aheadOf(client: Pick<PoolClient, "query">, w: WaitingRow) {
  if (w.status !== "waiting") return 0
  const { rows } = await client.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM popup_waitings WHERE popup_id = $1 AND day = $2 AND status = 'waiting' AND number < $3",
    [w.popup_id, dateStr(w.day), w.number]
  )
  return rows[0].n
}

export async function waitingOverview(popupId: string, memberId: string | null) {
  const { rows: pr } = await db().query<PopupRow>("SELECT * FROM popups WHERE id = $1 AND is_published", [popupId])
  const p = pr[0]
  if (!p) throw new BookingError(404, "팝업을 찾을 수 없습니다.")
  const own = takesBooking(p.operation_type)
  const day = seoulDay()
  const { rows: count } = await db().query<{ teams: number; people: number }>(
    "SELECT COUNT(*)::int AS teams, COALESCE(SUM(party_size), 0)::int AS people FROM popup_waitings WHERE popup_id = $1 AND day = $2 AND status = 'waiting'",
    [popupId, day]
  )
  let mine = null
  if (memberId && own) {
    const { rows } = await db().query<WaitingRow>(
      "SELECT * FROM popup_waitings WHERE popup_id = $1 AND member_id = $2 AND day = $3 AND status IN ('waiting', 'called') ORDER BY id DESC LIMIT 1",
      [popupId, memberId, day]
    )
    if (rows[0]) mine = toWaiting(rows[0], await aheadOf(db(), rows[0]))
  }
  return { open: own && p.has_native_waiting, operationType: p.operation_type, maxParty: MAX_PARTY, waitingTeams: count[0].teams, waitingPeople: count[0].people, mine }
}

export async function joinWaiting(memberId: string, popupId: string, input: Record<string, unknown>) {
  const size = partySize(input.partySize)
  return tx(async (client) => {
    // 번호를 차례로 매기려고 팝업 행을 잠금
    const p = await ownPopup(client, popupId, true)
    if (!p.has_native_waiting) throw new BookingError(409, "지금은 웨이팅을 받지 않습니다.", "closed")
    await closeOldDays(client, popupId)
    const day = seoulDay()
    const { rows: next } = await client.query<{ n: number }>("SELECT COALESCE(MAX(number), 0)::int + 1 AS n FROM popup_waitings WHERE popup_id = $1 AND day = $2", [popupId, day])
    const { rows } = await client
      .query<WaitingRow>(
        "INSERT INTO popup_waitings (popup_id, day, number, member_id, party_size) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [popupId, day, next[0].n, memberId, size]
      )
      .catch((err) => {
        if (err?.code === "23505") throw new BookingError(409, "이미 이 팝업에 줄을 서 있습니다.", "already_waiting")
        throw err
      })
    return toWaiting(rows[0], await aheadOf(client, rows[0]))
  })
}

export async function cancelWaiting(memberId: string, popupId: string) {
  const { rows } = await db().query<WaitingRow>(
    "UPDATE popup_waitings SET status = 'canceled', updated_at = NOW() WHERE popup_id = $1 AND member_id = $2 AND status IN ('waiting', 'called') RETURNING *",
    [popupId, memberId]
  )
  if (!rows[0]) throw new BookingError(404, "취소할 웨이팅이 없습니다.")
  return { status: "canceled" }
}

// 오늘 대기 팀 수 (팝업 목록의 웨이팅 숫자)
export async function waitingCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>()
  const { rows } = await db().query<{ popup_id: string; n: number }>(
    "SELECT popup_id, COUNT(*)::int AS n FROM popup_waitings WHERE popup_id = ANY($1) AND day = $2 AND status = 'waiting' GROUP BY popup_id",
    [ids, seoulDay()]
  )
  return new Map(rows.map((r) => [r.popup_id, r.n]))
}

// ---------------------------------------------------------------- 내 예약·웨이팅 (마이페이지)

export async function myReservations(memberId: string) {
  const today = seoulDay()
  const { rows: b } = await db().query<BookingRow>(
    `${BOOKING_SELECT} WHERE b.member_id = $1 AND (b.slot_date >= $2 OR b.created_at > NOW() - INTERVAL '30 days')
     ORDER BY b.slot_date DESC, s.start_time DESC LIMIT 50`,
    [memberId, today]
  )
  const { rows: w } = await db().query<WaitingRow>(
    `SELECT w.*, p.title FROM popup_waitings w JOIN popups p ON p.id = w.popup_id
     WHERE w.member_id = $1 AND w.created_at > NOW() - INTERVAL '30 days' ORDER BY w.id DESC LIMIT 50`,
    [memberId]
  )
  const waitings = []
  for (const r of w) waitings.push(toWaiting(r, dateStr(r.day) === today ? await aheadOf(db(), r) : undefined))
  return { bookings: b.map(toBooking), waitings }
}

// ---------------------------------------------------------------- 관리자

// 자사·제휴 팝업 목록과 오늘 숫자
export async function ownPopupsSummary() {
  const today = seoulDay()
  const { rows } = await db().query(
    `SELECT p.id, p.title, p.operation_type, p.start_date, p.end_date, p.has_native_booking, p.has_native_waiting, p.is_published,
       (SELECT COUNT(*)::int FROM popup_bookings b WHERE b.popup_id = p.id AND b.slot_date = $1 AND b.status IN ('booked', 'checked_in')) AS today_bookings,
       (SELECT COUNT(*)::int FROM popup_bookings b WHERE b.popup_id = p.id AND b.slot_date >= $1 AND b.status = 'booked') AS upcoming_bookings,
       (SELECT COUNT(*)::int FROM popup_waitings w WHERE w.popup_id = p.id AND w.day = $1 AND w.status = 'waiting') AS waiting_now,
       (SELECT COUNT(*)::int FROM popup_waitings w WHERE w.popup_id = p.id AND w.day = $1 AND w.status = 'entered') AS entered_today
     FROM popups p WHERE p.operation_type IN ('own', 'partner') ORDER BY p.end_date DESC, p.title`,
    [today]
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    operationType: r.operation_type as "own" | "partner",
    startDate: dateStr(r.start_date),
    endDate: dateStr(r.end_date),
    bookingOn: r.has_native_booking,
    waitingOn: r.has_native_waiting,
    isPublished: r.is_published,
    todayBookings: r.today_bookings,
    upcomingBookings: r.upcoming_bookings,
    waitingNow: r.waiting_now,
    enteredToday: r.entered_today,
  }))
}

async function assertOwn(popupId: string) {
  const { rows } = await db().query<{ operation_type: string }>("SELECT operation_type FROM popups WHERE id = $1", [popupId])
  if (!rows[0]) throw new BookingError(404, "팝업을 찾을 수 없습니다.")
  if (!takesBooking(rows[0].operation_type))
    throw new BookingError(409, "자사·제휴 팝업만 예약·웨이팅을 받을 수 있습니다. 팝업 관리에서 종류를 '자사' 또는 '제휴'로 바꿔주세요.", "not_own")
}

// 예약 받기·웨이팅 받기 켜고 끄기
export async function setPopupSwitch(popupId: string, which: "booking" | "waiting", on: boolean) {
  await assertOwn(popupId)
  const column = which === "booking" ? "has_native_booking" : "has_native_waiting"
  await db().query(`UPDATE popups SET ${column} = $2, updated_at = NOW() WHERE id = $1`, [popupId, on])
  return { on }
}

// 시간대 + 예약자 (?from=YYYY-MM-DD, 기본 오늘부터)
export async function adminBookings(popupId: string, from?: string) {
  await assertOwn(popupId)
  const start = from && DATE_RE.test(from) ? from : seoulDay()
  const { rows: slots } = await db().query<SlotRow>(
    `${SLOT_SELECT} WHERE s.popup_id = $1 AND s.slot_date >= $2 ORDER BY s.slot_date, s.start_time LIMIT 300`,
    [popupId, start]
  )
  const { rows: bookings } = await db().query<BookingRow>(
    `${BOOKING_SELECT} WHERE b.popup_id = $1 AND b.slot_date >= $2 ORDER BY b.slot_date, s.start_time, b.id`,
    [popupId, start]
  )
  const names = await memberNames(bookings.map((b) => b.member_id))
  return {
    slots: slots.map(toSlot),
    bookings: bookings.map((b) => ({ ...toBooking(b), memberName: names.get(b.member_id) || "회원" })),
  }
}

// 시간대 한꺼번에 열기 { fromDate, toDate, times: ["11:00", ...], durationMin, capacity }
export async function createSlots(popupId: string, input: Record<string, unknown>) {
  await assertOwn(popupId)
  const fromDate = String(input.fromDate || "")
  const toDate = String(input.toDate || input.fromDate || "")
  const times = Array.isArray(input.times) ? [...new Set(input.times.map((t) => String(t).trim()))] : []
  const duration = Number(input.durationMin)
  const capacity = Number(input.capacity)
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate) || fromDate > toDate) throw new BookingError(400, "날짜를 확인해주세요.")
  if (!times.length || times.some((t) => !TIME_RE.test(t))) throw new BookingError(400, "시작 시간을 11:00 처럼 입력해주세요.")
  if (!Number.isInteger(duration) || duration < 10 || duration > 600) throw new BookingError(400, "한 타임 길이는 10~600분으로 정해주세요.")
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) throw new BookingError(400, "정원은 1~1000명으로 정해주세요.")
  const days: string[] = []
  for (let d = new Date(`${fromDate}T00:00:00Z`); d.toISOString().slice(0, 10) <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
    if (days.length > 120) throw new BookingError(400, "한 번에 120일까지 열 수 있습니다.")
  }
  const endOf = (t: string) => {
    const m = Math.min(Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + duration, 23 * 60 + 59)
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  }
  let created = 0
  await tx(async (client) => {
    for (const day of days)
      for (const t of times) {
        const r = await client.query(
          `INSERT INTO popup_booking_slots (popup_id, slot_date, start_time, end_time, capacity) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (popup_id, slot_date, start_time) DO NOTHING`,
          [popupId, day, t, endOf(t), capacity]
        )
        created += r.rowCount ?? 0
      }
  })
  return { created, skipped: days.length * times.length - created }
}

// 시간대 정원·열고 닫기 { capacity?, isOpen? }
export async function updateSlot(slotId: number, input: Record<string, unknown>) {
  const sets: string[] = []
  const params: unknown[] = [slotId]
  if (input.capacity !== undefined) {
    const capacity = Number(input.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) throw new BookingError(400, "정원은 1~1000명으로 정해주세요.")
    params.push(capacity)
    sets.push(`capacity = $${params.length}`)
  }
  if (typeof input.isOpen === "boolean") {
    params.push(input.isOpen)
    sets.push(`is_open = $${params.length}`)
  }
  if (!sets.length) throw new BookingError(400, "바꿀 내용이 없습니다.")
  const { rowCount } = await db().query(`UPDATE popup_booking_slots SET ${sets.join(", ")} WHERE id = $1`, params)
  if (!rowCount) throw new BookingError(404, "없는 시간대입니다.")
  return { ok: true }
}

// 예약이 없는 시간대만 지움
export async function deleteSlot(slotId: number) {
  const { rows } = await db().query<{ n: number }>("SELECT COUNT(*)::int AS n FROM popup_bookings WHERE slot_id = $1 AND status IN ('booked', 'checked_in')", [slotId])
  if (rows[0].n) throw new BookingError(409, "예약이 있는 시간대는 지울 수 없습니다. 대신 마감해주세요.")
  const { rowCount } = await db().query("DELETE FROM popup_booking_slots WHERE id = $1", [slotId])
  if (!rowCount) throw new BookingError(404, "없는 시간대입니다.")
  return { ok: true }
}

const BOOKING_ADMIN_STATUSES = ["booked", "checked_in", "no_show", "canceled"]

// 예약 입장 처리·노쇼·취소 (예약 번호로 현장 확인)
export async function setBookingStatus(bookingId: number, status: unknown) {
  if (typeof status !== "string" || !BOOKING_ADMIN_STATUSES.includes(status)) throw new BookingError(400, "잘못된 상태입니다.")
  const { rowCount } = await db().query("UPDATE popup_bookings SET status = $2, updated_at = NOW() WHERE id = $1", [bookingId, status]).catch((err) => {
    if (err?.code === "23505") throw new BookingError(409, "이 회원은 같은 날 다른 예약이 있어 되돌릴 수 없습니다.")
    throw err
  })
  if (!rowCount) throw new BookingError(404, "없는 예약입니다.")
  return { ok: true }
}

// 오늘 웨이팅 줄
export async function adminWaitings(popupId: string) {
  await assertOwn(popupId)
  await closeOldDays(db(), popupId)
  const { rows } = await db().query<WaitingRow>("SELECT * FROM popup_waitings WHERE popup_id = $1 AND day = $2 ORDER BY number", [popupId, seoulDay()])
  const names = await memberNames(rows.map((r) => r.member_id))
  return { day: seoulDay(), waitings: rows.map((r) => ({ ...toWaiting(r), memberName: names.get(r.member_id) || "회원" })) }
}

const WAITING_ADMIN_STATUSES = ["waiting", "called", "entered", "no_show", "canceled"]

// 호출·입장·노쇼·취소
export async function setWaitingStatus(waitingId: number, status: unknown) {
  if (typeof status !== "string" || !WAITING_ADMIN_STATUSES.includes(status)) throw new BookingError(400, "잘못된 상태입니다.")
  const { rowCount } = await db()
    .query(
      `UPDATE popup_waitings SET status = $2::text, updated_at = NOW(), called_at = CASE WHEN $2::text = 'called' THEN NOW() ELSE called_at END WHERE id = $1`,
      [waitingId, status]
    )
    .catch((err) => {
      if (err?.code === "23505") throw new BookingError(409, "이 회원은 이미 다시 줄을 섰습니다.")
      throw err
    })
  if (!rowCount) throw new BookingError(404, "없는 웨이팅입니다.")
  return { ok: true }
}

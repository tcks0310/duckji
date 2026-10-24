"use client"

import { apiFetch } from "@/lib/api"

// 자사 팝업 예약·현장 웨이팅 (backend popups 서비스, /api/popups/...)
// 자사·제휴(operationType = "own" | "partner") 팝업만. 일반 팝업은 예약·웨이팅 없음

export type BookingSlot = { id: number; date: string; startTime: string; endTime: string; capacity: number; booked: number; remaining: number; isOpen: boolean }
export type Booking = {
  id: number
  code: string
  popupId: string
  popupTitle?: string
  slotId: number
  date: string
  startTime?: string
  endTime?: string
  partySize: number
  status: "booked" | "canceled" | "checked_in" | "no_show"
  createdAt: string
  memberName?: string
}
export type Waiting = {
  id: number
  popupId: string
  popupTitle?: string
  day: string
  number: number
  partySize: number
  status: "waiting" | "called" | "entered" | "canceled" | "no_show"
  createdAt: string
  calledAt: string | null
  ahead?: number
  memberName?: string
}
export type BookingOverview = { enabled: boolean; maxParty: number; slots: BookingSlot[]; mine: Booking[] }
export type WaitingOverview = { open: boolean; maxParty: number; waitingTeams: number; waitingPeople: number; mine: Waiting | null }
export type OwnPopupSummary = {
  id: string
  title: string
  operationType: "own" | "partner"
  startDate: string
  endDate: string
  bookingOn: boolean
  waitingOn: boolean
  isPublished: boolean
  todayBookings: number
  upcomingBookings: number
  waitingNow: number
  enteredToday: number
}

// ok / login(로그인 필요) / error(서버가 거절한 이유)
export type BookingResult<T> = { status: "ok"; data: T } | { status: "login" } | { status: "error"; error: string }

async function call<T>(path: string, init?: { method?: string; json?: unknown }): Promise<BookingResult<T>> {
  try {
    const res = await apiFetch(`/api/popups${path}`, {
      method: init?.method || "GET",
      cache: "no-store",
      headers: init?.json === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.json === undefined ? undefined : JSON.stringify(init.json),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 && !path.startsWith("/admin")) return { status: "login" }
    if (!res.ok || body.success === false) return { status: "error", error: body.error || "요청을 처리하지 못했습니다." }
    return { status: "ok", data: body as T }
  } catch {
    return { status: "error", error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

const id = (popupId: string) => encodeURIComponent(popupId)

// ---- 회원 ----
export const fetchBooking = (popupId: string) => call<BookingOverview>(`/${id(popupId)}/booking`)
export const createBooking = (popupId: string, slotId: number, partySize: number) =>
  call<{ booking: Booking }>(`/${id(popupId)}/bookings`, { method: "POST", json: { slotId, partySize } })
export const cancelBooking = (code: string) => call<{}>(`/bookings/${encodeURIComponent(code)}/cancel`, { method: "POST", json: {} })
export const fetchWaiting = (popupId: string) => call<WaitingOverview>(`/${id(popupId)}/waiting`)
export const joinWaiting = (popupId: string, partySize: number) => call<{ waiting: Waiting }>(`/${id(popupId)}/waiting`, { method: "POST", json: { partySize } })
export const cancelWaiting = (popupId: string) => call<{}>(`/${id(popupId)}/waiting/cancel`, { method: "POST", json: {} })
export const fetchMyReservations = () => call<{ bookings: Booking[]; waitings: Waiting[] }>("/me/reservations")

// ---- 관리자 ----
export const fetchOwnPopups = () => call<{ popups: OwnPopupSummary[] }>("/admin/own")
export const setOwnSwitch = (popupId: string, which: "booking" | "waiting", on: boolean) =>
  call<{ on: boolean }>(`/admin/own/${id(popupId)}/${which}-switch`, { method: "POST", json: { on } })
export const fetchAdminBookings = (popupId: string) => call<{ slots: BookingSlot[]; bookings: Booking[] }>(`/admin/own/${id(popupId)}/bookings`)
export const createSlots = (popupId: string, input: { fromDate: string; toDate: string; times: string[]; durationMin: number; capacity: number }) =>
  call<{ created: number; skipped: number }>(`/admin/own/${id(popupId)}/slots`, { method: "POST", json: input })
export const updateSlot = (slotId: number, input: { capacity?: number; isOpen?: boolean }) =>
  call<{}>(`/admin/own/slots/${slotId}`, { method: "PATCH", json: input })
export const deleteSlot = (slotId: number) => call<{}>(`/admin/own/slots/${slotId}`, { method: "DELETE" })
export const setBookingStatus = (bookingId: number, status: Booking["status"]) =>
  call<{}>(`/admin/own/bookings/${bookingId}/status`, { method: "POST", json: { status } })
export const fetchAdminWaitings = (popupId: string) => call<{ day: string; waitings: Waiting[] }>(`/admin/own/${id(popupId)}/waitings`)
export const setWaitingStatus = (waitingId: number, status: Waiting["status"]) =>
  call<{}>(`/admin/own/waitings/${waitingId}/status`, { method: "POST", json: { status } })

export const BOOKING_STATUS_LABEL: Record<Booking["status"], string> = { booked: "예약", canceled: "취소", checked_in: "입장", no_show: "노쇼" }
export const WAITING_STATUS_LABEL: Record<Waiting["status"], string> = { waiting: "대기 중", called: "호출됨", entered: "입장", canceled: "취소", no_show: "노쇼" }
export const OPERATION_TYPE_LABEL = { own: "자사", partner: "제휴", listing: "일반" } as const

import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { consumeQuota } from "../../shared/db/rate-limit"
import {
  adminBookings,
  adminWaitings,
  bookingOverview,
  BookingError,
  cancelBooking,
  cancelWaiting,
  createBooking,
  createSlots,
  deleteSlot,
  joinWaiting,
  myReservations,
  ownPopupsSummary,
  setBookingStatus,
  setPopupSwitch,
  setWaitingStatus,
  updateSlot,
  waitingOverview,
} from "./booking"

// 자사·제휴 팝업 예약·현장 웨이팅 (/api/popups/...). popups 라우트의 /:id 보다 먼저 연결
//  - 회원: GET /:id/booking, POST /:id/bookings, POST /bookings/:code/cancel
//          GET /:id/waiting, POST /:id/waiting, POST /:id/waiting/cancel, GET /me/reservations
//  - 관리자: /admin/own ... (자사·제휴 팝업 목록·예약 시간대·예약자·웨이팅 줄, 주소는 예전 이름 그대로)
export const bookingRoute = new Hono<MemberEnv>()

const body = async (c: Context) => (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
const numParam = (c: Context, name: string) => {
  const n = Number(c.req.param(name))
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const run = async (c: Context, fn: () => Promise<object>) => {
  try {
    return c.json({ success: true, ...(await fn()) })
  } catch (e) {
    if (e instanceof BookingError) return c.json({ success: false, error: e.message, code: e.code }, e.status)
    throw e
  }
}
const tooMany = (c: Context) => c.json({ success: false, error: "잠시 후 다시 시도해주세요.", code: "rate_limited" }, 429)

// ---- 회원 ----

bookingRoute.get("/me/reservations", requireMember, (c) => run(c, () => myReservations(c.get("member").id)))

bookingRoute.post("/bookings/:code/cancel", requireMember, (c) => run(c, () => cancelBooking(c.get("member").id, c.req.param("code"))))

bookingRoute.get("/:id/booking", (c) => run(c, () => bookingOverview(c.req.param("id"), getOptionalMember(c)?.id ?? null)))

bookingRoute.post("/:id/bookings", requireMember, async (c) => {
  if (!(await consumeQuota("popup-booking", c.get("member").id, 20, 600))) return tooMany(c)
  return run(c, async () => ({ booking: await createBooking(c.get("member").id, c.req.param("id"), await body(c)) }))
})

bookingRoute.get("/:id/waiting", (c) => run(c, () => waitingOverview(c.req.param("id"), getOptionalMember(c)?.id ?? null)))

bookingRoute.post("/:id/waiting", requireMember, async (c) => {
  if (!(await consumeQuota("popup-waiting", c.get("member").id, 20, 600))) return tooMany(c)
  return run(c, async () => ({ waiting: await joinWaiting(c.get("member").id, c.req.param("id"), await body(c)) }))
})

bookingRoute.post("/:id/waiting/cancel", requireMember, (c) => run(c, () => cancelWaiting(c.get("member").id, c.req.param("id"))))

// ---- 관리자 ----

const admin = new Hono()
admin.use("*", requireAdmin)

admin.get("/", (c) => run(c, async () => ({ popups: await ownPopupsSummary() })))

// 예약 받기·웨이팅 받기 { on }
for (const which of ["booking", "waiting"] as const) {
  admin.post(`/:id/${which}-switch`, async (c) => run(c, async () => setPopupSwitch(c.req.param("id"), which, (await body(c)).on === true)))
}

admin.get("/:id/bookings", (c) => run(c, () => adminBookings(c.req.param("id"), c.req.query("from"))))
admin.post("/:id/slots", async (c) => run(c, async () => createSlots(c.req.param("id"), await body(c))))
admin.get("/:id/waitings", (c) => run(c, () => adminWaitings(c.req.param("id"))))

admin.patch("/slots/:slotId", async (c) => {
  const id = numParam(c, "slotId")
  return id ? run(c, async () => updateSlot(id, await body(c))) : c.json({ success: false, error: "잘못된 요청입니다." }, 400)
})
admin.delete("/slots/:slotId", (c) => {
  const id = numParam(c, "slotId")
  return id ? run(c, () => deleteSlot(id)) : c.json({ success: false, error: "잘못된 요청입니다." }, 400)
})
admin.post("/bookings/:bookingId/status", async (c) => {
  const id = numParam(c, "bookingId")
  return id ? run(c, async () => setBookingStatus(id, (await body(c)).status)) : c.json({ success: false, error: "잘못된 요청입니다." }, 400)
})
admin.post("/waitings/:waitingId/status", async (c) => {
  const id = numParam(c, "waitingId")
  return id ? run(c, async () => setWaitingStatus(id, (await body(c)).status)) : c.json({ success: false, error: "잘못된 요청입니다." }, 400)
})

bookingRoute.route("/admin/own", admin)

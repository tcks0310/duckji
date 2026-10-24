import { normalizeSearchQuery } from "../../shared/search/text-search"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "../../shared/auth/admin-session"
import { requireAdmin } from "../../shared/auth/require-admin"
import { popupQrScansRepository } from "./qr-scans"
import { DuplicatePopupError, popupsRepository } from "./repository"
import { validatePopupInput } from "./validation"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { popupImages } from "./storage"
import { recordView, withLiveFields } from "./live-fields"
import { intakeRoute, logPopupDeleted } from "./intake/routes"
import { bookingRoute } from "./booking-routes"

export const popupsRoute = new Hono()

// 자동 수집 후보 · 기간 종료 처리 (/:id 보다 먼저 연결)
popupsRoute.route("/", intakeRoute)
// 자사 팝업 예약·웨이팅 (/:id 보다 먼저 연결)
popupsRoute.route("/", bookingRoute)

// 비공개 팝업은 관리자이고 ?all=1 일 때만 포함
const includeUnpublished = (c: Context) =>
  c.req.query("all") === "1" && isValidAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))

// 목록 (누구나)
popupsRoute.get("/", async (c) => {
  // ?q=검색어 → 통합 검색 (공개 팝업만, 정확도 순, 최대 ?limit=20)
  const q = normalizeSearchQuery(c.req.query("q"))
  if (q) {
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 50)
    const popups = await withLiveFields(await popupsRepository.search(q, limit))
    return c.json({ success: true, popups })
  }
  const popups = await withLiveFields(await popupsRepository.list({ includeUnpublished: includeUnpublished(c) }))
  return c.json({ success: true, popups })
})

// 포스터·갤러리 사진 업로드 (관리자): POST /admin/uploads { contentType, size } → 브라우저가 uploadUrl 로 PUT, publicUrl 을 팝업에 저장
mountImageUploads(popupsRoute, popupImages, {
  ticketPath: "/admin/uploads",
  localUploadPath: "/admin/uploads/local/",
  localServePath: "/images/local/",
  serviceBasePath: "/api/popups",
  guard: requireAdmin,
})

// 현장 QR 유입 집계 (관리자) — /:id 보다 먼저 등록
popupsRoute.get("/qr/stats", requireAdmin, async (c) => {
  const stats = await popupQrScansRepository.stats()
  return c.json({ success: true, stats })
})

// 지난 팝업 (누구나, 팝업 일정·지도 달력용): ?offset=0&limit=500
popupsRoute.get("/past", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 500, 1), 500)
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0)
  const { popups, total } = await popupsRepository.listPast({ limit, offset })
  return c.json({ success: true, popups: await withLiveFields(popups), total })
})

// 상세 (누구나, 종료 처리된 지난 팝업 포함: 달력에서 눌러 열림)
popupsRoute.get("/:id", async (c) => {
  const popup = await popupsRepository.get(c.req.param("id"), { includeUnpublished: includeUnpublished(c) })
  if (!popup) return c.json({ success: false, error: "Not Found" }, 404)
  return c.json({ success: true, popup: (await withLiveFields([popup]))[0] })
})

// 상세 조회 수 기록 (누구나)
popupsRoute.post("/:id/views", async (c) => {
  // 조회 수 부풀리기 방지: IP 당 1시간 300번까지만 기록, 넘으면 기록하지 않고 성공처럼 응답
  if (!(await consumeQuota("popup-view", clientIp(c), 300, 3600))) return c.json({ success: true, recorded: false })
  const recorded = await recordView(c.req.param("id"))
  return c.json({ success: true, recorded })
})

// 현장 QR 유입 기록 (누구나) — QR 로 사이트에 들어온 브라우저가 한 번 보냄
popupsRoute.post("/:id/qr-scans", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<{ visitorKey?: unknown }>().catch(() => null)
  const visitorKey = typeof body?.visitorKey === "string" ? body.visitorKey.trim() : ""
  if (!(await consumeQuota("popup-qr", clientIp(c), 60, 3600))) return c.json({ success: true, recorded: false })
  if (!/^[A-Za-z0-9-]{8,64}$/.test(visitorKey)) {
    return c.json({ success: false, error: "visitorKey 가 올바르지 않습니다." }, 400)
  }
  const popup = await popupsRepository.get(id, { includeUnpublished: false })
  if (!popup) return c.json({ success: false, error: "Not Found" }, 404)
  const recorded = await popupQrScansRepository.record(id, visitorKey)
  return c.json({ success: true, recorded })
})

// 등록 (관리자)
popupsRoute.post("/", requireAdmin, async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validatePopupInput(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    const popup = await popupsRepository.create(result.value)
    return c.json({ success: true, popup }, 201)
  } catch (e) {
    if (e instanceof DuplicatePopupError) return c.json({ success: false, errors: [e.message] }, 409)
    throw e
  }
})

// 수정 (관리자) — 보낸 필드만 바뀜
popupsRoute.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id")
  const existing = await popupsRepository.get(id, { includeUnpublished: true })
  if (!existing) return c.json({ success: false, error: "Not Found" }, 404)
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const { coordinates: _coordinates, ...existingInput } = existing
  const result = validatePopupInput({ ...body, id }, existingInput)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const popup = await popupsRepository.update(id, result.value)
  return c.json({ success: true, popup })
})

// 삭제 (관리자)
popupsRoute.delete("/:id", requireAdmin, async (c) => {
  const deleted = await popupsRepository.delete(c.req.param("id"))
  if (!deleted) return c.json({ success: false, error: "Not Found" }, 404)
  await logPopupDeleted(c.req.param("id"))
  return c.json({ success: true })
})

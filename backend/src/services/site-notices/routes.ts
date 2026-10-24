import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { requireAdmin } from "../../shared/auth/require-admin"
import { config } from "../../shared/config"
import { requireDatabase } from "../../shared/db/require-database"
import { siteNoticesRepository } from "./repository"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { noticeImages } from "./storage"
import { validateSiteNoticeInput } from "./validation"
import { mountAdminHotClips, mountPublicHotClips } from "./hot-clips"

// 사이트 공지 팝업·배너: 사이트 접속 시 뜨는 레이어 팝업·띠 배너를 관리자가 정함
// 관리자 API 는 /api/notices/admin/... (docs/planning/관리자센터-기능정의서.md)
export const siteNoticesRoute = new Hono()

siteNoticesRoute.use("*", requireDatabase)

const jsonBody = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
// 처리 이력에 남길 관리자: 회원 관리자면 회원 id, 비상용 계정이면 ADMIN_ID
const adminId = (c: Context) => readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId || config.adminId

// ======================= 공개 =======================

// 지금 노출 중인 공지. 대상(회원·비회원)·기기·화면 조건은 프론트가 걸러서 하나씩만 띄움
siteNoticesRoute.get("/live", async (c) => {
  c.header("Cache-Control", "public, max-age=60")
  return c.json({ success: true, notices: await siteNoticesRepository.listLive() })
})

// 홈 'SNS 핫클립' 자리 1~4 (hot-clips.ts)
mountPublicHotClips(siteNoticesRoute)

// 노출·클릭 기록 { type: "view" | "click" }
siteNoticesRoute.post("/:id/events", async (c) => {
  const id = idParam(c)
  const body = await jsonBody(c)
  const type = body?.type
  if (!id || (type !== "view" && type !== "click")) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  if (!(await consumeQuota("notice-event", clientIp(c), 300, 3600))) return c.json({ success: true })
  await siteNoticesRepository.count(id, type)
  return c.json({ success: true })
})

// ======================= 관리자 =======================

siteNoticesRoute.use("/admin/*", requireAdmin)

// 이미지 업로드: POST /admin/uploads { contentType, size } → 관리자 브라우저가 uploadUrl 로 PUT 한 뒤 publicUrl 을 공지에 저장
// (개발용 받기 /admin/uploads/local/* 는 위 requireAdmin 으로 관리자만, 보여주기 /uploads/local/* 는 누구나)
mountImageUploads(siteNoticesRoute, noticeImages, {
  ticketPath: "/admin/uploads",
  localUploadPath: "/admin/uploads/local/",
  localServePath: "/uploads/local/",
  serviceBasePath: "/api/notices",
})

mountAdminHotClips(siteNoticesRoute, adminId)

siteNoticesRoute.get("/admin/items", async (c) => {
  return c.json({ success: true, notices: await siteNoticesRepository.listAll() })
})

siteNoticesRoute.post("/admin/items", async (c) => {
  const body = await jsonBody(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validateSiteNoticeInput(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  return c.json({ success: true, notice: await siteNoticesRepository.create(result.value, adminId(c)) }, 201)
})

// 수정·게시·숨김 — 보낸 필드만 바뀜
siteNoticesRoute.patch("/admin/items/:id", async (c) => {
  const id = idParam(c)
  const existing = id ? await siteNoticesRepository.get(id) : null
  if (!existing) return c.json({ success: false, error: "Not Found" }, 404)
  const body = await jsonBody(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validateSiteNoticeInput(body, existing)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  return c.json({ success: true, notice: await siteNoticesRepository.update(existing, result.value, adminId(c)) })
})

siteNoticesRoute.delete("/admin/items/:id", async (c) => {
  const id = idParam(c)
  const existing = id ? await siteNoticesRepository.get(id) : null
  if (!existing) return c.json({ success: false, error: "Not Found" }, 404)
  await siteNoticesRepository.remove(existing, adminId(c))
  return c.json({ success: true })
})

// 계약 기간 맞추기 { startsAt, endsAt } (ISO) 또는 { cancelled: true }: b2b 계약을 고친 관리자 화면이 이어서 부름
siteNoticesRoute.post("/admin/contracts/:id/sync", async (c) => {
  const id = idParam(c)
  const body = await jsonBody(c)
  if (!id || !body) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  if (body.cancelled === true) return c.json({ success: true, updated: await siteNoticesRepository.syncContract(id, null, adminId(c)) })
  const startsAt = new Date(String(body.startsAt || ""))
  const endsAt = new Date(String(body.endsAt || ""))
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)
    return c.json({ success: false, error: "기간이 올바르지 않습니다." }, 400)
  const updated = await siteNoticesRepository.syncContract(id, { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }, adminId(c))
  return c.json({ success: true, updated })
})

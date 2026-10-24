import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { type MemberEnv } from "../../shared/auth/require-member"
import { config } from "../../shared/config"
import { requireDatabase } from "../../shared/db/require-database"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { projectPendingSummary } from "./project-repository"
import { projectAdminRoute, projectRoute } from "./project-routes"
import { venues } from "./repository"
import { venueImages } from "./storage"
import { PARTNERS } from "./types"
import { validateVenueSpace } from "./validation"

export const fundingRoute = new Hono<MemberEnv>()

fundingRoute.use("*", requireDatabase)

const readJson = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isInteger(id) && id > 0 ? id : null
}
const badBody = { success: false, errors: ["JSON 본문이 필요합니다."] }
const notFound = { success: false, error: "Not Found" }
// 관리자 계정은 아직 하나 (ADMIN_ID). 계정이 늘면 세션에서 꺼내도록 바꿈
const adminId = () => config.adminId

// 협력사 표기 (화면에서 사용)
fundingRoute.get("/partners", (c) => c.json({ success: true, partners: PARTNERS }))

// ================================================================ 공개 · 회원
// 대관 공간 목록 (누구나)
fundingRoute.get("/venues", async (c) => c.json({ success: true, venues: await venues.list(false) }))

fundingRoute.get("/venues/:id", async (c) => {
  const id = idParam(c)
  const venue = id && (await venues.get(id, false))
  return venue ? c.json({ success: true, venue }) : c.json(notFound, 404)
})

// ================================================================ 관리자 (/api/funding/admin/...)
const admin = new Hono()
admin.use("*", requireAdmin)

admin.get("/summary", async (c) => c.json({ success: true, pending: await projectPendingSummary() }))

// 대관 공간
admin.get("/venues", async (c) => c.json({ success: true, venues: await venues.list(true) }))

admin.post("/venues", async (c) => {
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateVenueSpace(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  return c.json({ success: true, venue: await venues.create(result.value, adminId()) }, 201)
})

admin.patch("/venues/:id", async (c) => {
  const id = idParam(c)
  const existing = id && (await venues.get(id, true))
  if (!id || !existing) return c.json(notFound, 404)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const { id: _id, createdAt: _c, updatedAt: _u, ...existingInput } = existing
  const result = validateVenueSpace(body, existingInput)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  return c.json({ success: true, venue: await venues.update(id, result.value, adminId()) })
})

admin.delete("/venues/:id", async (c) => {
  const id = idParam(c)
  if (!id || !(await venues.delete(id, adminId()))) return c.json(notFound, 404)
  return c.json({ success: true })
})

// 펀딩 관리 (검수·견적·담당자 대화·단계·주제·신고)
admin.route("/", projectAdminRoute)

// 대관 공간 사진 업로드 (관리자): POST /admin/uploads { contentType, size } → 브라우저가 uploadUrl 로 PUT, publicUrl 을 공간에 저장
mountImageUploads(fundingRoute, venueImages, {
  ticketPath: "/admin/uploads",
  localUploadPath: "/admin/uploads/local/",
  localServePath: "/venue-images/local/",
  serviceBasePath: "/api/funding",
  guard: requireAdmin,
})

fundingRoute.route("/admin", admin)

// 덕질펀딩 프로젝트 (project-routes.ts)
fundingRoute.route("/", projectRoute)


import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { consumeQuota } from "../../shared/db/rate-limit"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import {
  checkInPilgrimage,
  createPilgrimageCourse,
  deleteMyReview,
  deletePilgrimageCourse,
  deleteReview,
  getPublishedCourse,
  listPilgrimageForAdmin,
  listPublishedCourses,
  listReviewsForAdmin,
  pilgrimageOverview,
  saveReview,
  setPilgrimagePublished,
  setReviewHidden,
  updatePilgrimageCourse,
} from "./pilgrimage"
import { RewardError } from "./shared-tables"
import { pilgrimageImages } from "./storage"

// 덕지순례 (/api/rewards/pilgrimage)
//  - GET /courses, /courses/:id          공개 코스 목록·상세 (+ 내 도장·완주, 후기)
//  - PUT·DELETE /courses/:id/review      내 후기 남기기·고치기·지우기 (회원)
//  - POST /spots/:id/check-in            현장 도장 (회원, 위치 확인)
//  - POST /uploads                       코스 사진 업로드 주소 (관리자)
// 관리자 (/api/rewards/admin/pilgrimage): 코스 추가·수정·공개, 후기 숨김·삭제
export const pilgrimageRoute = new Hono<MemberEnv>()
export const pilgrimageAdminRoute = new Hono()

const body = async (c: Context) => (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
const fail = (c: Context, e: unknown) => {
  if (e instanceof RewardError) return c.json({ success: false, error: e.message, code: e.code }, e.status)
  throw e
}
const tooMany = (c: Context) => c.json({ success: false, error: "잠시 후 다시 시도해주세요.", code: "rate_limited" }, 429)
const run = async (c: Context, fn: () => Promise<object | void>) => {
  try {
    return c.json({ success: true, ...((await fn()) || {}) })
  } catch (e) {
    return fail(c, e)
  }
}

// ---- 공개 ----

pilgrimageRoute.get("/", async (c) => c.json({ success: true, ...(await pilgrimageOverview(getOptionalMember(c)?.id ?? null)) }))
pilgrimageRoute.get("/courses", async (c) => c.json({ success: true, ...(await listPublishedCourses(getOptionalMember(c)?.id ?? null)) }))
pilgrimageRoute.get("/courses/:id", (c) => run(c, () => getPublishedCourse(c.req.param("id"), getOptionalMember(c)?.id ?? null)))

pilgrimageRoute.put("/courses/:id/review", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-pilgrimage-review", c.get("member").id, 20, 3600))) return tooMany(c)
  const input = await body(c)
  return run(c, () => saveReview(c.req.param("id"), c.get("member").id, input))
})
pilgrimageRoute.delete("/courses/:id/review", requireMember, (c) => run(c, () => deleteMyReview(c.req.param("id"), c.get("member").id)))

pilgrimageRoute.post("/spots/:id/check-in", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-pilgrimage", c.get("member").id, 30, 600))) return tooMany(c)
  const input = await body(c)
  return run(c, () => checkInPilgrimage(c.get("member").id, c.req.param("id"), input))
})

// 코스 사진: 관리자 브라우저가 uploadUrl 로 올린 뒤 publicUrl 을 코스에 저장 (개발용 보여주기 /uploads/local/* 는 누구나)
mountImageUploads(pilgrimageRoute, pilgrimageImages, {
  ticketPath: "/uploads",
  localUploadPath: "/uploads/put/",
  localServePath: "/uploads/local/",
  serviceBasePath: "/api/rewards/pilgrimage",
  guard: requireAdmin,
})

// ---- 관리자 ----

pilgrimageAdminRoute.use("*", requireAdmin)

pilgrimageAdminRoute.get("/", async (c) => c.json({ success: true, ...(await listPilgrimageForAdmin()) }))
pilgrimageAdminRoute.post("/courses", async (c) => {
  const input = await body(c)
  return run(c, () => createPilgrimageCourse(input))
})
pilgrimageAdminRoute.put("/courses/:id", async (c) => {
  const input = await body(c)
  return run(c, () => updatePilgrimageCourse(c.req.param("id"), input))
})
pilgrimageAdminRoute.patch("/courses/:id/publish", async (c) => {
  const input = await body(c)
  return run(c, () => setPilgrimagePublished(c.req.param("id"), input.published === true))
})
pilgrimageAdminRoute.delete("/courses/:id", (c) => run(c, () => deletePilgrimageCourse(c.req.param("id"))))

pilgrimageAdminRoute.get("/reviews", async (c) => c.json({ success: true, reviews: await listReviewsForAdmin(c.req.query("courseId") || null) }))
pilgrimageAdminRoute.patch("/reviews/:courseId/:memberId", async (c) => {
  const input = await body(c)
  return run(c, () => setReviewHidden(c.req.param("courseId"), c.req.param("memberId"), input.hidden === true))
})
pilgrimageAdminRoute.delete("/reviews/:courseId/:memberId", (c) => run(c, () => deleteReview(c.req.param("courseId"), c.req.param("memberId"))))

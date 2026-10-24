import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "../../shared/auth/admin-session"
import { requireAdmin } from "../../shared/auth/require-admin"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { config } from "../../shared/config"
import { requireDatabase } from "../../shared/db/require-database"
import { DuplicatePartyEventError, partyRepository } from "./repository"
import { LEGACY_PARTY_GALLERY_SLUG, PARTY_GALLERY_SLUG, defaultPartyGallerySlug, getBoardPost, listEventBoardPosts } from "./shared-tables"
import { PARTY_EVENT_STATUSES } from "./types"
import { validatePartyEventInput } from "./validation"
import { partyImages } from "./storage"

// 덕지 펀딩 · 파티: 애니메이션 이벤트 캘린더 (캐릭터 생일·기념일·작중 사건·실제 행사)
// 이벤트마다 "파티할래요?" 글(gallery 서비스)이 이어지고, 펀딩 개설은 덕질펀딩(교류·파티)으로 이어짐
// 관리자 API 는 /api/party/admin/... (docs/planning/관리자센터-기능정의서.md)
export const partyRoute = new Hono<MemberEnv>()

partyRoute.use("*", requireDatabase)

const ADMIN_AUTHOR_ID = "admin" // gallery 서비스가 비상용 관리자 계정 글에 쓰는 작성자 id
const SUGGESTIONS_PER_DAY = 5
const isAdmin = (c: Context) => isValidAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))
const jsonBody = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const monthParam = (c: Context) => {
  const month = Number(c.req.query("month"))
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined
}

// ======================= 공개 =======================

// 이벤트 목록 (게시 중인 것만): ?month=10  ?q=나루토
partyRoute.get("/events", async (c) => {
  const events = await partyRepository.list({
    month: monthParam(c),
    query: c.req.query("q")?.trim() || undefined,
    statuses: ["published"],
  })
  return c.json({ success: true, events })
})

// 이벤트 상세 + "파티할래요?" 글
partyRoute.get("/events/:slug", async (c) => {
  const event = await partyRepository.get(c.req.param("slug"))
  if (!event || (event.status !== "published" && !isAdmin(c))) return c.json({ success: false, error: "Not Found" }, 404)
  const posts = await listEventBoardPosts(event.id, 50)
  return c.json({ success: true, event, posts, partyGallerySlug: event.gallerySlug || (await defaultPartyGallerySlug()) })
})

// 글이 연결된 이벤트 (글 상세에서 이벤트로 돌아가는 링크용)
partyRoute.get("/posts/:postId/event", async (c) => {
  const postId = Number(c.req.param("postId"))
  const event = Number.isSafeInteger(postId) ? await partyRepository.getByPost(postId) : null
  if (!event || (event.status !== "published" && !isAdmin(c))) return c.json({ success: false, error: "Not Found" }, 404)
  return c.json({ success: true, event })
})

// "파티할래요?" 글 연결 { postId } — 프론트가 gallery API 로 글을 쓴 뒤 작성자(또는 관리자)가 호출
partyRoute.post("/events/:slug/posts", async (c) => {
  const member = getOptionalMember(c)
  const admin = isAdmin(c)
  if (!member && !admin) return c.json({ success: false, error: "로그인이 필요합니다." }, 401)
  const event = await partyRepository.get(c.req.param("slug"))
  if (!event || event.status !== "published") return c.json({ success: false, error: "Not Found" }, 404)
  const body = await jsonBody(c)
  const postId = Number(body?.postId)
  const post = Number.isSafeInteger(postId) ? await getBoardPost(postId) : null
  const allowedGalleries = [event.gallerySlug, PARTY_GALLERY_SLUG, LEGACY_PARTY_GALLERY_SLUG]
  if (!post || !allowedGalleries.includes(post.gallerySlug)) {
    return c.json({ success: false, error: "이 이벤트의 갤러리에 있는 글만 연결할 수 있습니다." }, 400)
  }
  const isAuthor = member ? post.authorId === member.id : post.authorId === ADMIN_AUTHOR_ID
  if (!isAuthor && !admin) return c.json({ success: false, error: "작성자만 연결할 수 있습니다." }, 403)
  if (!(await partyRepository.linkPost(event.id, post.id))) {
    return c.json({ success: false, error: "이미 다른 이벤트에 연결된 글입니다." }, 409)
  }
  return c.json({ success: true }, 201)
})

// 회원 이벤트 제보 → submitted 로 접수, 관리자가 승인하면 캘린더에 게시
partyRoute.post("/suggestions", requireMember, async (c) => {
  const member = c.get("member")
  const body = await jsonBody(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  if ((await partyRepository.countSubmittedBy(member.id, 24)) >= SUGGESTIONS_PER_DAY) {
    return c.json({ success: false, errors: [`이벤트 제보는 하루 ${SUGGESTIONS_PER_DAY}건까지 할 수 있습니다.`] }, 429)
  }
  // 주소(slug)는 서버가 정하고, 노출 관련 값은 관리자 승인 때 정함
  const slug = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const result = validatePartyEventInput({ ...body, slug, status: "submitted", imageUrl: null, gallerySlug: null })
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const event = await partyRepository.suggest(result.value, member.id)
  return c.json({ success: true, event: { slug: event.slug, status: event.status } }, 201)
})

// ======================= 관리자 =======================

partyRoute.use("/admin/*", requireAdmin)

// 대표 이미지 업로드: POST /admin/uploads { contentType, size } → 관리자 브라우저가 uploadUrl 로 PUT, publicUrl 을 이벤트에 저장
mountImageUploads(partyRoute, partyImages, {
  ticketPath: "/admin/uploads",
  localUploadPath: "/admin/uploads/local/",
  localServePath: "/images/local/",
  serviceBasePath: "/api/party",
})

// 목록: ?status=submitted (없으면 전체)  ?month=10  ?q=
partyRoute.get("/admin/events", async (c) => {
  const status = c.req.query("status")
  const statuses = PARTY_EVENT_STATUSES.includes(status as any) ? [status!] : [...PARTY_EVENT_STATUSES]
  const events = await partyRepository.list({ month: monthParam(c), query: c.req.query("q")?.trim() || undefined, statuses })
  return c.json({ success: true, events })
})

// 대시보드 대기 건수
partyRoute.get("/admin/summary", async (c) => {
  const counts = await partyRepository.summary()
  return c.json({ success: true, summary: { submitted: counts.submitted || 0, counts } })
})

partyRoute.post("/admin/events", async (c) => {
  const body = await jsonBody(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validatePartyEventInput(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    return c.json({ success: true, event: await partyRepository.create(result.value, config.adminId) }, 201)
  } catch (e) {
    if (e instanceof DuplicatePartyEventError) return c.json({ success: false, errors: [e.message] }, 409)
    throw e
  }
})

// 수정·승인·반려·숨김 — 보낸 필드만 바뀜. 반려(status: rejected)는 reason 필수
partyRoute.patch("/admin/events/:slug", async (c) => {
  const existing = await partyRepository.get(c.req.param("slug"))
  if (!existing) return c.json({ success: false, error: "Not Found" }, 404)
  const body = await jsonBody(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validatePartyEventInput(body, existing)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : ""
  if (result.value.status === "rejected" && existing.status !== "rejected" && !reason) {
    return c.json({ success: false, errors: ["반려 사유를 입력해주세요."] }, 400)
  }
  try {
    return c.json({ success: true, event: await partyRepository.update(existing, result.value, config.adminId, reason) })
  } catch (e) {
    if (e instanceof DuplicatePartyEventError) return c.json({ success: false, errors: [e.message] }, 409)
    throw e
  }
})

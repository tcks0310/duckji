import { normalizeSearchQuery } from "../../shared/search/text-search"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "../../shared/auth/admin-session"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { config } from "../../shared/config"
import { db } from "../../shared/db/require-database"
import { DpError, memberContacts } from "./shared-tables"
import {
  FundingError,
  comments,
  isPublicStatus,
  likes,
  messages,
  notices,
  participants,
  projects,
  quotes,
  reports,
  topics,
} from "./project-repository"
import { ADMIN_STATUSES, PUBLIC_STATUSES, type Project, type ProjectStatus } from "./project-types"
import {
  validateComment,
  validateEdit,
  validateMessage,
  validateNotice,
  validateParticipation,
  validateProject,
  validateQuote,
  validateReport,
  validateReportPatch,
  validateSetup,
  validateTopic,
} from "./project-validation"

// 덕지 펀딩 프로젝트 API (/api/funding/projects ...)
// - 목록·상세·댓글·공지·참여자 프로필: 누구나 (견적 전·오픈 준비·반려 펀딩은 개설자와 관리자만)
// - 개설 신청·참여·댓글·좋아요: 회원
// - 견적서·담당자 대화·참여자 명단(연락처)·공지 작성: 개설자와 관리자
// - 신고: 비회원도 가능

export const projectRoute = new Hono<MemberEnv>()

const readJson = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const badBody = { success: false, errors: ["JSON 본문이 필요합니다."] }
const notFound = { success: false, error: "Not Found" }
const isAdmin = (c: Context) => isValidAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))
const isOwner = (c: Context, p: Project) => getOptionalMember(c)?.id === p.creatorId
const isOwnerOrAdmin = (c: Context, p: Project) => isOwner(c, p) || isAdmin(c)
const numId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// 공개 상태가 아니면 개설자·관리자에게만 보임
async function visibleProject(c: Context) {
  const p = await projects.get(c.req.param("id") ?? "")
  if (!p) return null
  return isPublicStatus(p.status) || isOwnerOrAdmin(c, p) ? p : null
}

const fail = (c: Context, e: unknown) => {
  if (e instanceof FundingError || e instanceof DpError) return c.json({ success: false, error: e.message }, e.status)
  throw e
}

// ================================================================ 공개
// ?partyEventId=<party.events.slug> 이면 그 파티 이벤트에서 열린 펀딩만
projectRoute.get("/projects", async (c) => {
  // ?q=검색어 → 통합 검색 (진행 중·성사, 예시 제외, 정확도 순, 최대 ?limit=20)
  const q = normalizeSearchQuery(c.req.query("q"))
  if (q) {
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 50)
    return c.json({ success: true, projects: await projects.search(q, limit), likedIds: [] })
  }
  const partyEventId = c.req.query("partyEventId") || undefined
  const list = await projects.list({ statuses: partyEventId ? ["live", "success"] : PUBLIC_STATUSES, partyEventId })
  const member = getOptionalMember(c)
  const likedIds = member ? await likes.idsByMember(member.id) : []
  return c.json({ success: true, projects: list, likedIds })
})

// 주제 (둘러보기 분류)
projectRoute.get("/topics", async (c) => c.json({ success: true, topics: await topics.list() }))

projectRoute.get("/projects/stats", async (c) => c.json({ success: true, stats: await projects.stats() }))

projectRoute.get("/projects/mine", requireMember, async (c) =>
  c.json({ success: true, projects: await projects.list({ creatorId: c.get("member").id }) })
)

projectRoute.get("/projects/:id", async (c) => {
  const project = await visibleProject(c)
  if (!project) return c.json(notFound, 404)
  const member = getOptionalMember(c)
  const liked = member ? await likes.has(project.id, member.id) : false
  return c.json({ success: true, project, liked })
})

projectRoute.get("/projects/:id/comments", async (c) => {
  const project = await visibleProject(c)
  return project ? c.json({ success: true, comments: await comments.list(project.id) }) : c.json(notFound, 404)
})

projectRoute.get("/projects/:id/notices", async (c) => {
  const project = await visibleProject(c)
  return project ? c.json({ success: true, notices: await notices.list(project.id) }) : c.json(notFound, 404)
})

// 참여자 프로필 (이름·사진만, 누르면 커뮤니티 피드)
projectRoute.get("/projects/:id/supporters", async (c) => {
  const project = await visibleProject(c)
  return project ? c.json({ success: true, supporters: await projects.supporters(project.id) }) : c.json(notFound, 404)
})

// 신고 (비회원은 guest 로 기록)
projectRoute.post("/reports", async (c) => {
  if (!(await consumeQuota("funding-report", getOptionalMember(c)?.id ?? `ip:${clientIp(c)}`, 20, 86400)))
    return c.json({ success: false, error: "신고는 하루 20건까지 할 수 있습니다." }, 429)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateReport(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const project = await projects.get(result.value.projectId)
  if (!project) return c.json(notFound, 404)
  const report = await reports.create(result.value, project.title, getOptionalMember(c)?.id ?? "guest")
  return c.json({ success: true, report: { id: report.id, status: report.status } }, 201)
})

// ================================================================ 회원
projectRoute.post("/projects", requireMember, async (c) => {
  if (!(await consumeQuota("funding-open", c.get("member").id, 5, 86400)))
    return c.json({ success: false, error: "펀딩 개설 신청은 하루 5건까지 할 수 있습니다." }, 429)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateProject(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const { project, rewardDp } = await projects.create(result.value, c.get("member"))
  return c.json({ success: true, project, rewardDp }, 201)
})

projectRoute.post("/projects/:id/participate", requireMember, async (c) => {
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateParticipation(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    const { participant, goalReached, rewardDp, paidDp, dpBalance } = await participants.create(c.req.param("id"), result.value, c.get("member"))
    return c.json({ success: true, participant, goalReached, rewardDp, paidDp, dpBalance }, 201)
  } catch (e) {
    return fail(c, e)
  }
})

projectRoute.get("/participations/mine", requireMember, async (c) =>
  c.json({ success: true, participations: await participants.listByMember(c.get("member").id) })
)

projectRoute.post("/participations/:id/cancel", requireMember, async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) return c.json(notFound, 404)
  try {
    await participants.cancel(id, c.get("member").id)
    return c.json({ success: true })
  } catch (e) {
    return fail(c, e)
  }
})

// 참여자 명단 (개인정보라 개설자·관리자만)
projectRoute.get("/projects/:id/participants", async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project) return c.json(notFound, 404)
  if (!isOwnerOrAdmin(c, project)) return c.json({ success: false, error: "개설자만 볼 수 있습니다." }, 403)
  return c.json({ success: true, participants: await participants.listByProject(project.id) })
})

projectRoute.post("/projects/:id/comments", requireMember, async (c) => {
  const project = await visibleProject(c)
  if (!project) return c.json(notFound, 404)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateComment(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const comment = await comments.create(project.id, result.value.content, result.value.userLevel, c.get("member"))
  return c.json({ success: true, comment }, 201)
})

projectRoute.post("/projects/:id/notices", async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project) return c.json(notFound, 404)
  if (!isOwnerOrAdmin(c, project)) return c.json({ success: false, error: "개설자만 공지를 쓸 수 있습니다." }, 403)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateNotice(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const authorType = isOwner(c, project) ? "creator" : "admin"
  return c.json({ success: true, notice: await notices.create(project.id, result.value.title, result.value.content, authorType) }, 201)
})

projectRoute.delete("/projects/:id/notices/:noticeId", async (c) => {
  const project = await projects.get(c.req.param("id"))
  const noticeId = numId(c.req.param("noticeId"))
  if (!project || !noticeId) return c.json(notFound, 404)
  if (!isOwnerOrAdmin(c, project)) return c.json({ success: false, error: "개설자만 지울 수 있습니다." }, 403)
  return (await notices.remove(project.id, noticeId)) ? c.json({ success: true }) : c.json(notFound, 404)
})

projectRoute.delete("/projects/:id/comments/:commentId", requireMember, async (c) => {
  const commentId = numId(c.req.param("commentId"))
  if (!commentId) return c.json(notFound, 404)
  const ok = await comments.remove(c.req.param("id"), commentId, isAdmin(c) ? null : c.get("member").id)
  return ok ? c.json({ success: true }) : c.json(notFound, 404)
})

// 견적서 (개설자·관리자). 개설자는 최신 견적을 수락
projectRoute.get("/projects/:id/quotes", async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project || !isOwnerOrAdmin(c, project)) return c.json(notFound, 404)
  return c.json({ success: true, quotes: await quotes.list(project.id) })
})

projectRoute.post("/projects/:id/quotes/:quoteId/accept", requireMember, async (c) => {
  const project = await projects.get(c.req.param("id"))
  const quoteId = numId(c.req.param("quoteId"))
  if (!project || !quoteId || project.creatorId !== c.get("member").id) return c.json(notFound, 404)
  const quote = await quotes.accept(project.id, quoteId)
  return quote ? c.json({ success: true, quote }) : c.json({ success: false, error: "이미 수락했거나 새 견적으로 바뀌었어요." }, 409)
})

// 담당자와 대화 (개설자 본인만. 관리자는 /admin/projects/:id/messages)
projectRoute.get("/projects/:id/messages", requireMember, async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project || project.creatorId !== c.get("member").id) return c.json(notFound, 404)
  return c.json({ success: true, messages: await messages.list(project.id) })
})

projectRoute.post("/projects/:id/messages", requireMember, async (c) => {
  const member = c.get("member")
  const project = await projects.get(c.req.param("id"))
  if (!project || project.creatorId !== member.id) return c.json(notFound, 404)
  if (!(await consumeQuota("funding-message", member.id, 200, 86400)))
    return c.json({ success: false, error: "메시지는 하루 200개까지 보낼 수 있습니다." }, 429)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateMessage(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  return c.json({ success: true, message: await messages.create(project.id, "creator", member.name, result.value.content) }, 201)
})

projectRoute.post("/projects/:id/like", requireMember, async (c) => {
  const project = await visibleProject(c)
  if (!project) return c.json(notFound, 404)
  return c.json({ success: true, ...(await likes.toggle(project.id, c.get("member").id)) })
})

// ================================================================ 관리자 (/api/funding/admin/...) — requireAdmin 은 routes.ts 에서
export const projectAdminRoute = new Hono()
const adminId = () => config.adminId

projectAdminRoute.get("/projects", async (c) => {
  const list = await projects.list()
  const [lastMessages, contacts] = await Promise.all([messages.lastByProject(), memberContacts(db(), list.map((p) => p.creatorId))])
  return c.json({ success: true, projects: list, lastMessages, contacts })
})

projectAdminRoute.get("/party-event-counts", async (c) =>
  c.json({ success: true, counts: await projects.countByPartyEvent() })
)

// 단계 바꾸기 { status, reason } — 반려·무산·중단은 사유 필수, 무산·중단은 참여 DP 자동 환불
projectAdminRoute.post("/projects/:id/status", async (c) => {
  const body = await readJson(c)
  const status = ADMIN_STATUSES.find((s) => s === body?.status) as ProjectStatus | undefined
  if (!status) return c.json({ success: false, errors: ["단계가 올바르지 않습니다."] }, 400)
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : ""
  if (["rejected", "failed", "canceled"].includes(status) && !reason) return c.json({ success: false, errors: ["사유를 입력해 주세요."] }, 400)
  try {
    const ok = await projects.setStatus(c.req.param("id"), status, { reason }, adminId())
    return ok ? c.json({ success: true }) : c.json(notFound, 404)
  } catch (e) {
    return fail(c, e)
  }
})

// 공개 전 설정 (목표·마감·참여 옵션·담당자·주제)
projectAdminRoute.put("/projects/:id/setup", async (c) => {
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateSetup(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    const ok = await projects.setup(c.req.param("id"), result.value, adminId())
    return ok ? c.json({ success: true, project: await projects.get(c.req.param("id")) }) : c.json(notFound, 404)
  } catch (e) {
    return fail(c, e)
  }
})

// 내용 고치기
projectAdminRoute.put("/projects/:id", async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project) return c.json(notFound, 404)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateEdit(body, project.type)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  await projects.edit(project.id, result.value, adminId())
  return c.json({ success: true, project: await projects.get(project.id) })
})

projectAdminRoute.post("/projects/:id/quotes", async (c) => {
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateQuote(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const quote = await quotes.create(c.req.param("id"), result.value, adminId())
  return quote ? c.json({ success: true, quote }, 201) : c.json(notFound, 404)
})

projectAdminRoute.get("/projects/:id/messages", async (c) => {
  const project = await projects.get(c.req.param("id"))
  return project ? c.json({ success: true, messages: await messages.list(project.id) }) : c.json(notFound, 404)
})

projectAdminRoute.post("/projects/:id/messages", async (c) => {
  const project = await projects.get(c.req.param("id"))
  if (!project) return c.json(notFound, 404)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateMessage(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const name = project.managerName ? `담당자 ${project.managerName}` : "덕지 담당자"
  return c.json({ success: true, message: await messages.create(project.id, "admin", name, result.value.content) }, 201)
})

// 주제
projectAdminRoute.post("/topics", async (c) => {
  const result = validateTopic((await readJson(c)) ?? {})
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    return c.json({ success: true, id: await topics.create(result.value.name, result.value.sortOrder) }, 201)
  } catch (e) {
    return fail(c, e)
  }
})

projectAdminRoute.patch("/topics/:id", async (c) => {
  const id = numId(c.req.param("id"))
  const result = validateTopic((await readJson(c)) ?? {})
  if (!id) return c.json(notFound, 404)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  try {
    return (await topics.update(id, result.value.name, result.value.sortOrder)) ? c.json({ success: true }) : c.json(notFound, 404)
  } catch (e) {
    return fail(c, e)
  }
})

projectAdminRoute.delete("/topics/:id", async (c) => {
  const id = numId(c.req.param("id"))
  return id && (await topics.remove(id)) ? c.json({ success: true }) : c.json(notFound, 404)
})

projectAdminRoute.get("/reports", async (c) => c.json({ success: true, reports: await reports.list() }))

projectAdminRoute.patch("/reports/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) return c.json(notFound, 404)
  const body = await readJson(c)
  if (!body) return c.json(badBody, 400)
  const result = validateReportPatch(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const report = await reports.update(id, result.value.status, result.value.adminNote, adminId())
  return report ? c.json({ success: true, report }) : c.json(notFound, 404)
})

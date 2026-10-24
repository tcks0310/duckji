import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { requireDatabase } from "../../shared/db/require-database"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { normalizeSearchQuery } from "../../shared/search/text-search"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { createComment, getComment, lastCommentAt, listComments, listMyComments, MAX_COMMENT, setCommentStatus } from "./comments"
import { DUCKRYEOK_RULES, LEVELS, adjustByAdmin, ledgerOf, todayEarned } from "./duckryeok"
import { duckryeokRanking, getProfile, updateProfile } from "./members"
import { closePollNow, validatePoll, vote } from "./polls"
import {
  adminListPosts,
  createPost,
  getPostDetail,
  getPostRow,
  incrementView,
  lastPostAt,
  listFeed,
  listHomeNotices,
  listHot,
  listMine,
  listNotices,
  normalizeTag,
  popularTags,
  react,
  searchPosts,
  setPostStatus,
  updatePost,
  validatePost,
} from "./posts"
import { AUTO_HIDE_REPORTS, REPORT_REASONS, createReport, listReports, openReportCount, resolveReports } from "./reports"
import { galleryRequestRoute } from "./requests"
import { getMemberSquad, isMemberBlocked, squadExists } from "./shared-tables"
import { rangeStats, recordVisit, visitorKey } from "./stats"
import { MAX_MEDIA, media, memberImages } from "./storage"
import { adminTree, deleteGroup, getGalleryById, getGalleryBySlug, publicTree, saveGallery, saveGroup, searchGalleries, type Gallery } from "./tree"
import { GalleryError, KST_TODAY, adminActor, currentActor, idOf, isAdmin, jsonBody, run, str, tx, type Actor } from "./util"
import { db } from "../../shared/db/require-database"

// 덕지 갤러리: 대분류 > 갤러리 > 글(사진·동영상) · 댓글 · 덕업/덕다운 · 덕력 · 신고 · 투표 · 통계

export const galleryRoute = new Hono<MemberEnv>()

const POST_COOLDOWN_MS = 30_000
const COMMENT_COOLDOWN_MS = 5_000

galleryRoute.use("*", async (c, next) => {
  if (c.req.path.includes("/uploads/local/")) return next() // 로컬 업로드 파일은 DB 없이
  return requireDatabase(c, next)
})

const limitOf = (c: Context, def: number, max: number) => Math.min(Math.max(Number(c.req.query("limit")) || def, 1), max)

// 글·댓글을 쓰는 사람 (회원 또는 관리자). 정지 회원은 막음
async function writer(c: Context): Promise<Actor> {
  const actor = currentActor(c)
  if (!actor) throw new GalleryError(401, "로그인이 필요합니다.")
  if (await isMemberBlocked(actor.id)) throw new GalleryError(403, "이용이 정지된 계정입니다.")
  return actor
}

// 이 갤러리에 글·댓글을 쓸 수 있는지 (화면 버튼 표시용 이유 포함)
function permissions(gallery: Gallery, actor: Actor | null) {
  const write =
    gallery.status !== "active"
      ? "운영이 멈춘 갤러리입니다."
      : !actor
        ? "로그인하면 글을 쓸 수 있어요."
        : gallery.writeRole === "admin" && !actor.isStaff
          ? "운영팀만 글을 쓰는 갤러리입니다."
          : null
  const comment =
    gallery.status !== "active"
      ? "운영이 멈춘 갤러리입니다."
      : !actor
        ? "로그인하면 댓글을 쓸 수 있어요."
        : gallery.commentRole === "admin" && !actor.isStaff
          ? "운영팀만 댓글을 쓰는 갤러리입니다."
          : null
  return { canWrite: !write, writeBlockedReason: write, canComment: !comment, commentBlockedReason: comment }
}

const visit = (c: Context, galleryId: number) =>
  recordVisit(galleryId, visitorKey(getOptionalMember(c)?.id ?? null, clientIp(c), c.req.header("user-agent") || "")).catch(() => {})

// ============================ 갤러리 ============================

// 개설 요청 (/requests, /admin/requests)
galleryRoute.route("/", galleryRequestRoute)

// 트리 (대분류 > 갤러리). ?q= 이면 이름·별칭 검색 (통합 검색)
galleryRoute.get("/", async (c) => {
  const q = normalizeSearchQuery(c.req.query("q"))
  if (q) return c.json({ success: true, galleries: await searchGalleries(q) })
  return c.json({ success: true, ...(await publicTree()) })
})

// 첫 화면: 공지·오늘의 핫 게시글·인기 해시태그·덕력 순위
galleryRoute.get("/home", async (c) => {
  const [notices, hot, tags, ranking] = await Promise.all([listHomeNotices(3), listHot(10), popularTags(15), duckryeokRanking(5)])
  return c.json({ success: true, notices, hot, tags, ranking })
})

// 덕력 규칙 (화면 안내)
galleryRoute.get("/rules", (c) =>
  c.json({ success: true, duckryeok: DUCKRYEOK_RULES, levels: LEVELS, maxMedia: MAX_MEDIA, autoHideReports: AUTO_HIDE_REPORTS })
)

// 갤러리 한 곳: 정보·공지·글쓰기 권한 (방문 기록)
galleryRoute.get("/g/:slug", async (c) => {
  const gallery = await getGalleryBySlug(c.req.param("slug"))
  if (!gallery || (gallery.status === "closed" && !isAdmin(c))) return c.json({ success: false, error: "없거나 닫힌 갤러리입니다." }, 404)
  const actor = currentActor(c)
  const [notices] = await Promise.all([listNotices(gallery.id), visit(c, gallery.id)])
  const viewer = permissions(gallery, actor)
  // 스쿼드 이름으로 쓰는 갤러리는 스쿼드에 든 회원만
  if (viewer.canWrite && gallery.postAsSquad && actor && !actor.isStaff && !(await getMemberSquad(db(), actor.id))) {
    Object.assign(viewer, { canWrite: false, writeBlockedReason: "스쿼드에 들어가면 스쿼드 이름으로 글을 쓸 수 있어요." })
  }
  return c.json({ success: true, gallery, notices, viewer })
})

// ============================ 글 ============================

// 피드: ?gallery=<slug> ?tag= ?author=<회원id> ?squad=<스쿼드id> ?cursor= ?limit=  /  ?q= 검색
galleryRoute.get("/posts", async (c) => {
  const q = normalizeSearchQuery(c.req.query("q"))
  if (q) return c.json({ success: true, posts: await searchPosts(q, limitOf(c, 20, 50)), nextCursor: null })
  let galleryId: number | null = null
  const slug = c.req.query("gallery")
  if (slug) {
    const gallery = await getGalleryBySlug(slug)
    if (!gallery || gallery.status === "closed") return c.json({ success: false, error: "없거나 닫힌 갤러리입니다." }, 404)
    galleryId = gallery.id
  }
  const squadId = idOf(c.req.query("squad"))
  if (squadId && !(await squadExists(squadId))) return c.json({ success: true, posts: [], nextCursor: null })
  const tag = c.req.query("tag") ? normalizeTag(c.req.query("tag")!) : null
  const page = await listFeed({
    galleryId,
    tag,
    authorId: c.req.query("author") || null,
    squadId,
    includeNotices: !galleryId,
    cursor: c.req.query("cursor") || null,
    limit: limitOf(c, 24, 60),
  })
  return c.json({ success: true, ...page })
})

// 오늘의 핫 게시글 ?gallery=<slug>
galleryRoute.get("/hot", async (c) => {
  const slug = c.req.query("gallery")
  const gallery = slug ? await getGalleryBySlug(slug) : null
  return c.json({ success: true, posts: await listHot(limitOf(c, 10, 30), gallery?.id ?? null) })
})

galleryRoute.get("/tags", async (c) => c.json({ success: true, tags: await popularTags(limitOf(c, 20, 50)) }))

// 글 하나 (조회수 +1, 방문 기록)
galleryRoute.get("/posts/:id", async (c) => {
  const id = idOf(c.req.param("id"))
  const admin = isAdmin(c)
  const member = getOptionalMember(c)
  const detail = id ? await getPostDetail(id, member?.id ?? null, admin) : null
  if (!detail || (detail.post.status !== "published" && !admin && detail.post.authorId !== member?.id)) {
    return c.json({ success: false, error: "없거나 지워진 글입니다." }, 404)
  }
  const gallery = (await getGalleryById(detail.post.galleryId))!
  if (gallery.status === "closed" && !admin) return c.json({ success: false, error: "닫힌 갤러리의 글입니다." }, 404)
  await Promise.all([incrementView(detail.post.id), visit(c, gallery.id)])
  const actor = currentActor(c)
  return c.json({
    success: true,
    post: { ...detail.post, viewCount: detail.post.viewCount + 1 },
    gallery: { id: gallery.id, slug: gallery.slug, name: gallery.name, layout: gallery.layout, heads: gallery.heads },
    viewer: {
      ...permissions(gallery, actor),
      loggedIn: Boolean(member),
      memberId: member?.id ?? null,
      isAuthor: Boolean(actor && actor.id === detail.post.authorId),
      isAdmin: admin,
      reaction: detail.reaction,
    },
  })
})

// 글쓰기 { gallerySlug, head?, title, body, media:[url], links:[{url,label}], hashtags:[], isNotice?, poll? }
galleryRoute.post("/posts", (c) =>
  run(
    c,
    async () => {
      const author = await writer(c)
      const body = await jsonBody(c)
      const gallery = await getGalleryBySlug(str(body.gallerySlug))
      if (!gallery) throw new GalleryError(400, "갤러리를 다시 골라 주세요.")
      const perm = permissions(gallery, author)
      if (!perm.canWrite) throw new GalleryError(403, perm.writeBlockedReason!)
      const input = validatePost(body, gallery)
      const poll = author.isStaff ? validatePoll(body.poll) : null
      if (!author.isStaff) {
        const last = await lastPostAt(author.id)
        if (last && Date.now() - last.getTime() < POST_COOLDOWN_MS) throw new GalleryError(429, "글은 30초에 한 번씩 쓸 수 있습니다.")
        if (!(await consumeQuota("gallery-post", author.id, 30, 86400))) throw new GalleryError(429, "글은 하루 30개까지 쓸 수 있습니다.")
      }
      const { id, earned } = await createPost(gallery, author, {
        ...input,
        isNotice: author.isStaff && body.isNotice === true,
        asSquad: body.asSquad === true,
        poll,
      })
      return { post: { id }, earned }
    },
    201
  )
)

// 글 수정 (작성자, 관리자는 운영팀 글도)
galleryRoute.patch("/posts/:id", (c) =>
  run(c, async () => {
    const actor = await writer(c)
    const id = idOf(c.req.param("id"))
    const row = id ? await getPostRow(id) : null
    if (!row || row.status !== "published") throw new GalleryError(404, "글을 찾을 수 없습니다.")
    const isOwner = row.author_id === actor.id || (actor.isStaff && row.is_staff)
    if (!isOwner) throw new GalleryError(403, "작성자만 고칠 수 있습니다.")
    const gallery = (await getGalleryById(Number(row.gallery_id)))!
    const body = await jsonBody(c)
    const input = validatePost(body, gallery)
    await updatePost(id!, {
      ...input,
      isNotice: actor.isStaff && typeof body.isNotice === "boolean" ? body.isNotice : undefined,
      poll: actor.isStaff && body.poll !== undefined ? validatePoll(body.poll) : undefined,
    })
    return { post: { id } }
  })
)

// 글 지우기 (작성자 또는 관리자)
galleryRoute.delete("/posts/:id", (c) =>
  run(c, async () => {
    const actor = currentActor(c)
    const id = idOf(c.req.param("id"))
    const row = id ? await getPostRow(id) : null
    if (!row || row.status === "deleted") throw new GalleryError(404, "글을 찾을 수 없습니다.")
    if (!actor || (row.author_id !== actor.id && !actor.isStaff)) throw new GalleryError(403, "작성자만 지울 수 있습니다.")
    await setPostStatus(id!, "deleted")
  })
)

// 덕업·덕다운 { value: 1 | -1 | 0 }  (한 사람이 한 글에 하나)
galleryRoute.post("/posts/:id/reaction", requireMember, (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    if (!id) throw new GalleryError(404, "글을 찾을 수 없습니다.")
    const body = await jsonBody(c)
    const value = body.value === 1 ? 1 : body.value === -1 ? -1 : body.value === 0 ? 0 : null
    if (value === null) throw new GalleryError(400, "덕업·덕다운을 다시 눌러 주세요.")
    if (!(await consumeQuota("gallery-reaction", c.get("member").id, 300, 3600))) throw new GalleryError(429, "잠시 뒤 다시 눌러 주세요.")
    return react(id, c.get("member").id, value)
  })
)

// 투표 { optionId }
galleryRoute.post("/posts/:id/vote", requireMember, (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    const optionId = Number((await jsonBody(c)).optionId)
    if (!id || !Number.isSafeInteger(optionId)) throw new GalleryError(400, "후보를 다시 골라 주세요.")
    await vote(id, c.get("member").id, optionId)
    const detail = await getPostDetail(id, c.get("member").id)
    return { poll: detail?.post.poll ?? null }
  })
)

// ============================ 댓글 ============================

galleryRoute.get("/posts/:id/comments", async (c) => {
  const id = idOf(c.req.param("id"))
  const row = id ? await getPostRow(id) : null
  if (!row || (row.status !== "published" && !isAdmin(c))) return c.json({ success: false, error: "글을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, comments: await listComments(id!) })
})

galleryRoute.post("/posts/:id/comments", (c) =>
  run(
    c,
    async () => {
      const author = await writer(c)
      const id = idOf(c.req.param("id"))
      const row = id ? await getPostRow(id) : null
      if (!row || row.status !== "published") throw new GalleryError(404, "글을 찾을 수 없습니다.")
      const gallery = (await getGalleryById(Number(row.gallery_id)))!
      const perm = permissions(gallery, author)
      if (!perm.canComment) throw new GalleryError(403, perm.commentBlockedReason!)
      const body = await jsonBody(c)
      const text = str(body.body)
      if (!text || text.length > MAX_COMMENT) throw new GalleryError(400, `댓글은 1~${MAX_COMMENT.toLocaleString()}자로 써 주세요.`)
      if (!author.isStaff) {
        const last = await lastCommentAt(author.id)
        if (last && Date.now() - last.getTime() < COMMENT_COOLDOWN_MS) throw new GalleryError(429, "댓글을 너무 빠르게 쓰고 있어요. 잠시 뒤 다시 써 주세요.")
        if (!(await consumeQuota("gallery-comment", author.id, 200, 86400))) throw new GalleryError(429, "댓글은 하루 200개까지 쓸 수 있습니다.")
      }
      const parentId = body.parentId === undefined || body.parentId === null ? null : Number(body.parentId)
      return createComment({ id: id!, authorId: row.author_id }, author, text, parentId)
    },
    201
  )
)

galleryRoute.delete("/comments/:id", (c) =>
  run(c, async () => {
    const actor = currentActor(c)
    const id = idOf(c.req.param("id"))
    const comment = id ? await getComment(id) : null
    if (!comment || comment.status !== "published") throw new GalleryError(404, "댓글을 찾을 수 없습니다.")
    if (!actor || (comment.authorId !== actor.id && !actor.isStaff)) throw new GalleryError(403, "작성자만 지울 수 있습니다.")
    await setCommentStatus(id!, "deleted")
  })
)

// ============================ 신고 ============================

// { targetType: post | comment | member, targetId, reason, detail? }
galleryRoute.post("/reports", requireMember, (c) =>
  run(c, async () => {
    const body = await jsonBody(c)
    const targetType = ["post", "comment", "member"].includes(String(body.targetType)) ? (body.targetType as "post" | "comment" | "member") : null
    const targetId = str(String(body.targetId ?? ""))
    const reason = str(body.reason)
    if (!targetType || !targetId || !(REPORT_REASONS as readonly string[]).includes(reason)) throw new GalleryError(400, "신고 대상과 사유를 확인해 주세요.")
    if (targetType === "post" && !(await getPostRow(Number(targetId)))) throw new GalleryError(404, "글을 찾을 수 없습니다.")
    if (targetType === "comment" && !(await getComment(Number(targetId)))) throw new GalleryError(404, "댓글을 찾을 수 없습니다.")
    if (!(await consumeQuota("gallery-report", c.get("member").id, 30, 86400))) throw new GalleryError(429, "신고는 하루 30번까지 할 수 있습니다.")
    const created = await createReport({ targetType, targetId, reporterId: c.get("member").id, reason, detail: str(body.detail).slice(0, 1000) })
    return { alreadyReported: !created }
  })
)

// ============================ 회원 홈 ============================

// 다른 회원 홈 (프로필, 글은 /posts?author= 로)
galleryRoute.get("/members/:id", async (c) => {
  const profile = await getProfile(c.req.param("id"))
  if (!profile) return c.json({ success: false, error: "회원을 찾을 수 없습니다." }, 404)
  return c.json({ success: true, profile })
})

galleryRoute.get("/ranking", async (c) => c.json({ success: true, ranking: await duckryeokRanking(limitOf(c, 20, 100)) }))

// 내 홈
galleryRoute.get("/me", requireMember, async (c) => {
  const id = c.get("member").id
  const [profile, today] = await Promise.all([getProfile(id), todayEarned(id)])
  return c.json({ success: true, profile, today })
})

// 내 소개·SNS 링크 { bio?, links? }
galleryRoute.patch("/me", requireMember, (c) =>
  run(c, async () => {
    await updateProfile(c.get("member").id, await jsonBody(c))
    return { profile: await getProfile(c.get("member").id) }
  })
)

galleryRoute.get("/me/posts", requireMember, async (c) =>
  c.json({ success: true, ...(await listMine(c.get("member").id, c.req.query("cursor") || null, limitOf(c, 24, 60))) })
)
galleryRoute.get("/me/comments", requireMember, async (c) =>
  c.json({ success: true, comments: await listMyComments(c.get("member").id, limitOf(c, 30, 100)) })
)
galleryRoute.get("/me/duckryeok", requireMember, async (c) =>
  c.json({ success: true, ledger: await ledgerOf(c.get("member").id, limitOf(c, 30, 100)) })
)

// ============================ 사진·동영상 업로드 ============================

// 업로드 주소 발급 { contentType, size } (회원·관리자). 1시간 60개
mountImageUploads(galleryRoute, media, {
  ticketPath: "/uploads",
  localUploadPath: "/uploads/local/",
  localServePath: "/uploads/local/",
  serviceBasePath: "/api/galleries",
  beforeTicket: async (c) => {
    try {
      const actor = await writer(c)
      if (!actor.isStaff && !(await consumeQuota("gallery-upload", actor.id, 60, 3600)))
        return c.json({ success: false, error: "사진·동영상은 1시간에 60개까지 올릴 수 있습니다." }, 429)
      return null
    } catch (e) {
      if (e instanceof GalleryError) return c.json({ success: false, error: e.message }, e.status)
      throw e
    }
  },
})

// 회원 이미지 (프로필·펀딩 개설·굿즈 의뢰). 1시간 60장
mountImageUploads(galleryRoute, memberImages, {
  ticketPath: "/member-uploads",
  localUploadPath: "/member-uploads/local/",
  localServePath: "/member-uploads/local/",
  serviceBasePath: "/api/galleries",
  guard: requireMember,
  beforeTicket: async (c) => {
    if (!(await consumeQuota("board-upload", c.get("member").id, 60, 3600)))
      return c.json({ success: false, error: "이미지는 1시간에 60장까지 올릴 수 있습니다. 잠시 뒤 다시 시도해 주세요." }, 429)
    return null
  },
})

// ============================ 관리자 ============================

const admin = new Hono()
admin.use("*", requireAdmin)

const logAction = (c: Context, action: string, targetType: string, targetId: string | number, detail: Record<string, unknown> = {}) =>
  db()
    .query("INSERT INTO gallery.admin_actions (actor, action, target_type, target_id, detail) VALUES ($1,$2,$3,$4,$5)", [
      adminActor(c),
      action,
      targetType,
      String(targetId),
      JSON.stringify(detail),
    ])
    .catch(() => {})

// 요약 숫자 (관리자 갤러리 첫 화면)
admin.get("/summary", async (c) => {
  const { rows } = await db().query(
    `SELECT (SELECT count(*) FROM gallery.posts WHERE status = 'published' AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${KST_TODAY})::int AS today_posts,
            (SELECT count(*) FROM gallery.comments WHERE status = 'published' AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${KST_TODAY})::int AS today_comments,
            (SELECT count(DISTINCT visitor) FROM gallery.daily_visitors WHERE day = ${KST_TODAY})::int AS today_visitors,
            (SELECT count(*) FROM gallery.posts WHERE status = 'published')::int AS total_posts,
            (SELECT count(*) FROM gallery.gallery_requests WHERE status = 'pending')::int AS pending_requests`
  )
  const r = rows[0]
  return c.json({
    success: true,
    summary: {
      todayPosts: r.today_posts,
      todayComments: r.today_comments,
      todayVisitors: r.today_visitors,
      totalPosts: r.total_posts,
      pendingRequests: r.pending_requests,
      openReports: await openReportCount(),
    },
  })
})

admin.get("/tree", async (c) => c.json({ success: true, ...(await adminTree()) }))

admin.post("/groups", (c) =>
  run(
    c,
    async () => {
      const group = await saveGroup(null, await jsonBody(c))
      logAction(c, "group_create", "group", group.id, { name: group.name })
      return { group }
    },
    201
  )
)
admin.patch("/groups/:id", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    if (!id) throw new GalleryError(404, "대분류를 찾을 수 없습니다.")
    const group = await saveGroup(id, await jsonBody(c))
    logAction(c, "group_update", "group", id, { name: group.name })
    return { group }
  })
)
admin.delete("/groups/:id", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    if (!id) throw new GalleryError(404, "대분류를 찾을 수 없습니다.")
    await deleteGroup(id)
    logAction(c, "group_delete", "group", id)
  })
)

// 갤러리 개설·수정 (글쓰기 권한 writeRole: member | admin 포함)
admin.post("/galleries", (c) =>
  run(
    c,
    async () => {
      const gallery = await saveGallery(null, await jsonBody(c))
      logAction(c, "gallery_create", "gallery", gallery.id, { name: gallery.name })
      return { gallery }
    },
    201
  )
)
admin.patch("/galleries/:id", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    if (!id) throw new GalleryError(404, "갤러리를 찾을 수 없습니다.")
    const body = await jsonBody(c)
    const gallery = await saveGallery(id, body)
    logAction(c, "gallery_update", "gallery", id, { fields: Object.keys(body) })
    return { gallery }
  })
)

// 글 관리 ?galleryId= &status= &q= &page=
admin.get("/posts", async (c) => {
  const limit = 30
  const page = Math.max(Number(c.req.query("page")) || 1, 1)
  const result = await adminListPosts({
    galleryId: idOf(c.req.query("galleryId")),
    groupId: idOf(c.req.query("groupId")),
    status: c.req.query("status") || undefined,
    q: str(c.req.query("q")) || undefined,
    limit,
    offset: (page - 1) * limit,
  })
  return c.json({ success: true, ...result, page, pageSize: limit })
})

// 글 상태·공지 { status?: published | hidden, isNotice?: boolean }
admin.patch("/posts/:id", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    const row = id ? await getPostRow(id) : null
    if (!row) throw new GalleryError(404, "글을 찾을 수 없습니다.")
    const body = await jsonBody(c)
    if (body.status === "hidden" || body.status === "published") {
      await setPostStatus(id!, body.status)
      logAction(c, body.status === "hidden" ? "post_hide" : "post_restore", "post", id!)
    }
    if (typeof body.isNotice === "boolean") {
      await db().query("UPDATE gallery.posts SET is_notice = $2 WHERE id = $1", [id, body.isNotice])
      logAction(c, body.isNotice ? "post_pin" : "post_unpin", "post", id!)
    }
  })
)

// 투표 지금 마감 (마감 시각은 글을 쓸 때 정함)
admin.post("/posts/:id/poll/close", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    if (!id || !(await closePollNow(id))) throw new GalleryError(404, "투표를 찾을 수 없습니다.")
    logAction(c, "poll_close", "post", id)
  })
)

admin.patch("/comments/:id", (c) =>
  run(c, async () => {
    const id = idOf(c.req.param("id"))
    const status = (await jsonBody(c)).status
    if (!id || (status !== "hidden" && status !== "published")) throw new GalleryError(400, "처리 방법을 확인해 주세요.")
    await setCommentStatus(id, status)
    logAction(c, status === "hidden" ? "comment_hide" : "comment_restore", "comment", id)
  })
)

// 신고 ?status=open|actioned|dismissed
admin.get("/reports", async (c) => {
  const s = c.req.query("status")
  return c.json({ success: true, reports: await listReports(s === "actioned" || s === "dismissed" ? s : "open") })
})

// 신고 처리 { targetType, targetId, action: hide | dismiss, note? }
admin.post("/reports/resolve", (c) =>
  run(c, async () => {
    const body = await jsonBody(c)
    const targetType = ["post", "comment", "member"].includes(String(body.targetType)) ? (body.targetType as "post" | "comment" | "member") : null
    const targetId = str(String(body.targetId ?? ""))
    if (!targetType || !targetId || (body.action !== "hide" && body.action !== "dismiss")) throw new GalleryError(400, "처리 대상과 방법을 확인해 주세요.")
    const resolved = await resolveReports(targetType, targetId, body.action, str(body.note))
    logAction(c, `report_${body.action}`, targetType, targetId)
    return { resolved }
  })
)

// 통계 ?galleryId= &from=YYYY-MM-DD &to=YYYY-MM-DD
admin.get("/stats", (c) =>
  run(c, async () => ({
    stats: await rangeStats({ galleryId: idOf(c.req.query("galleryId")), from: str(c.req.query("from")), to: str(c.req.query("to")) }),
  }))
)

// 회원 덕력 조정 { amount, note }
admin.post("/members/:id/duckryeok", (c) =>
  run(c, async () => {
    const body = await jsonBody(c)
    const amount = Math.trunc(Number(body.amount))
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) throw new GalleryError(400, "조정할 덕력을 확인해 주세요.")
    const memberId = c.req.param("id")
    await tx((client) => adjustByAdmin(client, memberId, amount, str(body.note).slice(0, 200) || "운영팀 조정"))
    logAction(c, "duckryeok_adjust", "member", memberId, { amount })
    return { profile: await getProfile(memberId) }
  })
)

galleryRoute.route("/admin", admin)

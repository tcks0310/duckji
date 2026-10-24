import { Hono, type Context } from "hono"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember, requireMember, type MemberEnv } from "../../shared/auth/require-member"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { requireDatabase } from "../../shared/db/require-database"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { codeRedemptions, createCode, deleteCode, listCodes, myCodes, redeemCode, updateCode, validateCode } from "./codes"
import {
  adminTopics,
  adminVersion,
  createItem,
  createOption,
  createTopic,
  createVersion,
  deleteItem,
  deleteOption,
  deleteTopic,
  deleteVersion,
  moveItem,
  quizCatalog,
  quizVersionForPlay,
  submitQuizVersion,
  updateItem,
  updateOption,
  updateTopic,
  updateVersion,
} from "./quiz"
import { RewardError } from "./shared-tables"
import { pilgrimageAdminRoute, pilgrimageRoute } from "./pilgrimage-routes"
import { claimTarotDaily } from "./tarot"
import {
  adminDeleteMessage,
  adminDisbandSquad,
  adminListSquads,
  adminRemoveMember,
  adminSquadDetail,
  adminUpdateSquad,
  applyToSquad,
  cancelApplication,
  checkSquadName,
  createSquad,
  decideRequest,
  deleteMessage,
  disbandMySquad,
  canUploadSquadImage,
  joinSquad,
  kickMember,
  leaveSquad,
  listMessages,
  listSquads,
  mySquad,
  postMessage,
  squadDetail,
  squadPreview,
  squadStats,
  transferLeader,
  updateMySquad,
} from "./squads"
import { squadImages } from "./storage"

// 서버가 확인한 뒤 주는 덕지 포인트 (/api/rewards). 관리자 API 는 /api/rewards/admin/...
//  - 코드: POST /codes (팝업·굿즈·일반 배포·크리에이터 아무 종류, 마이페이지 포인트 관리), GET /codes/mine
//  - 덕력 퀴즈: GET /quiz (주제별 공개 버전), GET /quiz/versions/:id, POST /quiz/versions/:id/submit
//  - 덕지순례: /pilgrimage/... (pilgrimage-routes.ts)
//  - 오늘의 타로: POST /tarot/daily
//  - 스쿼드: GET /squads(둘러보기), /squads/id/:id(상세), /squads/mine, /squads/:code(초대 미리보기)
//           POST /squads, /squads/:code/join, /squads/id/:id/apply, /squads/leave, PATCH /squads/mine (리더), 채팅 /squads/mine/messages
export const rewardsRoute = new Hono<MemberEnv>()

rewardsRoute.use("*", requireDatabase)

const body = async (c: Context) => (await c.req.json<Record<string, unknown>>().catch(() => null)) || {}
const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
const fail = (c: Context, e: unknown) => {
  if (e instanceof RewardError) return c.json({ success: false, error: e.message, code: e.code }, e.status)
  throw e
}
const tooMany = (c: Context) => c.json({ success: false, error: "잠시 후 다시 시도해주세요.", code: "rate_limited" }, 429)
const run = async (c: Context, fn: () => Promise<unknown>) => {
  try {
    const data = await fn()
    return c.json({ success: true, ...(data && typeof data === "object" ? data : {}) })
  } catch (e) {
    return fail(c, e)
  }
}

// ---- 코드 ----

rewardsRoute.get("/codes/mine", requireMember, async (c) => {
  const kind = c.req.query("kind") === "creator" ? "creator" : undefined
  return c.json({ success: true, codes: await myCodes(c.get("member").id, kind) })
})

// 코드 등록 (마이페이지 포인트 관리). 예전 스쿼드 창의 크리에이터 코드 전용 칸(/codes/creator)은 2026-10-18 삭제
rewardsRoute.post("/codes", requireMember, async (c) => {
  const memberId = c.get("member").id
  // 코드 맞히기 막기: 10분에 10번
  if (!(await consumeQuota("rewards-code", memberId, 10, 600))) return tooMany(c)
  try {
    return c.json({ success: true, ...(await redeemCode(memberId, (await body(c)).code)) })
  } catch (e) {
    return fail(c, e)
  }
})

// ---- 덕력 퀴즈 ----

rewardsRoute.get("/quiz", async (c) => c.json({ success: true, ...(await quizCatalog(getOptionalMember(c)?.id ?? null)) }))

rewardsRoute.get("/quiz/versions/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => quizVersionForPlay(id, getOptionalMember(c)?.id ?? null))
})

// 채점: 회원은 처음 한 번 보상 + 정답·해설, 비회원은 맞힌 개수만
rewardsRoute.post("/quiz/versions/:id/submit", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  const me = getOptionalMember(c)
  if (!(await consumeQuota("rewards-quiz-submit", me?.id ?? clientIp(c), 30, 3600))) return tooMany(c)
  return run(c, async () => submitQuizVersion(id, me?.id ?? null, (await body(c)).answers))
})

// ---- 덕지순례 ----

rewardsRoute.route("/pilgrimage", pilgrimageRoute)

// ---- 오늘의 타로 ----

rewardsRoute.post("/tarot/daily", requireMember, async (c) => {
  try {
    return c.json({ success: true, ...(await claimTarotDaily(c.get("member").id, (await body(c)).type)) })
  } catch (e) {
    return fail(c, e)
  }
})

// ---- 스쿼드 ----

const memberId = (c: Context<MemberEnv>) => c.get("member").id

// 둘러보기 ?q=검색어&sort=members|newest
rewardsRoute.get("/squads", async (c) => c.json({ success: true, ...(await listSquads({ q: c.req.query("q"), sort: c.req.query("sort") })) }))

// 이름 쓸 수 있는지 ?name=
rewardsRoute.get("/squads/name-check", async (c) => {
  if (!(await consumeQuota("rewards-squad-name", clientIp(c), 120, 600))) return tooMany(c)
  const me = getOptionalMember(c)
  const mine = me ? await mySquad(me.id) : null
  return c.json({ success: true, ...(await checkSquadName(c.req.query("name"), mine?.isLeader ? mine.id : 0)) })
})

rewardsRoute.get("/squads/mine", requireMember, async (c) => c.json({ success: true, squad: await mySquad(memberId(c)) }))

rewardsRoute.post("/squads", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-squad", memberId(c), 20, 86400))) return tooMany(c)
  return run(c, async () => ({ squad: await createSquad(memberId(c), await body(c)) }))
})

// 리더: 이름·소개·아이콘·가입 방식 { name?, intro?, icon?, color?, imageUrl?, joinPolicy? }
rewardsRoute.patch("/squads/mine", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-squad-edit", memberId(c), 30, 3600))) return tooMany(c)
  return run(c, async () => ({ squad: await updateMySquad(memberId(c), await body(c)) }))
})
rewardsRoute.post("/squads/mine/kick", requireMember, async (c) => run(c, async () => ({ squad: await kickMember(memberId(c), (await body(c)).memberId) })))
rewardsRoute.post("/squads/mine/transfer", requireMember, async (c) =>
  run(c, async () => ({ squad: await transferLeader(memberId(c), (await body(c)).memberId) }))
)
rewardsRoute.post("/squads/mine/disband", requireMember, async (c) => run(c, () => disbandMySquad(memberId(c))))
rewardsRoute.post("/squads/mine/requests/:id/:decision", requireMember, async (c) => {
  const id = idParam(c)
  const decision = c.req.param("decision")
  if (!id || (decision !== "approve" && decision !== "reject")) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => decideRequest(memberId(c), id, decision === "approve"))
})

// 스쿼드 채팅 (팀원만) ?after=<마지막 id> 새 메시지, ?before=<첫 id> 이전 메시지
rewardsRoute.get("/squads/mine/messages", requireMember, async (c) => {
  const num = (v?: string) => (v && /^\d{1,18}$/.test(v) ? Number(v) : undefined)
  return run(c, () => listMessages(memberId(c), { after: num(c.req.query("after")), before: num(c.req.query("before")) }))
})
rewardsRoute.post("/squads/mine/messages", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-squad-chat", memberId(c), 30, 60))) return tooMany(c)
  return run(c, async () => postMessage(memberId(c), (await body(c)).body))
})
rewardsRoute.delete("/squads/mine/messages/:id", requireMember, async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => deleteMessage(memberId(c), id))
})

rewardsRoute.post("/squads/leave", requireMember, async (c) => run(c, () => leaveSquad(memberId(c))))

// 리더(또는 스쿼드를 만드는 회원): 스쿼드 아이콘 이미지 업로드 (squads/YYYY/MM/<uuid>.<ext>)
mountImageUploads(rewardsRoute, squadImages, {
  ticketPath: "/squads/uploads",
  localUploadPath: "/squads/uploads/local/",
  localServePath: "/squads/uploads/local/",
  serviceBasePath: "/api/rewards",
  guard: requireMember,
  beforeTicket: async (c) => {
    if (!(await consumeQuota("rewards-squad-upload", c.get("member").id, 20, 3600))) return tooMany(c)
    return (await canUploadSquadImage(c.get("member").id)) ? null : c.json({ success: false, error: "스쿼드 리더만 사진을 올릴 수 있습니다." }, 403)
  },
})

// 스쿼드 상세 (누구나) · 가입 신청/바로 가입 · 신청 취소
rewardsRoute.get("/squads/id/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => squadDetail(id, getOptionalMember(c)?.id ?? null))
})
rewardsRoute.post("/squads/id/:id/apply", requireMember, async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  if (!(await consumeQuota("rewards-squad-apply", memberId(c), 20, 3600))) return tooMany(c)
  return run(c, async () => {
    const r = await applyToSquad(memberId(c), id, (await body(c)).message)
    return r
  })
})
rewardsRoute.delete("/squads/id/:id/apply", requireMember, async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => cancelApplication(memberId(c), id))
})

// 초대 링크 미리보기 (누구나, 코드 맞히기 막기: IP 당 10분에 60번)
rewardsRoute.get("/squads/:code", async (c) => {
  if (!(await consumeQuota("rewards-squad-view", clientIp(c), 60, 600))) return tooMany(c)
  return run(c, async () => ({ squad: await squadPreview(c.req.param("code")) }))
})

rewardsRoute.post("/squads/:code/join", requireMember, async (c) => {
  if (!(await consumeQuota("rewards-squad-join", memberId(c), 20, 600))) return tooMany(c)
  return run(c, () => joinSquad(memberId(c), c.req.param("code")))
})

// ---- 관리자 ----

const admin = new Hono()
admin.use("*", requireAdmin)

admin.get("/codes", async (c) => c.json({ success: true, codes: await listCodes() }))
admin.post("/codes", async (c) => run(c, async () => ({ code: await createCode(validateCode(await body(c), false)) })))
admin.patch("/codes/:code", async (c) =>
  run(c, async () => ({ code: await updateCode(c.req.param("code").toUpperCase(), validateCode(await body(c), true)) }))
)
admin.delete("/codes/:code", async (c) => run(c, () => deleteCode(c.req.param("code").toUpperCase())))
admin.get("/codes/:code/redemptions", async (c) => run(c, async () => ({ redemptions: await codeRedemptions(c.req.param("code").toUpperCase()) })))

// 덕력 퀴즈: 주제 → 버전 → 문제 → 보기. 버전을 바꾸는 요청은 그 버전 전체를 다시 돌려줌
const versionReply = (c: Context, fn: () => Promise<number>) => run(c, async () => ({ version: await adminVersion(await fn()) }))
const withId = (c: Context, fn: (id: number) => Promise<unknown>) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return fn(id) as Promise<Response>
}
admin.get("/quiz/topics", async (c) => c.json({ success: true, topics: await adminTopics() }))
admin.post("/quiz/topics", async (c) => run(c, async () => ({ id: await createTopic(await body(c)), topics: await adminTopics() })))
admin.patch("/quiz/topics/:id", async (c) => withId(c, (id) => run(c, async () => (await updateTopic(id, await body(c)), { topics: await adminTopics() }))))
admin.delete("/quiz/topics/:id", async (c) => withId(c, (id) => run(c, async () => (await deleteTopic(id), { topics: await adminTopics() }))))
admin.post("/quiz/topics/:id/versions", async (c) =>
  withId(c, (id) => run(c, async () => ({ id: await createVersion(id, await body(c)), topics: await adminTopics() })))
)
admin.get("/quiz/versions/:id", async (c) => withId(c, (id) => run(c, async () => ({ version: await adminVersion(id) }))))
admin.patch("/quiz/versions/:id", async (c) => withId(c, (id) => versionReply(c, async () => (await updateVersion(id, await body(c)), id))))
admin.delete("/quiz/versions/:id", async (c) => withId(c, (id) => run(c, async () => (await deleteVersion(id), { topics: await adminTopics() }))))
admin.post("/quiz/versions/:id/items", async (c) => withId(c, (id) => versionReply(c, async () => createItem(id, await body(c)))))
admin.patch("/quiz/items/:id", async (c) => withId(c, (id) => versionReply(c, async () => updateItem(id, await body(c)))))
admin.delete("/quiz/items/:id", async (c) => withId(c, (id) => versionReply(c, () => deleteItem(id))))
admin.post("/quiz/items/:id/move", async (c) => withId(c, (id) => versionReply(c, async () => moveItem(id, (await body(c)).dir))))
admin.post("/quiz/items/:id/options", async (c) => withId(c, (id) => versionReply(c, async () => createOption(id, await body(c)))))
admin.patch("/quiz/options/:id", async (c) => withId(c, (id) => versionReply(c, async () => updateOption(id, await body(c)))))
admin.delete("/quiz/options/:id", async (c) => withId(c, (id) => versionReply(c, () => deleteOption(id))))

admin.route("/pilgrimage", pilgrimageAdminRoute)
admin.get("/squads/stats", async (c) => c.json({ success: true, stats: await squadStats() }))

// 스쿼드 관리: 목록·상세(팀원·활동 기록·채팅)·강제 이름 변경·숨김·해산·팀원 제외·채팅 삭제 (조치는 squad_admin_actions 에 기록)
const adminActor = (c: Context) => {
  const id = readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))?.memberId
  return id ? `admin:${id}` : "admin"
}
admin.get("/squads", async (c) => c.json({ success: true, ...(await adminListSquads(c.req.query("q"))) }))
admin.get("/squads/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => adminSquadDetail(id))
})
admin.patch("/squads/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, async () => adminUpdateSquad(id, await body(c), adminActor(c)))
})
admin.post("/squads/:id/disband", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, async () => adminDisbandSquad(id, (await body(c)).reason, adminActor(c)))
})
admin.post("/squads/:id/remove-member", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, async () => {
    const b = await body(c)
    return adminRemoveMember(id, b.memberId, b.reason, adminActor(c))
  })
})
admin.delete("/squads/messages/:id", async (c) => {
  const id = idParam(c)
  if (!id) return c.json({ success: false, error: "잘못된 요청입니다." }, 400)
  return run(c, () => adminDeleteMessage(id, adminActor(c)))
})

rewardsRoute.route("/admin", admin)

import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { getOptionalMember } from "../../shared/auth/require-member"
import { requireDatabase } from "../../shared/db/require-database"
import { adminInquiriesRoute, inquiriesRoute } from "./inquiries"
import { adminMallItemsRoute, mallItemsRoute } from "./mall-items"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { cleanAttachments, inquiryAttachments, mallImages } from "./storage"
import { adminContractsRoute } from "./contracts"
import { normalizeKeywords } from "./keywords"
import { flushOutbox } from "./mailer"
import {
  B2bError,
  createApplication,
  deleteApplication,
  getApplication,
  getSummary,
  listApplications,
  listOutbox,
  reviewApplication,
} from "./repository"
import { APPLICATION_STATUSES, NEXT_STATUSES, STATUS_LABELS } from "./status"
import { resultPage } from "./templates"
import { DATE_RE, todayKst } from "./time"
import { isEmail, validateApplication, validateReview } from "./validation"

// B2B 입점·광고 신청, 계약·광고 기간
// 공개: /api/b2b/applications, /api/b2b/inquiries (견적·제작 문의), /api/b2b/mall/items (덕지몰 품목)
// 관리자: /api/b2b/admin/* (docs/planning/관리자센터-기능정의서.md 4.5)
export const b2bRoute = new Hono()

b2bRoute.use("*", requireDatabase)

b2bRoute.onError((err, c) => {
  if (err instanceof B2bError) return c.json({ success: false, error: err.message }, err.status)
  throw err
})

const json = async (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const page = (c: Context) => ({
  limit: Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 200),
  offset: Math.max(Number(c.req.query("offset")) || 0, 0),
})
const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) throw new B2bError("잘못된 ID 입니다.", 404)
  return id
}
// 접수 확인 메일은 바로 보내도록 요청 끝에 한 번 발송 시도 (실패해도 응답은 그대로, 다음 스케줄에서 재시도)
const flushNow = () => flushOutbox().catch((e) => console.error("[b2b] outbox flush failed", e))

const dateQuery = (v: string | undefined) => {
  if (!v) return todayKst()
  if (!DATE_RE.test(v)) throw new B2bError("date 는 YYYY-MM-DD 형식이어야 합니다.")
  return v
}

// ------------------------------------------------------------------------------
// 공개
// ------------------------------------------------------------------------------

// 입점·광고 신청 (신청 페이지 /partners/apply). 포스터·시안 첨부는 견적 문의와 같은 비공개 저장소(/inquiries/uploads)
b2bRoute.post("/applications", async (c) => {
  if (!(await consumeQuota("b2b-application", clientIp(c), 10, 86400)))
    return c.json({ success: false, errors: ["신청이 너무 많습니다. 내일 다시 시도해 주세요."] }, 429)
  const body = await json(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  // 봇이 채우는 숨은 필드가 있으면 접수한 척만 함
  if (typeof body.website === "string" && body.website) return c.json({ success: true, application: null }, 201)
  const result = validateApplication(body, cleanAttachments(body.attachments, new URL(c.req.url).origin))
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const app = await createApplication(result.value)
  await flushNow()
  return c.json({ success: true, application: { id: app.id, code: app.code, status: app.status } }, 201)
})


// ------------------------------------------------------------------------------
// 관리자
// ------------------------------------------------------------------------------

const admin = new Hono()
admin.use("*", requireAdmin)

// 대시보드 대기 건수
admin.get("/summary", async (c) => c.json({ success: true, summary: await getSummary() }))

// 상태 이름·전환 규칙 (화면 버튼용)
admin.get("/statuses", (c) =>
  c.json({ success: true, statuses: APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], next: NEXT_STATUSES[s] })) })
)

// 비공개 첨부(포스터·시안)는 볼 때마다 1시간짜리 서명 주소로
const withSignedAttachments = async <T extends { attachments: string[] }>(a: T): Promise<T> =>
  a.attachments.length ? { ...a, attachments: await Promise.all(a.attachments.map((u) => inquiryAttachments.viewUrl(u))) } : a

admin.get("/applications", async (c) => {
  const result = await listApplications({ status: c.req.query("status") || undefined, q: c.req.query("q")?.trim() || undefined, ...page(c) })
  return c.json({ success: true, ...result, applications: await Promise.all(result.applications.map(withSignedAttachments)) })
})

admin.get("/applications/:id", async (c) => {
  const found = await getApplication(idParam(c))
  if (!found) return c.json({ success: false, error: "Not Found" }, 404)
  return c.json({ success: true, ...found, application: await withSignedAttachments(found.application) })
})

// 상태 변경(사유)·노출 위치·배포 기간·키워드·메모 수정
admin.patch("/applications/:id", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validateReview(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const application = await reviewApplication(idParam(c), result.value)
  await flushNow()
  return c.json({ success: true, application })
})

admin.delete("/applications/:id", async (c) => {
  const deleted = await deleteApplication(idParam(c), c.req.query("reason") || "")
  if (!deleted) return c.json({ success: false, error: "Not Found" }, 404)
  return c.json({ success: true })
})


// 발송 대기·이력 (SES 연결 전에는 여기 queued 로 쌓임)
admin.get("/outbox", async (c) => {
  const outbox = await listOutbox({ status: c.req.query("status") || undefined, kind: c.req.query("kind") || undefined, ...page(c) })
  return c.json({ success: true, outbox })
})

admin.post("/outbox/flush", async (c) => c.json({ success: true, mail: await flushOutbox() }))

// 계약·광고 기간 (contracts.ts)
admin.route("/contracts", adminContractsRoute)

// 견적·제작 문의 (inquiries.ts)
admin.route("/inquiries", adminInquiriesRoute)

// 덕지몰 품목 (mall-items.ts)
admin.route("/mall/items", adminMallItemsRoute)
b2bRoute.route("/mall/items", mallItemsRoute)

// 덕지몰 품목 사진 업로드 (관리자): POST /admin/mall/uploads { contentType, size }
mountImageUploads(b2bRoute, mallImages, {
  ticketPath: "/admin/mall/uploads",
  localUploadPath: "/admin/mall/uploads/local/",
  localServePath: "/mall/uploads/local/",
  serviceBasePath: "/api/b2b",
  guard: requireAdmin,
})

// 견적 요청 첨부(시안·참고 사진) 업로드: 비회원도 올리므로 IP 당 1시간 30장
mountImageUploads(b2bRoute, inquiryAttachments, {
  ticketPath: "/inquiries/uploads",
  localUploadPath: "/inquiries/uploads/local/",
  localServePath: "/inquiries/uploads/local/",
  serviceBasePath: "/api/b2b",
  beforeTicket: async (c) =>
    (await consumeQuota("b2b-inquiry-upload", clientIp(c), 30, 3600))
      ? null
      : c.json({ success: false, error: "사진은 1시간에 30장까지 올릴 수 있습니다. 잠시 뒤 다시 시도해 주세요." }, 429),
})

b2bRoute.route("/inquiries", inquiriesRoute)

b2bRoute.route("/admin", admin)

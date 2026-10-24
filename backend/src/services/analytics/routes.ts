import { Hono } from "hono"
import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireDatabase } from "../../shared/db/require-database"
import { analyticsRepository } from "./repository"
import { deviceFromUserAgent, isBot, parseDays, validateEvent } from "./validation"

// 방문 통계: 사이트가 보내는 방문·검색·가입 기록을 모으고, 관리자 센터 > 방문 통계에 보여 줍니다.
// 국가는 사이트 주소(www.duckji.com/api/...)로 들어올 때 CloudFront 가 붙여 주는 CloudFront-Viewer-Country 헤더로 알아냅니다.
export const analyticsRoute = new Hono()

analyticsRoute.use("*", requireDatabase)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 기록 (공개): { kind, visitorId, sessionId, path, referrer?, utmSource?, searchQuery?, lang? }
// 실패해도 화면에는 영향이 없도록 항상 202 로 답함
analyticsRoute.post("/events", async (c) => {
  const userAgent = c.req.header("user-agent") || ""
  if (isBot(userAgent)) return c.json({ success: true }, 202)
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validateEvent(body, {
    country: (c.req.header("cloudfront-viewer-country") || "").toUpperCase() || null,
    device: deviceFromUserAgent(userAgent),
    ownHost: "duckji.com",
  })
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  // 부풀리기 방지: IP 당 1시간 600번까지만 기록
  if (!(await consumeQuota("analytics", clientIp(c), 600, 3600))) return c.json({ success: true }, 202)
  await analyticsRepository.record(result.value)
  return c.json({ success: true }, 202)
})

// 요약 (관리자): ?days=1|7|30|90
analyticsRoute.get("/admin/summary", requireAdmin, async (c) => {
  return c.json({ success: true, ...(await analyticsRepository.summary(parseDays(c.req.query("days")))) })
})

// 최근 방문 목록 (관리자): ?days=7&limit=50&country=KR&signedUp=1
analyticsRoute.get("/admin/sessions", requireAdmin, async (c) => {
  const country = (c.req.query("country") || "").toUpperCase()
  const sessions = await analyticsRepository.sessions(parseDays(c.req.query("days")), {
    limit: Math.min(Math.max(Math.trunc(Number(c.req.query("limit"))) || 50, 1), 200),
    country: /^[A-Z]{2}$/.test(country) ? country : undefined,
    signedUpOnly: c.req.query("signedUp") === "1",
  })
  return c.json({ success: true, sessions })
})

// 한 방문의 이동 경로 (관리자)
analyticsRoute.get("/admin/sessions/:id", requireAdmin, async (c) => {
  const id = c.req.param("id")
  if (!UUID_RE.test(id)) return c.json({ success: false, error: "방문 id 가 올바르지 않습니다." }, 400)
  return c.json({ success: true, events: await analyticsRepository.sessionEvents(id) })
})

// 원본 기록 정리 (관리자): ?days=400 보다 오래된 기록 삭제 (최소 90일은 남김)
analyticsRoute.delete("/admin/events", requireAdmin, async (c) => {
  const days = Math.max(Math.trunc(Number(c.req.query("days"))) || 400, 90)
  return c.json({ success: true, deleted: await analyticsRepository.purgeOlderThan(days) })
})

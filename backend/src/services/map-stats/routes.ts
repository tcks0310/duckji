import { clientIp, consumeQuota } from "../../shared/db/rate-limit"
import { createHash } from "crypto"
import { Hono, type Context } from "hono"
import { config } from "../../shared/config"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireDatabase } from "../../shared/db/require-database"
import { mapStatsRepository } from "./repository"
import { parseRankingQuery, validateClick } from "./validation"

// 지도 클릭 집계와 인기 순위. 화면 배치는 기획·디자인 논의 후 정하고, 여기서는 데이터와 API 만 제공합니다.
export const mapStatsRoute = new Hono()

mapStatsRoute.use("*", requireDatabase)

// 방문자 식별값: IP·브라우저·날짜를 서버 비밀값과 함께 해시 (원래 IP 는 저장하지 않음)
function visitorHash(c: Context) {
  const ip = (c.req.header("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  const ua = c.req.header("user-agent") || ""
  const day = new Date().toISOString().slice(0, 10)
  return createHash("sha256").update(`${ip}|${ua}|${day}|${config.memberSessionSecret}`).digest("hex")
}

// 클릭 기록 (공개): { kind: "marker"|"map", popupId } 또는 { kind: "search", keyword }
mapStatsRoute.post("/clicks", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body) return c.json({ success: false, error: "JSON 본문이 필요합니다." }, 400)
  const result = validateClick(body)
  if (!result.ok) return c.json({ success: false, error: result.error }, 400)
  // 순위 조작 방지: IP 당 1시간 300번까지만 기록
  if (!(await consumeQuota("map-click", clientIp(c), 300, 3600))) return c.json({ success: true }, 202)
  await mapStatsRepository.recordClick(result.value, visitorHash(c))
  return c.json({ success: true }, 202)
})

// 인기 순위 (공개): ?type=popup|keyword&period=day|week|month&limit=3
// type=popup 은 마커·지도 클릭을 합쳐 셉니다
mapStatsRoute.get("/ranking", async (c) => {
  const { type, period, limit } = parseRankingQuery({
    type: c.req.query("type"),
    period: c.req.query("period"),
    limit: c.req.query("limit"),
  })
  const items = await mapStatsRepository.ranking(type === "keyword" ? ["search"] : ["marker", "map"], period, limit)
  c.header("Cache-Control", "public, max-age=60")
  return c.json({ success: true, type, period, items })
})

// 원본 기록 정리 (관리자): ?days=180 보다 오래된 기록 삭제
mapStatsRoute.delete("/clicks", requireAdmin, async (c) => {
  const days = Math.max(Math.trunc(Number(c.req.query("days"))) || 180, 31)
  return c.json({ success: true, deleted: await mapStatsRepository.purgeOlderThan(days) })
})

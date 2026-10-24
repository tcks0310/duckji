import { db } from "../../shared/db/require-database"
import type { EventInput } from "./types"

// 기간: 한국 시간 오늘 0시에서 (days - 1)일 전부터 지금까지
const SINCE = `(date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') - make_interval(days => $1::int - 1)) AT TIME ZONE 'Asia/Seoul'`

// 방문(세션)마다 첫 기록의 정보(들어온 페이지·국가·기기·유입 경로)와 활동 요약
const SESSIONS = `
  WITH ev AS (
    SELECT * FROM analytics.events WHERE created_at >= ${SINCE}
  ),
  first AS (
    SELECT DISTINCT ON (session_id) session_id, visitor_id, created_at AS started_at, path AS entry_path,
           country, device, lang, referrer_host, utm_source
    FROM ev ORDER BY session_id, created_at
  ),
  agg AS (
    SELECT session_id,
           MAX(created_at) AS ended_at,
           COUNT(*) FILTER (WHERE kind = 'pageview') AS pageviews,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT search_query), NULL) AS searches,
           BOOL_OR(kind = 'signup') AS signed_up
    FROM ev GROUP BY session_id
  ),
  sessions AS (
    SELECT f.*, a.ended_at, a.pageviews, a.searches, a.signed_up,
           COALESCE(f.utm_source, f.referrer_host, 'direct') AS source
    FROM first f JOIN agg a USING (session_id)
  )`

const num = (v: unknown) => Number(v) || 0

export const analyticsRepository = {
  async record(e: EventInput) {
    await db().query(
      `INSERT INTO analytics.events
         (kind, visitor_id, session_id, path, referrer_host, utm_source, search_query, country, device, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [e.kind, e.visitorId, e.sessionId, e.path, e.referrerHost, e.utmSource, e.searchQuery, e.country, e.device, e.lang]
    )
    // 보관 기간(13개월, 개인정보처리방침)이 지난 기록은 가끔 지움
    if (Math.random() < 0.001) this.purgeOlderThan(400).catch(() => {})
  },

  // 관리자 방문 통계 한 화면 분량
  async summary(days: number) {
    const q = <T extends Record<string, unknown>>(sql: string) => db().query<T>(sql, [days]).then((r) => r.rows)

    const [totals] = await q(`${SESSIONS}
      SELECT COUNT(DISTINCT visitor_id) AS visitors,
             COUNT(*) AS sessions,
             COALESCE(SUM(pageviews), 0) AS pageviews,
             COUNT(*) FILTER (WHERE signed_up) AS signup_sessions,
             COUNT(DISTINCT visitor_id) FILTER (WHERE signed_up) AS signup_visitors,
             (SELECT COUNT(*) FROM ev WHERE kind = 'search') AS searches,
             (SELECT COUNT(*) FROM ev WHERE kind = 'signup') AS signups
      FROM sessions`)

    const daily = await q(`${SESSIONS}
      SELECT to_char(started_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
             COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS sessions,
             COALESCE(SUM(pageviews), 0) AS pageviews, COUNT(*) FILTER (WHERE signed_up) AS signups
      FROM sessions GROUP BY 1 ORDER BY 1`)

    const hourly = await q(`${SESSIONS}
      SELECT EXTRACT(HOUR FROM started_at AT TIME ZONE 'Asia/Seoul')::int AS hour, COUNT(*) AS sessions
      FROM sessions GROUP BY 1 ORDER BY 1`)

    const countries = await q(`${SESSIONS}
      SELECT COALESCE(country, '??') AS country, COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS sessions,
             COUNT(*) FILTER (WHERE signed_up) AS signups
      FROM sessions GROUP BY 1 ORDER BY sessions DESC LIMIT 20`)

    const sources = await q(`${SESSIONS}
      SELECT source, COUNT(*) AS sessions, COUNT(*) FILTER (WHERE signed_up) AS signups
      FROM sessions GROUP BY 1 ORDER BY sessions DESC LIMIT 15`)

    const devices = await q(`${SESSIONS}
      SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS sessions FROM sessions GROUP BY 1 ORDER BY sessions DESC`)

    const pages = await q(`
      SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
      FROM analytics.events WHERE kind = 'pageview' AND created_at >= ${SINCE}
      GROUP BY path ORDER BY pageviews DESC LIMIT 20`)

    const searches = await q(`
      SELECT search_query AS query, COUNT(*) AS count, COUNT(DISTINCT visitor_id) AS visitors
      FROM analytics.events WHERE kind = 'search' AND created_at >= ${SINCE}
      GROUP BY search_query ORDER BY count DESC LIMIT 20`)

    const visitors = num(totals?.visitors)
    const signupVisitors = num(totals?.signup_visitors)
    return {
      days,
      totals: {
        visitors,
        sessions: num(totals?.sessions),
        pageviews: num(totals?.pageviews),
        searches: num(totals?.searches),
        signups: num(totals?.signups),
        signupVisitors,
        conversionRate: visitors ? Math.round((signupVisitors / visitors) * 1000) / 10 : 0,
      },
      daily: daily.map((r) => ({ date: String(r.date), visitors: num(r.visitors), sessions: num(r.sessions), pageviews: num(r.pageviews), signups: num(r.signups) })),
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: num(hourly.find((r) => num(r.hour) === hour)?.sessions) })),
      countries: countries.map((r) => ({ country: String(r.country), visitors: num(r.visitors), sessions: num(r.sessions), signups: num(r.signups) })),
      sources: sources.map((r) => ({ source: String(r.source), sessions: num(r.sessions), signups: num(r.signups) })),
      devices: devices.map((r) => ({ device: String(r.device), sessions: num(r.sessions) })),
      pages: pages.map((r) => ({ path: String(r.path), pageviews: num(r.pageviews), visitors: num(r.visitors) })),
      searches: searches.map((r) => ({ query: String(r.query), count: num(r.count), visitors: num(r.visitors) })),
    }
  },

  // 최근 방문 목록: 언제·어느 나라에서·어디로 들어와·무엇을 검색했고·가입했는지
  async sessions(days: number, options: { limit: number; country?: string; signedUpOnly?: boolean }) {
    const { rows } = await db().query(
      `${SESSIONS}
       SELECT s.*,
              EXISTS (SELECT 1 FROM analytics.events p WHERE p.visitor_id = s.visitor_id AND p.created_at < s.started_at) AS returning
       FROM sessions s
       WHERE ($3::char(2) IS NULL OR s.country = $3) AND (NOT $4::boolean OR s.signed_up)
       ORDER BY s.started_at DESC
       LIMIT $2`,
      [days, options.limit, options.country || null, Boolean(options.signedUpOnly)]
    )
    return rows.map((r) => ({
      sessionId: String(r.session_id),
      startedAt: r.started_at,
      endedAt: r.ended_at,
      country: r.country,
      device: r.device,
      lang: r.lang,
      entryPath: r.entry_path,
      source: r.source,
      pageviews: num(r.pageviews),
      searches: (r.searches as string[]) || [],
      signedUp: Boolean(r.signed_up),
      returning: Boolean(r.returning),
    }))
  },

  // 한 방문의 이동 경로
  async sessionEvents(sessionId: string) {
    const { rows } = await db().query(
      `SELECT kind, path, search_query, created_at FROM analytics.events WHERE session_id = $1 ORDER BY created_at LIMIT 300`,
      [sessionId]
    )
    return rows.map((r) => ({ kind: r.kind, path: r.path, searchQuery: r.search_query, at: r.created_at }))
  },

  // 오래된 원본 기록 정리 (관리자 수동 호출)
  async purgeOlderThan(days: number) {
    const { rowCount } = await db().query(`DELETE FROM analytics.events WHERE created_at < NOW() - make_interval(days => $1)`, [days])
    return rowCount || 0
  },
}

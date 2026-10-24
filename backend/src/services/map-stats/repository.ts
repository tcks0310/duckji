import { db } from "../../shared/db/require-database"
import type { ClickInput, ClickKind, RankingItem, RankingPeriod } from "./types"

const PERIOD_INTERVAL: Record<RankingPeriod, string> = { day: "1 day", week: "7 days", month: "30 days" }

export const mapStatsRepository = {
  // 같은 방문자가 같은 대상을 한 시간 안에 여러 번 눌러도 1번으로 셉니다 (순위 부풀리기 방지)
  async recordClick(input: ClickInput, visitorHash: string) {
    await db().query(
      `INSERT INTO map_stats.clicks (kind, target, visitor_hash, bucket_hour)
       VALUES ($1, $2, $3, date_trunc('hour', NOW()))
       ON CONFLICT (kind, target, visitor_hash, bucket_hour) DO NOTHING`,
      [input.kind, input.target, visitorHash]
    )
  },

  async ranking(kinds: ClickKind[], period: RankingPeriod, limit: number): Promise<RankingItem[]> {
    const { rows } = await db().query<{ target: string; clicks: string; visitors: string }>(
      `SELECT target, COUNT(*) AS clicks, COUNT(DISTINCT visitor_hash) AS visitors
       FROM map_stats.clicks
       WHERE kind = ANY($1) AND created_at >= NOW() - $2::interval
       GROUP BY target
       ORDER BY clicks DESC, visitors DESC, target
       LIMIT $3`,
      [kinds, PERIOD_INTERVAL[period], limit]
    )
    return rows.map((r, i) => ({ rank: i + 1, target: r.target, clicks: Number(r.clicks), visitors: Number(r.visitors) }))
  },

  // 오래된 원본 기록 정리 (관리자 수동 호출)
  async purgeOlderThan(days: number) {
    const { rowCount } = await db().query(`DELETE FROM map_stats.clicks WHERE created_at < NOW() - make_interval(days => $1)`, [days])
    return rowCount || 0
  },
}

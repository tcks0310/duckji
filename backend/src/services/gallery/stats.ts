import { createHash } from "crypto"
import { db } from "../../shared/db/require-database"
import { GalleryError, KST_TODAY } from "./util"

// 갤러리 통계: 날짜별(한국 시간) 방문자(같은 사람은 하루 한 번)·조회·글·댓글·덕업
// 방문은 갤러리 화면·글 화면을 열 때 기록. 방문자 키는 회원 id 또는 IP·브라우저를 해시한 값이라 원래 값은 남지 않음

export const visitorKey = (memberId: string | null, ip: string, userAgent: string) =>
  createHash("md5").update(memberId ? `m:${memberId}` : `a:${ip}|${userAgent}`).digest("hex")

export async function recordVisit(galleryId: number, visitor: string) {
  await db().query(
    `INSERT INTO gallery.daily_visitors (gallery_id, day, visitor) VALUES ($1, ${KST_TODAY}, $2) ON CONFLICT DO NOTHING`,
    [galleryId, visitor]
  )
  await db().query(
    `INSERT INTO gallery.daily_views (gallery_id, day, views) VALUES ($1, ${KST_TODAY}, 1)
     ON CONFLICT (gallery_id, day) DO UPDATE SET views = gallery.daily_views.views + 1`,
    [galleryId]
  )
  // 가끔 2년 지난 방문자 기록을 지움 (일별 합계는 daily_views 와 글·댓글 표로 남음)
  if (Math.random() < 0.001) db().query("DELETE FROM gallery.daily_visitors WHERE day < CURRENT_DATE - 800").catch(() => {})
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// 기간 통계 { from, to: YYYY-MM-DD (한국 날짜, 포함) }, galleryId 없으면 전체. 92일 넘으면 달 단위로 묶음
export async function rangeStats(opts: { galleryId: number | null; from: string; to: string }) {
  if (!DAY_RE.test(opts.from) || !DAY_RE.test(opts.to) || opts.from > opts.to) throw new GalleryError(400, "기간을 다시 골라 주세요.")
  const days = (Date.parse(opts.to) - Date.parse(opts.from)) / 86400000 + 1
  if (days > 3700) throw new GalleryError(400, "기간은 10년 안으로 골라 주세요.")
  const unit = days > 92 ? "month" : "day"
  const bucket = (col: string) => (unit === "month" ? `to_char(${col}, 'YYYY-MM')` : `to_char(${col}, 'YYYY-MM-DD')`)
  const kstDay = (col: string) => `(${col} AT TIME ZONE 'Asia/Seoul')::date`
  const g = opts.galleryId
  const params = [opts.from, opts.to, g]
  const gCond = (col: string) => `($3::bigint IS NULL OR ${col} = $3)`

  const [visitors, views, posts, comments, ups, top] = await Promise.all([
    db().query(
      `SELECT ${bucket("day")} AS b, count(*)::int AS n FROM gallery.daily_visitors
       WHERE day BETWEEN $1 AND $2 AND ${gCond("gallery_id")} GROUP BY b`,
      params
    ),
    db().query(
      `SELECT ${bucket("day")} AS b, sum(views)::int AS n FROM gallery.daily_views
       WHERE day BETWEEN $1 AND $2 AND ${gCond("gallery_id")} GROUP BY b`,
      params
    ),
    db().query(
      `SELECT ${bucket(kstDay("created_at"))} AS b, count(*)::int AS n FROM gallery.posts
       WHERE ${kstDay("created_at")} BETWEEN $1 AND $2 AND status <> 'deleted' AND ${gCond("gallery_id")} GROUP BY b`,
      params
    ),
    db().query(
      `SELECT ${bucket(kstDay("c.created_at"))} AS b, count(*)::int AS n FROM gallery.comments c JOIN gallery.posts p ON p.id = c.post_id
       WHERE ${kstDay("c.created_at")} BETWEEN $1 AND $2 AND c.status <> 'deleted' AND ${gCond("p.gallery_id")} GROUP BY b`,
      params
    ),
    db().query(
      `SELECT ${bucket(kstDay("r.created_at"))} AS b, count(*) FILTER (WHERE r.value = 1)::int AS n
       FROM gallery.post_reactions r JOIN gallery.posts p ON p.id = r.post_id
       WHERE ${kstDay("r.created_at")} BETWEEN $1 AND $2 AND ${gCond("p.gallery_id")} GROUP BY b`,
      params
    ),
    // 기간 안 갤러리별 순위 (전체 보기일 때)
    g
      ? Promise.resolve({ rows: [] as any[] })
      : db().query(
          `SELECT gl.id, gl.name, gr.name AS group_name,
                  COALESCE((SELECT count(*) FROM gallery.daily_visitors v WHERE v.gallery_id = gl.id AND v.day BETWEEN $1 AND $2), 0)::int AS visitors,
                  COALESCE((SELECT count(*) FROM gallery.posts p WHERE p.gallery_id = gl.id AND p.status <> 'deleted'
                            AND ${kstDay("p.created_at")} BETWEEN $1 AND $2), 0)::int AS posts,
                  COALESCE((SELECT count(*) FROM gallery.comments c JOIN gallery.posts p ON p.id = c.post_id WHERE p.gallery_id = gl.id
                            AND c.status <> 'deleted' AND ${kstDay("c.created_at")} BETWEEN $1 AND $2), 0)::int AS comments
           FROM gallery.galleries gl LEFT JOIN gallery.groups gr ON gr.id = gl.group_id
           WHERE gl.status <> 'closed' AND $3::bigint IS NULL
           ORDER BY visitors DESC, posts DESC, gl.sort_order`,
          params
        ),
  ])

  // 빈 칸까지 채운 축
  const labels: string[] = []
  const d = new Date(`${opts.from}T00:00:00Z`)
  const end = new Date(`${opts.to}T00:00:00Z`)
  while (d <= end) {
    const label = unit === "month" ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10)
    if (labels[labels.length - 1] !== label) labels.push(label)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  const pick = (rows: any[]) => {
    const m = new Map(rows.map((r) => [r.b as string, Number(r.n) || 0]))
    return labels.map((l) => m.get(l) ?? 0)
  }
  const series = {
    visitors: pick(visitors.rows),
    views: pick(views.rows),
    posts: pick(posts.rows),
    comments: pick(comments.rows),
    ups: pick(ups.rows),
  }
  const sum = (a: number[]) => a.reduce((s, n) => s + n, 0)
  return {
    unit,
    labels,
    series,
    totals: Object.fromEntries(Object.entries(series).map(([k, v]) => [k, sum(v)])),
    galleries: top.rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name as string,
      groupName: (r.group_name || "") as string,
      visitors: r.visitors as number,
      posts: r.posts as number,
      comments: r.comments as number,
    })),
  }
}

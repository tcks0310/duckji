import { db } from "../../shared/db/require-database"
import { setCommentStatus } from "./comments"
import { setPostStatus } from "./posts"
import { GalleryError, iso } from "./util"

// 신고 (글·댓글·회원). 같은 사람은 같은 대상을 한 번만
// 글·댓글이 서로 다른 회원에게 AUTO_HIDE_REPORTS 번 신고되면 관리자가 보기 전까지 자동으로 가림 (임시조치)
export const REPORT_REASONS = ["spam", "abuse", "adult", "copyright", "privacy", "impersonation", "etc"] as const
export const AUTO_HIDE_REPORTS = 5

type Target = "post" | "comment" | "member"

export async function createReport(input: { targetType: Target; targetId: string; reporterId: string; reason: string; detail: string }) {
  if (input.targetType === "member" && input.targetId === input.reporterId) throw new GalleryError(400, "나를 신고할 수는 없습니다.")
  const { rowCount } = await db().query(
    `INSERT INTO gallery.reports (target_type, target_id, reporter_id, reason, detail) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (target_type, target_id, reporter_id) DO NOTHING`,
    [input.targetType, input.targetId, input.reporterId, input.reason, input.detail]
  )
  const created = (rowCount ?? 0) > 0
  if (created && input.targetType !== "member") {
    const { rows } = await db().query(
      "SELECT count(*)::int AS n FROM gallery.reports WHERE target_type = $1 AND target_id = $2 AND status = 'open'",
      [input.targetType, input.targetId]
    )
    if (rows[0].n >= AUTO_HIDE_REPORTS) {
      const id = Number(input.targetId)
      if (input.targetType === "post") await setPostStatus(id, "hidden")
      else await setCommentStatus(id, "hidden")
    }
  }
  return created
}

// 관리자: 대상별로 묶은 신고 목록
export async function listReports(status: "open" | "actioned" | "dismissed") {
  const { rows } = await db().query(
    `SELECT r.target_type, r.target_id, count(*)::int AS report_count, array_agg(DISTINCT r.reason) AS reasons,
            array_agg(r.detail ORDER BY r.created_at) FILTER (WHERE r.detail <> '') AS details,
            min(r.created_at) AS first_at, max(r.created_at) AS last_at,
            COALESCE(p.title, left(c.body, 100), u.name) AS preview,
            COALESCE(p.author_id, c.author_id, u.id) AS author_id,
            COALESCE(p.author_name, c.author_name, u.name) AS author_name,
            COALESCE(p.id, c.post_id) AS post_id,
            COALESCE(p.status, c.status, u.status) AS target_status,
            g.name AS gallery_name,
            (p.media -> 0 ->> 'url') AS cover_url
     FROM gallery.reports r
     LEFT JOIN gallery.posts p ON r.target_type = 'post' AND p.id::text = r.target_id
     LEFT JOIN gallery.comments c ON r.target_type = 'comment' AND c.id::text = r.target_id
     LEFT JOIN gallery.posts cp ON cp.id = COALESCE(p.id, c.post_id)
     LEFT JOIN gallery.galleries g ON g.id = cp.gallery_id
     LEFT JOIN dukji_users u ON r.target_type = 'member' AND u.id = r.target_id
     WHERE r.status = $1
     GROUP BY r.target_type, r.target_id, p.title, c.body, u.name, p.author_id, c.author_id, u.id, p.author_name, c.author_name,
              p.id, c.post_id, p.status, c.status, u.status, g.name, p.media
     ORDER BY count(*) DESC, min(r.created_at)
     LIMIT 200`,
    [status]
  )
  return rows.map((r: any) => ({
    targetType: r.target_type as Target,
    targetId: r.target_id as string,
    postId: r.post_id === null ? null : Number(r.post_id),
    reportCount: r.report_count as number,
    reasons: r.reasons as string[],
    details: (r.details || []) as string[],
    preview: (r.preview || "") as string,
    authorId: r.author_id as string | null,
    authorName: r.author_name as string | null,
    targetStatus: r.target_status as string | null,
    galleryName: r.gallery_name as string | null,
    coverUrl: r.cover_url as string | null,
    firstReportedAt: iso(r.first_at)!,
    lastReportedAt: iso(r.last_at)!,
  }))
}

// 관리자 처리: hide(가림, 회원 신고는 '조치함'으로만), dismiss(문제없음 — 자동으로 가려졌던 글·댓글은 다시 보임)
export async function resolveReports(targetType: Target, targetId: string, action: "hide" | "dismiss", note: string) {
  if (targetType !== "member") {
    const id = Number(targetId)
    if (!Number.isSafeInteger(id)) throw new GalleryError(400, "대상이 올바르지 않습니다.")
    const set = targetType === "post" ? setPostStatus : setCommentStatus
    const table = targetType === "post" ? "gallery.posts" : "gallery.comments"
    const { rows } = await db().query(`SELECT status FROM ${table} WHERE id = $1`, [id])
    const status = rows[0]?.status
    // 숨김은 게시 중인 것만, 문제없음은 (자동으로) 가려졌던 것만 되돌림. 작성자가 지운 것은 그대로
    if (action === "hide" && status === "published") await set(id, "hidden")
    if (action === "dismiss" && status === "hidden") await set(id, "published")
  }
  const { rowCount } = await db().query(
    `UPDATE gallery.reports SET status = $3, admin_note = $4, handled_at = NOW()
     WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
    [targetType, targetId, action === "hide" ? "actioned" : "dismissed", note.slice(0, 500)]
  )
  return rowCount ?? 0
}

export async function openReportCount() {
  const { rows } = await db().query("SELECT count(DISTINCT (target_type, target_id))::int AS n FROM gallery.reports WHERE status = 'open'")
  return rows[0].n as number
}

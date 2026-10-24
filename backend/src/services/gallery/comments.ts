import { db } from "../../shared/db/require-database"
import { creditComment, restoreFor, revokeFor } from "./duckryeok"
import { withAuthors } from "./posts"
import { ADMIN_AUTHOR, GalleryError, iso, tx, type Actor } from "./util"

// 댓글 (답글은 한 단계). 지우거나 숨겨도 행은 남기고 글자만 가림
export const MAX_COMMENT = 1000
const MIN_COMMENT_FOR_DUCKRYEOK = 2 // 너무 짧은 댓글은 저장은 되지만 덕력 없음

const toComment = (r: any) => ({
  id: Number(r.id),
  postId: Number(r.post_id),
  parentId: r.parent_id === null ? null : Number(r.parent_id),
  authorId: r.author_id as string,
  authorName: r.author_name as string,
  isStaff: r.is_staff as boolean,
  body: r.status === "published" ? (r.body as string) : r.status === "hidden" ? "운영 정책에 따라 숨겨진 댓글입니다." : "삭제된 댓글입니다.",
  status: r.status as "published" | "hidden" | "deleted",
  createdAt: iso(r.created_at)!,
})

export async function listComments(postId: number) {
  const { rows } = await db().query("SELECT * FROM gallery.comments WHERE post_id = $1 ORDER BY created_at, id LIMIT 1000", [postId])
  return withAuthors(rows.map(toComment))
}

export async function getComment(id: number) {
  const { rows } = await db().query("SELECT * FROM gallery.comments WHERE id = $1", [id])
  return rows[0] ? toComment(rows[0]) : null
}

export async function lastCommentAt(authorId: string) {
  const { rows } = await db().query("SELECT max(created_at) AS at FROM gallery.comments WHERE author_id = $1", [authorId])
  return rows[0]?.at as Date | null
}

export async function createComment(post: { id: number; authorId: string }, author: Actor, body: string, parentId: number | null) {
  return tx(async (client) => {
    let parent: number | null = null
    if (parentId) {
      const { rows } = await client.query("SELECT id, parent_id, post_id FROM gallery.comments WHERE id = $1", [parentId])
      if (!rows[0] || Number(rows[0].post_id) !== post.id) throw new GalleryError(400, "답글을 달 댓글을 찾을 수 없습니다.")
      parent = rows[0].parent_id ? Number(rows[0].parent_id) : Number(rows[0].id)
    }
    const { rows } = await client.query(
      "INSERT INTO gallery.comments (post_id, parent_id, author_id, author_name, is_staff, body) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [post.id, parent, author.id, author.name, author.isStaff, body]
    )
    await client.query("UPDATE gallery.posts SET comment_count = comment_count + 1 WHERE id = $1", [post.id])
    const comment = toComment(rows[0])
    let earned = 0
    if (author.id !== ADMIN_AUTHOR.id && body.replace(/\s/g, "").length >= MIN_COMMENT_FOR_DUCKRYEOK) {
      earned = await creditComment(client, author.id, comment.id)
    }
    return { comment, earned }
  })
}

export async function setCommentStatus(id: number, status: "published" | "hidden" | "deleted") {
  return tx(async (client) => {
    const { rows } = await client.query("SELECT author_id, post_id, status FROM gallery.comments WHERE id = $1 FOR UPDATE", [id])
    const cur = rows[0]
    if (!cur || cur.status === status) return false
    await client.query("UPDATE gallery.comments SET status = $2 WHERE id = $1", [id, status])
    if (status === "published") {
      await client.query("UPDATE gallery.posts SET comment_count = comment_count + 1 WHERE id = $1", [cur.post_id])
      await restoreFor(client, cur.author_id, "comment", id)
    } else if (cur.status === "published") {
      await client.query("UPDATE gallery.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1", [cur.post_id])
      await revokeFor(client, cur.author_id, "comment", id)
    }
    return true
  })
}

// 내 댓글 (내 홈)
export async function listMyComments(authorId: string, limit: number) {
  const { rows } = await db().query(
    `SELECT c.*, p.title AS post_title FROM gallery.comments c JOIN gallery.posts p ON p.id = c.post_id
     WHERE c.author_id = $1 AND c.status = 'published' AND p.status = 'published'
     ORDER BY c.created_at DESC LIMIT $2`,
    [authorId, limit]
  )
  return rows.map((r: any) => ({ ...toComment(r), postTitle: r.post_title as string }))
}

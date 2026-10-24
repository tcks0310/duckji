import { db } from "../../shared/db/require-database"
import type { PartyPost } from "./types"

// party 가 다른 서비스 소유 테이블(gallery)에 닿는 곳은 이 파일에만 모아 둡니다.
// DB 를 분리하면 이 파일만 gallery API 호출로 바꾸면 됩니다.

// 연결 갤러리를 정하지 않은 이벤트의 "파티할래요?" 글은 덕지 갤러리 스토어 > 펀딩 모집 갤러리에 씀 (hj 10-18)
// 그 갤러리가 없으면 예전처럼 스쿼드 > 스쿼드 구하기. 예전에 스쿼드 구하기에 쓴 글도 계속 연결할 수 있음
export const PARTY_GALLERY_SLUG = "store-funding-recruit"
export const LEGACY_PARTY_GALLERY_SLUG = "squad-recruit"

export async function defaultPartyGallerySlug(): Promise<string> {
  const { rows } = await db().query(`SELECT 1 FROM gallery.galleries WHERE slug = $1`, [PARTY_GALLERY_SLUG])
  return rows.length ? PARTY_GALLERY_SLUG : LEGACY_PARTY_GALLERY_SLUG
}

// gallery.posts 의 게시 중인 글과 그 글이 있는 갤러리
export async function getBoardPost(postId: number): Promise<{ id: number; authorId: string; gallerySlug: string } | null> {
  const { rows } = await db().query(
    `SELECT p.id, p.author_id, g.slug FROM gallery.posts p
     JOIN gallery.galleries g ON g.id = p.gallery_id
     WHERE p.id = $1 AND p.status = 'published'`,
    [postId]
  )
  return rows[0] ? { id: Number(rows[0].id), authorId: rows[0].author_id, gallerySlug: rows[0].slug } : null
}

// 이벤트에 연결된 게시 중인 글 목록 (최신순)
export async function listEventBoardPosts(eventId: number, limit: number): Promise<PartyPost[]> {
  const { rows } = await db().query(
    `SELECT p.id, p.head, p.title, p.author_id, p.author_name, p.up_count AS vote_count, p.comment_count, p.created_at
     FROM party.event_posts ep
     JOIN gallery.posts p ON p.id = ep.post_id AND p.status = 'published'
     WHERE ep.event_id = $1
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $2`,
    [eventId, limit]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    head: r.head,
    title: r.title,
    authorId: r.author_id,
    authorName: r.author_name,
    voteCount: r.vote_count,
    commentCount: r.comment_count,
    createdAt: r.created_at.toISOString(),
  }))
}

// 이벤트별 게시 중인 글 수 (목록용, SELECT ... FROM party.events e 안에서 사용)
export const POST_COUNT_SQL = `(SELECT COUNT(*) FROM party.event_posts ep
  JOIN gallery.posts p ON p.id = ep.post_id AND p.status = 'published'
  WHERE ep.event_id = e.id)`

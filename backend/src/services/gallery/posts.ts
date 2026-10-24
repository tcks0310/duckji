import { buildTextSearch, normalizeSearchQuery } from "../../shared/search/text-search"
import { db } from "../../shared/db/require-database"
import { applyReaction, creditPost, getDuckryeok, levelOf, restoreFor, revokeFor } from "./duckryeok"
import { getPollsForPosts, savePoll, type PollInput } from "./polls"
import { getAuthorSquads, getMemberCards, getMemberSquad, type AuthorSquad } from "./shared-tables"
import { MAX_MEDIA, isOwnMediaUrl, media, mediaTypeOf } from "./storage"
import type { Gallery } from "./tree"
import { ADMIN_AUTHOR, GalleryError, iso, str, tx, type Actor, type Q } from "./util"

// 덕지 갤러리 글 (사진·동영상 위주). 글 목록은 사진 바둑판(grid) 또는 목록(list)으로 보여 줌

export const MAX_BODY = 5000
export const MAX_LINKS = 5
export const MAX_TAGS = 10

export interface MediaItem {
  type: "image" | "video"
  url: string
}

export interface LinkItem {
  url: string
  label: string
}

const SUMMARY_COLUMNS = `p.id, p.gallery_id, g.slug AS gallery_slug, g.name AS gallery_name, p.author_id, p.author_name, p.is_staff,
  p.squad_id, p.squad_name, p.head, p.title, left(p.body, 140) AS excerpt, p.media, p.hashtags, p.is_notice, p.status,
  p.view_count, p.up_count, p.down_count, p.comment_count, p.created_at, p.updated_at,
  EXISTS (SELECT 1 FROM gallery.polls pl WHERE pl.post_id = p.id) AS has_poll`

const FROM = "FROM gallery.posts p JOIN gallery.galleries g ON g.id = p.gallery_id"

const toSummary = (r: any) => {
  const items = (r.media || []) as MediaItem[]
  return {
    id: Number(r.id),
    galleryId: Number(r.gallery_id),
    gallerySlug: r.gallery_slug as string,
    galleryName: r.gallery_name as string,
    authorId: r.author_id as string,
    authorName: r.author_name as string,
    isStaff: r.is_staff as boolean,
    postedAsSquad: r.squad_id ? { id: Number(r.squad_id), name: r.squad_name as string } : null,
    head: r.head as string,
    title: r.title as string,
    excerpt: (r.excerpt || "") as string,
    cover: items[0] ?? null,
    mediaCount: items.length,
    hashtags: (r.hashtags || []) as string[],
    isNotice: r.is_notice as boolean,
    status: r.status as "published" | "hidden" | "deleted",
    hasPoll: Boolean(r.has_poll),
    viewCount: Number(r.view_count),
    upCount: r.up_count as number,
    downCount: r.down_count as number,
    commentCount: r.comment_count as number,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  }
}

export type PostSummary = ReturnType<typeof toSummary>

// 글쓴이 표시용: 프로필 사진·덕력 레벨·스쿼드 배지
export async function withAuthors<T extends { authorId: string }>(items: T[]) {
  const ids = items.map((i) => i.authorId)
  const [cards, duck, squads] = await Promise.all([getMemberCards(ids), getDuckryeok(ids), getAuthorSquads(ids)])
  return items.map((i) => {
    const level = i.authorId === "admin" ? null : levelOf(duck.get(i.authorId) ?? 0)
    return {
      ...i,
      authorAvatarUrl: cards.get(i.authorId)?.avatarUrl ?? null,
      authorLevel: level ? { level: level.level, title: level.title } : null,
      authorSquad: (squads.get(i.authorId) ?? null) as AuthorSquad | null,
    }
  })
}

// ---------------- 입력 검사 ----------------

const TAG_RE = /#([\p{L}\p{N}_]{1,20})/gu
export const normalizeTag = (v: string) =>
  v
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 20)

// 본문의 #태그 + 따로 넣은 태그 (중복 없이 최대 10개)
export function collectTags(body: string, extra: unknown): string[] {
  const fromBody = [...body.matchAll(TAG_RE)].map((m) => m[1])
  const given = Array.isArray(extra) ? extra.filter((t): t is string => typeof t === "string") : []
  return [...new Set([...given, ...fromBody].map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS)
}

// SNS 이름 자동 표시
const SNS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "인스타그램"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "유튜브"],
  [/(^|\.)tiktok\.com$/, "틱톡"],
  [/(^|\.)threads\.(net|com)$/, "스레드"],
  [/(^|\.)facebook\.com$/, "페이스북"],
  [/(^|\.)blog\.naver\.com$/, "네이버 블로그"],
  [/(^|\.)pixiv\.net$/, "픽시브"],
]
export function snsLabel(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return SNS.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "")
  } catch {
    return "링크"
  }
}

export function cleanLinks(v: unknown): LinkItem[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new GalleryError(400, "링크 형식이 올바르지 않습니다.")
  const links = v
    .map((l) => (typeof l === "string" ? { url: l } : l))
    .map((l: any) => ({ url: typeof l?.url === "string" ? l.url.trim() : "", label: typeof l?.label === "string" ? l.label.trim().slice(0, 30) : "" }))
    .filter((l) => l.url)
  if (links.length > MAX_LINKS) throw new GalleryError(400, `링크는 ${MAX_LINKS}개까지 넣을 수 있습니다.`)
  for (const l of links) {
    if (l.url.length > 500 || !/^https?:\/\/[^\s<>"]+$/i.test(l.url)) throw new GalleryError(400, "링크는 http:// 나 https:// 로 시작하는 주소여야 합니다.")
    if (!l.label) l.label = snsLabel(l.url)
  }
  return links
}

export function cleanMedia(v: unknown): MediaItem[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new GalleryError(400, "첨부 형식이 올바르지 않습니다.")
  const urls = v.map((m: any) => (typeof m === "string" ? m : m?.url)).filter((u): u is string => typeof u === "string" && u.length > 0)
  if (urls.length > MAX_MEDIA) throw new GalleryError(400, `사진·동영상은 합쳐서 ${MAX_MEDIA}개까지 올릴 수 있습니다.`)
  if (urls.some((u) => !isOwnMediaUrl(u))) throw new GalleryError(400, "첨부 파일 주소가 올바르지 않습니다. 다시 올려 주세요.")
  return [...new Set(urls)].map((url) => ({ type: mediaTypeOf(url), url: media.canonicalUrl(url) }))
}

export interface PostInput {
  head: string
  title: string
  body: string
  media: MediaItem[]
  links: LinkItem[]
  hashtags: string[]
}

export function validatePost(body: Record<string, unknown>, gallery: Gallery): PostInput {
  const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n").trim() : ""
  const value: PostInput = {
    head: str(body.head) || gallery.heads[0] || "",
    title: str(body.title).replace(/\s+/g, " "),
    body: text,
    media: cleanMedia(body.media),
    links: cleanLinks(body.links),
    hashtags: collectTags(text, body.hashtags),
  }
  if (gallery.heads.length && !gallery.heads.includes(value.head)) throw new GalleryError(400, "말머리를 골라 주세요.")
  if (!gallery.heads.length) value.head = ""
  if (!value.title || value.title.length > 100) throw new GalleryError(400, "제목은 1~100자로 써 주세요.")
  if (value.body.length > MAX_BODY) throw new GalleryError(400, `내용은 ${MAX_BODY.toLocaleString()}자까지 쓸 수 있습니다.`)
  if (/data:[^;\s]+;base64,/i.test(value.body)) throw new GalleryError(400, "사진은 본문에 붙여넣지 말고 첨부해 주세요.")
  // 사진 갤러리는 사진·동영상이 하나 이상 있어야 함
  if (gallery.layout === "grid" && !value.media.length) throw new GalleryError(400, "사진이나 동영상을 하나 이상 올려 주세요.")
  if (!value.body && !value.media.length) throw new GalleryError(400, "내용을 써 주세요.")
  return value
}

// ---------------- 목록 ----------------

export interface FeedFilter {
  galleryId?: number | null
  tag?: string | null
  authorId?: string | null
  squadId?: number | null
  includeNotices?: boolean // 갤러리 화면은 공지를 따로 위에 보여 주므로 빼고 셈
  cursor?: string | null
  limit: number
}

export const encodeCursor = (p: { createdAt: string; id: number }) => Buffer.from(`${p.createdAt}_${p.id}`).toString("base64url")
const decodeCursor = (cursor: string) => {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("_")
  return createdAt && /^\d+$/.test(id || "") && !Number.isNaN(Date.parse(createdAt)) ? { createdAt, id } : null
}

// 공개 피드: 열린 갤러리의 게시 중인 글, 최신순 (커서)
export async function listFeed(f: FeedFilter) {
  const cursor = f.cursor ? decodeCursor(f.cursor) : null
  const params: unknown[] = []
  const p = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }
  const where = ["p.status = 'published'", "g.status <> 'closed'"]
  if (f.galleryId) where.push(`p.gallery_id = ${p(f.galleryId)}`)
  else where.push("g.group_id IS NOT NULL")
  if (f.tag) where.push(`p.hashtags @> ARRAY[${p(f.tag)}]::text[]`)
  if (f.authorId) where.push(`p.author_id = ${p(f.authorId)}`)
  if (f.squadId) where.push(`p.squad_id = ${p(f.squadId)}`)
  if (!f.includeNotices) where.push("NOT p.is_notice")
  if (cursor) where.push(`(p.created_at, p.id) < (${p(cursor.createdAt)}::timestamptz, ${p(cursor.id)}::bigint)`)
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS} ${FROM} WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC, p.id DESC LIMIT ${p(f.limit + 1)}`,
    params
  )
  const posts = rows.slice(0, f.limit).map(toSummary)
  return { posts: await withAuthors(posts), nextCursor: rows.length > f.limit ? encodeCursor(posts[posts.length - 1]) : null }
}

// 갤러리 공지 (위에 고정)
export async function listNotices(galleryId: number, limit = 5) {
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS} ${FROM} WHERE p.gallery_id = $1 AND p.status = 'published' AND p.is_notice
     ORDER BY p.created_at DESC LIMIT $2`,
    [galleryId, limit]
  )
  return withAuthors(rows.map(toSummary))
}

// 첫 화면 공지: 공지 갤러리(관리자만 쓰는 목록형 갤러리)의 최근 글 + 공지로 고정한 글
export async function listHomeNotices(limit = 3) {
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS} ${FROM}
     WHERE p.status = 'published' AND g.status = 'active' AND g.group_id IS NOT NULL
       AND (p.is_notice OR (g.write_role = 'admin' AND g.layout = 'list'))
     ORDER BY p.created_at DESC LIMIT $1`,
    [limit]
  )
  return rows.map(toSummary)
}

// 핫 게시글 점수: 덕업 3, 덕다운 -2, 댓글 2, 조회 0.1 (최근 글일수록 유리)
const HOT_SCORE = `((p.up_count * 3 - p.down_count * 2 + p.comment_count * 2 + p.view_count * 0.1)
  / power(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 0.8))`

// 오늘의 핫 게시글: 최근 24시간 글 중 점수 순 (글이 적으면 7일로 넓힘)
export async function listHot(limit: number, galleryId?: number | null) {
  const run = async (hours: number) => {
    const params: unknown[] = [hours, limit]
    const galleryCond = galleryId ? `AND p.gallery_id = $3` : "AND g.group_id IS NOT NULL"
    if (galleryId) params.push(galleryId)
    const { rows } = await db().query(
      `SELECT ${SUMMARY_COLUMNS}, ${HOT_SCORE} AS hot ${FROM}
       WHERE p.status = 'published' AND g.status <> 'closed' AND NOT p.is_notice ${galleryCond}
         AND p.created_at > NOW() - make_interval(hours => $1::int)
         AND (p.up_count + p.comment_count + p.view_count) > 0
       ORDER BY hot DESC, p.id DESC LIMIT $2`,
      params
    )
    return rows.map(toSummary)
  }
  let posts = await run(24)
  if (posts.length < Math.min(4, limit)) posts = await run(24 * 7)
  return withAuthors(posts)
}

// 인기 해시태그 (최근 30일)
export async function popularTags(limit: number) {
  const { rows } = await db().query(
    `SELECT tag, count(*)::int AS n FROM gallery.posts p, unnest(p.hashtags) AS tag
     WHERE p.status = 'published' AND p.created_at > NOW() - INTERVAL '30 days'
     GROUP BY tag ORDER BY n DESC, tag LIMIT $1`,
    [limit]
  )
  return rows.map((r: any) => ({ tag: r.tag as string, count: r.n as number }))
}

// 통합 검색: 제목·해시태그·내용·글쓴이 (정확도 → 최신 순)
export async function searchPosts(query: string, limit: number) {
  const q = normalizeSearchQuery(query)
  const params: unknown[] = []
  const tag = normalizeTag(q)
  const { where, score } = buildTextSearch(
    q.replace(/^#/, ""),
    [
      { sql: "p.title", weight: 3 },
      { sql: "array_to_string(p.hashtags, ' ')", weight: 2 },
      { sql: "p.author_name", weight: 1 },
      { sql: "p.body", weight: 0.5 },
    ],
    params
  )
  params.push(tag || "\u0000", limit)
  const tagParam = `$${params.length - 1}`
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS}, (${score} + CASE WHEN p.hashtags @> ARRAY[${tagParam}]::text[] THEN 200 ELSE 0 END) AS search_score
     ${FROM}
     WHERE p.status = 'published' AND g.status <> 'closed' AND g.group_id IS NOT NULL
       AND (${where} OR p.hashtags @> ARRAY[${tagParam}]::text[])
     ORDER BY search_score DESC, p.created_at DESC, p.id DESC
     LIMIT $${params.length}`,
    params
  )
  return withAuthors(rows.map(toSummary))
}

// ---------------- 한 글 ----------------

export async function getPostRow(id: number, client: Q = db()) {
  const { rows } = await client.query(`SELECT p.*, g.slug AS gallery_slug, g.name AS gallery_name ${FROM} WHERE p.id = $1`, [id])
  return rows[0] || null
}

export async function getPostDetail(id: number, viewerId: string | null, isAdmin = false) {
  const r = await getPostRow(id)
  if (!r) return null
  const [withAuthor] = await withAuthors([
    {
      ...toSummary({ ...r, excerpt: "" }),
      body: r.body as string,
      media: (r.media || []) as MediaItem[],
      links: (r.links || []) as LinkItem[],
    },
  ])
  const polls = await getPollsForPosts([id], viewerId, isAdmin)
  let reaction = 0
  if (viewerId) {
    const { rows } = await db().query("SELECT value FROM gallery.post_reactions WHERE post_id = $1 AND member_id = $2", [id, viewerId])
    reaction = rows[0]?.value ?? 0
  }
  return { post: { ...withAuthor, poll: polls.get(id) ?? null }, reaction }
}

export async function incrementView(id: number) {
  await db().query("UPDATE gallery.posts SET view_count = view_count + 1 WHERE id = $1", [id])
}

export async function lastPostAt(authorId: string) {
  const { rows } = await db().query("SELECT max(created_at) AS at FROM gallery.posts WHERE author_id = $1", [authorId])
  return rows[0]?.at as Date | null
}

export async function createPost(
  gallery: Gallery,
  author: Actor,
  input: PostInput & { isNotice: boolean; asSquad: boolean; poll: PollInput | null }
) {
  return tx(async (client) => {
    let squad: { id: number; name: string } | null = null
    if (gallery.postAsSquad || input.asSquad) {
      squad = author.id === "admin" ? null : await getMemberSquad(client, author.id)
      if (gallery.postAsSquad && !squad && !author.isStaff) throw new GalleryError(403, "스쿼드에 들어간 회원만 이 갤러리에 쓸 수 있습니다.")
    }
    const { rows } = await client.query(
      `INSERT INTO gallery.posts (gallery_id, author_id, author_name, is_staff, squad_id, squad_name, head, title, body, media, links, hashtags, is_notice)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        gallery.id, author.id, author.name, author.isStaff, squad?.id ?? null, squad?.name ?? null, input.head, input.title, input.body,
        JSON.stringify(input.media), JSON.stringify(input.links), input.hashtags, input.isNotice,
      ]
    )
    const id = Number(rows[0].id)
    if (input.poll) await savePoll(client, id, input.poll)
    const earned = author.id === ADMIN_AUTHOR.id ? 0 : await creditPost(client, author.id, id) // 비상용 운영 계정 글만 덕력 없음 (관리자 회원도 받음)
    return { id, earned }
  })
}

export async function updatePost(id: number, input: PostInput & { isNotice?: boolean; poll?: PollInput | null }) {
  return tx(async (client) => {
    await client.query(
      `UPDATE gallery.posts SET head=$2, title=$3, body=$4, media=$5, links=$6, hashtags=$7, is_notice = COALESCE($8, is_notice), updated_at=NOW()
       WHERE id = $1 AND status = 'published'`,
      [id, input.head, input.title, input.body, JSON.stringify(input.media), JSON.stringify(input.links), input.hashtags, input.isNotice ?? null]
    )
    if (input.poll !== undefined) await savePoll(client, id, input.poll)
  })
}

// 지움·숨김: 행은 남기고 상태만 바꿈 (신고 대응 기록). 받은 덕력은 되돌림
export async function setPostStatus(id: number, status: "published" | "hidden" | "deleted") {
  return tx(async (client) => {
    const { rows } = await client.query("SELECT author_id, status FROM gallery.posts WHERE id = $1 FOR UPDATE", [id])
    const cur = rows[0]
    if (!cur || cur.status === status) return false
    await client.query("UPDATE gallery.posts SET status = $2, updated_at = NOW() WHERE id = $1", [id, status])
    if (status === "published") await restoreFor(client, cur.author_id, "post", id)
    else if (cur.status === "published") await revokeFor(client, cur.author_id, "post", id)
    return true
  })
}

// 덕업(1)·덕다운(-1)·취소(0). 한 사람이 한 글에 하나. 글쓴이 덕력에 바로 반영
export async function react(postId: number, memberId: string, value: 1 | -1 | 0) {
  return tx(async (client) => {
    const { rows } = await client.query("SELECT author_id, status FROM gallery.posts WHERE id = $1 FOR UPDATE", [postId])
    const post = rows[0]
    if (!post || post.status !== "published") throw new GalleryError(404, "글을 찾을 수 없습니다.")
    if (post.author_id === memberId) throw new GalleryError(400, "내 글에는 덕업·덕다운을 할 수 없습니다.")
    const { rows: prevRows } = await client.query("SELECT value FROM gallery.post_reactions WHERE post_id = $1 AND member_id = $2", [postId, memberId])
    const prev: number = prevRows[0]?.value ?? 0
    if (prev !== value) {
      if (value === 0) await client.query("DELETE FROM gallery.post_reactions WHERE post_id = $1 AND member_id = $2", [postId, memberId])
      else
        await client.query(
          `INSERT INTO gallery.post_reactions (post_id, member_id, value) VALUES ($1, $2, $3)
           ON CONFLICT (post_id, member_id) DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
          [postId, memberId, value]
        )
      const up = (value === 1 ? 1 : 0) - (prev === 1 ? 1 : 0)
      const down = (value === -1 ? 1 : 0) - (prev === -1 ? 1 : 0)
      await client.query("UPDATE gallery.posts SET up_count = GREATEST(up_count + $2, 0), down_count = GREATEST(down_count + $3, 0) WHERE id = $1", [
        postId,
        up,
        down,
      ])
      await applyReaction(client, post.author_id, postId, value - prev)
    }
    const { rows: counts } = await client.query("SELECT up_count, down_count FROM gallery.posts WHERE id = $1", [postId])
    return { reaction: value, upCount: counts[0].up_count as number, downCount: counts[0].down_count as number }
  })
}

// 내 글 (내 홈 관리용, 숨김 포함·지운 글 제외)
export async function listMine(authorId: string, cursor: string | null, limit: number) {
  const c = cursor ? decodeCursor(cursor) : null
  const params: unknown[] = [authorId, limit + 1]
  let cond = ""
  if (c) {
    params.push(c.createdAt, c.id)
    cond = "AND (p.created_at, p.id) < ($3::timestamptz, $4::bigint)"
  }
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS} ${FROM} WHERE p.author_id = $1 AND p.status <> 'deleted' ${cond}
     ORDER BY p.created_at DESC, p.id DESC LIMIT $2`,
    params
  )
  const posts = rows.slice(0, limit).map(toSummary)
  return { posts, nextCursor: rows.length > limit ? encodeCursor(posts[posts.length - 1]) : null }
}

// 관리자: 글 목록 (상태·갤러리·검색어)
export async function adminListPosts(f: { galleryId?: number | null; groupId?: number | null; status?: string; q?: string; limit: number; offset: number }) {
  const params: unknown[] = []
  const p = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }
  const where = ["TRUE"]
  if (f.galleryId) where.push(`p.gallery_id = ${p(f.galleryId)}`)
  else if (f.groupId) where.push(`g.group_id = ${p(f.groupId)}`)
  if (f.status && ["published", "hidden", "deleted"].includes(f.status)) where.push(`p.status = ${p(f.status)}`)
  if (f.q) {
    const like = p(`%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    where.push(`(p.title ILIKE ${like} OR p.author_name ILIKE ${like} OR p.author_id = ${p(f.q)})`)
  }
  const { rows } = await db().query(
    `SELECT ${SUMMARY_COLUMNS}, pl.ends_at AS poll_ends_at, pl.closed_at AS poll_closed_at, count(*) OVER () AS total
     ${FROM} LEFT JOIN gallery.polls pl ON pl.post_id = p.id WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC, p.id DESC LIMIT ${p(f.limit)} OFFSET ${p(f.offset)}`,
    params
  )
  // 관리자 목록은 투표 마감 시각·직접 마감 여부도 같이
  const posts = rows.map((r) => ({ ...toSummary(r), pollEndsAt: iso(r.poll_ends_at), pollClosedAt: iso(r.poll_closed_at) }))
  return { posts, total: rows[0] ? Number(rows[0].total) : 0 }
}

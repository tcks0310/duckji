import { db } from "../../shared/db/require-database"
import { GalleryError, KST_TODAY, iso, str, tx, type Q } from "./util"

// 대분류(groups) > 갤러리(galleries)
// 갤러리마다 글쓰기 권한(write_role: member 누구나 / admin 관리자만), 보기 방식(grid 사진 / list 목록),
// 스쿼드 이름으로 쓰는 갤러리(post_as_squad) 를 관리자 화면에서 정함

export const GALLERY_STATUSES = ["active", "dormant", "closed"] as const // 운영 / 휴면(읽기만) / 닫힘(안 보임)
export const ROLES = ["member", "admin"] as const
export const LAYOUTS = ["grid", "list"] as const

export interface Group {
  id: number
  slug: string
  name: string
  kind: "normal" | "squad"
  sortOrder: number
  isActive: boolean
}

export interface Gallery {
  id: number
  slug: string
  name: string
  groupId: number | null
  description: string
  coverImageUrl: string | null
  heads: string[]
  aliases: string[]
  status: (typeof GALLERY_STATUSES)[number]
  sortOrder: number
  writeRole: (typeof ROLES)[number]
  commentRole: (typeof ROLES)[number]
  layout: (typeof LAYOUTS)[number]
  postAsSquad: boolean
  createdAt: string
}

const toGroup = (r: any): Group => ({
  id: Number(r.id),
  slug: r.slug,
  name: r.name,
  kind: r.kind,
  sortOrder: r.sort_order,
  isActive: r.is_active,
})

export const toGallery = (r: any): Gallery => ({
  id: Number(r.id),
  slug: r.slug,
  name: r.name,
  groupId: r.group_id === null ? null : Number(r.group_id),
  description: r.description,
  coverImageUrl: r.cover_image_url,
  heads: r.heads || [],
  aliases: r.aliases || [],
  status: r.status,
  sortOrder: r.sort_order,
  writeRole: r.write_role,
  commentRole: r.comment_role,
  layout: r.layout,
  postAsSquad: r.post_as_squad,
  createdAt: iso(r.created_at)!,
})

const SELECT_GALLERY = `
  SELECT g.*, COALESCE((SELECT array_agg(a.alias ORDER BY a.alias) FROM gallery.gallery_aliases a WHERE a.gallery_id = g.id), '{}') AS aliases
  FROM gallery.galleries g`

export async function getGalleryBySlug(slug: string, client: Q = db()) {
  const { rows } = await client.query(`${SELECT_GALLERY} WHERE g.slug = $1`, [slug])
  return rows[0] ? toGallery(rows[0]) : null
}

export async function getGalleryById(id: number, client: Q = db()) {
  const { rows } = await client.query(`${SELECT_GALLERY} WHERE g.id = $1`, [id])
  return rows[0] ? toGallery(rows[0]) : null
}

// 공개 트리: 열린 대분류와 그 안의 운영·휴면 갤러리 (글 수·오늘 글 수 포함)
export async function publicTree() {
  const [groups, galleries, counts] = await Promise.all([
    db().query("SELECT * FROM gallery.groups WHERE is_active ORDER BY sort_order, id"),
    db().query(`${SELECT_GALLERY} WHERE g.status <> 'closed' ORDER BY g.sort_order, g.name`),
    db().query(
      `SELECT gallery_id, count(*)::int AS posts,
              count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = ${KST_TODAY})::int AS today
       FROM gallery.posts WHERE status = 'published' GROUP BY gallery_id`
    ),
  ])
  const countMap = new Map(counts.rows.map((r: any) => [Number(r.gallery_id), { posts: r.posts, today: r.today }]))
  const all = galleries.rows.map((r) => ({ ...toGallery(r), ...(countMap.get(Number(r.id)) || { posts: 0, today: 0 }) }))
  return {
    groups: groups.rows.map((g) => ({ ...toGroup(g), galleries: all.filter((x) => x.groupId === Number(g.id)) })),
    galleries: all,
  }
}

// 이름·별칭 검색 (통합 검색)
export async function searchGalleries(q: string) {
  const { rows } = await db().query(
    `${SELECT_GALLERY}
     WHERE g.status <> 'closed' AND g.group_id IS NOT NULL
       AND (g.name ILIKE $1 OR g.description ILIKE $1
            OR EXISTS (SELECT 1 FROM gallery.gallery_aliases a WHERE a.gallery_id = g.id AND a.alias ILIKE $1))
     ORDER BY g.sort_order, g.name LIMIT 20`,
    [`%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`]
  )
  return rows.map(toGallery)
}

// ---------------- 관리자 ----------------

// 관리자 트리: 닫힌 것까지 + 갤러리별 글·댓글·오늘 방문자
export async function adminTree() {
  const [groups, galleries, posts, comments, visitors] = await Promise.all([
    db().query("SELECT * FROM gallery.groups ORDER BY sort_order, id"),
    db().query(`${SELECT_GALLERY} ORDER BY g.sort_order, g.name`),
    db().query(
      `SELECT gallery_id, count(*) FILTER (WHERE status = 'published')::int AS posts,
              count(*) FILTER (WHERE status = 'published' AND (created_at AT TIME ZONE 'Asia/Seoul')::date = ${KST_TODAY})::int AS today_posts
       FROM gallery.posts GROUP BY gallery_id`
    ),
    db().query(
      `SELECT p.gallery_id, count(*)::int AS comments FROM gallery.comments c JOIN gallery.posts p ON p.id = c.post_id
       WHERE c.status = 'published' GROUP BY p.gallery_id`
    ),
    db().query(`SELECT gallery_id, count(*)::int AS n FROM gallery.daily_visitors WHERE day = ${KST_TODAY} GROUP BY gallery_id`),
  ])
  const by = (rows: any[], key: string) => new Map(rows.map((r) => [Number(r.gallery_id), r[key] as number]))
  const postMap = new Map(posts.rows.map((r: any) => [Number(r.gallery_id), r]))
  const commentMap = by(comments.rows, "comments")
  const visitorMap = by(visitors.rows, "n")
  return {
    groups: groups.rows.map(toGroup),
    galleries: galleries.rows.map((r) => {
      const id = Number(r.id)
      return {
        ...toGallery(r),
        stats: {
          posts: postMap.get(id)?.posts ?? 0,
          todayPosts: postMap.get(id)?.today_posts ?? 0,
          comments: commentMap.get(id) ?? 0,
          todayVisitors: visitorMap.get(id) ?? 0,
        },
      }
    }),
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/
const strList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))] : []
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback)

export async function saveGroup(id: number | null, body: Record<string, unknown>) {
  const current = id ? (await db().query("SELECT * FROM gallery.groups WHERE id = $1", [id])).rows[0] : null
  if (id && !current) throw new GalleryError(404, "대분류를 찾을 수 없습니다.")
  const v = {
    slug: (body.slug !== undefined ? str(body.slug) : current?.slug || "").toLowerCase(),
    name: body.name !== undefined ? str(body.name) : current?.name || "",
    kind: pick(body.kind ?? current?.kind, ["normal", "squad"] as const, "normal"),
    sortOrder: Number.isFinite(Number(body.sortOrder ?? current?.sort_order)) ? Math.trunc(Number(body.sortOrder ?? current?.sort_order ?? 0)) : 0,
    isActive: body.isActive !== undefined ? body.isActive === true : current ? current.is_active : true,
  }
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(v.slug)) throw new GalleryError(400, "대분류 주소는 영문 소문자·숫자·하이픈 2~40자여야 합니다.")
  if (!v.name || v.name.length > 40) throw new GalleryError(400, "대분류 이름은 1~40자여야 합니다.")
  try {
    const { rows } = id
      ? await db().query(
          "UPDATE gallery.groups SET slug=$2, name=$3, kind=$4, sort_order=$5, is_active=$6, updated_at=NOW() WHERE id=$1 RETURNING *",
          [id, v.slug, v.name, v.kind, v.sortOrder, v.isActive]
        )
      : await db().query("INSERT INTO gallery.groups (slug, name, kind, sort_order, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *", [
          v.slug,
          v.name,
          v.kind,
          v.sortOrder,
          v.isActive,
        ])
    return toGroup(rows[0])
  } catch (e: any) {
    if (e?.code === "23505") throw new GalleryError(409, "같은 주소의 대분류가 있습니다.")
    throw e
  }
}

export async function deleteGroup(id: number) {
  const { rows } = await db().query("SELECT count(*)::int AS n FROM gallery.galleries WHERE group_id = $1 AND status <> 'closed'", [id])
  if (rows[0].n > 0) throw new GalleryError(409, "안에 열린 갤러리가 있어 지울 수 없습니다. 갤러리를 먼저 옮기거나 닫아 주세요.")
  await db().query("UPDATE gallery.galleries SET group_id = NULL WHERE group_id = $1", [id])
  await db().query("DELETE FROM gallery.groups WHERE id = $1", [id])
}

// 갤러리 개설·수정 (보낸 칸만 바뀜)
export async function saveGallery(id: number | null, body: Record<string, unknown>) {
  const current = id ? await getGalleryById(id) : null
  if (id && !current) throw new GalleryError(404, "갤러리를 찾을 수 없습니다.")
  const m = { ...(current || {}), ...body } as Record<string, any>
  const v = {
    slug: str(m.slug).toLowerCase(),
    name: str(m.name),
    groupId: m.groupId === null || m.groupId === undefined || m.groupId === "" ? null : Number(m.groupId),
    description: str(m.description).slice(0, 300),
    coverImageUrl: str(m.coverImageUrl) || null,
    heads: strList(m.heads),
    aliases: strList(m.aliases),
    status: pick(m.status, GALLERY_STATUSES, "active"),
    sortOrder: Number.isFinite(Number(m.sortOrder)) ? Math.trunc(Number(m.sortOrder)) : 0,
    writeRole: pick(m.writeRole, ROLES, "member"),
    commentRole: pick(m.commentRole, ROLES, "member"),
    layout: pick(m.layout, LAYOUTS, "grid"),
    postAsSquad: m.postAsSquad === true,
  }
  if (!SLUG_RE.test(v.slug)) throw new GalleryError(400, "갤러리 주소는 영문 소문자·숫자·하이픈 2~60자여야 합니다.")
  if (!v.name || v.name.length > 100) throw new GalleryError(400, "갤러리 이름은 1~100자여야 합니다.")
  if (v.heads.length > 10 || v.heads.some((h) => h.length > 20)) throw new GalleryError(400, "말머리는 10개까지, 각 20자 이하여야 합니다.")
  if (v.aliases.length > 20 || v.aliases.some((a) => a.length > 100)) throw new GalleryError(400, "별칭은 20개까지, 각 100자 이하여야 합니다.")
  if (v.coverImageUrl && !/^https?:\/\//.test(v.coverImageUrl)) throw new GalleryError(400, "대표 이미지 주소가 올바르지 않습니다.")

  return tx(async (client) => {
    if (v.groupId !== null) {
      const { rowCount } = await client.query("SELECT 1 FROM gallery.groups WHERE id = $1", [v.groupId])
      if (!rowCount) throw new GalleryError(400, "대분류를 다시 골라 주세요.")
    }
    // 같은 대분류 안에서 이름이 겹치면 안 됨 (대분류가 다르면 '공지' 처럼 같은 이름 가능), 별칭·주소는 전체에서 하나
    const { rows: dup } = await client.query(
      `SELECT g.name FROM gallery.galleries g
       WHERE g.id IS DISTINCT FROM $1 AND g.status <> 'closed'
         AND ((lower(g.name) = lower($2) AND g.group_id IS NOT DISTINCT FROM $5) OR lower(g.slug) = $3
              OR EXISTS (SELECT 1 FROM gallery.gallery_aliases a WHERE a.gallery_id = g.id AND lower(a.alias) = ANY($4)))
       LIMIT 1`,
      [id, v.name, v.slug, v.aliases.map((a) => a.toLowerCase()), v.groupId]
    )
    if (dup[0]) throw new GalleryError(409, `이미 같은 이름·별칭·주소의 갤러리가 있습니다: ${dup[0].name}`)
    const values = [
      v.slug, v.name, v.groupId, v.description, v.coverImageUrl, v.heads, v.status, v.sortOrder,
      v.writeRole, v.commentRole, v.layout, v.postAsSquad,
    ]
    let galleryId: number
    try {
      const { rows } = id
        ? await client.query(
            `UPDATE gallery.galleries SET slug=$1, name=$2, group_id=$3, description=$4, cover_image_url=$5, heads=$6, status=$7, sort_order=$8,
               write_role=$9, comment_role=$10, layout=$11, post_as_squad=$12, updated_at=NOW()
             WHERE id = $13 RETURNING id`,
            [...values, id]
          )
        : await client.query(
            `INSERT INTO gallery.galleries (slug, name, group_id, description, cover_image_url, heads, status, sort_order,
               write_role, comment_role, layout, post_as_squad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
            values
          )
      galleryId = Number(rows[0].id)
    } catch (e: any) {
      if (e?.code === "23505") throw new GalleryError(409, "같은 주소(slug)의 갤러리가 있습니다.")
      throw e
    }
    await client.query("DELETE FROM gallery.gallery_aliases WHERE gallery_id = $1", [galleryId])
    for (const alias of v.aliases) {
      await client
        .query("INSERT INTO gallery.gallery_aliases (gallery_id, alias) VALUES ($1, $2)", [galleryId, alias])
        .catch((e: any) => {
          if (e?.code === "23505") throw new GalleryError(409, `다른 갤러리가 이미 쓰는 별칭입니다: ${alias}`)
          throw e
        })
    }
    return (await getGalleryById(galleryId, client))!
  })
}

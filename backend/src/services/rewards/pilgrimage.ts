import { randomBytes } from "crypto"
import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import { PILGRIMAGE_MAX_ACCURACY_M, PILGRIMAGE_SPOT_DP, REASONS } from "./rules"
import { earnMemberPoints, memberNames, memberPublicProfiles, RewardError, type MemberPublicProfile } from "./shared-tables"
import { tx } from "./tx"

// 덕지순례 코스 (rewards.pilgrimage_*)
// 관리자가 코스(소개·사진)와 순서 있는 스팟(주소·좌표·이동 안내)을 만들고 공개함
// 휴대폰 위치가 스팟 반경 안이면 도장 + DP, 코스의 스팟을 모두 찍으면 완주 보상. 위치 자체는 저장하지 않고 거리만 남김
// 회원은 코스마다 후기(별점 1~5 + 한줄평) 하나를 남기고 고칠 수 있음

type SpotRow = {
  id: string
  course_id: string
  name: string
  lat: number
  lng: number
  radius_m: number
  active: boolean
  sort_order: number
  address: string
  address_detail: string
  image_url: string
  description: string
  stay_time: string
  next_move: string
}
type CourseRow = {
  id: string
  title: string
  reward_dp: number
  summary: string
  cover_image: string
  gallery: string[]
  theme: string
  tags: string[]
  region: string
  duration_text: string
  published: boolean
  sort_order: number
  route_legs: RouteLeg[] | null
  created_at: string
  updated_at: string
}
// 장소 사이 걷는 길 (카카오 도보 경로, 관리자 저장 때 계산). null 구간은 화면이 직선으로 이어 줌
type RouteLeg = { from: [number, number]; to: [number, number]; path: [number, number][]; distanceM: number | null; durationS: number | null } | null
type CourseStats = { completions: number; review_count: number; avg_rating: number | null }

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/
const COMMENT_MAX = 100

// 두 좌표 사이 거리 (m)
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

const toSpot = (r: SpotRow) => ({
  id: r.id,
  name: r.name,
  address: r.address,
  addressDetail: r.address_detail ?? "",
  lat: r.lat,
  lng: r.lng,
  imageUrl: r.image_url,
  description: r.description,
  stayTime: r.stay_time,
  nextMove: r.next_move,
  radiusM: r.radius_m,
})

const toCourse = (c: CourseRow & CourseStats, spots: SpotRow[]) => ({
  id: c.id,
  title: c.title,
  summary: c.summary,
  coverImage: c.cover_image,
  gallery: c.gallery,
  theme: c.theme,
  tags: c.tags,
  region: c.region,
  durationText: c.duration_text,
  rewardDp: c.reward_dp,
  completions: c.completions,
  reviewCount: c.review_count,
  avgRating: c.avg_rating === null ? null : Math.round(c.avg_rating * 10) / 10,
  routeLegs: c.route_legs ?? [],
  spots: spots.filter((s) => s.course_id === c.id).map(toSpot),
})

const STATS_SQL = `
  (SELECT COUNT(*)::int FROM rewards.pilgrimage_completions m WHERE m.course_id = c.id) AS completions,
  (SELECT COUNT(*)::int FROM rewards.pilgrimage_reviews r WHERE r.course_id = c.id AND NOT r.hidden) AS review_count,
  (SELECT AVG(r.rating)::float FROM rewards.pilgrimage_reviews r WHERE r.course_id = c.id AND NOT r.hidden) AS avg_rating`

async function memberProgress(memberId: string | null) {
  if (!memberId) return { visited: [] as string[], completed: [] as string[] }
  const { rows: visits } = await db().query<{ spot_id: string }>("SELECT spot_id FROM rewards.pilgrimage_visits WHERE member_id = $1", [memberId])
  const { rows: done } = await db().query<{ course_id: string }>("SELECT course_id FROM rewards.pilgrimage_completions WHERE member_id = $1", [memberId])
  return { visited: visits.map((r) => r.spot_id), completed: done.map((r) => r.course_id) }
}

// ---- 공개 ----

// 공개 코스 목록 + 내 진행 (비로그인이면 빈 목록)
export async function listPublishedCourses(memberId: string | null) {
  const { rows: courses } = await db().query<CourseRow & CourseStats>(
    `SELECT c.*, ${STATS_SQL} FROM rewards.pilgrimage_courses c WHERE c.published ORDER BY c.sort_order, c.created_at, c.id`
  )
  const { rows: spots } = await db().query<SpotRow>(
    `SELECT s.* FROM rewards.pilgrimage_spots s JOIN rewards.pilgrimage_courses c ON c.id = s.course_id
     WHERE c.published AND s.active ORDER BY s.course_id, s.sort_order, s.id`
  )
  // 목록에는 걷는 길 좌표가 필요 없어 뺌 (상세에서만 그림)
  return {
    courses: courses.map((c) => ({ ...toCourse(c, spots), routeLegs: [] })),
    spotDp: PILGRIMAGE_SPOT_DP,
    ...(await memberProgress(memberId)),
  }
}

// 공개 코스 하나 + 후기 + 내 진행·내 후기
export async function getPublishedCourse(courseId: string, memberId: string | null) {
  if (!ID_RE.test(courseId)) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  const { rows } = await db().query<CourseRow & CourseStats>(
    `SELECT c.*, ${STATS_SQL} FROM rewards.pilgrimage_courses c WHERE c.id = $1 AND c.published`,
    [courseId]
  )
  if (!rows[0]) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  const { rows: spots } = await db().query<SpotRow>(
    "SELECT * FROM rewards.pilgrimage_spots WHERE course_id = $1 AND active ORDER BY sort_order, id",
    [courseId]
  )
  const progress = await memberProgress(memberId)
  return {
    course: toCourse(rows[0], spots),
    reviews: await courseReviews(courseId, memberId),
    myReview: memberId ? await myReview(courseId, memberId) : null,
    spotDp: PILGRIMAGE_SPOT_DP,
    ...progress,
  }
}

// 후기 목록 (숨김 제외, 최근 고친 순). 작성자 프로필 카드에 필요한 정보를 함께 담아 회원 id 는 내보내지 않음
async function courseReviews(courseId: string, memberId: string | null) {
  const { rows } = await db().query<{ member_id: string; rating: number; comment: string; created_at: string; updated_at: string }>(
    `SELECT member_id, rating, comment, created_at, updated_at FROM rewards.pilgrimage_reviews
     WHERE course_id = $1 AND NOT hidden ORDER BY updated_at DESC LIMIT 200`,
    [courseId]
  )
  const authors = await reviewAuthors(rows.map((r) => r.member_id))
  const { rows: done } = await db().query<{ member_id: string }>(
    "SELECT member_id FROM rewards.pilgrimage_completions WHERE course_id = $1 AND member_id = ANY($2)",
    [courseId, rows.map((r) => r.member_id)]
  )
  const finished = new Set(done.map((r) => r.member_id))
  return rows.map((r, i) => ({
    key: `r${i}`,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    mine: r.member_id === memberId,
    completedThis: finished.has(r.member_id), // 이 코스를 완주한 사람
    author: authors.get(r.member_id) ?? { nickname: "알 수 없음", avatarUrl: "", joinedAt: null, withdrawn: true, completions: 0, squad: null },
  }))
}

type ReviewAuthor = MemberPublicProfile & { completions: number; squad: { name: string; size: number } | null }

// 후기 작성자 카드: 닉네임·사진·가입일 + 덕지순례 완주 수 + 스쿼드
// 스쿼드는 이름·인원만 (숨긴 스쿼드는 빼고, 초대 코드는 내보내지 않음)
async function reviewAuthors(ids: string[]): Promise<Map<string, ReviewAuthor>> {
  const profiles = await memberPublicProfiles(db(), ids)
  const { rows: counts } = await db().query<{ member_id: string; n: number }>(
    "SELECT member_id, COUNT(*)::int AS n FROM rewards.pilgrimage_completions WHERE member_id = ANY($1) GROUP BY member_id",
    [ids]
  )
  const { rows: squads } = await db().query<{ member_id: string; name: string; size: number }>(
    `SELECT sm.member_id, s.name, (SELECT COUNT(*)::int FROM rewards.squad_members x WHERE x.squad_id = s.id) AS size
     FROM rewards.squad_members sm JOIN rewards.squads s ON s.id = sm.squad_id WHERE sm.member_id = ANY($1) AND NOT s.hidden`,
    [ids]
  )
  const done = new Map(counts.map((r) => [r.member_id, r.n]))
  const squadOf = new Map(squads.map((s) => [s.member_id, { name: s.name, size: s.size }]))
  const result = new Map<string, ReviewAuthor>()
  for (const id of ids) {
    const p = profiles.get(id)
    if (!p) continue
    result.set(id, { ...p, completions: p.withdrawn ? 0 : done.get(id) ?? 0, squad: p.withdrawn ? null : squadOf.get(id) ?? null })
  }
  return result
}

async function myReview(courseId: string, memberId: string) {
  const { rows } = await db().query<{ rating: number; comment: string; hidden: boolean; updated_at: string }>(
    "SELECT rating, comment, hidden, updated_at FROM rewards.pilgrimage_reviews WHERE course_id = $1 AND member_id = $2",
    [courseId, memberId]
  )
  return rows[0] ? { rating: rows[0].rating, comment: rows[0].comment, hidden: rows[0].hidden, updatedAt: rows[0].updated_at } : null
}

// 후기 남기기·고치기 { rating, comment }
export async function saveReview(courseId: string, memberId: string, input: Record<string, unknown>) {
  if (!ID_RE.test(courseId)) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  const rating = Number(input.rating)
  const comment = typeof input.comment === "string" ? input.comment.replace(/\s+/g, " ").trim() : ""
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new RewardError(400, "별점을 1~5점 중에 골라주세요.")
  if (comment.length < 2) throw new RewardError(400, "한줄평을 두 글자 이상 적어주세요.")
  if (comment.length > COMMENT_MAX) throw new RewardError(400, `한줄평은 ${COMMENT_MAX}자까지 쓸 수 있어요.`)
  const { rows } = await db().query("SELECT 1 FROM rewards.pilgrimage_courses WHERE id = $1 AND published", [courseId])
  if (!rows.length) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  // 관리자가 숨긴 후기는 고쳐도 숨김 유지
  await db().query(
    `INSERT INTO rewards.pilgrimage_reviews (course_id, member_id, rating, comment) VALUES ($1, $2, $3, $4)
     ON CONFLICT (course_id, member_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()`,
    [courseId, memberId, rating, comment]
  )
  return getPublishedCourse(courseId, memberId)
}

export async function deleteMyReview(courseId: string, memberId: string) {
  if (!ID_RE.test(courseId)) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  await db().query("DELETE FROM rewards.pilgrimage_reviews WHERE course_id = $1 AND member_id = $2", [courseId, memberId])
  return getPublishedCourse(courseId, memberId)
}

// 내 기록: 도장 찍은 스팟, 완주한 코스 (예전 화면과의 호환용)
export async function pilgrimageOverview(memberId: string | null) {
  const { rows: counts } = await db().query<{ course_id: string; n: number }>(
    "SELECT course_id, COUNT(*)::int AS n FROM rewards.pilgrimage_completions GROUP BY course_id"
  )
  const { rows: ready } = await db().query<{ id: string }>(
    `SELECT s.id FROM rewards.pilgrimage_spots s JOIN rewards.pilgrimage_courses c ON c.id = s.course_id WHERE s.active AND c.published`
  )
  return {
    completedCounts: Object.fromEntries(counts.map((r) => [r.course_id, r.n])),
    readySpots: ready.map((r) => r.id),
    spotDp: PILGRIMAGE_SPOT_DP,
    ...(await memberProgress(memberId)),
  }
}

// 도장 찍기 { lat, lng, accuracy }
export async function checkInPilgrimage(memberId: string, spotId: string, input: Record<string, unknown>) {
  if (!ID_RE.test(spotId)) throw new RewardError(404, "스팟을 찾을 수 없습니다.")
  const lat = Number(input.lat)
  const lng = Number(input.lng)
  const accuracy = Number(input.accuracy)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new RewardError(400, "위치를 확인하지 못했습니다. 위치 권한을 허용해주세요.", "no_location")
  }
  if (!Number.isFinite(accuracy) || accuracy > PILGRIMAGE_MAX_ACCURACY_M) {
    throw new RewardError(400, "위치가 정확하지 않습니다. 실외나 창가에서 다시 시도해주세요.", "inaccurate")
  }

  return tx(async (client) => {
    const { rows } = await client.query<SpotRow & { published: boolean }>(
      `SELECT s.*, c.published FROM rewards.pilgrimage_spots s JOIN rewards.pilgrimage_courses c ON c.id = s.course_id WHERE s.id = $1`,
      [spotId]
    )
    const spot = rows[0]
    if (!spot || !spot.active || !spot.published) throw new RewardError(404, "아직 도장을 찍을 수 없는 스팟입니다.", "not_ready")
    const distance = distanceMeters(lat, lng, spot.lat, spot.lng)
    if (distance > spot.radius_m) {
      const km = distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`
      throw new RewardError(403, `스팟에서 ${km} 떨어져 있어요. 현장(${spot.radius_m}m 안)에서 찍어주세요.`, "too_far")
    }
    const inserted = await client.query(
      "INSERT INTO rewards.pilgrimage_visits (member_id, spot_id, distance_m) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING spot_id",
      [memberId, spotId, distance]
    )
    if (!inserted.rowCount) throw new RewardError(409, "이미 도장을 찍은 스팟입니다.", "already_claimed")
    let balance = await earnMemberPoints(client, memberId, PILGRIMAGE_SPOT_DP, REASONS.pilgrimageSpot, spotId)

    // 코스의 활성 스팟을 모두 찍었으면 완주
    const { rows: left } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM rewards.pilgrimage_spots s
       WHERE s.course_id = $1 AND s.active
         AND NOT EXISTS (SELECT 1 FROM rewards.pilgrimage_visits v WHERE v.spot_id = s.id AND v.member_id = $2)`,
      [spot.course_id, memberId]
    )
    let courseRewardDp = 0
    if (left[0].n === 0) {
      const done = await client.query(
        "INSERT INTO rewards.pilgrimage_completions (member_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING course_id",
        [memberId, spot.course_id]
      )
      const { rows: course } = await client.query<CourseRow>("SELECT * FROM rewards.pilgrimage_courses WHERE id = $1", [spot.course_id])
      if (done.rowCount && course[0].reward_dp > 0) {
        balance = await earnMemberPoints(client, memberId, course[0].reward_dp, REASONS.pilgrimageCourse, spot.course_id)
        courseRewardDp = course[0].reward_dp
      }
    }
    return { spotId, courseId: spot.course_id, rewardDp: PILGRIMAGE_SPOT_DP, courseCompleted: left[0].n === 0, courseRewardDp, balance }
  })
}

// ---- 관리자 ----

export async function listPilgrimageForAdmin() {
  const { rows: courses } = await db().query<CourseRow & CourseStats & { checkins: number; hidden_reviews: number }>(
    `SELECT c.*, ${STATS_SQL},
       (SELECT COUNT(*)::int FROM rewards.pilgrimage_visits v JOIN rewards.pilgrimage_spots s ON s.id = v.spot_id WHERE s.course_id = c.id) AS checkins,
       (SELECT COUNT(*)::int FROM rewards.pilgrimage_reviews r WHERE r.course_id = c.id AND r.hidden) AS hidden_reviews
     FROM rewards.pilgrimage_courses c ORDER BY c.published DESC, c.sort_order, c.created_at, c.id`
  )
  const { rows: spots } = await db().query<SpotRow & { visits: number }>(
    `SELECT s.*, (SELECT COUNT(*)::int FROM rewards.pilgrimage_visits v WHERE v.spot_id = s.id) AS visits
     FROM rewards.pilgrimage_spots s WHERE s.active ORDER BY s.course_id, s.sort_order, s.id`
  )
  return {
    courses: courses.map((c) => ({
      ...toCourse(c, []),
      published: c.published,
      sortOrder: c.sort_order,
      checkins: c.checkins,
      hiddenReviews: c.hidden_reviews,
      updatedAt: c.updated_at,
      spots: spots.filter((s) => s.course_id === c.id).map((s) => ({ ...toSpot(s), visits: s.visits })),
    })),
    spotDp: PILGRIMAGE_SPOT_DP,
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const newId = (prefix: string) => `${prefix}-${randomBytes(5).toString("hex")}`

// 이미지 주소: 사이트 경로(/images/...) 또는 http(s) 주소만
function imageUrl(v: unknown, label: string): string {
  const url = str(v, 1000)
  if (!url) return ""
  if ((url.startsWith("/") && !url.startsWith("//")) || /^https?:\/\/[^\s]+$/.test(url)) return url
  throw new RewardError(400, `${label} 주소가 올바르지 않습니다.`)
}

const textList = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, maxLen).replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, maxItems)

type SpotInput = ReturnType<typeof toSpotInput>

function toSpotInput(raw: unknown, index: number) {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const n = index + 1
  const name = str(s.name, 200)
  const lat = Number(s.lat)
  const lng = Number(s.lng)
  const radius = s.radiusM === undefined || s.radiusM === "" ? 300 : Number(s.radiusM)
  if (!name) throw new RewardError(400, `${n}번 장소 이름을 입력해주세요.`)
  if (s.lat === "" || s.lng === "" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new RewardError(400, `${n}번 장소(${name})의 위치를 정해주세요. 주소 검색 후 지도에서 자리를 골라주세요.`)
  }
  if (!Number.isInteger(radius) || radius < 50 || radius > 2000) throw new RewardError(400, `${n}번 장소의 인증 반경은 50~2000m 로 정해주세요.`)
  return {
    id: str(s.id, 100),
    name,
    address: str(s.address, 300),
    addressDetail: str(s.addressDetail, 200),
    lat,
    lng,
    radius,
    imageUrl: imageUrl(s.imageUrl, `${n}번 장소 사진`),
    description: str(s.description, 500),
    stayTime: str(s.stayTime, 50),
    nextMove: str(s.nextMove, 100),
  }
}

function validateCourse(input: Record<string, unknown>) {
  const title = str(input.title, 200)
  const rewardDp = Number(input.rewardDp)
  if (!title) throw new RewardError(400, "코스 이름을 입력해주세요.")
  if (!Number.isInteger(rewardDp) || rewardDp < 0 || rewardDp > 5000) throw new RewardError(400, "완주 보상은 0~5000 DP 로 정해주세요.")
  const rawSpots = Array.isArray(input.spots) ? input.spots : []
  if (rawSpots.length > 12) throw new RewardError(400, "장소는 12곳까지 넣을 수 있어요.")
  const spots: SpotInput[] = rawSpots.map(toSpotInput)
  const published = input.published === true
  if (published && spots.length === 0) throw new RewardError(400, "장소를 한 곳 이상 넣어야 공개할 수 있어요.")
  return {
    title,
    rewardDp,
    summary: str(input.summary, 500),
    coverImage: imageUrl(input.coverImage, "대표 사진"),
    gallery: (Array.isArray(input.gallery) ? input.gallery : []).slice(0, 10).map((u) => imageUrl(u, "갤러리 사진")).filter(Boolean),
    theme: str(input.theme, 50),
    tags: textList(input.tags, 10, 30),
    region: str(input.region, 50),
    durationText: str(input.durationText, 50),
    published,
    sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
    routeLegs: toRouteLegs(input.routeLegs),
    spots,
  }
}

const coord = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length < 2) return null
  const lat = Number(v[0])
  const lng = Number(v[1])
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)

// 걷는 길 구간: 장소 11구간, 구간당 점 3,000개까지
function toRouteLegs(raw: unknown): RouteLeg[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 11).map((l) => {
    if (!l || typeof l !== "object") return null
    const o = l as Record<string, unknown>
    const from = coord(o.from)
    const to = coord(o.to)
    const path = (Array.isArray(o.path) ? o.path : []).slice(0, 3000).map(coord).filter((p): p is [number, number] => p !== null)
    if (!from || !to || path.length < 2) return null
    return { from, to, path, distanceM: num(o.distanceM), durationS: num(o.durationS) }
  })
}

// 스팟 순서대로 저장. 빠진 스팟은 도장 기록이 있으면 숨기고(기록 유지), 없으면 지움
async function saveSpots(client: PoolClient, courseId: string, spots: SpotInput[]) {
  const { rows: existing } = await client.query<{ id: string; visits: number }>(
    `SELECT s.id, (SELECT COUNT(*)::int FROM rewards.pilgrimage_visits v WHERE v.spot_id = s.id) AS visits
     FROM rewards.pilgrimage_spots s WHERE s.course_id = $1`,
    [courseId]
  )
  const own = new Set(existing.map((r) => r.id))
  const kept = new Set<string>()
  for (const [i, s] of spots.entries()) {
    const id = s.id && own.has(s.id) && !kept.has(s.id) ? s.id : newId("sp")
    kept.add(id)
    await client.query(
      `INSERT INTO rewards.pilgrimage_spots (id, course_id, name, lat, lng, radius_m, active, sort_order, address, address_detail, image_url, description, stay_time, next_move)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng, radius_m = EXCLUDED.radius_m,
         active = TRUE, sort_order = EXCLUDED.sort_order, address = EXCLUDED.address, address_detail = EXCLUDED.address_detail, image_url = EXCLUDED.image_url,
         description = EXCLUDED.description, stay_time = EXCLUDED.stay_time, next_move = EXCLUDED.next_move`,
      [id, courseId, s.name, s.lat, s.lng, s.radius, i, s.address, s.addressDetail, s.imageUrl, s.description, s.stayTime, s.nextMove]
    )
  }
  for (const r of existing) {
    if (kept.has(r.id)) continue
    if (r.visits > 0) await client.query("UPDATE rewards.pilgrimage_spots SET active = FALSE, sort_order = 1000 WHERE id = $1", [r.id])
    else await client.query("DELETE FROM rewards.pilgrimage_spots WHERE id = $1", [r.id])
  }
}

// 코스 추가 (id 는 서버가 만듦)
export async function createPilgrimageCourse(input: Record<string, unknown>) {
  const v = validateCourse(input)
  const id = newId("pc")
  await tx(async (client) => {
    await client.query(
      `INSERT INTO rewards.pilgrimage_courses (id, title, reward_dp, summary, cover_image, gallery, theme, tags, region, duration_text, published, sort_order, route_legs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, v.title, v.rewardDp, v.summary, v.coverImage, v.gallery, v.theme, v.tags, v.region, v.durationText, v.published, v.sortOrder, JSON.stringify(v.routeLegs)]
    )
    await saveSpots(client, id, v.spots)
  })
  return { id, ...(await listPilgrimageForAdmin()) }
}

// 코스 고치기 (스팟 목록 전체를 순서대로 받음)
export async function updatePilgrimageCourse(courseId: string, input: Record<string, unknown>) {
  if (!ID_RE.test(courseId)) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  const v = validateCourse(input)
  await tx(async (client) => {
    const updated = await client.query(
      `UPDATE rewards.pilgrimage_courses SET title = $2, reward_dp = $3, summary = $4, cover_image = $5, gallery = $6, theme = $7, tags = $8,
         region = $9, duration_text = $10, published = $11, sort_order = $12, route_legs = $13, updated_at = NOW() WHERE id = $1`,
      [courseId, v.title, v.rewardDp, v.summary, v.coverImage, v.gallery, v.theme, v.tags, v.region, v.durationText, v.published, v.sortOrder, JSON.stringify(v.routeLegs)]
    )
    if (!updated.rowCount) throw new RewardError(404, "코스를 찾을 수 없습니다.")
    await saveSpots(client, courseId, v.spots)
  })
  return { id: courseId, ...(await listPilgrimageForAdmin()) }
}

// 공개·비공개 전환
export async function setPilgrimagePublished(courseId: string, published: boolean) {
  if (published) {
    const { rows } = await db().query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM rewards.pilgrimage_spots WHERE course_id = $1 AND active",
      [courseId]
    )
    if (!rows[0]?.n) throw new RewardError(400, "장소를 한 곳 이상 넣어야 공개할 수 있어요.")
  }
  const r = await db().query("UPDATE rewards.pilgrimage_courses SET published = $2, updated_at = NOW() WHERE id = $1", [courseId, published])
  if (!r.rowCount) throw new RewardError(404, "코스를 찾을 수 없습니다.")
  return listPilgrimageForAdmin()
}

// 코스 지우기: 도장 기록이 있으면 막음 (비공개로 돌리면 됨)
export async function deletePilgrimageCourse(courseId: string) {
  const { rows } = await db().query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM rewards.pilgrimage_visits v JOIN rewards.pilgrimage_spots s ON s.id = v.spot_id WHERE s.course_id = $1`,
    [courseId]
  )
  if (rows[0].n > 0) throw new RewardError(409, "도장 기록이 있는 코스는 지울 수 없어요. 비공개로 돌려주세요.")
  await db().query("DELETE FROM rewards.pilgrimage_courses WHERE id = $1", [courseId])
  return listPilgrimageForAdmin()
}

// 후기 관리 목록 (숨긴 후기 포함)
export async function listReviewsForAdmin(courseId: string | null) {
  const { rows } = await db().query<{
    course_id: string
    course_title: string
    member_id: string
    rating: number
    comment: string
    hidden: boolean
    updated_at: string
  }>(
    `SELECT r.course_id, c.title AS course_title, r.member_id, r.rating, r.comment, r.hidden, r.updated_at
     FROM rewards.pilgrimage_reviews r
     JOIN rewards.pilgrimage_courses c ON c.id = r.course_id
     WHERE ($1::text IS NULL OR r.course_id = $1) ORDER BY r.updated_at DESC LIMIT 300`,
    [courseId]
  )
  const names = await memberNames(db(), [...new Set(rows.map((r) => r.member_id))])
  return rows.map((r) => ({
    courseId: r.course_id,
    courseTitle: r.course_title,
    memberId: r.member_id,
    memberName: names.get(r.member_id) || "알 수 없음",
    rating: r.rating,
    comment: r.comment,
    hidden: r.hidden,
    updatedAt: r.updated_at,
  }))
}

export async function setReviewHidden(courseId: string, memberId: string, hidden: boolean) {
  const r = await db().query("UPDATE rewards.pilgrimage_reviews SET hidden = $3 WHERE course_id = $1 AND member_id = $2", [courseId, memberId, hidden])
  if (!r.rowCount) throw new RewardError(404, "후기를 찾을 수 없습니다.")
}

export async function deleteReview(courseId: string, memberId: string) {
  await db().query("DELETE FROM rewards.pilgrimage_reviews WHERE course_id = $1 AND member_id = $2", [courseId, memberId])
}

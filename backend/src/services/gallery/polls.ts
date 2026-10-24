import { db } from "../../shared/db/require-database"
import { isOwnMediaUrl, media } from "./storage"
import { GalleryError, iso, str, tx, type Q } from "./util"

// 글에 붙는 투표 (이달의 굿즈·이달의 코스어처럼 관리자가 매달 글을 쓰며 붙임)
// 한 사람 한 표, 투표 중에는 다른 후보로 바꿀 수 있음. 결과는 투표한 뒤나 마감 뒤에 보임 (관리자는 항상)

export const MAX_OPTIONS = 30

export interface PollOptionInput {
  id?: number
  label: string
  description: string
  imageUrl: string | null
  linkUrl: string | null
}

export interface PollInput {
  question: string
  endsAt: string | null
  options: PollOptionInput[]
}

export function validatePoll(v: unknown): PollInput | null {
  if (v === null || v === undefined || v === false) return null
  if (typeof v !== "object") throw new GalleryError(400, "투표 형식이 올바르지 않습니다.")
  const b = v as Record<string, any>
  const question = str(b.question).slice(0, 200)
  const endsAt = b.endsAt ? new Date(String(b.endsAt)) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new GalleryError(400, "투표 마감 시각이 올바르지 않습니다.")
  const options: PollOptionInput[] = (Array.isArray(b.options) ? b.options : []).map((o: any) => ({
    id: Number.isSafeInteger(o?.id) ? o.id : undefined,
    label: str(o?.label).slice(0, 100),
    description: str(o?.description).slice(0, 300),
    imageUrl: str(o?.imageUrl) || null,
    linkUrl: str(o?.linkUrl) || null,
  }))
  if (!question) throw new GalleryError(400, "투표 질문을 써 주세요.")
  if (options.length < 2 || options.length > MAX_OPTIONS) throw new GalleryError(400, `투표 후보는 2~${MAX_OPTIONS}개여야 합니다.`)
  if (options.some((o) => !o.label)) throw new GalleryError(400, "후보 이름을 모두 써 주세요.")
  for (const o of options) {
    if (o.imageUrl && !isOwnMediaUrl(o.imageUrl)) throw new GalleryError(400, "후보 사진은 이 화면에서 올린 사진만 쓸 수 있습니다.")
    if (o.imageUrl) o.imageUrl = media.canonicalUrl(o.imageUrl)
    if (o.linkUrl && (o.linkUrl.length > 500 || !/^https?:\/\/\S+$/i.test(o.linkUrl))) throw new GalleryError(400, "후보 링크는 http:// 나 https:// 주소여야 합니다.")
  }
  return { question, endsAt: endsAt ? endsAt.toISOString() : null, options }
}

// 글에 투표 저장 (null 이면 투표 없앰). 표를 받은 후보는 지울 수 없음
export async function savePoll(client: Q, postId: number, input: PollInput | null) {
  const { rows } = await client.query("SELECT id FROM gallery.polls WHERE post_id = $1", [postId])
  const existing = rows[0] ? Number(rows[0].id) : null
  if (!input) {
    if (existing) {
      const { rows: votes } = await client.query("SELECT count(*)::int AS n FROM gallery.poll_votes WHERE poll_id = $1", [existing])
      if (votes[0].n > 0) throw new GalleryError(409, "이미 표가 들어온 투표는 없앨 수 없습니다. 마감해 주세요.")
      await client.query("DELETE FROM gallery.polls WHERE id = $1", [existing])
    }
    return
  }
  let pollId = existing
  if (pollId) {
    await client.query("UPDATE gallery.polls SET question = $2, ends_at = $3 WHERE id = $1", [pollId, input.question, input.endsAt])
  } else {
    const { rows: created } = await client.query("INSERT INTO gallery.polls (post_id, question, ends_at) VALUES ($1, $2, $3) RETURNING id", [
      postId,
      input.question,
      input.endsAt,
    ])
    pollId = Number(created[0].id)
  }
  const keep = input.options.map((o) => o.id).filter((id): id is number => Boolean(id))
  const { rows: removed } = await client.query(
    "SELECT id, label, vote_count FROM gallery.poll_options WHERE poll_id = $1 AND NOT (id = ANY($2::bigint[]))",
    [pollId, keep]
  )
  const voted = removed.find((r: any) => r.vote_count > 0)
  if (voted) throw new GalleryError(409, `표를 받은 후보(${voted.label})는 지울 수 없습니다.`)
  if (removed.length) await client.query("DELETE FROM gallery.poll_options WHERE id = ANY($1::bigint[])", [removed.map((r: any) => r.id)])
  for (const [i, o] of input.options.entries()) {
    if (o.id) {
      const { rowCount } = await client.query(
        "UPDATE gallery.poll_options SET label=$3, description=$4, image_url=$5, link_url=$6, sort_order=$7 WHERE id = $1 AND poll_id = $2",
        [o.id, pollId, o.label, o.description, o.imageUrl, o.linkUrl, i]
      )
      if (rowCount) continue
    }
    await client.query(
      "INSERT INTO gallery.poll_options (poll_id, label, description, image_url, link_url, sort_order) VALUES ($1,$2,$3,$4,$5,$6)",
      [pollId, o.label, o.description, o.imageUrl, o.linkUrl, i]
    )
  }
}

const isClosed = (r: any) => Boolean(r.closed_at) || Boolean(r.ends_at && new Date(r.ends_at).getTime() <= Date.now())

// 글별 투표 (보는 사람이 투표했는지, 결과 공개 여부 포함)
export async function getPollsForPosts(postIds: number[], viewerId: string | null, isAdmin = false) {
  const result = new Map<number, any>()
  if (!postIds.length) return result
  const { rows: polls } = await db().query("SELECT * FROM gallery.polls WHERE post_id = ANY($1)", [postIds])
  if (!polls.length) return result
  const pollIds = polls.map((p: any) => p.id)
  const [{ rows: options }, { rows: mine }] = await Promise.all([
    db().query("SELECT * FROM gallery.poll_options WHERE poll_id = ANY($1) ORDER BY sort_order, id", [pollIds]),
    viewerId
      ? db().query("SELECT poll_id, option_id FROM gallery.poll_votes WHERE poll_id = ANY($1) AND member_id = $2", [pollIds, viewerId])
      : Promise.resolve({ rows: [] as any[] }),
  ])
  const myVote = new Map(mine.map((r: any) => [String(r.poll_id), Number(r.option_id)]))
  for (const p of polls) {
    const opts = options.filter((o: any) => String(o.poll_id) === String(p.id))
    const total = opts.reduce((s: number, o: any) => s + o.vote_count, 0)
    const closed = isClosed(p)
    const myOptionId = myVote.get(String(p.id)) ?? null
    const showResults = closed || myOptionId !== null || isAdmin
    result.set(Number(p.post_id), {
      id: Number(p.id),
      question: p.question,
      endsAt: iso(p.ends_at),
      closed,
      totalVotes: showResults ? total : null,
      myOptionId,
      options: opts.map((o: any) => ({
        id: Number(o.id),
        label: o.label,
        description: o.description,
        imageUrl: o.image_url,
        linkUrl: o.link_url,
        voteCount: showResults ? o.vote_count : null,
      })),
    })
  }
  return result
}

// 투표하기 (회원, 한 사람 한 표, 바꾸기 가능)
export async function vote(postId: number, memberId: string, optionId: number) {
  return tx(async (client) => {
    const { rows } = await client.query(
      `SELECT pl.*, p.status FROM gallery.polls pl JOIN gallery.posts p ON p.id = pl.post_id WHERE pl.post_id = $1 FOR UPDATE OF pl`,
      [postId]
    )
    const poll = rows[0]
    if (!poll || poll.status !== "published") throw new GalleryError(404, "투표를 찾을 수 없습니다.")
    if (isClosed(poll)) throw new GalleryError(400, "마감된 투표입니다.")
    const { rowCount } = await client.query("SELECT 1 FROM gallery.poll_options WHERE id = $1 AND poll_id = $2", [optionId, poll.id])
    if (!rowCount) throw new GalleryError(400, "후보를 다시 골라 주세요.")
    const { rows: prev } = await client.query("SELECT option_id FROM gallery.poll_votes WHERE poll_id = $1 AND member_id = $2", [poll.id, memberId])
    const prevId = prev[0] ? Number(prev[0].option_id) : null
    if (prevId !== optionId) {
      if (prevId) await client.query("UPDATE gallery.poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = $1", [prevId])
      await client.query("UPDATE gallery.poll_options SET vote_count = vote_count + 1 WHERE id = $1", [optionId])
      await client.query(
        `INSERT INTO gallery.poll_votes (poll_id, member_id, option_id) VALUES ($1, $2, $3)
         ON CONFLICT (poll_id, member_id) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
        [poll.id, memberId, optionId]
      )
    }
  })
}

// 관리자: 투표 지금 마감 (이미 마감된 투표는 그대로)
export async function closePollNow(postId: number) {
  const { rowCount } = await db().query("UPDATE gallery.polls SET closed_at = COALESCE(closed_at, NOW()) WHERE post_id = $1", [postId])
  return (rowCount ?? 0) > 0
}

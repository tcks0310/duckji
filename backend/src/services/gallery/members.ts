import { db } from "../../shared/db/require-database"
import { levelOf } from "./duckryeok"
import { cleanLinks } from "./posts"
import { getAuthorSquads, getMemberCard, getMemberCards, getMemberSquad } from "./shared-tables"
import { GalleryError } from "./util"

// 갤러리 프로필 (내 홈·다른 회원 홈): 덕력·레벨, 소개, SNS 링크, 스쿼드, 활동 수
export async function getProfile(memberId: string) {
  const card = await getMemberCard(memberId)
  if (!card) return null
  const [{ rows: prof }, { rows: counts }, squad] = await Promise.all([
    db().query("SELECT duckryeok, bio, links FROM gallery.members WHERE member_id = $1", [memberId]),
    db().query(
      `SELECT (SELECT count(*) FROM gallery.posts WHERE author_id = $1 AND status = 'published')::int AS posts,
              (SELECT count(*) FROM gallery.comments WHERE author_id = $1 AND status = 'published')::int AS comments,
              (SELECT COALESCE(sum(up_count), 0) FROM gallery.posts WHERE author_id = $1 AND status = 'published')::int AS ups`,
      [memberId]
    ),
    getMemberSquad(db(), memberId),
  ])
  const p = prof[0]
  return {
    id: card.id,
    name: card.name,
    avatarUrl: card.avatarUrl,
    joinedAt: card.joinedAt,
    bio: (p?.bio || "") as string,
    links: (p?.links || []) as { url: string; label: string }[],
    level: levelOf(Number(p?.duckryeok || 0)),
    squad,
    counts: { posts: counts[0].posts as number, comments: counts[0].comments as number, ups: counts[0].ups as number },
  }
}

export async function updateProfile(memberId: string, body: Record<string, unknown>) {
  const bio = typeof body.bio === "string" ? body.bio.replace(/\s+\n/g, "\n").trim() : undefined
  if (bio !== undefined && bio.length > 300) throw new GalleryError(400, "소개는 300자까지 쓸 수 있습니다.")
  const links = body.links !== undefined ? cleanLinks(body.links) : undefined
  await db().query(
    `INSERT INTO gallery.members (member_id, bio, links) VALUES ($1, COALESCE($2, ''), COALESCE($3::jsonb, '[]'::jsonb))
     ON CONFLICT (member_id) DO UPDATE SET bio = COALESCE($2, gallery.members.bio), links = COALESCE($3::jsonb, gallery.members.links), updated_at = NOW()`,
    [memberId, bio ?? null, links ? JSON.stringify(links) : null]
  )
}

// 덕력 순위 (첫 화면·내 홈)
export async function duckryeokRanking(limit: number) {
  const { rows } = await db().query(
    `SELECT m.member_id, m.duckryeok FROM gallery.members m JOIN dukji_users u ON u.id = m.member_id
     WHERE m.duckryeok > 0 AND u.status IN ('active', 'dormant') ORDER BY m.duckryeok DESC, m.updated_at LIMIT $1`,
    [limit]
  )
  const ids = rows.map((r: any) => r.member_id as string)
  const [cards, squads] = await Promise.all([getMemberCards(ids), getAuthorSquads(ids)])
  return rows.map((r: any) => {
    const lv = levelOf(Number(r.duckryeok))
    return {
      memberId: r.member_id as string,
      name: cards.get(r.member_id)?.name || "회원",
      avatarUrl: cards.get(r.member_id)?.avatarUrl ?? null,
      duckryeok: lv.duckryeok,
      level: lv.level,
      title: lv.title,
      squad: squads.get(r.member_id) ?? null,
    }
  })
}

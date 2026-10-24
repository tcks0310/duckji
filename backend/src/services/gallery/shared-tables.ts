import { db } from "../../shared/db/require-database"
import type { Q } from "./util"

// gallery 가 다른 서비스 소유 테이블에 닿는 곳은 이 파일에만 모아 둡니다.
//  - dukji_users (users 서비스): 프로필 사진·상태
//  - rewards.squads · squad_members (rewards 서비스): 글쓴이 스쿼드 배지, 스쿼드 이름으로 글쓰기
// DB 를 나누게 되면 이 파일만 API 호출로 바꾸면 됩니다.

export type AuthorSquad = { id: number; name: string; icon: string; color: string }

export interface MemberCard {
  id: string
  name: string
  avatarUrl: string | null
}

// 회원 이름·프로필 사진 (탈퇴 회원은 이름 대신 '탈퇴 회원')
export async function getMemberCards(ids: string[]): Promise<Map<string, MemberCard>> {
  const list = [...new Set(ids.filter((id) => id && id !== "admin"))]
  if (!list.length) return new Map()
  const { rows } = await db().query("SELECT id, name, avatar_url, status FROM dukji_users WHERE id = ANY($1)", [list])
  return new Map(
    rows.map((r: any) => [r.id as string, { id: r.id, name: r.status === "withdrawn" ? "탈퇴 회원" : r.name, avatarUrl: r.avatar_url || null }])
  )
}

export async function getMemberCard(id: string): Promise<(MemberCard & { joinedAt: string; status: string }) | null> {
  const { rows } = await db().query("SELECT id, name, avatar_url, status, joined_at FROM dukji_users WHERE id = $1", [id])
  const r = rows[0]
  if (!r || r.status === "withdrawn") return null
  return { id: r.id, name: r.name, avatarUrl: r.avatar_url || null, status: r.status, joinedAt: new Date(r.joined_at).toISOString() }
}

// 글쓴이 옆 스쿼드 배지. 관리자가 숨긴 스쿼드는 뺌. icon 은 올린 이미지가 있으면 그 주소
export async function getAuthorSquads(memberIds: string[]): Promise<Map<string, AuthorSquad>> {
  const ids = [...new Set(memberIds.filter((id) => id && id !== "admin"))]
  if (!ids.length) return new Map()
  try {
    const { rows } = await db().query(
      `SELECT m.member_id, s.id, s.name, COALESCE(s.image_url, s.icon) AS icon, s.color
       FROM rewards.squad_members m JOIN rewards.squads s ON s.id = m.squad_id
       WHERE m.member_id = ANY($1) AND NOT s.hidden`,
      [ids]
    )
    return new Map(rows.map((r: any) => [r.member_id, { id: Number(r.id), name: r.name, icon: r.icon, color: r.color }]))
  } catch {
    return new Map() // 스쿼드 표가 없는 DB
  }
}

// 회원이 속한 스쿼드 (스쿼드 이름으로 글쓰기·내 홈)
export async function getMemberSquad(client: Q, memberId: string): Promise<(AuthorSquad & { isLeader: boolean }) | null> {
  try {
    const { rows } = await client.query(
      `SELECT s.id, s.name, COALESCE(s.image_url, s.icon) AS icon, s.color, s.leader_id = $1 AS is_leader
       FROM rewards.squad_members m JOIN rewards.squads s ON s.id = m.squad_id
       WHERE m.member_id = $1 AND NOT s.hidden`,
      [memberId]
    )
    const r = rows[0]
    return r ? { id: Number(r.id), name: r.name, icon: r.icon, color: r.color, isLeader: r.is_leader } : null
  } catch {
    return null
  }
}

// 정지·탈퇴 회원인지 (관리자 쿠키로도 글을 쓸 수 있는 라우트라 requireMember 대신 직접 확인)
export async function isMemberBlocked(id: string): Promise<boolean> {
  if (id === "admin") return false
  const { rows } = await db().query(
    "SELECT to_jsonb(u) ->> 'status' AS status, to_jsonb(u) ->> 'suspended_until' AS until FROM dukji_users u WHERE id = $1",
    [id]
  )
  const r = rows[0]
  if (!r) return false
  if (r.status === "banned" || r.status === "withdrawn") return true
  return r.status === "suspended" && (!r.until || Date.parse(r.until) > Date.now())
}

// 스쿼드가 있는지 (스쿼드 홈 글 목록)
export async function squadExists(id: number): Promise<boolean> {
  try {
    const { rowCount } = await db().query("SELECT 1 FROM rewards.squads WHERE id = $1 AND NOT hidden", [id])
    return (rowCount ?? 0) > 0
  } catch {
    return false
  }
}

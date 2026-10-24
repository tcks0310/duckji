import type { PoolClient } from "pg"

// rewards 가 다른 서비스 소유 테이블에 닿는 곳은 이 파일에만 모아 둡니다.
// 지금은 같은 RDS 라 SQL 로 쓰지만, DB 를 나누면 이 파일만 users 서비스 API 호출로 바꾸면 됩니다.

export class RewardError extends Error {
  constructor(public status: 400 | 403 | 404 | 409 | 429, message: string, public code?: string) {
    super(message)
  }
}

// 덕지 포인트 원장(users 서비스 소유)에 지급 기록. 확인 기록과 같은 트랜잭션(client)에서 부릅니다.
// 같은 회원·사유·대상(refId)은 원장의 고유 인덱스로 한 번만 들어감
// memo 는 회원 포인트 내역에 같이 보이는 한 줄 (예: 코드 이름)
export async function earnMemberPoints(client: PoolClient, memberId: string, amount: number, reason: string, refId: string, memo?: string): Promise<number> {
  await client.query("INSERT INTO member_point_balances (member_id) VALUES ($1) ON CONFLICT DO NOTHING", [memberId]).catch((err) => {
    if (err?.code === "23503") throw new RewardError(404, "회원 정보를 찾을 수 없습니다. 다시 로그인해주세요.")
    throw err
  })
  const { rows } = await client.query<{ balance: number }>("SELECT balance FROM member_point_balances WHERE member_id = $1 FOR UPDATE", [memberId])
  const inserted = await client.query(
    "INSERT INTO member_point_ledger (member_id, amount, reason, ref_id, memo) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id",
    [memberId, amount, reason, refId, memo ? memo.slice(0, 200) : null]
  )
  if (!inserted.rowCount) throw new RewardError(409, "이미 받은 포인트입니다.", "already_claimed")
  const balance = rows[0].balance + amount
  await client.query("UPDATE member_point_balances SET balance = $2, updated_at = NOW() WHERE member_id = $1", [memberId, balance])
  return balance
}

// 회원 이름 (users 서비스 소유 dukji_users 읽기, 스쿼드 팀원 표시용)
export async function memberNames(client: Pick<PoolClient, "query">, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { rows } = await client.query<{ id: string; name: string; status: string }>("SELECT id, name, status FROM dukji_users WHERE id = ANY($1)", [ids])
  return new Map(rows.map((r) => [r.id, r.status === "withdrawn" ? "탈퇴 회원" : r.name]))
}

// 회원 공개 프로필 (users 서비스 소유 dukji_users 읽기, 덕지순례 후기 작성자 카드용)
// 닉네임(name)·프로필 사진·가입일만. 탈퇴 회원은 이름·사진을 보이지 않음
export type MemberPublicProfile = { nickname: string; avatarUrl: string; joinedAt: string | null; withdrawn: boolean }
export async function memberPublicProfiles(client: Pick<PoolClient, "query">, ids: string[]): Promise<Map<string, MemberPublicProfile>> {
  if (!ids.length) return new Map()
  const { rows } = await client.query<{ id: string; name: string; avatar_url: string | null; joined_at: string; status: string }>(
    "SELECT id, name, avatar_url, joined_at, status FROM dukji_users WHERE id = ANY($1)",
    [ids]
  )
  return new Map(
    rows.map((r): [string, MemberPublicProfile] =>
      r.status === "withdrawn"
        ? [r.id, { nickname: "탈퇴 회원", avatarUrl: "", joinedAt: null, withdrawn: true }]
        : [r.id, { nickname: r.name, avatarUrl: r.avatar_url || "", joinedAt: r.joined_at, withdrawn: false }]
    )
  )
}

export type MemberProfile = { id: string; name: string; avatarUrl: string | null; status: string; email: string; joinedAt: string | null }

// 회원 프로필 (dukji_users 읽기, 스쿼드 팀원 목록용). email·joinedAt 은 관리자 화면에서만 씀
export async function memberProfiles(client: Pick<PoolClient, "query">, ids: string[]): Promise<Map<string, MemberProfile>> {
  if (!ids.length) return new Map()
  const { rows } = await client.query<{ id: string; name: string; avatar_url: string | null; status: string; email: string; joined_at: Date | null }>(
    "SELECT id, name, avatar_url, status, email, joined_at FROM dukji_users WHERE id = ANY($1)",
    [ids]
  )
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.status === "withdrawn" ? "탈퇴 회원" : r.name,
        avatarUrl: r.status === "withdrawn" ? null : r.avatar_url,
        status: r.status,
        email: r.email,
        joinedAt: r.joined_at?.toISOString() ?? null,
      },
    ])
  )
}

// 팀원들이 최근 days 일 동안 커뮤니티(gallery 서비스 소유 gallery.posts)에 쓴 공개 글 수
export async function memberPostCount(client: Pick<PoolClient, "query">, ids: string[], days: number): Promise<number> {
  if (!ids.length) return 0
  const { rows } = await client.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM gallery.posts WHERE author_id = ANY($1) AND status = 'published' AND created_at > NOW() - make_interval(days => $2::int)",
    [ids, days]
  )
  return rows[0]?.n ?? 0
}

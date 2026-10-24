import { db } from "../../shared/db/require-database"

// popups 가 다른 서비스 소유 테이블에 닿는 곳은 이 파일에만 모아 둡니다. (live-fields.ts 의 찜 수 읽기는 예전부터 그 파일에)

// 회원 이름 (users 서비스 소유 dukji_users 읽기, 관리자 예약·웨이팅 명단 표시용)
export async function memberNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { rows } = await db().query<{ id: string; name: string; status: string }>("SELECT id, name, status FROM dukji_users WHERE id = ANY($1)", [
    [...new Set(ids)],
  ])
  return new Map(rows.map((r) => [r.id, r.status === "withdrawn" ? "탈퇴 회원" : r.name]))
}

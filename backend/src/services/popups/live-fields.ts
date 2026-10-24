import { pool } from "../../shared/db/pool"
import { statusFor } from "./intake/convert"
import type { Popup } from "./types"
import { waitingCounts } from "./booking"

// 화면에 보여 줄 때 계산하는 값 (DB 에 박아 둔 숫자를 쓰지 않음)
// - 상태·D-day: 오늘(한국 시간) 기준으로 시작·종료일에서 계산. 관리자가 종료 처리(endedAt)한 팝업은 종료 그대로
// - 찜 수: 회원 찜 기록(member_likes, users 서비스 소유 테이블)을 읽어서 셈 (표·칸이 아직 없으면 DB 값)
// - 웨이팅 수: 자사·제휴 팝업의 오늘 대기 팀 수 (popup_waitings)
export async function withLiveFields(popups: Popup[]): Promise<Popup[]> {
  const likes = await countLikes(popups.map((p) => p.id))
  const takes = popups.filter((p) => p.operationType === "own" || p.operationType === "partner").map((p) => p.id)
  const waiting = pool && takes.length ? await waitingCounts(takes) : new Map<string, number>()
  return popups.map((p) => ({
    ...p,
    ...(p.endedAt ? {} : statusFor(p.startDate, p.endDate)),
    likeCount: likes ? (likes.get(p.id) ?? 0) : p.likeCount,
    waitingCount: waiting.get(p.id) ?? 0,
  }))
}

async function countLikes(ids: string[]): Promise<Map<string, number> | null> {
  if (!pool || !ids.length) return null
  try {
    const { rows } = await pool.query<{ item_id: string; n: number }>(
      "SELECT item_id, COUNT(*)::int AS n FROM member_likes WHERE kind = 'popup' AND item_id = ANY($1) GROUP BY item_id",
      [ids]
    )
    return new Map(rows.map((r) => [r.item_id, r.n]))
  } catch (e: any) {
    if (e?.code === "42P01") return null
    throw e
  }
}

// 상세 조회 수 +1 (화면이 브라우저 세션마다 팝업당 한 번 보냄)
export async function recordView(id: string) {
  if (!pool) return false
  const { rowCount } = await pool.query("UPDATE popups SET view_count = view_count + 1 WHERE id = $1 AND is_published", [id])
  return (rowCount ?? 0) > 0
}

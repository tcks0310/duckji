import type { Member } from "../../shared/auth/member-session"
import { isRealEmail, providerUserId, tx } from "./members"
import { fromRow, type UserRow } from "./rows"

// 마이페이지 로그인 수단 연동·해제
// 한 회원에 카카오·네이버·구글·이메일을 하나씩 붙여 어느 것으로 로그인해도 같은 회원이 됨

export class LinkError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message)
  }
}

const LABEL: Record<string, string> = { kakao: "카카오", naver: "네이버", google: "구글", apple: "애플", cognito: "이메일", email: "이메일" }
export const providerLabel = (p: string) => LABEL[p] || p

// 방금 로그인한 수단(m)을 memberId 회원에 붙임. 이미 다른 회원 것이면 막음
export async function linkIdentity(memberId: string, m: Member) {
  const pid = providerUserId(m)
  const email = isRealEmail(m.email) ? m.email.trim().toLowerCase() : null
  return tx(async (client) => {
    const { rows: users } = await client.query<UserRow>("SELECT * FROM dukji_users WHERE id = $1 FOR UPDATE", [memberId])
    const user = users[0]
    if (!user || user.status === "withdrawn") throw new LinkError(404, "회원 정보를 찾을 수 없습니다. 다시 로그인해주세요.")
    const { rows: owner } = await client.query<{ member_id: string }>(
      "SELECT member_id FROM member_identities WHERE provider = $1 AND provider_user_id = $2",
      [m.provider, pid]
    )
    if (owner[0] && owner[0].member_id !== memberId) {
      throw new LinkError(409, `이 ${providerLabel(m.provider)} 계정은 이미 다른 덕지 계정에 연결되어 있습니다. 그 계정에서 연동을 해제하거나 탈퇴한 뒤 다시 시도해주세요.`)
    }
    if (!owner[0]) {
      const { rows: same } = await client.query("SELECT 1 FROM member_identities WHERE member_id = $1 AND provider = $2", [memberId, m.provider])
      if (same[0]) throw new LinkError(409, `이미 연결된 ${providerLabel(m.provider)} 계정이 있습니다. 해제한 뒤 다시 연결해주세요.`)
      await client.query(
        `INSERT INTO member_identities (provider, provider_user_id, member_id, email, email_verified)
         VALUES ($1, $2, $3, $4, $5)`,
        [m.provider, pid, memberId, email, Boolean(m.emailVerified && email)]
      )
    }
    return fromRow(user)
  })
}

// 연동 해제. 마지막 로그인 수단은 해제할 수 없음
export async function unlinkIdentity(memberId: string, provider: string) {
  return tx(async (client) => {
    const { rows } = await client.query<{ provider: string }>(
      "SELECT provider FROM member_identities WHERE member_id = $1 FOR UPDATE",
      [memberId]
    )
    if (!rows.some((r) => r.provider === provider)) throw new LinkError(404, "연결된 로그인 수단이 아닙니다.")
    if (rows.length <= 1) throw new LinkError(400, "로그인 수단이 하나뿐이라 해제할 수 없습니다. 다른 수단을 먼저 연결해주세요.")
    await client.query("DELETE FROM member_identities WHERE member_id = $1 AND provider = $2", [memberId, provider])
    // 회원 행의 대표 가입 수단이 해제되면 남은 수단 중 가장 먼저 연결한 것으로
    await client.query(
      `UPDATE dukji_users SET provider = (
         SELECT provider FROM member_identities WHERE member_id = $1 ORDER BY linked_at LIMIT 1)
       WHERE id = $1 AND provider = $2`,
      [memberId, provider]
    )
  })
}

import { db } from "../../shared/db/require-database"
import { verifyPassword } from "./password"

// Cognito 사용자 이전 트리거 (User Migration Lambda Trigger)
// Cognito 에 없는 이메일로 로그인·비밀번호 찾기를 하면 Cognito 가 이 함수를 부릅니다.
// 예전 이메일 가입 회원(비밀번호를 우리 DB 에 저장하던 방식)이면 Cognito 에 옮겨 주고,
// 첫 로그인 때 users 서비스가 그 회원에 Cognito 로그인 수단을 연결합니다 (members.ts resolveLogin).

export const isCognitoMigrationEvent = (event: any) =>
  typeof event?.triggerSource === "string" && event.triggerSource.startsWith("UserMigration_")

export async function handleCognitoMigration(event: any) {
  const email = String(event.userName || "").trim().toLowerCase()
  const { rows } = await db().query<{ name: string; email: string; password_hash: string }>(
    `SELECT u.name, u.email, c.password_hash
     FROM dukji_users u JOIN dukji_user_email_credentials c ON c.user_id = u.id
     WHERE u.provider = 'email' AND lower(u.email) = $1 AND u.status IN ('active', 'dormant')
     ORDER BY u.joined_at LIMIT 1`,
    [email]
  )
  const legacy = rows[0]
  if (!legacy) throw new Error("User not found")

  if (event.triggerSource === "UserMigration_Authentication") {
    if (!(await verifyPassword(String(event.request?.password || ""), legacy.password_hash))) throw new Error("Bad password")
    event.response.finalUserStatus = "CONFIRMED"
  }
  event.response.userAttributes = { email, email_verified: "true", name: legacy.name }
  event.response.messageAction = "SUPPRESS"
  return event
}

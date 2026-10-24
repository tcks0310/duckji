import { serviceHeaders } from "../../shared/auth/service-call"
import { loadAccount, sendOne, type PushMessage } from "./fcm"

// users 서비스에서 보낼 알림을 받아(처리 끝으로 표시됨) FCM 으로 보내고, 없는 기기 토큰은 지우라고 알려 줌
// FCM 키가 아직 없으면 알림을 꺼내지 않음 (키를 넣은 뒤부터 하루 안의 알림이 나감)

const usersBase = () => (process.env.USERS_API_URL || "").replace(/\/$/, "")

async function callUsers(path: string, payload: object) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${usersBase()}/api/users/service/push/${path}`, { method: "POST", headers: serviceHeaders(body), body })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok || !json.success) throw new Error(`users ${path} 실패: ${res.status} ${json.error || ""}`)
  return json
}

export async function sendPending() {
  const sa = await loadAccount()
  if (!sa || !usersBase()) return { sent: 0, skipped: "not_configured" }
  const { messages } = (await callUsers("claim", {})) as { messages: PushMessage[] }
  let sent = 0
  let failed = 0
  const invalid: string[] = []
  for (let i = 0; i < messages.length; i += 20) {
    const results = await Promise.all(messages.slice(i, i + 20).map((m) => sendOne(sa, m).catch(() => "failed" as const)))
    results.forEach((r, j) => {
      if (r === "sent") sent++
      else if (r === "invalid") invalid.push(messages[i + j].token)
      else failed++
    })
  }
  if (invalid.length) await callUsers("invalid", { tokens: [...new Set(invalid)] })
  const summary = { claimed: messages.length, sent, failed, invalid: invalid.length }
  if (messages.length) console.log("push", JSON.stringify(summary))
  return summary
}

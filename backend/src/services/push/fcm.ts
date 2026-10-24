import { createSign } from "crypto"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

// FCM HTTP v1 으로 보내기 (서비스 계정 키로 구글 접근 토큰을 만들어 씀)
// 키 파일: uploads 버킷 private/push/fcm-service-account.json (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키)

type ServiceAccount = { project_id: string; client_email: string; private_key: string }
export type PushMessage = { id: number; token: string; title: string; body: string; link: string }
export type SendResult = "sent" | "invalid" | "failed"

const KEY_OBJECT = "private/push/fcm-service-account.json"
const s3 = new S3Client({ region: process.env.PUSH_BUCKET_REGION || process.env.AWS_REGION || "ap-northeast-2" })

// 키가 없을 때는 기억하지 않음 (나중에 올리면 다음 실행부터 바로 씀)
let account: ServiceAccount | null = null
export async function loadAccount(): Promise<ServiceAccount | null> {
  if (account) return account
  const bucket = process.env.PUSH_BUCKET
  if (!bucket) return null
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: KEY_OBJECT }))
    const json = JSON.parse(await obj.Body!.transformToString())
    account = json.project_id && json.client_email && json.private_key ? json : null
  } catch (e: any) {
    if (e?.name !== "NoSuchKey") console.error("FCM 키를 읽지 못했어요", e?.name || e)
    account = null
  }
  return account
}

let access: { token: string; until: number } | null = null
async function accessToken(sa: ServiceAccount) {
  if (access && access.until > Date.now() + 60_000) return access.token
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")}`
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok || !json.access_token) throw new Error(`구글 접근 토큰 실패: ${res.status} ${json.error || ""}`)
  access = { token: json.access_token, until: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return access.token
}

export async function sendOne(sa: ServiceAccount, m: PushMessage): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: m.token,
        notification: { title: m.title, body: m.body || undefined },
        data: { link: m.link || "", notificationId: String(m.id) },
        android: { priority: "HIGH", notification: { channel_id: "default" } },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  })
  if (res.ok) return "sent"
  const err = (await res.json().catch(() => ({}))) as any
  const code = err?.error?.details?.find((d: any) => d?.errorCode)?.errorCode || err?.error?.status
  // 앱을 지웠거나 토큰이 바뀐 기기
  if (res.status === 404 || code === "UNREGISTERED" || (code === "INVALID_ARGUMENT" && /token/i.test(err?.error?.message || ""))) return "invalid"
  console.error("FCM 보내기 실패", res.status, code)
  return "failed"
}

import { createHmac, timingSafeEqual } from "crypto"
import type { Context, Next } from "hono"
import { memberSecret } from "./member-session"

// 서비스끼리 HTTP 로 부를 때 쓰는 서명 (예: VPC 밖 서비스 → VPC 안 users 의 DP 차감)
// 따로 비밀값을 만들지 않고 모든 서비스가 가진 MEMBER_SESSION_SECRET 에서 용도별 키를 뽑아 씀 (member-extra 와 같은 방식)
// 헤더 X-Duckji-Service = "<보낸 시각 ms>.<HMAC(시각.본문)>", 2분 지난 요청은 거절

export const SERVICE_HEADER = "x-duckji-service"
const MAX_AGE_MS = 2 * 60_000

const sign = (ts: string, body: string) => createHmac("sha256", `dukji-service:${memberSecret()}`).update(`${ts}.${body}`).digest("base64url")

export function serviceHeaders(body: string): Record<string, string> {
  const ts = String(Date.now())
  return { [SERVICE_HEADER]: `${ts}.${sign(ts, body)}`, "Content-Type": "application/json" }
}

// 서명이 맞으면 본문(JSON)을 c.set("serviceBody") 로 넘김
export async function requireServiceCall(c: Context, next: Next) {
  if (!memberSecret()) return c.json({ success: false, error: "서비스 호출 설정이 없습니다." }, 503)
  const header = c.req.header(SERVICE_HEADER) || ""
  const dot = header.indexOf(".")
  const ts = header.slice(0, dot)
  const raw = await c.req.text()
  const age = Date.now() - Number(ts)
  const expected = Buffer.from(sign(ts, raw))
  const given = Buffer.from(header.slice(dot + 1))
  if (dot < 1 || !(age >= -30_000 && age <= MAX_AGE_MS) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return c.json({ success: false, error: "허용되지 않은 호출입니다." }, 401)
  }
  try {
    c.set("serviceBody" as never, JSON.parse(raw || "{}") as never)
  } catch {
    return c.json({ success: false, error: "본문이 올바르지 않습니다." }, 400)
  }
  await next()
}

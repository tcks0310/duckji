import { pool } from "./pool"

// 회원별 횟수 제한: windowSec 초 동안 max 번까지. 허용되면 기록하고 true, 넘으면 false
// DB 가 있으면 rate_limit_events 에 남겨 Lambda 여러 대에서도 같이 셈, 없으면(로컬 메모리 모드) 프로세스 안에서만 셈
const memory = new Map<string, number[]>()

export async function consumeQuota(bucket: string, subject: string, max: number, windowSec: number): Promise<boolean> {
  if (!pool) {
    const key = `${bucket}:${subject}`
    const since = Date.now() - windowSec * 1000
    const hits = (memory.get(key) || []).filter((t) => t > since)
    if (hits.length >= max) return false
    memory.set(key, [...hits, Date.now()])
    return true
  }
  const { rows } = await pool.query(
    `INSERT INTO rate_limit_events (bucket, subject)
     SELECT $1::varchar, $2::varchar
     WHERE (SELECT count(*) FROM rate_limit_events
            WHERE bucket = $1::varchar AND subject = $2::varchar AND created_at > NOW() - make_interval(secs => $4::int)) < $3::int
     RETURNING id`,
    [bucket, subject, max, windowSec]
  )
  // 가끔 이틀 지난 기록을 지움 (제한 기간은 길어야 하루)
  if (Math.random() < 0.01) pool.query("DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '2 days'").catch(() => {})
  return rows.length > 0
}

export const tooManyRequests = (message: string) => ({ success: false, error: message })

// 요청한 사람의 IP. 운영은 API Gateway 가 본 접속 IP(위조 불가), 로컬은 x-forwarded-for 또는 "local"
// 로그인 없이 받는 양식(입점 신청·뉴스레터·신고·이메일 인증 메일)의 횟수 제한에 씀
export function clientIp(c: { env?: any; req: { header(name: string): string | undefined } }): string {
  const fromGateway = c.env?.requestContext?.http?.sourceIp || c.env?.event?.requestContext?.http?.sourceIp
  if (typeof fromGateway === "string" && fromGateway) return fromGateway
  return (c.req.header("x-forwarded-for") || "").split(",")[0].trim() || "local"
}

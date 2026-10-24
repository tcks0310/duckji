import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"
import { b2bConfig as cfg } from "./config"
import type { MailContent } from "./templates"

// 메일 발송 지점
// 모든 메일은 먼저 b2b.outbox 에 queued 로 쌓이고, flushOutbox() 가 MAIL_DRIVER 로 보냅니다.
//   none : 아무것도 안 보냄 (기본값, SES 연결 전). 관리자 화면에서 발송 대기 목록으로 확인
//   log  : 콘솔에 출력하고 sent 처리 (로컬 개발용)
//   ses  : SES 연결 후 sendViaSes 를 구현해서 사용

type Queryable = Pick<PoolClient, "query">

const BATCH = 50

export async function enqueueMail(
  q: Queryable,
  kind: string,
  to: string,
  mail: MailContent
) {
  await q.query(
    `INSERT INTO b2b.outbox (kind, to_email, subject, html, text, headers) VALUES ($1,$2,$3,$4,$5,$6)`,
    [kind, to, mail.subject, mail.html, mail.text, JSON.stringify(mail.headers || {})]
  )
}

interface OutboxRow {
  id: number
  to_email: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

async function sendViaSes(_mail: OutboxRow): Promise<void> {
  // TODO(SES 연결 시): @aws-sdk/client-sesv2 SendEmailCommand 로 cfg.mailFrom → to_email 발송, headers 포함.
  // Lambda 역할에 ses:SendEmail 권한 추가 필요.
  throw new Error("SES 가 아직 연결되지 않았습니다 (MAIL_DRIVER=ses)")
}

async function deliver(mail: OutboxRow) {
  if (cfg.mailDriver === "log") {
    console.log(`[mail] ${cfg.mailFrom} → ${mail.to_email}: ${mail.subject}`)
    return
  }
  if (cfg.mailDriver === "ses") return sendViaSes(mail)
}

export async function flushOutbox(): Promise<{ driver: string; sent: number; failed: number; expired: number }> {
  const pool = db()
  if (cfg.mailDriver === "none") return { driver: cfg.mailDriver, sent: 0, failed: 0, expired: 0 }

  let sent = 0
  let failed = 0
  for (;;) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, to_email, subject, html, text, headers FROM b2b.outbox
         WHERE status = 'queued' ORDER BY id LIMIT ${BATCH} FOR UPDATE SKIP LOCKED`
      )
      for (const row of rows) {
        try {
          await deliver(row)
          await client.query(`UPDATE b2b.outbox SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, error = NULL WHERE id = $1`, [row.id])
          sent++
        } catch (e) {
          // 3번 실패하면 failed 로 멈춤 (관리자가 확인)
          await client.query(
            `UPDATE b2b.outbox SET attempts = attempts + 1, error = $2,
               status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'queued' END WHERE id = $1`,
            [row.id, String((e as Error).message || e).slice(0, 1000)]
          )
          failed++
        }
      }
      await client.query("COMMIT")
      if (rows.length < BATCH || failed > 0) break
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }
  return { driver: cfg.mailDriver, sent, failed, expired: 0 }
}

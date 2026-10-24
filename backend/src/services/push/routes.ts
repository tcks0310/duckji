import { Hono } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { isAlimtalkConfigured, SAMPLE_VARIABLES, sendAlimtalk } from "./alimtalk"

export const pushRoute = new Hono()

// 상태 확인만. 보내기는 1분마다 스케줄로 (lambda.ts → send.ts, alimtalk.ts)
pushRoute.get("/", (c) => c.json({ success: true, schedule: "1분마다", alimtalk: isAlimtalkConfigured() }))

// 관리자 '알림 관리' → 알림톡 테스트 발송 { kind, templateId, phone } (예시 값으로 채워 보냄)
pushRoute.post("/alimtalk/test", requireAdmin, async (c) => {
  if (!isAlimtalkConfigured()) return c.json({ success: false, error: "알림톡 설정(솔라피 키·채널 ID)이 아직 서버에 없어요." }, 503)
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const kind = typeof b.kind === "string" ? b.kind : ""
  const templateId = typeof b.templateId === "string" ? b.templateId.trim() : ""
  const to = typeof b.phone === "string" ? b.phone.replace(/\D/g, "") : ""
  const sample = SAMPLE_VARIABLES[kind]
  if (!sample) return c.json({ success: false, error: "알림톡을 쓰지 않는 종류예요." }, 400)
  if (!/^[A-Za-z0-9_-]{4,60}$/.test(templateId)) return c.json({ success: false, error: "템플릿 ID 를 먼저 저장해 주세요." }, 400)
  if (!/^01\d{8,9}$/.test(to)) return c.json({ success: false, error: "받을 휴대폰 번호를 확인해 주세요." }, 400)
  const variables = Object.fromEntries(Object.entries(sample).map(([k, v]) => [`#{${k}}`, v]))
  const r = await sendAlimtalk({ to, templateId, variables })
  if (!r.ok) return c.json({ success: false, error: `솔라피가 거절했어요: ${r.error}` }, 502)
  return c.json({ success: true })
})

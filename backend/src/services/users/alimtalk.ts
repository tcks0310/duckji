import { db } from "../../shared/db/require-database"
import { decryptField } from "./crypto"

// 알림톡으로 보낼 알림 꺼내기 (부르는 곳: push.ts /service/push/alimtalk/*)
// 카카오 검수를 받은 템플릿의 빈칸(#{이름} ...)을 여기서 채움. 템플릿 문구: /mnt/project-files/launch/솔라피-카카오톡-연동-안내.md 5장
// 받는 번호는 본인인증·회원정보의 휴대폰(member_profiles.phone_enc). 없으면 no_phone 으로 처리 끝

export type AlimtalkMessage = { id: number; kind: string; templateId: string; to: string; variables: Record<string, string> }

// 웨이팅 호출은 늦게 가면 소용없어서 30분, 나머지는 6시간 지나면 보내지 않음
const FRESH_SQL = `n.created_at > NOW() - CASE WHEN n.kind = 'waiting_called' THEN INTERVAL '30 minutes' ELSE INTERVAL '6 hours' END`
const WAITING_ENTRY_MINUTES = "10"

const num = (v: unknown) => (v === null || v === undefined ? "" : Number(v).toLocaleString("ko-KR"))
const DOW = ["일", "월", "화", "수", "목", "금", "토"]
const dateLabel = (d: Date | string | null, time: string | null) => {
  if (!d) return ""
  const s = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10)
  const [y, m, day] = s.split("-").map(Number)
  const dow = DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]
  return `${m}월 ${day}일(${dow})${time ? ` ${time}` : ""}`
}

// 관리자가 송장 칸에 "CJ대한통운 123456789" 처럼 적음 → 택배사·번호로 나눔
export function splitTracking(raw: string) {
  const t = (raw || "").trim()
  const m = t.match(/^(.*?)[\s:·-]*([0-9][0-9-]{5,})$/)
  if (!m) return { carrier: "", number: t }
  return { carrier: m[1].trim(), number: m[2] }
}

// 빈 값은 카카오가 거절하므로 "-" 로
const fill = (vars: Record<string, string>) =>
  Object.fromEntries(Object.entries(vars).map(([k, v]) => [`#{${k}}`, (v || "").trim() || "-"]))

export function templateVariables(kind: string, r: Record<string, any>): Record<string, string> | null {
  const name = r.member_name || "회원"
  switch (kind) {
    case "order_paid":
      return fill({ 이름: name, 주문번호: r.order_no, 상품명: r.item, 결제금액: `${num(r.total_dp)} DP`, 결제수단: "덕지 DP" })
    case "order_shipped": {
      const t = splitTracking(r.tracking_no)
      return fill({ 이름: name, 주문번호: r.order_no, 상품명: r.item, 택배사: t.carrier || "주문 내역에서 확인", 송장번호: t.number })
    }
    case "order_canceled":
      return fill({ 이름: name, 주문번호: r.order_no, 상품명: r.item, 환불금액: `${num(r.total_dp)} DP`, 환불방법: "덕지 DP로 환불" })
    case "booking_confirmed":
      return fill({
        이름: name, 팝업이름: r.popup_title, 예약일시: dateLabel(r.slot_date, r.start_time), 인원: String(r.party_size ?? ""),
        장소: r.place, 예약번호: r.booking_code,
      })
    case "booking_reminder":
      return fill({ 이름: name, 팝업이름: r.popup_title, 예약일시: dateLabel(r.slot_date, r.start_time), 인원: String(r.party_size ?? ""), 장소: r.place })
    case "waiting_called":
      return fill({ 이름: name, 팝업이름: r.popup_title, 대기번호: String(r.waiting_number ?? ""), 인원: String(r.party_size ?? ""), 입장마감: WAITING_ENTRY_MINUTES })
    default:
      return null
  }
}

let ready: boolean | null = null
async function hasColumns() {
  if (ready) return true
  const { rows } = await db().query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_kinds' AND column_name = 'alimtalk_template_id'"
  )
  ready = rows.length > 0
  return ready
}

// 보낼 알림을 처리 끝으로 표시하며 꺼냄. 번호 없음·시간 지남은 그 자리에서 처리 끝
export async function claimAlimtalk(): Promise<AlimtalkMessage[]> {
  if (!(await hasColumns())) return []
  await db().query("SELECT notify_due(NULL)")
  const { rows } = await db().query(
    `WITH pending AS (
       SELECT n.id, n.kind, n.member_id, n.ref_id, k.alimtalk_template_id AS template_id,
              COALESCE(n.audience = 'member' AND 'alimtalk' = ANY (k.channels) AND k.alimtalk_template_id <> '', FALSE) AS uses,
              (${FRESH_SQL}) AS fresh
         FROM member_notifications n
         LEFT JOIN notification_kinds k ON k.code = n.kind
        WHERE n.alimtalk_at IS NULL
        ORDER BY n.id
        LIMIT 500
          FOR UPDATE OF n SKIP LOCKED
     ), done AS (
       UPDATE member_notifications m
          SET alimtalk_at = NOW(),
              alimtalk_status = CASE WHEN p.uses AND NOT p.fresh THEN 'expired' END
         FROM pending p
        WHERE m.id = p.id
       RETURNING p.*
     )
     SELECT d.id, d.kind, d.template_id, u.name AS member_name, pr.phone_enc,
            o.order_no, o.total_dp, o.tracking_no, CASE WHEN o.id IS NOT NULL THEN notify_order_label(o.id) END AS item,
            COALESCE(bp.title, wp.title) AS popup_title,
            COALESCE(NULLIF(bp.venue_name, ''), NULLIF(bp.location, ''), '팝업 상세에서 확인') AS place,
            b.slot_date, to_char(s.start_time, 'HH24:MI') AS start_time, b.code AS booking_code,
            COALESCE(b.party_size, w.party_size) AS party_size, w.number AS waiting_number
       FROM done d
       JOIN dukji_users u ON u.id = d.member_id
       LEFT JOIN member_profiles pr ON pr.member_id = d.member_id
       LEFT JOIN store.orders o ON d.kind LIKE 'order\\_%' AND o.id::text = d.ref_id
       LEFT JOIN popup_bookings b ON d.kind LIKE 'booking\\_%' AND b.id::text = d.ref_id
       LEFT JOIN popup_booking_slots s ON s.id = b.slot_id
       LEFT JOIN popups bp ON bp.id = b.popup_id
       LEFT JOIN popup_waitings w ON d.kind LIKE 'waiting\\_%' AND w.id::text = d.ref_id
       LEFT JOIN popups wp ON wp.id = w.popup_id
      WHERE d.uses AND d.fresh
      ORDER BY d.id`
  )
  const out: AlimtalkMessage[] = []
  const noPhone: number[] = []
  for (const r of rows as any[]) {
    const to = (decryptField(r.phone_enc) || "").replace(/\D/g, "")
    const variables = templateVariables(r.kind, r)
    if (!/^01\d{8,9}$/.test(to) || !variables) {
      noPhone.push(Number(r.id))
      continue
    }
    out.push({ id: Number(r.id), kind: r.kind, templateId: r.template_id, to, variables })
  }
  if (noPhone.length) {
    await db().query("UPDATE member_notifications SET alimtalk_status = 'no_phone' WHERE id = ANY($1::bigint[])", [noPhone])
  }
  return out
}

// push 서비스가 보낸 결과 [{ id, ok, error? }]
export async function saveAlimtalkResults(results: { id: number; ok: boolean; error?: string }[]) {
  if (!results.length || !(await hasColumns())) return
  await db().query(
    `UPDATE member_notifications m SET alimtalk_status = CASE WHEN r.ok THEN 'sent' ELSE 'failed' END, alimtalk_error = r.error
       FROM jsonb_to_recordset($1::jsonb) AS r(id BIGINT, ok BOOLEAN, error TEXT)
      WHERE m.id = r.id`,
    [JSON.stringify(results.map((r) => ({ id: r.id, ok: r.ok, error: r.ok ? null : (r.error || "").slice(0, 200) })))]
  )
}

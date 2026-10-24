import { pool } from "../../shared/db/pool"

// 팝업 현장 QR 유입 기록·집계

export interface PopupQrStats {
  popupId: string
  total: number // 전체 유입 수
  uniqueVisitors: number // 순 방문자 수 (브라우저 기준)
  today: number // 오늘(한국 시간) 유입 수
  last7Days: number // 최근 7일 유입 수
  lastScannedAt: string | null
}

export interface PopupQrScansRepository {
  record(popupId: string, visitorKey: string): Promise<boolean> // 새로 기록했으면 true
  stats(): Promise<PopupQrStats[]>
}

// 같은 브라우저가 같은 팝업 QR 을 이 시간 안에 다시 찍으면 한 번으로 셉니다
const DEDUPE_MINUTES = 30

const kstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

// 메모리 저장소 (DATABASE_URL 미설정 시). 재시작하면 초기화됨
class MemoryPopupQrScansRepository implements PopupQrScansRepository {
  private scans: { popupId: string; visitorKey: string; scannedAt: Date }[] = []

  async record(popupId: string, visitorKey: string) {
    const since = Date.now() - DEDUPE_MINUTES * 60 * 1000
    const duplicate = this.scans.some(
      (s) => s.popupId === popupId && s.visitorKey === visitorKey && s.scannedAt.getTime() >= since
    )
    if (duplicate) return false
    this.scans.push({ popupId, visitorKey, scannedAt: new Date() })
    return true
  }

  async stats() {
    const today = kstDate(new Date())
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const byPopup = new Map<string, typeof this.scans>()
    for (const s of this.scans) byPopup.set(s.popupId, [...(byPopup.get(s.popupId) || []), s])
    return [...byPopup.entries()].map(([popupId, scans]) => ({
      popupId,
      total: scans.length,
      uniqueVisitors: new Set(scans.map((s) => s.visitorKey)).size,
      today: scans.filter((s) => kstDate(s.scannedAt) === today).length,
      last7Days: scans.filter((s) => s.scannedAt.getTime() >= weekAgo).length,
      lastScannedAt: new Date(Math.max(...scans.map((s) => s.scannedAt.getTime()))).toISOString(),
    }))
  }
}

class PostgresPopupQrScansRepository implements PopupQrScansRepository {
  constructor(private db: NonNullable<typeof pool>) {}

  async record(popupId: string, visitorKey: string) {
    const { rowCount } = await this.db.query(
      `INSERT INTO popup_qr_scans (popup_id, visitor_key)
       SELECT $1::varchar, $2::varchar
       WHERE NOT EXISTS (
         SELECT 1 FROM popup_qr_scans
         WHERE popup_id = $1 AND visitor_key = $2 AND scanned_at >= NOW() - ($3 || ' minutes')::interval
       )`,
      [popupId, visitorKey, String(DEDUPE_MINUTES)]
    )
    return (rowCount ?? 0) > 0
  }

  async stats() {
    const { rows } = await this.db.query(
      `SELECT popup_id,
              COUNT(*)::int AS total,
              COUNT(DISTINCT visitor_key)::int AS unique_visitors,
              COUNT(*) FILTER (WHERE (scanned_at AT TIME ZONE 'Asia/Seoul')::date = (NOW() AT TIME ZONE 'Asia/Seoul')::date)::int AS today,
              COUNT(*) FILTER (WHERE scanned_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
              MAX(scanned_at) AS last_scanned_at
       FROM popup_qr_scans
       GROUP BY popup_id`
    )
    return rows.map((r) => ({
      popupId: r.popup_id,
      total: r.total,
      uniqueVisitors: r.unique_visitors,
      today: r.today,
      last7Days: r.last_7_days,
      lastScannedAt: r.last_scanned_at ? new Date(r.last_scanned_at).toISOString() : null,
    }))
  }
}

export const popupQrScansRepository: PopupQrScansRepository = pool
  ? new PostgresPopupQrScansRepository(pool)
  : new MemoryPopupQrScansRepository()

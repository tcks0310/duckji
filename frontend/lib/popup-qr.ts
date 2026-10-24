import { apiFetch } from "@/lib/api"
import { popupDetailHref } from "@/lib/popup-service"

// 팝업 현장 QR: QR 주소 만들기, QR 유입 기록, 관리자 집계 조회 (backend popups 서비스)

// QR 이 가리킬 사이트 주소. 배포 주소를 NEXT_PUBLIC_SITE_URL 로 지정하면 그 주소를 쓰고,
// 없으면 지금 열려 있는 관리자 페이지의 주소를 씁니다.
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, "")
  return typeof window !== "undefined" ? window.location.origin : "https://www.duckji.com"
}

// 예: https://www.duckji.com/popups/detail/?id=anime-xxx&ref=qr  → 팝업 상세 페이지 (예전 /?popup= QR 도 이 페이지로 넘어감)
export function buildPopupQrUrl(popupId: string) {
  return `${getSiteUrl()}${popupDetailHref(popupId)}&ref=qr`
}

const VISITOR_KEY_STORAGE = "dukji_qr_visitor"

// 브라우저마다 임의로 만든 값 (순 방문자 집계용, 개인정보 아님)
function getVisitorKey() {
  try {
    let key = localStorage.getItem(VISITOR_KEY_STORAGE)
    if (!key) {
      key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem(VISITOR_KEY_STORAGE, key)
    }
    return key
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

// QR 로 들어온 접속 1회 기록. 실패해도 화면에는 영향 없음
export async function recordPopupQrScan(popupId: string) {
  try {
    await apiFetch(`/api/popups/${encodeURIComponent(popupId)}/qr-scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorKey: getVisitorKey() }),
    })
  } catch {}
}

export interface PopupQrStats {
  popupId: string
  total: number
  uniqueVisitors: number
  today: number
  last7Days: number
  lastScannedAt: string | null
}

// 관리자: 팝업별 QR 유입 집계
export async function fetchPopupQrStats(): Promise<Record<string, PopupQrStats>> {
  const res = await apiFetch("/api/popups/qr/stats", { cache: "no-store" })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "QR 유입 집계를 불러오지 못했습니다.")
  return Object.fromEntries((json.stats as PopupQrStats[]).map((s) => [s.popupId, s]))
}

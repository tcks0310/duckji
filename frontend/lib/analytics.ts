import { API_BASE_URL } from "@/lib/api"

// 방문 통계 기록 (backend analytics 서비스 → 관리자 센터 > 방문 통계). 실패해도 화면 동작에는 영향을 주지 않습니다.
// - visitorId: 이 브라우저에 만든 무작위 값 (회원 정보·IP 와 연결하지 않음)
// - sessionId: 한 번의 방문. 30분 동안 움직임이 없으면 새 방문
// 운영에서는 사이트 주소(www.duckji.com/api/...)로 보내 CloudFront 가 접속 국가를 붙여 줍니다.

const VISITOR_KEY = "duckji_vid"
const SESSION_KEY = "duckji_sid"
const SESSION_IDLE_MS = 30 * 60 * 1000

type Kind = "pageview" | "search" | "signup"

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16)
      })

function ids(): { visitorId: string; sessionId: string; isNewSession: boolean } | null {
  try {
    let visitorId = localStorage.getItem(VISITOR_KEY)
    if (!visitorId) {
      visitorId = uuid()
      localStorage.setItem(VISITOR_KEY, visitorId)
    }
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as { id: string; last: number } | null
    const now = Date.now()
    const isNewSession = !saved || now - saved.last > SESSION_IDLE_MS
    const sessionId = isNewSession ? uuid() : saved!.id
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, last: now }))
    return { visitorId, sessionId, isNewSession }
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 기록하지 않음
    return null
  }
}

const endpoint = () =>
  /(^|\.)duckji\.com$/.test(window.location.hostname)
    ? `${window.location.origin}/api/analytics/events`
    : `${API_BASE_URL}/api/analytics/events`

function send(kind: Kind, extra: Record<string, string> = {}) {
  if (typeof window === "undefined" || navigator.webdriver) return
  const path = window.location.pathname
  if (path.startsWith("/admin")) return
  const id = ids()
  if (!id) return

  const body: Record<string, string> = { kind, visitorId: id.visitorId, sessionId: id.sessionId, path, lang: navigator.language || "", ...extra }
  // 유입 경로는 방문의 첫 기록에만: 다른 사이트에서 왔으면 그 주소, ?utm_source= / ?ref= (QR 등)
  if (id.isNewSession) {
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) body.referrer = document.referrer
    const params = new URLSearchParams(window.location.search)
    const utm = params.get("utm_source") || params.get("ref")
    if (utm) body.utmSource = utm
  }

  fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}

export const trackPageview = () => send("pageview")

export function trackSearch(query: string) {
  const q = query.trim()
  if (q) send("search", { searchQuery: q })
}

export const trackSignup = () => send("signup")

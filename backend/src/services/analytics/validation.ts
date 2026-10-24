import { DEVICES, EVENT_KINDS, PERIOD_DAYS, type Device, type EventInput, type EventKind } from "./types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOST_RE = /^[a-z0-9.-]{1,100}$/
const COUNTRY_RE = /^[A-Z]{2}$/

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "")

// 검색 로봇·미리보기 봇은 기록하지 않음
export const isBot = (userAgent: string) =>
  !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|yeti|daum|python|curl|wget/i.test(userAgent)

// 휴대폰·태블릿·PC 구분 (User-Agent 기준)
export function deviceFromUserAgent(userAgent: string): Device {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet"
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile"
  return "desktop"
}

export type EventValidation = { ok: true; value: EventInput } | { ok: false; error: string }

// 브라우저가 보낸 기록 확인. country·device 는 서버가 헤더에서 채움
export function validateEvent(
  body: Record<string, unknown>,
  server: { country: string | null; device: Device; ownHost: string }
): EventValidation {
  const kind = body.kind as EventKind
  if (!EVENT_KINDS.includes(kind)) return { ok: false, error: `kind 는 ${EVENT_KINDS.join(", ")} 중 하나여야 합니다.` }
  const visitorId = text(body.visitorId, 36)
  const sessionId = text(body.sessionId, 36)
  if (!UUID_RE.test(visitorId) || !UUID_RE.test(sessionId)) return { ok: false, error: "visitorId·sessionId 가 올바르지 않습니다." }

  const path = text(body.path, 200).split(/[?#]/)[0]
  if (!path.startsWith("/")) return { ok: false, error: "path 가 올바르지 않습니다." }
  // 관리자 화면은 통계에서 뺌
  if (path.startsWith("/admin")) return { ok: false, error: "관리자 화면은 기록하지 않습니다." }

  // 다른 사이트에서 들어온 경우만 주소(호스트)를 남김
  let referrerHost: string | null = null
  const ref = text(body.referrer, 500)
  if (ref) {
    try {
      const host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "")
      if (HOST_RE.test(host) && !host.endsWith(server.ownHost) && host !== "localhost") referrerHost = host
    } catch {
      // 주소가 아니면 무시
    }
  }

  const utmSource = text(body.utmSource, 60).toLowerCase() || null
  const searchQuery = kind === "search" ? text(body.searchQuery, 80).toLowerCase() || null : null
  if (kind === "search" && !searchQuery) return { ok: false, error: "searchQuery 가 필요합니다." }

  const lang = text(body.lang, 10) || null
  const country = server.country && COUNTRY_RE.test(server.country) ? server.country : null
  const device = DEVICES.includes(server.device) ? server.device : null

  return { ok: true, value: { kind, visitorId, sessionId, path, referrerHost, utmSource, searchQuery, country, device, lang } }
}

// 관리자 조회 기간: ?days=1|7|30|90 (기본 7)
export function parseDays(value: string | undefined) {
  const n = Math.trunc(Number(value))
  return (PERIOD_DAYS as readonly number[]).includes(n) ? n : 7
}

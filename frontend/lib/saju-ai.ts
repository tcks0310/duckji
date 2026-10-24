import { apiFetch } from "./api"

// 덕지 도사 AI 사주 (backend saju 서비스, 로그인 회원 전용)
// 회원 정보(가입 정보)는 쓰지 않음. 사주에 넣은 정보와 결과는 사주 서버의 이용 기록으로 남고, 다른 기기에서는 마지막으로 넣은 정보를 불러와 이어 봅니다.

export type SajuElement = "wood" | "fire" | "earth" | "metal" | "water"
export type SajuTopic = "overall" | "personality" | "taste" | "love" | "wealth" | "future"

export interface SajuBirth {
  year: number
  month: number
  day: number
  calendar: "solar" | "lunar"
  leapMonth: boolean
  hour: number | null
  minute: number | null
  gender: "F" | "M"
}

export interface SajuChar {
  hanja: string
  hangul: string
  element: SajuElement
  yang: boolean
  tenGod: string | null
}

export interface SajuPillar {
  key: "hour" | "day" | "month" | "year"
  label: string
  stem: SajuChar
  branch: SajuChar & { hidden: string[] }
}

export interface SajuChart {
  key: string
  input: { solarDate: string; lunarDate: string | null; time: string | null; correctedTime: string | null; gender: "F" | "M" }
  pillars: (SajuPillar | null)[]
  dayMaster: { hanja: string; hangul: string; element: SajuElement; image: string }
  elements: Record<SajuElement, number>
  strength: { score: number; label: string }
  favorable: SajuElement[]
  relations: string[]
  daeun: { forward: boolean; list: { ganzhi: string; hangul: string; startYear: number; age: number; current: boolean }[] }
  seun: { year: number; ganzhi: string; hangul: string; tenGod: string }[]
}

export interface SajuReading {
  text: string
  summary: string
  suggestions: string[]
}

export const SAJU_TOPICS: { id: SajuTopic; label: string; icon: string; desc: string }[] = [
  { id: "overall", label: "종합 풀이", icon: "🧭", desc: "타고난 큰 그림 한 번에" },
  { id: "personality", label: "성격", icon: "🙂", desc: "겉모습과 속마음" },
  { id: "taste", label: "취향", icon: "🎧", desc: "덕질 스타일·끌리는 장르" },
  { id: "love", label: "이성", icon: "💕", desc: "끌리는 사람·인연의 때" },
  { id: "wealth", label: "재물", icon: "💰", desc: "돈 버는 결·새는 곳" },
  { id: "future", label: "미래", icon: "🔮", desc: "지금 대운과 올해·내년" },
]

export const ELEMENT_STYLE: Record<SajuElement, { ko: string; text: string; bg: string }> = {
  wood: { ko: "목", text: "text-emerald-300", bg: "bg-emerald-400" },
  fire: { ko: "화", text: "text-rose-300", bg: "bg-rose-400" },
  earth: { ko: "토", text: "text-amber-300", bg: "bg-amber-400" },
  metal: { ko: "금", text: "text-zinc-100", bg: "bg-zinc-200" },
  water: { ko: "수", text: "text-sky-300", bg: "bg-sky-400" },
}

// 오늘의 덕질 운세 (날마다·시간마다 바뀜)
export type SajuDailyTopic = "chemi" | "bias" | "charm" | "wallet" | "ticket"

export const SAJU_DAILY: { id: SajuDailyTopic; label: string; icon: string; tag: string; ask: string; needsBias?: boolean }[] = [
  { id: "chemi", label: "최애와 케미", icon: "💞", tag: "오늘 궁합", ask: "오늘 최애랑 케미 어때요?", needsBias: true },
  { id: "bias", label: "최애 떡밥 운", icon: "📸", tag: "셀카·라이브", ask: "오늘 최애 떡밥 올까요?", needsBias: true },
  { id: "charm", label: "오늘 내 매력", icon: "💘", tag: "도화살 지수", ask: "오늘 제 매력 어때요?" },
  { id: "wallet", label: "지갑 방어력", icon: "💸", tag: "굿즈 결제", ask: "오늘 결제해도 괜찮을까요?" },
  { id: "ticket", label: "금손 기운", icon: "🎫", tag: "티켓팅·응모", ask: "오늘 티켓팅 운 어때요?" },
]

export interface SajuDailyStats {
  date: string
  topic: SajuDailyTopic
  metric: string
  score: number
  today: { ganzhi: string; hangul: string }
  hour: { range: string; buff: number }
  bestHour: string
  luckyColor: string
}

export interface SajuDailyReading {
  headline: string
  text: string
  suggestions: string[]
}

export interface SajuBias {
  name: string
  year: number
  month: number
  day: number
}

export type SajuResult<T> = ({ ok: true } & T) | { ok: false; status: number; code?: string; error: string }

async function post<T>(path: string, body: unknown): Promise<SajuResult<T>> {
  try {
    const res = await apiFetch(`/api/saju${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.success) return { ok: true, ...(json as T) }
    return {
      ok: false,
      status: res.status,
      code: json?.code,
      error: json?.error || (res.status === 401 ? "로그인이 필요해요." : "덕지 도사가 잠시 자리를 비웠다덕. 조금 뒤에 다시 와 달라덕."),
    }
  } catch {
    return { ok: false, status: 0, error: "연결이 끊겼다덕. 잠시 뒤에 다시 해 달라덕." }
  }
}

// 앱(웹뷰)에서는 DP 대신 하루 무료 횟수 (서버가 UA 의 DuckjiApp 으로 판단)
export type SajuAppFree = { limit: number; left: number }

export const fetchSajuChart = (birth: SajuBirth, name = "") =>
  post<{ chart: SajuChart; readings: Partial<Record<SajuTopic, SajuReading>>; dailyCounts: Record<string, number>; available: boolean; price: number; appFree?: SajuAppFree | null }>("/chart", { birth, name })

export const fetchSajuReading = (birth: SajuBirth, topic: SajuTopic) =>
  post<{ reading: SajuReading; cached: boolean; charged?: number; balance?: number; freeLeft?: number }>("/reading", { birth, topic })

export const askSaju = (birth: SajuBirth, messages: { role: "user" | "assistant"; content: string }[]) =>
  post<{ answer: string; suggestions: string[]; charged?: number; balance?: number; freeLeft?: number }>("/ask", { birth, messages })

export const fetchSajuDaily = (birth: SajuBirth, bias: SajuBias | null, topic: SajuDailyTopic) =>
  post<{ stats: SajuDailyStats; reading: SajuDailyReading | null; cached: boolean; dailyCounts: Record<string, number>; charged?: number; balance?: number; freeLeft?: number; code?: string; price?: number }>("/daily", {
    birth,
    topic,
    bias: bias ? { year: bias.year, month: bias.month, day: bias.day, name: bias.name } : null,
  })

export async function fetchSajuToday(): Promise<Record<string, number>> {
  try {
    const res = await apiFetch("/api/saju/today")
    const json = await res.json().catch(() => null)
    return json?.success ? json.dailyCounts || {} : {}
  } catch {
    return {}
  }
}

// 다른 기기에서 넣었던 사주 정보를 불러와 이 브라우저에도 기억 (사주 이용 기록에서 가져옴)
export async function syncLastInput(): Promise<void> {
  try {
    const res = await apiFetch("/api/saju/me")
    const json = await res.json().catch(() => null)
    const last = json?.success ? json.lastInput : null
    if (!last?.birth) return
    localStorage.setItem(STORE_KEY, JSON.stringify({ birth: last.birth, name: last.name || "" }))
    if (last.bias?.year) localStorage.setItem(BIAS_KEY, JSON.stringify({ name: "", ...last.bias }))
  } catch {}
}

const BIAS_KEY = "dukji_saju_ai_bias"

export function loadBias(): SajuBias | null {
  try {
    const v = JSON.parse(localStorage.getItem(BIAS_KEY) || "null")
    return v?.year ? v : null
  } catch {
    return null
  }
}

export function saveBias(bias: SajuBias | null) {
  try {
    if (bias) localStorage.setItem(BIAS_KEY, JSON.stringify(bias))
    else localStorage.removeItem(BIAS_KEY)
  } catch {}
}

const STORE_KEY = "dukji_saju_ai_birth"

export function loadSavedBirth(): { birth: SajuBirth; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || "null")
    return v?.birth?.year ? v : null
  } catch {
    return null
  }
}

export function saveBirth(birth: SajuBirth, name: string) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ birth, name }))
  } catch {}
}

export function clearSavedBirth() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {}
}

export function describeBirth(b: SajuBirth): string {
  const cal = b.calendar === "lunar" ? `음력${b.leapMonth ? "(윤달)" : ""}` : "양력"
  const time = b.hour === null ? "태어난 시각 모름" : `${b.hour}시 ${String(b.minute ?? 0).padStart(2, "0")}분`
  return `${cal} ${b.year}년 ${b.month}월 ${b.day}일, ${time}, ${b.gender === "F" ? "여성" : "남성"}`
}

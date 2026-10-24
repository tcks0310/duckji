import { ApiError } from "@/lib/community-api"
import { apiFetch } from "@/lib/api"

// 덕지 펀딩 · 파티: 애니메이션 이벤트 캘린더 API (backend party 서비스)

export type PartyEventKind = "birthday" | "anniversary" | "story" | "real"
export type PartyEventStatus = "submitted" | "published" | "rejected" | "hidden"

export const PARTY_EVENT_KIND_LABELS: Record<PartyEventKind, string> = {
  birthday: "생일",
  anniversary: "기념일",
  story: "작중 사건",
  real: "실제 행사",
}

export const PARTY_EVENT_STATUS_LABELS: Record<PartyEventStatus, string> = {
  submitted: "제보 접수",
  published: "게시 중",
  rejected: "반려",
  hidden: "숨김",
}

// 연결 갤러리를 정하지 않은 이벤트의 "파티할래요?" 글은 덕지 갤러리 스토어 > 펀딩 모집 갤러리에 씀 (hj 10-18)
// 실제로 쓸 갤러리는 서버가 partyGallerySlug 로 알려 줌 (갤러리가 없으면 스쿼드 구하기)
export const PARTY_GALLERY_SLUG = "store-funding-recruit"
export const PARTY_POST_HEAD = "파티할래요?"

export interface PartyEvent {
  id: number
  slug: string
  title: string
  kind: PartyEventKind
  workTitle: string
  characterName: string | null
  month: number
  day: number
  year: number | null // null 이면 매년 반복
  description: string
  imageUrl: string | null
  source: string
  gallerySlug: string | null
  status: PartyEventStatus
  rejectReason: string | null
  suggestedBy: string | null
  postCount: number
  createdAt: string
}

export interface PartyPost {
  id: number
  head: string
  title: string
  authorId: string
  authorName: string
  voteCount: number
  commentCount: number
  createdAt: string
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  let res: Response
  try {
    res = await apiFetch(path, {
      cache: "no-store",
      ...rest,
      headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new ApiError(data.error || data.errors?.[0] || "요청을 처리하지 못했습니다.", res.status)
  }
  return data as T
}

// ---------- 공개 ----------
export const fetchPartyEvents = (params: { month?: number; q?: string } = {}) => {
  const qs = new URLSearchParams()
  if (params.month) qs.set("month", String(params.month))
  if (params.q) qs.set("q", params.q)
  const query = qs.toString()
  return request<{ events: PartyEvent[] }>(`/api/party/events${query ? `?${query}` : ""}`).then((r) => r.events)
}

export const fetchPartyEvent = (slug: string) =>
  request<{ event: PartyEvent; posts: PartyPost[]; partyGallerySlug: string }>(`/api/party/events/${encodeURIComponent(slug)}`)

export const fetchPartyEventByPost = (postId: number) =>
  request<{ event: PartyEvent }>(`/api/party/posts/${postId}/event`).then((r) => r.event)

// board 에 쓴 글을 이벤트에 연결
export const linkPartyPost = (slug: string, postId: number) =>
  request(`/api/party/events/${encodeURIComponent(slug)}/posts`, { method: "POST", json: { postId } })

export const suggestPartyEvent = (input: {
  title: string
  kind: PartyEventKind
  workTitle: string
  characterName?: string
  month: number
  day: number
  description?: string
  source?: string
}) => request<{ event: { slug: string; status: string } }>("/api/party/suggestions", { method: "POST", json: input })

// ---------- 관리자 ----------
export const fetchAdminPartyEvents = (status?: PartyEventStatus) =>
  request<{ events: PartyEvent[] }>(`/api/party/admin/events${status ? `?status=${status}` : ""}`).then((r) => r.events)

export const createPartyEvent = (input: Partial<PartyEvent>) =>
  request<{ event: PartyEvent }>("/api/party/admin/events", { method: "POST", json: input }).then((r) => r.event)

export const updatePartyEvent = (slug: string, input: Partial<PartyEvent> & { reason?: string }) =>
  request<{ event: PartyEvent }>(`/api/party/admin/events/${encodeURIComponent(slug)}`, { method: "PATCH", json: input }).then(
    (r) => r.event
  )

// ---------- 날짜 ----------
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// 윤년이 아닌 해의 2월 29일 이벤트는 2월 28일에 표시
function dateIn(year: number, month: number, day: number) {
  const last = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(day, last))
}

// 오늘 이후 가장 가까운 날 (특정 연도 이벤트가 지났으면 null)
export function nextOccurrence(event: Pick<PartyEvent, "month" | "day" | "year">, from = new Date()): Date | null {
  const today = startOfDay(from)
  if (event.year) {
    const d = dateIn(event.year, event.month, event.day)
    return d >= today ? d : null
  }
  const thisYear = dateIn(today.getFullYear(), event.month, event.day)
  return thisYear >= today ? thisYear : dateIn(today.getFullYear() + 1, event.month, event.day)
}

export function daysUntil(date: Date, from = new Date()) {
  return Math.round((date.getTime() - startOfDay(from).getTime()) / 86_400_000)
}

export function formatDDay(event: Pick<PartyEvent, "month" | "day" | "year">) {
  const next = nextOccurrence(event)
  if (!next) return "지난 이벤트"
  const d = daysUntil(next)
  return d === 0 ? "D-DAY" : `D-${d}`
}

export const formatEventDate = (event: Pick<PartyEvent, "month" | "day" | "year">) =>
  `${event.year ? `${event.year}년 ` : "매년 "}${event.month}월 ${event.day}일`

// yyyy-mm-dd (펀딩 개설 폼 eventDate 파라미터)
export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// 이 이벤트로 펀딩 열기 주소 (/funding/new 가 eventId·eventTitle·workTag·eventDate 로 일정·제목을 미리 채움)
export function partyFundingHref(event: PartyEvent) {
  const next = nextOccurrence(event)
  const qs = new URLSearchParams({ eventId: event.slug, eventTitle: event.title, workTag: event.workTitle })
  if (next) qs.set("eventDate", toDateInput(next))
  return `/funding/new?${qs}`
}

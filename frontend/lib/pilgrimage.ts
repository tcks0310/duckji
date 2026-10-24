"use client"

import { apiFetch } from "@/lib/api"

// 덕지순례 코스 (backend rewards 서비스 /api/rewards/pilgrimage)
// 관리자가 만든 코스·순서 있는 장소·후기. 현장 도장은 lib/rewards 의 checkInPilgrimage

export type PilgrimageSpotInfo = {
  id: string
  name: string
  address: string
  addressDetail: string // 상세 주소·찾아가는 설명 (예: 2층, OO 건물 앞 벽화)
  lat: number
  lng: number
  imageUrl: string
  description: string
  stayTime: string
  nextMove: string // 다음 장소까지 (예: 도보 8분)
  radiusM: number
}

export type PilgrimageCourseInfo = {
  id: string
  title: string
  summary: string
  coverImage: string
  gallery: string[]
  theme: string
  tags: string[]
  region: string
  durationText: string
  rewardDp: number
  completions: number
  reviewCount: number
  avgRating: number | null
  routeLegs?: (RouteLeg | null)[]
  spots: PilgrimageSpotInfo[]
}

export type ReviewAuthor = {
  nickname: string
  avatarUrl: string
  joinedAt: string | null
  withdrawn: boolean
  completions: number // 덕지순례 완주 수 (전체 코스)
  squad: { name: string; size: number } | null
}

export type PilgrimageReview = {
  key: string
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
  mine: boolean
  completedThis: boolean
  author: ReviewAuthor
}

export type MyReview = { rating: number; comment: string; hidden: boolean; updatedAt: string }

export type CourseList = { courses: PilgrimageCourseInfo[]; visited: string[]; completed: string[]; spotDp: number }
export type CourseDetail = { course: PilgrimageCourseInfo; reviews: PilgrimageReview[]; myReview: MyReview | null; visited: string[]; completed: string[]; spotDp: number }

export const REVIEW_MAX = 100

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

async function call<T>(path: string, method = "GET", json?: unknown): Promise<Result<T>> {
  try {
    const res = await apiFetch(`/api/rewards/pilgrimage${path}`, {
      method,
      cache: "no-store",
      headers: json === undefined ? undefined : { "Content-Type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) return { ok: false, status: res.status, error: body.error || "요청을 처리하지 못했습니다." }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: 0, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

export const fetchCourses = () => call<CourseList>("/courses")
export const fetchCourse = (id: string) => call<CourseDetail>(`/courses/${encodeURIComponent(id)}`)
export const saveMyReview = (id: string, rating: number, comment: string) =>
  call<CourseDetail>(`/courses/${encodeURIComponent(id)}/review`, "PUT", { rating, comment })
export const deleteMyReview = (id: string) => call<CourseDetail>(`/courses/${encodeURIComponent(id)}/review`, "DELETE")

// 기본 주소 + 상세 주소
export const fullAddress = (s: { address?: string; addressDetail?: string }) => [s.address, s.addressDetail].filter(Boolean).join(" ")

// 네이버 지도 검색 링크 (주소가 있으면 주소, 없으면 이름)
export const naverMapLink = (spot: { name: string; address?: string }) =>
  `https://map.naver.com/p/search/${encodeURIComponent(spot.address || spot.name)}`

// 좌표 확인 링크 (핀이 꽂힌 지도)
export const coordinateLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

export const courseDetailHref = (id: string) => `/popups/pilgrimage/detail/?id=${encodeURIComponent(id)}`

// 덕지순례 장소 번호 색: 1~7 빨주노초파남보, 8 흰색, 9 검정, 10번부터는 다시 빨강부터
// hex 는 지도 마커, cls 는 화면 번호 동그라미에 씀 (노랑·흰색은 글자를 어둡게)
export const STEP_COLORS = [
  { hex: "#ef4444", text: "#ffffff", cls: "bg-red-500 text-white" },
  { hex: "#f97316", text: "#ffffff", cls: "bg-orange-500 text-white" },
  { hex: "#facc15", text: "#18181b", cls: "bg-yellow-400 text-zinc-900" },
  { hex: "#22c55e", text: "#ffffff", cls: "bg-green-500 text-white" },
  { hex: "#3b82f6", text: "#ffffff", cls: "bg-blue-500 text-white" },
  { hex: "#4f46e5", text: "#ffffff", cls: "bg-indigo-600 text-white" },
  { hex: "#8b5cf6", text: "#ffffff", cls: "bg-violet-500 text-white" },
  { hex: "#ffffff", text: "#18181b", cls: "bg-white text-zinc-900" },
  { hex: "#18181b", text: "#ffffff", cls: "bg-zinc-950 text-white ring-1 ring-zinc-500" },
] as const
export const stepPalette = (i: number) => STEP_COLORS[((i % STEP_COLORS.length) + STEP_COLORS.length) % STEP_COLORS.length]

// 장소 사이 실제 걷는 길 (카카오 도보 경로, 관리자가 코스를 저장할 때 계산해 둠). 좌표는 [위도, 경도]
export type RouteLeg = { from: [number, number]; to: [number, number]; path: [number, number][]; distanceM: number | null; durationS: number | null }

const near = (a: [number, number], lat: number, lng: number) => Math.abs(a[0] - lat) < 2e-5 && Math.abs(a[1] - lng) < 2e-5
// 두 장소 사이 저장된 걷는 길 (장소를 옮겨 좌표가 달라졌으면 없음 → 직선)
export function legBetween(legs: (RouteLeg | null)[] | undefined, a: { lat: number; lng: number }, b: { lat: number; lng: number }): RouteLeg | null {
  return legs?.find((l): l is RouteLeg => Boolean(l && near(l.from, a.lat, a.lng) && near(l.to, b.lat, b.lng))) ?? null
}

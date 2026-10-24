"use client"

import { apiFetch } from "@/lib/api"
import { getSiteUrl } from "@/lib/popup-qr"
import { loadPoints, type PointResult } from "@/lib/member-points"

// 서버가 확인한 뒤 주는 덕지 포인트 (backend rewards 서비스 /api/rewards)
// 코드 등록·덕력 퀴즈·광고 충전. 받으면 화면 잔액을 다시 불러옴
// 결과는 member-points 의 PointResult 와 같은 모양이라 화면의 로그인 안내·오류 알림을 그대로 씀

export type RewardResult<T = {}> = Exclude<PointResult, { status: "ok" }> | ({ status: "ok"; balance: number; amount: number } & T)

async function call<T>(path: string, init?: { method?: string; json?: unknown }): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code?: string }> {
  try {
    const res = await apiFetch(`/api/rewards${path}`, {
      method: init?.method || "GET",
      cache: "no-store",
      headers: init?.json === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.json === undefined ? undefined : JSON.stringify(init.json),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) return { ok: false, status: res.status, error: body.error || "요청을 처리하지 못했습니다.", code: body.code }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: 0, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

async function earn<T extends { balance: number }>(path: string, json: unknown, amountOf: (d: T) => number): Promise<RewardResult<{ data: T }>> {
  const r = await call<T>(path, { method: "POST", json })
  if (!r.ok) return r.status === 401 ? { status: "login" } : { status: "error", error: r.error }
  loadPoints()
  return { status: "ok", balance: r.data.balance, amount: amountOf(r.data), data: r.data }
}

// ---- 코드 ----

// kind: popup = 팝업 관련, goods = 굿즈 관련, general = 일반 배포, creator = 크리에이터 제휴 (회원당 하나)
export type RewardCodeKind = "popup" | "goods" | "general" | "creator"
export type RedeemedCode = { code: string; kind: RewardCodeKind; name: string; targetName: string; rewardDp: number; rewardItem: string; balance: number }

// 코드 등록 (아무 종류나, 마이페이지 포인트 관리)
export const redeemCode = (code: string) => earn<RedeemedCode>("/codes", { code }, (d) => d.rewardDp)

// ---- 덕력 퀴즈 (주제 → 버전, 회원은 버전마다 처음 한 번 보상) ----

export type QuizAttempt = { correct: number; total: number; rewardDp: number; createdAt: string }
export type QuizCatalog = {
  topics: {
    id: number
    title: string
    description: string
    versions: { id: number; title: string; description: string; questionCount: number; maxRewardDp: number; mine: QuizAttempt | null }[]
  }[]
}
export type QuizPlay = {
  version: { id: number; topicTitle: string; title: string; description: string; baseDp: number; perCorrectDp: number; maxRewardDp: number }
  questions: { id: number; question: string; options: { id: number; label: string }[] }[]
  mine: QuizAttempt | null
}
export type QuizSubmitted =
  | { member: false; correct: number; total: number }
  | {
      member: true
      correct: number
      total: number
      results: { id: number; picked: number; answer: number; correct: boolean; explanation: string }[]
      earnedDp: number
      firstTry: boolean
      balance: number | null
      mine: QuizAttempt | null
    }

export async function fetchQuizCatalog() {
  const r = await call<QuizCatalog>("/quiz")
  return r.ok ? r.data : null
}

export async function fetchQuizVersion(id: number) {
  const r = await call<QuizPlay>(`/quiz/versions/${id}`)
  return r.ok ? { ok: true as const, ...r.data } : { ok: false as const, error: r.error }
}

// answers: 문제 id → 고른 보기 id
export async function submitQuiz(id: number, answers: Record<number, number>) {
  const r = await call<QuizSubmitted>(`/quiz/versions/${id}/submit`, { method: "POST", json: { answers } })
  if (!r.ok) return { ok: false as const, error: r.error }
  if (r.data.member && r.data.earnedDp > 0) loadPoints()
  return { ok: true as const, data: r.data }
}

// ---- 스쿼드 (홈 팝업창용. 스쿼드 페이지는 lib/squads.ts) ----

export type SquadMember = { name: string; isLeader: boolean; isMe: boolean; joinedAt: string }
export type Squad = { id?: number; name?: string; code: string; size: number; rewardDp: number; isLeader: boolean; completedAt: string | null; members: SquadMember[] }
export type SquadPreview = { code: string; leaderName: string; members: number; size: number; full: boolean }
type SquadResult<T> = { status: "ok"; data: T } | { status: "login" } | { status: "error"; error: string }

const squadCall = async <T>(path: string, method = "GET"): Promise<SquadResult<T>> => {
  const r = await call<T>(path, method === "GET" ? undefined : { method, json: {} })
  if (!r.ok) return r.status === 401 ? { status: "login" } : { status: "error", error: r.error }
  return { status: "ok", data: r.data }
}

// 내 스쿼드 (비로그인이면 login)
export const fetchMySquad = () => squadCall<{ squad: Squad | null }>("/squads/mine")
export const createSquad = () => squadCall<{ squad: Squad }>("/squads", "POST")
export const leaveSquad = () => squadCall<{ disbanded: boolean }>("/squads/leave", "POST")
export const previewSquad = (code: string) => squadCall<{ squad: SquadPreview }>(`/squads/${encodeURIComponent(code)}`)

// 들어가기. 세 번째로 들어와 완성되면 DP 를 받음
export async function joinSquad(code: string): Promise<SquadResult<{ squad: Squad; rewardDp: number }>> {
  const r = await squadCall<{ squad: Squad; rewardDp: number }>(`/squads/${encodeURIComponent(code)}/join`, "POST")
  if (r.status === "ok" && r.data.rewardDp) loadPoints()
  return r
}

export const buildSquadInviteUrl = (code: string) => `${getSiteUrl()}/community/gallery/squads/?join=${encodeURIComponent(code)}`

// ---- 덕지순례 ----

export type PilgrimageOverview = { visited: string[]; completed: string[]; completedCounts: Record<string, number>; readySpots: string[]; spotDp: number }

export async function fetchPilgrimage() {
  const r = await call<PilgrimageOverview>("/pilgrimage")
  return r.ok ? r.data : null
}

// 휴대폰 위치 (권한 거부·실패면 오류 문구)
function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | { error: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "이 기기에서는 위치를 확인할 수 없습니다." })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => resolve({ error: e.code === 1 ? "위치 권한을 허용해야 도장을 찍을 수 있어요." : "위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  })
}

// 현장 도장: 위치를 서버에 보내 스팟 반경 안인지 확인받음 (위치는 서버에 저장되지 않음)
export async function checkInPilgrimage(spotId: string) {
  const pos = await currentPosition()
  if ("error" in pos) return { status: "error" as const, error: pos.error }
  return earn<{ spotId: string; courseId: string; rewardDp: number; courseCompleted: boolean; courseRewardDp: number; balance: number }>(
    `/pilgrimage/spots/${encodeURIComponent(spotId)}/check-in`,
    pos,
    (d) => d.rewardDp + d.courseRewardDp
  )
}

// ---- 오늘의 타로 ----

// 한 장·4장 뽑기·주사위 도장 DP. 종류마다 하루 한 번, 금액은 서버가 정함
export const claimTarotDaily = (type: "single" | "draw" | "dice") =>
  earn<{ type: string; rewardDp: number; balance: number }>("/tarot/daily", { type }, (d) => d.rewardDp)

"use client"

import { useEffect, useSyncExternalStore } from "react"
import { apiFetch } from "@/lib/api"

// 덕지 포인트(DP): 로그인한 회원만 가지며 서버 원장에 기록됩니다 (backend users 서비스 /api/users/me/points).
// 비로그인이면 잔액이 null 이라 화면에 표시하지 않고, 받기·쓰기는 "login" 을 돌려줘 로그인을 안내합니다.
// 지급 금액·한도는 서버 규칙(backend/src/services/users/point-rules.ts)이 정합니다.

export type PointResult = { status: "ok"; balance: number; amount: number } | { status: "login" } | { status: "error"; error: string }

type PointState = { status: "unknown" | "loading" | "guest" | "member"; balance: number | null }

const EMPTY: PointState = { status: "unknown", balance: null }
let state: PointState = EMPTY
const listeners = new Set<() => void>()
const setState = (next: PointState) => {
  state = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

let loadSeq = 0

// 서버에 로그인 세션이 없거나(만료·회원 DB 에 없음) 정지된 회원인데 브라우저에 예전 로그인 표시(dukji_user)가
// 남아 있으면 지우고 한 번 새로고침. 그대로 두면 회원 목록에 없는데 로그인된 것처럼 보임
function dropStaleLogin() {
  try {
    if (!localStorage.getItem("dukji_user")) return
    localStorage.removeItem("dukji_user")
    window.location.reload()
  } catch {
    // 저장소를 못 쓰는 브라우저는 그대로
  }
}

// 서버에서 내 잔액 불러오기 (로그인 직후에도 부릅니다)
export async function loadPoints() {
  const seq = ++loadSeq
  if (state.status === "unknown") setState({ ...state, status: "loading" })
  try {
    const res = await apiFetch("/api/users/me/points", { cache: "no-store" })
    if (seq !== loadSeq) return
    if (res.status === 401 || res.status === 403) {
      setState({ status: "guest", balance: null })
      return dropStaleLogin()
    }
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error)
    setState({ status: "member", balance: json.balance })
  } catch {
    if (seq === loadSeq) setState({ status: "unknown", balance: null })
  }
}

// 로그아웃: 화면에서 포인트 숨기기
export function clearPoints() {
  loadSeq++
  setState({ status: "guest", balance: null })
}

async function post(path: "earn" | "spend", reason: string, refId?: string, amount?: number): Promise<PointResult> {
  if (state.status !== "member") await loadPoints()
  if (state.status === "guest") return { status: "login" }
  try {
    const res = await apiFetch(`/api/users/me/points/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, refId, amount }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) {
      clearPoints()
      return { status: "login" }
    }
    if (!res.ok || !json.success) return { status: "error", error: json.error || "포인트를 처리하지 못했습니다." }
    setState({ status: "member", balance: json.balance })
    return { status: "ok", balance: json.balance, amount: json.amount }
  } catch {
    return { status: "error", error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

// 포인트 받기. reason 은 서버 규칙 코드 (quiz_reward, pilgrimage_spot ...), refId 는 같은 대상 중복 지급 방지용
export const earnPoints = (reason: string, refId?: string, amount?: number) => post("earn", reason, refId, amount)

// 포인트 쓰기 (화면에서 직접 쓰는 사용 규칙이 생기면)
export const spendPoints = (reason: string, refId?: string, amount?: number) => post("spend", reason, refId, amount)

export type PointHistoryItem = {
  id: number
  amount: number
  reason: string
  label: string
  refId: string | null
  memo: string | null
  isTest: boolean
  balanceAfter: number
  createdAt: string
}

// 내 포인트 내역 (최신순). before = 더 보기용 마지막 id
export async function fetchPointHistory(before?: number, limit = 30) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (before) q.set("before", String(before))
  const res = await apiFetch(`/api/users/me/points/history?${q}`, { cache: "no-store" })
  if (res.status === 401) return { success: false as const, login: true, error: "로그인이 필요합니다." }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) return { success: false as const, login: false, error: json.error || "내역을 불러오지 못했습니다." }
  return { success: true as const, balance: json.balance as number, history: json.history as PointHistoryItem[], hasMore: Boolean(json.hasMore) }
}

let autoLoaded = false

// 화면에서 쓰기: const { balance } = useMemberPoints(). balance 가 null 이면 비로그인(표시하지 않음)
export function useMemberPoints() {
  useEffect(() => {
    if (autoLoaded) return
    autoLoaded = true
    loadPoints()
  }, [])
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

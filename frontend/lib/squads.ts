"use client"

import { apiFetch } from "@/lib/api"
import { loadPoints } from "@/lib/member-points"
import { getSiteUrl } from "@/lib/popup-qr"

// 스쿼드 (backend rewards 서비스 /api/rewards/squads)
// 둘러보기·상세는 누구나, 내 스쿼드·채팅·가입 신청은 회원. 실패하면 { ok: false, status, error }

export type SquadLook = {
  id: number
  name: string
  intro: string
  icon: string
  color: string
  imageUrl: string | null
  coverUrl: string | null // 스쿼드 홈 표지
  notice: string // 스쿼드 홈 공지 (리더가 씀)
  links: { url: string; label: string }[] // 스쿼드 SNS
  joinPolicy: "open" | "request"
  createdAt: string
  completed: boolean
}
export type SquadCard = SquadLook & { memberCount: number; leaderName: string }
export type SquadMemberView = { name: string; avatarUrl: string | null; isLeader: boolean; isMe: boolean; joinedAt: string }
export type SquadEvent = {
  id: number
  type: string
  memberName: string | null
  detail: { from?: string; to?: string; dp?: number; count?: number }
  createdAt: string
}
export type SquadDetail = {
  squad: SquadCard & { maxMembers: number; rewardAt: number; rewardDp: number }
  members: SquadMemberView[]
  activity: { events: SquadEvent[]; chatTotal: number; chatWeek: number; posts30d: number }
  viewer: { loggedIn: boolean; isMember: boolean; inOtherSquad: boolean; pendingRequest: boolean }
}
export type MySquad = SquadLook & {
  code: string
  hidden: boolean
  size: number
  maxMembers: number
  rewardDp: number
  isLeader: boolean
  completedAt: string | null
  members: (SquadMemberView & { memberId: string })[]
  requests: { id: number; name: string; avatarUrl: string | null; message: string; createdAt: string }[]
  chatTotal: number
}
export type SquadInvite = SquadLook & { code: string; leaderName: string; members: number; size: number; full: boolean }
export type SquadMessage = { id: number; name: string; avatarUrl: string | null; isMe: boolean; isLeader: boolean; body: string; deleted: boolean; createdAt: string }

export type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string }

async function call<T>(path: string, method = "GET", json?: unknown): Promise<Res<T>> {
  try {
    const res = await apiFetch(`/api/rewards${path}`, {
      method,
      cache: "no-store",
      headers: json === undefined ? undefined : { "Content-Type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) return { ok: false, status: res.status, error: body.error || "요청을 처리하지 못했습니다.", code: body.code }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: 0, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

export const fetchSquads = (q: string, sort: "members" | "newest") =>
  call<{ squads: SquadCard[]; totals: { squads: number; members: number }; maxMembers: number }>(
    `/squads?${new URLSearchParams({ ...(q ? { q } : {}), sort })}`
  )
export const fetchSquadDetail = (id: number) => call<SquadDetail>(`/squads/id/${id}`)
export const fetchMySquad = () => call<{ squad: MySquad | null }>("/squads/mine")
export const fetchInvite = (code: string) => call<{ squad: SquadInvite }>(`/squads/${encodeURIComponent(code)}`)
export const checkSquadName = (name: string) => call<{ ok: boolean; error?: string }>(`/squads/name-check?${new URLSearchParams({ name })}`)

export type SquadInput = {
  name?: string
  intro?: string
  icon?: string
  color?: string
  imageUrl?: string | null
  joinPolicy?: "open" | "request"
  coverUrl?: string | null
  notice?: string
  links?: { url: string; label?: string }[]
}
export const createSquad = (input: SquadInput) => call<{ squad: MySquad }>("/squads", "POST", input)
export const updateMySquad = (input: SquadInput) => call<{ squad: MySquad }>("/squads/mine", "PATCH", input)
export const kickSquadMember = (memberId: string) => call<{ squad: MySquad }>("/squads/mine/kick", "POST", { memberId })
export const transferSquadLeader = (memberId: string) => call<{ squad: MySquad }>("/squads/mine/transfer", "POST", { memberId })
export const disbandSquad = () => call<{ disbanded: boolean }>("/squads/mine/disband", "POST", {})
export const leaveSquad = () => call<{ disbanded: boolean }>("/squads/leave", "POST", {})
export const decideSquadRequest = (id: number, approve: boolean) =>
  call<{ squad: MySquad; notice: string }>(`/squads/mine/requests/${id}/${approve ? "approve" : "reject"}`, "POST", {})

// 초대 코드로 바로 들어가기 · 스쿼드 페이지에서 가입(바로 가입 또는 가입 신청). DP 를 받으면 잔액을 다시 불러옴
export async function joinByCode(code: string) {
  const r = await call<{ squad: MySquad; rewardDp: number }>(`/squads/${encodeURIComponent(code)}/join`, "POST", {})
  if (r.ok && r.data.rewardDp) loadPoints()
  return r
}
export async function applyToSquad(id: number, message: string) {
  const r = await call<{ joined: boolean; requested?: boolean; rewardDp: number }>(`/squads/id/${id}/apply`, "POST", { message })
  if (r.ok && r.data.rewardDp) loadPoints()
  return r
}
export const cancelSquadApplication = (id: number) => call<{ cancelled: boolean }>(`/squads/id/${id}/apply`, "DELETE")

export const fetchSquadMessages = (opts: { after?: number; before?: number } = {}) => {
  const q = new URLSearchParams()
  if (opts.after) q.set("after", String(opts.after))
  if (opts.before) q.set("before", String(opts.before))
  return call<{ messages: SquadMessage[]; canModerate: boolean }>(`/squads/mine/messages?${q}`)
}
export const sendSquadMessage = (body: string) => call<{ message: SquadMessage }>("/squads/mine/messages", "POST", { body })
export const deleteSquadMessage = (id: number) => call<{ deleted: boolean }>(`/squads/mine/messages/${id}`, "DELETE")

export const squadInviteUrl = (code: string) => `${getSiteUrl()}/community/gallery/squads/?join=${encodeURIComponent(code)}`

// 활동 기록 한 줄
export function squadEventText(e: SquadEvent) {
  const who = e.memberName || "누군가"
  switch (e.type) {
    case "created":
      return `${who}님이 스쿼드를 만들었어요`
    case "joined":
      return `${who}님이 들어왔어요`
    case "left":
      return `${who}님이 나갔어요`
    case "kicked":
      return `${who}님이 스쿼드에서 빠졌어요`
    case "renamed":
      return `이름이 '${e.detail.to}'(으)로 바뀌었어요`
    case "icon_changed":
      return "아이콘이 바뀌었어요"
    case "leader_changed":
      return `${who}님이 새 리더가 됐어요`
    case "reward_paid":
      return `스쿼드 완성! 팀원에게 ${e.detail.dp?.toLocaleString() ?? ""} DP 지급`
    default:
      return "스쿼드 활동"
  }
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
}
export const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return d.toDateString() === today.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

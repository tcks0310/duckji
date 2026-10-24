"use client"

import { useEffect, useSyncExternalStore } from "react"
import { apiFetch } from "@/lib/api"

// 알림함 (backend users 서비스 /api/users/me/notifications, 관리자는 /api/users/admin/notifications)
// 알림은 서버가 주문·결제·예약·펀딩 상태가 바뀔 때 만들고, 여기서는 읽기·읽음 처리·설정만 합니다.
// 종 아이콘의 빨간 숫자는 상단 종과 마이페이지 알림 화면이 같이 씀 (useUnreadCount)

export interface NotificationItem {
  id: number
  kind: string
  group: string
  title: string
  body: string
  link: string
  createdAt: string
  read: boolean
}

export interface NotificationPrefs {
  popup: boolean
  funding: boolean
  gallery: boolean
  quietNight: boolean
}

type Scope = "member" | "admin"
const base = (scope: Scope) => (scope === "admin" ? "/api/users/admin/notifications/inbox" : "/api/users/me/notifications")

// ---------------------------------------------------------------- 안 읽은 수 (화면 여러 곳이 같이 씀)
const counts: Record<Scope, number> = { member: 0, admin: 0 }
const listeners = new Set<() => void>()
const setCount = (scope: Scope, n: number) => {
  counts[scope] = n
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export async function refreshUnread(scope: Scope = "member") {
  try {
    const path = scope === "admin" ? base("admin") + "?limit=1" : base("member") + "/unread-count"
    const res = await apiFetch(path, { cache: "no-store" })
    if (!res.ok) return
    const json = await res.json()
    if (json.success) setCount(scope, Number(json.unread) || 0)
  } catch {
    // 연결이 안 되면 숫자만 그대로
  }
}

// 페이지를 열 때, 다른 탭에서 돌아올 때, 5분마다 다시 확인
export function useUnreadCount(scope: Scope = "member", enabled = true) {
  useEffect(() => {
    if (!enabled) return
    refreshUnread(scope)
    const onFocus = () => document.visibilityState === "visible" && refreshUnread(scope)
    document.addEventListener("visibilitychange", onFocus)
    const timer = window.setInterval(() => refreshUnread(scope), 5 * 60 * 1000)
    return () => {
      document.removeEventListener("visibilitychange", onFocus)
      window.clearInterval(timer)
    }
  }, [scope, enabled])
  return useSyncExternalStore(subscribe, () => counts[scope], () => 0)
}

// ---------------------------------------------------------------- 목록·읽음
export async function fetchNotifications(scope: Scope = "member", before?: number, limit = 20) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (before) q.set("before", String(before))
  const res = await apiFetch(`${base(scope)}?${q}`, { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) return { success: false as const, login: true, error: "로그인이 필요합니다." }
  if (!res.ok || !json.success) return { success: false as const, login: false, error: json.error || "알림을 불러오지 못했어요." }
  setCount(scope, Number(json.unread) || 0)
  return { success: true as const, items: json.items as NotificationItem[], hasMore: Boolean(json.hasMore) }
}

export async function markRead(scope: Scope, ids: number[] | "all") {
  const res = await apiFetch(`${base(scope)}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.success) setCount(scope, Number(json.unread) || 0)
  return Boolean(res.ok && json.success)
}

// ---------------------------------------------------------------- 회원 설정
export async function fetchPrefs(): Promise<NotificationPrefs | null> {
  const res = await apiFetch("/api/users/me/notifications/prefs", { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  return res.ok && json.success ? (json.prefs as NotificationPrefs) : null
}

export async function savePrefs(changes: Partial<NotificationPrefs>) {
  const res = await apiFetch("/api/users/me/notifications/prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw new Error(json.error || "설정을 저장하지 못했어요.")
  return json.prefs as NotificationPrefs
}

// ---------------------------------------------------------------- 표시
// 방금·n분 전·n시간 전·어제·10월 18일
export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - Date.parse(iso)) / 1000
  if (diff < 60) return "방금"
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 172800) return "어제"
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export const GROUP_LABELS: Record<string, string> = {
  order: "주문",
  dp: "DP",
  popup: "팝업",
  booking: "예약",
  funding: "펀딩",
  mall: "덕지몰",
  account: "계정",
  notice: "공지",
  admin: "운영",
}

// ---------------------------------------------------------------- 관리자 알림 관리
export interface NotificationKind {
  code: string
  group: string
  name: string
  description: string
  audience: "member" | "admin"
  enabled: boolean
  titleTpl: string
  bodyTpl: string
  linkTpl: string
  vars: string
  channels: string[]
  alimtalkTemplateId: string
  essential: boolean
  prefGroup: string | null
  sendHour: number | null
  sentCount: number
  lastSentAt: string | null
  updatedAt: string
}

export interface NotificationLogItem {
  id: number
  audience: "member" | "admin"
  memberId: string | null
  memberName: string
  memberEmail: string
  kind: string
  kindName: string
  title: string
  body: string
  link: string
  createdAt: string
  readAt: string | null
  alimtalkStatus: "sent" | "failed" | "no_phone" | "expired" | null
  alimtalkError: string | null
}

export interface NotificationBroadcast {
  id: number
  title: string
  body: string
  link: string
  sentCount: number
  createdAt: string
}

// 알림함·알림톡(솔라피)은 실제로 감. 나머지는 연결되면 켜짐
export const CHANNEL_LABELS: Record<string, { label: string; ready: boolean; note?: string }> = {
  inbox: { label: "알림함", ready: true },
  push: { label: "앱 푸시", ready: false, note: "앱 출시 때" },
  alimtalk: { label: "알림톡", ready: true },
  email: { label: "메일", ready: false, note: "SES 승인 후" },
}

async function adminCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`/api/users/admin/notifications${path}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw new Error(json.error || "요청을 처리하지 못했어요.")
  return json as T
}

export const fetchKinds = async () => (await adminCall<{ kinds: NotificationKind[] }>("GET", "/kinds")).kinds
export const updateKind = async (code: string, changes: Partial<Pick<NotificationKind, "enabled" | "titleTpl" | "bodyTpl" | "linkTpl" | "channels" | "sendHour" | "alimtalkTemplateId">>) =>
  (await adminCall<{ kind: NotificationKind }>("PUT", `/kinds/${encodeURIComponent(code)}`, changes)).kind
// 알림톡 테스트 발송 (push 서비스, 예시 값으로 채워 보냄)
export async function sendAlimtalkTest(kind: string, templateId: string, phone: string) {
  const res = await apiFetch("/api/push/alimtalk/test", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, templateId, phone }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw new Error(json.error || "보내지 못했어요.")
}

export const ALIMTALK_STATUS_LABELS: Record<string, string> = { sent: "알림톡 보냄", failed: "알림톡 실패", no_phone: "번호 없음", expired: "시간 지남" }

export async function fetchLog(opts: { kind?: string; q?: string; before?: number }) {
  const q = new URLSearchParams({ limit: "50" })
  if (opts.kind) q.set("kind", opts.kind)
  if (opts.q) q.set("q", opts.q)
  if (opts.before) q.set("before", String(opts.before))
  return adminCall<{ items: NotificationLogItem[]; hasMore: boolean }>("GET", `/log?${q}`)
}
export const fetchBroadcasts = () => adminCall<{ items: NotificationBroadcast[]; recipients: number }>("GET", "/broadcasts")
export const sendBroadcast = async (input: { title: string; body: string; link: string }) =>
  (await adminCall<{ sentCount: number }>("POST", "/broadcasts", input)).sentCount

// 미리보기용: {빈칸}을 예시 값으로 채움
export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{([A-Za-z]+)\}/g, (_, k: string) => vars[k] ?? "")
}

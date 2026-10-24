import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"

// 관리자 권한 확인
// 관리자 여부는 서버가 정합니다. 회원 DB 에서 role = 'admin' 인 회원이 로그인하면
// users 서비스가 관리자 세션 쿠키(httpOnly)를 발급하고, 관리자 API 는 모두 이 쿠키를 검증합니다.
// 화면은 GET /api/admin/session 결과로만 관리자 버튼을 보여 줍니다. (버튼을 숨기는 건 편의일 뿐, 보안은 서버 검증)

const ADMIN_MEMBER_FLAG = "dukji_admin_member" // 관리자 회원으로 로그인한 적이 있음 (세션 만료 시 재발급 시도용)
const ADMIN_CHANGE_EVENT = "dukji-admin-change"

// 같은 화면의 여러 컴포넌트가 동시에 물어도 요청은 한 번만
let inflight: Promise<boolean> | null = null

export function fetchAdminSession(): Promise<boolean> {
  if (!inflight) {
    inflight = apiFetch("/api/admin/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => json.authenticated === true)
      .catch(() => false)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

// 로그인 직후 POST /api/users/me 응답의 회원 역할을 기록하고 화면에 알림
export function rememberMemberRole(role: unknown) {
  try {
    if (role === "admin") localStorage.setItem(ADMIN_MEMBER_FLAG, "1")
    else localStorage.removeItem(ADMIN_MEMBER_FLAG)
  } catch {
    // 저장소를 못 써도 서버 세션 확인은 그대로 동작
  }
  notifyAdminChange()
}

export function forgetAdminMember() {
  try {
    localStorage.removeItem(ADMIN_MEMBER_FLAG)
  } catch {}
  notifyAdminChange()
}

export function notifyAdminChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADMIN_CHANGE_EVENT))
}

const wasAdminMember = () => {
  try {
    return localStorage.getItem(ADMIN_MEMBER_FLAG) === "1"
  } catch {
    return false
  }
}

// 관리자 세션(12시간)이 끝났어도 회원 로그인이 살아 있으면, 회원 DB 역할을 다시 확인해 재발급
export async function refreshAdminFromMember(): Promise<boolean> {
  try {
    const res = await apiFetch("/api/users/me", { method: "POST" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) return false
    try {
      if (json.user?.role === "admin") localStorage.setItem(ADMIN_MEMBER_FLAG, "1")
      else localStorage.removeItem(ADMIN_MEMBER_FLAG)
    } catch {}
    return json.user?.role === "admin" && (await fetchAdminSession())
  } catch {
    return false
  }
}

// 관리자 버튼 표시 여부. memberKey(로그인한 회원 id)가 바뀌거나 로그인·로그아웃 알림이 오면 다시 확인
export function useIsAdmin(memberKey?: string | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      let ok = await fetchAdminSession()
      if (!ok && memberKey && wasAdminMember()) ok = await refreshAdminFromMember()
      if (!cancelled) setIsAdmin(ok)
    }
    check()
    window.addEventListener(ADMIN_CHANGE_EVENT, check)
    return () => {
      cancelled = true
      window.removeEventListener(ADMIN_CHANGE_EVENT, check)
    }
  }, [memberKey])

  return isAdmin
}

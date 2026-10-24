import { UserProfile } from "@/components/auth/types"
import { apiFetch } from "@/lib/api"
import { rememberMemberRole } from "@/lib/admin-access"

export interface DukjiUser {
  id: string
  name: string
  email: string
  provider: "kakao" | "naver" | "google" | "apple" | "email"
  avatarUrl?: string
  phone?: string
  joinedAt: string
  lastLoginAt: string
  role: "member" | "creator" | "partner" | "admin"
  points: number
  status: "active" | "dormant" | "banned"
  authSource: string
  favoriteAnime?: string[]
}

// 회원 정보는 서버 회원 DB 한 곳에만 있습니다 (예전 브라우저 회원 목록 캐시는 지움).
const OLD_LOCAL_LIST_KEY = "dukji_real_registered_users_v2"

class UserService {
  // 관리자 화면: 서버 회원 목록
  public async fetchServerUsers(): Promise<DukjiUser[]> {
    if (typeof window === "undefined") return []
    try {
      const res = await apiFetch("/api/users", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success && Array.isArray(json.users)) {
        return (json.users as DukjiUser[]).sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
      }
    } catch (e) {
      console.warn("fetchServerUsers error:", e)
    }
    return []
  }

  // 로그인·가입 직후 호출: 서버가 로그인 세션 쿠키의 회원으로 최근 로그인 시간을 기록 (요청 본문은 받지 않음)
  // 관리자 역할 회원이면 서버가 관리자 세션도 발급 → 관리자 버튼 다시 확인
  public registerOrUpdateUser(_profile?: UserProfile | Partial<DukjiUser>): void {
    if (typeof window === "undefined") return
    try {
      localStorage.removeItem(OLD_LOCAL_LIST_KEY)
    } catch {
      // ignore
    }
    apiFetch("/api/users/me", { method: "POST" })
      .then((res) => res.json())
      .then((json) => json?.success && rememberMemberRole(json.user?.role))
      .catch((err) => {
        console.warn("Background server user sync:", err)
      })
  }
}

export const userService = new UserService()

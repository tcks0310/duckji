import { apiFetch } from "@/lib/api"
import { getSiteUrl } from "@/lib/popup-qr"

// 친구 추천 (backend users/referral.ts): 회원마다 고유 추천 ID(DJ + 6자리)
// 추천 링크(https://www.duckji.com/?invite=DJXXXXXX)로 들어오면 브라우저에 기억해 두고, 가입 화면 추천인 칸에 미리 넣어 줌

const STORAGE_KEY = "duckji_invite_code"
const CODE_RE = /^DJ[A-Z0-9]{6}$/

export const normalizeReferralCode = (v: string) => v.trim().toUpperCase().replace(/[\s-]/g, "")
export const isReferralCodeShape = (v: string) => CODE_RE.test(normalizeReferralCode(v))

export const referralLink = (code: string) => `${getSiteUrl()}/?invite=${encodeURIComponent(code)}`

export function rememberReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("invite")
    if (code && isReferralCodeShape(code)) localStorage.setItem(STORAGE_KEY, normalizeReferralCode(code))
  } catch {}
}

export function rememberedReferralCode() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

export function forgetReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export type ReferralCheck = { valid: true; code: string; name: string } | { valid: false; error: string }

export async function checkReferralCode(code: string): Promise<ReferralCheck> {
  try {
    const res = await apiFetch(`/api/users/referral/check?code=${encodeURIComponent(normalizeReferralCode(code))}`, { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (json.success && json.valid) return { valid: true, code: json.code, name: json.name }
    return { valid: false, error: json.error || "추천인 ID 를 찾을 수 없습니다." }
  } catch {
    return { valid: false, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." }
  }
}

export interface MyReferral {
  code: string
  invitedCount: number
  earnedDp: number
  referrerDp: number
  referredDp: number
  referredBy: string | null
}

export async function fetchMyReferral(): Promise<MyReferral | null> {
  try {
    const res = await apiFetch("/api/users/referral/me", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    return json.success ? (json as MyReferral) : null
  } catch {
    return null
  }
}

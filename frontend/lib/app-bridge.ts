"use client"

// 덕지 앱(mobile/App.tsx)과 웹 사이의 연결
// 앱은 페이지가 열릴 때 window.DuckjiNative 에 할 수 있는 일을 적어 둠 (예전 앱엔 없음 → 웹 방식 그대로)
// 웹이 window.ReactNativeWebView.postMessage 로 부탁하면 앱이 "duckji-native" 이벤트로 답을 돌려줌

type NativeLoginProvider = "kakao" | "google" | "naver"
type NativeLoginToken = { accessToken?: string; idToken?: string }
type NativePush = { token: string; platform: "android" | "ios"; appVersion?: string }

declare global {
  interface Window {
    DuckjiNative?: { v: number; login?: string[]; push?: NativePush }
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

// 앱이 이 로그인을 휴대폰 기능(카카오톡·구글 계정)으로 할 수 있는지
export const canNativeLogin = (provider: NativeLoginProvider) =>
  typeof window !== "undefined" && !!window.ReactNativeWebView && !!window.DuckjiNative?.login?.includes(provider)

// 앱에 로그인을 부탁하고 토큰을 받음. 취소하면 error = "access_denied" (로그인 화면이 조용히 넘어감)
export function nativeLogin(provider: NativeLoginProvider): Promise<NativeLoginToken> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const timer = setTimeout(() => finish({ ok: false, error: "로그인 응답 시간이 지났어요. 다시 시도해 주세요." }), 180000)
    const onAnswer = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && d.id === id) finish(d)
    }
    function finish(d: { ok: boolean; accessToken?: string; idToken?: string; canceled?: boolean; error?: string }) {
      clearTimeout(timer)
      window.removeEventListener("duckji-native", onAnswer)
      if (d.ok) return resolve({ accessToken: d.accessToken, idToken: d.idToken })
      reject(Object.assign(new Error(d.canceled ? "canceled" : d.error || "로그인하지 못했어요."), d.canceled ? { error: "access_denied" } : {}))
    }
    window.addEventListener("duckji-native", onAnswer)
    window.ReactNativeWebView!.postMessage(JSON.stringify({ type: "login", provider, id }))
  })
}

// ---------------------------------------------------------------- 푸시 기기 등록
// 앱이 알림 허용을 받고 기기 토큰을 얻으면 window.DuckjiNative.push 에 넣고 "duckji-push" 이벤트를 보냄
// 로그인한 회원이면 서버에 이 기기를 붙임 (같은 회원·토큰은 한 번만). 로그아웃 때는 뗌 (forgetPushDevice)
const PUSH_REG_KEY = "dukji_push_reg"

const memberIdNow = () => {
  try {
    return JSON.parse(localStorage.getItem("dukji_user") || "null")?.id || null
  } catch {
    return null
  }
}

export async function syncPushDevice() {
  const push = typeof window !== "undefined" ? window.DuckjiNative?.push : undefined
  const memberId = memberIdNow()
  if (!push?.token || !memberId) return
  const key = `${memberId}:${push.token}`
  try {
    if (localStorage.getItem(PUSH_REG_KEY) === key) return
    const { apiFetch } = await import("@/lib/api")
    const res = await apiFetch("/api/users/me/push-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(push),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.saved) localStorage.setItem(PUSH_REG_KEY, key)
  } catch {
    // 다음에 화면을 열 때 다시 시도
  }
}

export async function forgetPushDevice() {
  const token = typeof window !== "undefined" ? window.DuckjiNative?.push?.token : undefined
  try {
    localStorage.removeItem(PUSH_REG_KEY)
    if (!token) return
    const { apiFetch } = await import("@/lib/api")
    await apiFetch("/api/users/me/push-devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
  } catch {
    // 로그아웃은 계속 진행
  }
}

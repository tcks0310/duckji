"use client"

import { SignupRequiredError, syncMember } from "@/lib/member-auth"
import { apiFetch } from "@/lib/api"
import { canNativeLogin, nativeLogin } from "@/lib/app-bridge"
import { isAppMode } from "@/lib/app-mode"

// 덕지 앱에서는 새 창 없이 이 화면에서 네이버로 갔다가 돌아옴. 돌아온 뒤 갈 곳 (auth/naver/callback)
export const NAVER_NEXT_KEY = "dukji_naver_next"

// DUKJI Naver Official OAuth Integration
export const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ""

export interface NaverUserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string
  provider: "naver"
}

declare global {
  interface Window {
    naver: any
  }
}

// Dynamically loads Naver Login JS SDK v2
export function loadNaverSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Window is not defined"))
    }

    if (window.naver && window.naver.LoginWithNaverId) {
      return resolve(window.naver)
    }

    const existing = document.getElementById("naver-js-sdk")
    if (existing && window.naver && window.naver.LoginWithNaverId) {
      return resolve(window.naver)
    }

    if (existing) {
      existing.remove()
    }

    const script = document.createElement("script")
    script.id = "naver-js-sdk"
    script.src = "https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js"
    script.charset = "utf-8"
    script.async = true
    script.onload = () => {
      resolve(window.naver)
    }
    script.onerror = (err) => {
      console.error("Failed to load Naver SDK script:", err)
      reject(new Error("네이버 로그인 SDK 스크립트를 불러오지 못했습니다."))
    }
    document.head.appendChild(script)
  })
}

// Opens Naver OAuth popup and receives user profile
export async function loginWithNaver(): Promise<NaverUserProfile> {
  if (typeof window === "undefined") {
    throw new Error("Window is undefined")
  }

  // 덕지 앱: 네이버 앱(없으면 네이버 로그인 화면)으로 로그인한 토큰을 앱이 넘겨줌
  if (canNativeLogin("naver")) {
    const { accessToken } = await nativeLogin("naver")
    if (!accessToken) throw new Error("네이버 인증 토큰을 받지 못했습니다.")
    const res = await apiFetch("/api/auth/naver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    })
    const data = await res.json().catch(() => ({}))
    if (!data.success) throw new Error(data.error || "네이버 로그인에 실패했습니다.")
    const synced = await syncMember()
    if (synced.success) return { ...synced.user, avatarUrl: synced.user.avatarUrl || "/images/avatar/female.jpg", provider: "naver" }
    throw synced.signupRequired ? new SignupRequiredError() : new Error(synced.error)
  }

  const state = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  sessionStorage.setItem("naver_oauth_state", state)

  const redirectUri = `${window.location.origin}/auth/naver/callback`
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${state}`

  // 덕지 앱(웹뷰)은 새 창을 열지 않음 → 이 화면에서 바로 네이버 로그인으로
  if (isAppMode()) {
    const next = new URLSearchParams(window.location.search).get("next")
    if (next && next.startsWith("/") && !next.startsWith("//")) sessionStorage.setItem(NAVER_NEXT_KEY, next)
    else sessionStorage.removeItem(NAVER_NEXT_KEY)
    window.location.href = naverAuthUrl
    return new Promise(() => {})
  }

  const width = 500
  const height = 650
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const popup = window.open(
    naverAuthUrl,
    "naver_login_popup",
    `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
  )

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    // Popup blocked, fallback to direct redirect
    window.location.href = naverAuthUrl
    return new Promise(() => {})
  }

  return new Promise((resolve, reject) => {
    let isSettled = false

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NAVER_LOGIN_SUCCESS") {
        if (isSettled) return
        isSettled = true
        cleanup()
        resolve(event.data.user)
      } else if (event.data && event.data.type === "NAVER_SIGNUP_REQUIRED") {
        if (isSettled) return
        isSettled = true
        cleanup()
        reject(new SignupRequiredError())
      } else if (event.data && event.data.type === "NAVER_LOGIN_ERROR") {
        if (isSettled) return
        isSettled = true
        cleanup()
        reject(new Error(event.data.error || "네이버 로그인에 실패했습니다."))
      }
    }

    const checkPopupClosed = setInterval(() => {
      if (popup.closed && !isSettled) {
        clearInterval(checkPopupClosed)
        setTimeout(() => {
          if (!isSettled) {
            isSettled = true
            cleanup()
            reject(new Error("네이버 로그인 창이 닫혔습니다."))
          }
        }, 500)
      }
    }, 600)

    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        cleanup()
        reject(new Error("네이버 로그인 대기 시간이 초과되었습니다."))
      }
    }, 120000)

    const cleanup = () => {
      window.removeEventListener("message", handleMessage)
      clearInterval(checkPopupClosed)
      clearTimeout(timeout)
    }

    window.addEventListener("message", handleMessage)
  })
}

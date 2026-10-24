"use client"

import { SignupRequiredError, startSocialSession } from "@/lib/member-auth"
import { canNativeLogin, nativeLogin } from "@/lib/app-bridge"

export let GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
export let GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""

export interface GoogleUserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string
  provider: "google"
}

declare global {
  interface Window {
    google: any
  }
}

// Dynamically loads Google Identity Services SDK
export function loadGoogleSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Window is not defined"))
    }

    if (window.google && window.google.accounts) {
      return resolve(window.google)
    }

    const existing = document.getElementById("google-gsi-sdk")
    if (existing && window.google && window.google.accounts) {
      return resolve(window.google)
    }

    if (existing) {
      existing.remove()
    }

    const script = document.createElement("script")
    script.id = "google-gsi-sdk"
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      resolve(window.google)
    }
    script.onerror = (err) => {
      console.error("Failed to load Google GSI SDK script:", err)
      reject(new Error("Google 로그인 SDK를 불러오지 못했습니다."))
    }
    document.head.appendChild(script)
  })
}

// Initiates Google OAuth Login
export async function loginWithGoogle(): Promise<GoogleUserProfile> {
  if (typeof window === "undefined") {
    throw new Error("Window is undefined")
  }

  // 덕지 앱: 구글은 앱 안 화면(웹뷰) 로그인을 막아서, 휴대폰의 구글 계정으로 로그인한 ID 토큰을 앱이 넘겨줌
  if (canNativeLogin("google")) {
    const { idToken } = await nativeLogin("google")
    if (!idToken) throw new Error("구글 인증 토큰을 받지 못했습니다.")
    const session = await startSocialSession("google", { idToken })
    if (session.success) return { ...session.user, avatarUrl: session.user.avatarUrl || "/images/avatar/male.jpg", provider: "google" }
    throw session.signupRequired ? new SignupRequiredError() : new Error(session.error)
  }

  // If Client ID is not yet configured, throw informative error
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
    throw new Error("Google Client ID가 아직 설정되지 않았습니다. 개발자 콘솔에서 발급받은 키를 등록해주세요.")
  }

  const google = await loadGoogleSdk()

  if (!google || !google.accounts || !google.accounts.oauth2) {
    throw new Error("Google Identity SDK 초기화에 실패했습니다.")
  }

  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error("Google token error:", tokenResponse)
            return reject(new Error(tokenResponse.error_description || tokenResponse.error))
          }

          if (tokenResponse.access_token) {
            // 서버가 토큰을 직접 검증해 회원 세션(쿠키)을 발급. 처음 쓰는 계정이면 회원가입 페이지로
            const session = await startSocialSession("google", tokenResponse.access_token)
            if (session.success) {
              return resolve({ ...session.user, avatarUrl: session.user.avatarUrl || "/images/avatar/male.jpg", provider: "google" })
            }
            reject(session.signupRequired ? new SignupRequiredError() : new Error(session.error))
          } else {
            reject(new Error("구글 인증 토큰을 수신하지 못했습니다."))
          }
        },
      })

      // Trigger Google account selector popup
      client.requestAccessToken({ prompt: "select_account" })
    } catch (err) {
      console.error("Failed to launch Google Token Client:", err)
      reject(err)
    }
  })
}

"use client"

import { SignupRequiredError, startSocialSession } from "@/lib/member-auth"
import { canNativeLogin, nativeLogin } from "@/lib/app-bridge"

// DUKJI Kakao Official SDK Integration Helper
export const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ""
export const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY || ""

declare global {
  interface Window {
    Kakao: any
  }
}

// Dynamically and reliably loads Kakao SDK v1
export function loadKakaoSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Window is not defined"))
    }

    if (window.Kakao && typeof window.Kakao.isInitialized === "function" && window.Kakao.isInitialized()) {
      return resolve(window.Kakao)
    }

    const existing = document.getElementById("kakao-js-sdk")
    if (existing && window.Kakao && typeof window.Kakao.init === "function") {
      try {
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY)
        }
        return resolve(window.Kakao)
      } catch (e) {
        // continue reload
      }
    }

    if (existing) {
      existing.remove()
    }

    const script = document.createElement("script")
    script.id = "kakao-js-sdk"
    script.src = "https://developers.kakao.com/sdk/js/kakao.min.js"
    script.async = true
    script.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY)
        }
        resolve(window.Kakao)
      } catch (e) {
        reject(e)
      }
    }
    script.onerror = (err) => {
      console.error("Failed to load Kakao SDK script:", err)
      reject(new Error("카카오 SDK 스크립트를 불러오지 못했습니다. 네트워크 상태를 확인해주세요."))
    }
    document.head.appendChild(script)
  })
}

export async function loginWithKakao(): Promise<{
  id: string
  name: string
  email: string
  avatarUrl: string
  provider: "kakao"
}> {
  // 덕지 앱: 카카오톡 앱(없으면 카카오 계정 화면)으로 로그인한 토큰을 앱이 넘겨줌
  if (canNativeLogin("kakao")) {
    const { accessToken } = await nativeLogin("kakao")
    if (!accessToken) throw new Error("카카오 인증 토큰을 받지 못했습니다.")
    const session = await startSocialSession("kakao", accessToken)
    if (session.success) return { ...session.user, avatarUrl: session.user.avatarUrl || "/images/avatar/female.jpg", provider: "kakao" }
    throw session.signupRequired ? new SignupRequiredError() : new Error(session.error)
  }

  const kakao = await loadKakaoSdk()

  if (!kakao) {
    throw new Error("카카오 SDK를 불러올 수 없습니다.")
  }

  if (!kakao.isInitialized()) {
    kakao.init(KAKAO_JS_KEY)
  }

  return new Promise((resolve, reject) => {
    let isSettled = false

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        reject(new Error("카카오 로그인 응답 시간이 초과되었습니다. 다시 시도해 주세요."))
      }
    }, 120000)

    kakao.Auth.login({
      throughTalk: true,
      persistAccessToken: true,
      success: function (authObj: any) {
        if (isSettled) return
        isSettled = true
        clearTimeout(timer)
        console.log("Kakao Auth.login success:", authObj)
        // 서버가 토큰을 직접 검증해 회원 세션(쿠키)을 발급. 처음 쓰는 계정이면 회원가입 페이지로
        const accessToken = authObj?.access_token || kakao.Auth.getAccessToken?.()
        if (!accessToken) {
          reject(new Error("카카오 인증 토큰을 받지 못했습니다."))
          return
        }
        startSocialSession("kakao", accessToken).then((session) => {
          if (session.success) {
            resolve({ ...session.user, avatarUrl: session.user.avatarUrl || "/images/avatar/female.jpg", provider: "kakao" })
          } else if (session.signupRequired) {
            reject(new SignupRequiredError())
          } else {
            reject(new Error(session.error))
          }
        })
      },
      fail: function (err: any) {
        if (isSettled) return
        isSettled = true
        clearTimeout(timer)
        console.error("Kakao Auth.login failed:", err)
        reject(err)
      },
    })
  })
}

export const startKakaoOAuth = loginWithKakao

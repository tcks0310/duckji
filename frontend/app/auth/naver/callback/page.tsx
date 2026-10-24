"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { SIGNUP_PATH, syncMember, LINK_RETURN_KEY } from "@/lib/member-auth"
import { NAVER_NEXT_KEY } from "@/lib/naver-auth"

export default function NaverCallbackPage() {
  const [statusText, setStatusText] = useState("네이버 로그인 인증 처리 중...")

  useEffect(() => {
    async function processCallback() {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get("code")
        const state = urlParams.get("state")
        const error = urlParams.get("error")
        const errorDescription = urlParams.get("error_description")

        if (error) {
          console.error("Naver OAuth error:", error, errorDescription)
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "NAVER_LOGIN_ERROR",
                error: errorDescription || error,
              },
              "*"
            )
            setTimeout(() => window.close(), 500)
          } else {
            // 새 창 없이 넘어온 경우(덕지 앱 등): 취소하면 로그인하던 화면으로 돌아감
            const back = sessionStorage.getItem(LINK_RETURN_KEY)
            const next = sessionStorage.getItem(NAVER_NEXT_KEY)
            sessionStorage.removeItem(LINK_RETURN_KEY)
            sessionStorage.removeItem(NAVER_NEXT_KEY)
            window.location.href = back || (next ? `/login/?next=${encodeURIComponent(next)}` : "/login/")
          }
          return
        }

        if (code) {
          setStatusText("네이버 프로필 정보를 동기화하는 중...")
          const res = await apiFetch("/api/auth/naver", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, state }),
          })

          const data = await res.json()
          // 서버 세션이 생기면 회원 DB 확인: 처음 쓰는 계정이면 회원가입 페이지로
          const synced = data.success ? await syncMember() : null

          if (synced && !synced.success && synced.signupRequired) {
            setStatusText("회원가입 정보를 입력하는 화면으로 이동합니다...")
            if (window.opener) {
              window.opener.postMessage({ type: "NAVER_SIGNUP_REQUIRED" }, window.location.origin)
              setTimeout(() => window.close(), 300)
            } else {
              window.location.href = SIGNUP_PATH
            }
          } else if (synced?.success) {
            setStatusText("로그인 성공! 창을 닫는 중...")
            if (window.opener) {
              window.opener.postMessage({ type: "NAVER_LOGIN_SUCCESS", user: synced.user }, window.location.origin)
              setTimeout(() => window.close(), 300)
            } else {
              localStorage.setItem("dukji_user", JSON.stringify(synced.user))
              // 마이페이지에서 연동하다 창 대신 페이지로 넘어온 경우 마이페이지로 돌아감
              // 덕지 앱은 로그인 전에 보던 페이지(next)로 돌아감
              const back = sessionStorage.getItem(LINK_RETURN_KEY) || sessionStorage.getItem(NAVER_NEXT_KEY)
              sessionStorage.removeItem(LINK_RETURN_KEY)
              sessionStorage.removeItem(NAVER_NEXT_KEY)
              window.location.href = back || "/"
            }
          } else {
            const message = (synced && !synced.success && synced.error) || data.error || "로그인 처리에 실패했습니다."
            console.error("Naver login failed:", message)
            setStatusText(`로그인 처리 실패: ${message}`)
            if (window.opener) {
              window.opener.postMessage({ type: "NAVER_LOGIN_ERROR", error: message }, window.location.origin)
              setTimeout(() => window.close(), 1500)
            } else if (sessionStorage.getItem(LINK_RETURN_KEY)) {
              const back = sessionStorage.getItem(LINK_RETURN_KEY) as string
              sessionStorage.removeItem(LINK_RETURN_KEY)
              alert(message)
              window.location.href = back
            }
          }
        }
      } catch (err: any) {
        console.error("Naver callback processing error:", err)
        setStatusText("오류가 발생했습니다. 창을 닫아주세요.")
      }
    }

    processCallback()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 bg-[#03C75A] rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto shadow-lg shadow-[#03C75A]/30 animate-pulse">
          N
        </div>
        <h2 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
          <span>{statusText}</span>
        </h2>
        <p className="text-xs text-zinc-400">
          잠시만 기다려주세요. 로그인이 완료되면 창이 자동으로 닫힙니다.
        </p>
      </div>
    </div>
  )
}

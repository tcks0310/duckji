"use client"

import { SignupRequiredError, startAppleSession } from "@/lib/member-auth"

// 애플 로그인 (Sign in with Apple JS, 팝업 방식)
// 애플 개발자 계정에서 만든 웹용 Services ID 를 NEXT_PUBLIC_APPLE_CLIENT_ID 에 넣으면 버튼이 보임 (비어 있으면 숨김)
// 돌아오는 주소(Return URL)는 애플 콘솔에 https://www.duckji.com/login/ 처럼 등록해 둔 주소와 같아야 함
// 서버는 받은 identity token 을 애플 공개키로 확인함 (backend/src/services/auth/apple.ts)

export const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || ""
export const isAppleLoginEnabled = () => Boolean(APPLE_CLIENT_ID)

const SDK_URL = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/ko_KR/appleid.auth.js"

declare global {
  interface Window {
    AppleID?: any
  }
}

function loadAppleSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.AppleID?.auth) return resolve(window.AppleID)
    const existing = document.getElementById("apple-signin-sdk") as HTMLScriptElement | null
    const script = existing || document.createElement("script")
    script.addEventListener("load", () => resolve(window.AppleID))
    script.addEventListener("error", () => reject(new Error("애플 로그인을 불러오지 못했습니다.")))
    if (!existing) {
      script.id = "apple-signin-sdk"
      script.src = SDK_URL
      script.async = true
      document.head.appendChild(script)
    }
  })
}

const randomString = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function loginWithApple() {
  if (!APPLE_CLIENT_ID) throw new Error("애플 로그인이 아직 설정되지 않았습니다.")
  const AppleID = await loadAppleSdk()
  const nonce = randomString()
  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: "name email",
    redirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || `${window.location.origin}/login/`,
    state: randomString(),
    nonce,
    usePopup: true,
  })
  let res: any
  try {
    res = await AppleID.auth.signIn()
  } catch (e: any) {
    // 팝업을 닫으면 { error: "popup_closed_by_user" }
    throw new Error(e?.error || "애플 로그인이 취소되었습니다.")
  }
  const idToken = res?.authorization?.id_token
  if (!idToken) throw new Error("애플 인증 정보를 받지 못했습니다.")
  // 이름은 처음 로그인할 때만 옴. 한국식으로 성+이름
  const n = res?.user?.name
  const name = n ? `${n.lastName || ""}${n.firstName || ""}`.trim() : undefined
  const session = await startAppleSession(idToken, nonce, name)
  if (session.success) return { ...session.user, avatarUrl: session.user.avatarUrl || "/images/avatar/male.jpg", provider: "apple" as const }
  throw session.signupRequired ? new SignupRequiredError() : new Error(session.error)
}

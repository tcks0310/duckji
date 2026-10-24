import { Platform } from "react-native"
import keys from "../login-keys.json"

// 휴대폰 기능으로 하는 소셜 로그인 (웹 화면이 window.DuckjiNative 를 보고 부탁함, frontend/lib/app-bridge.ts)
// 카카오: 카카오톡 앱으로 바로 로그인(없으면 카카오 계정 화면) → 액세스 토큰
// 구글: 구글이 앱 안 웹 화면 로그인을 막아서 휴대폰 구글 계정으로 → ID 토큰 (웹 클라이언트 ID 로 받아 서버 확인이 웹과 같음)
// 네이버: 네이버 앱(없으면 네이버 로그인 화면)으로 → 액세스 토큰. 네이버 SDK 는 Client Secret 을 앱에 넣는 방식이라
//   Secret 은 레포에 두지 않고 Expo 환경 변수 EXPO_PUBLIC_NAVER_CLIENT_SECRET 로 빌드 때만 넣음
// 애플·이메일은 웹 화면 그대로. 키가 비어 있으면 그 로그인도 웹 화면 그대로 (login-keys.json)

export type NativeProvider = "kakao" | "google" | "naver"
const NAVER_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || ""
export type NativeLoginAnswer =
  | { ok: true; accessToken?: string; idToken?: string }
  | { ok: false; canceled?: boolean; error?: string }

export function nativeProviders(): NativeProvider[] {
  const list: NativeProvider[] = []
  if (keys.kakaoNativeAppKey) list.push("kakao")
  if (keys.googleWebClientId && (Platform.OS === "android" || keys.googleIosClientId)) list.push("google")
  if (keys.naverClientId && NAVER_SECRET && (Platform.OS === "android" || keys.naverIosUrlScheme)) list.push("naver")
  return list
}

const isCancel = (e: unknown) => /cancel/i.test(String((e as any)?.code ?? "") + " " + String((e as any)?.message ?? ""))

export async function nativeLogin(provider: string): Promise<NativeLoginAnswer> {
  if (!nativeProviders().includes(provider as NativeProvider)) return { ok: false, error: "이 앱에서 쓸 수 없는 로그인이에요." }
  try {
    return provider === "kakao" ? await kakaoLogin() : provider === "naver" ? await naverLogin() : await googleLogin()
  } catch (e) {
    if (isCancel(e)) return { ok: false, canceled: true }
    return { ok: false, error: String((e as any)?.message || "로그인하지 못했어요.") }
  }
}

// 네이티브 모듈은 빌드에 들어 있을 때만 불러옴 (키가 없으면 플러그인을 빼고 빌드함)
let kakaoReady: Promise<void> | null = null
async function kakaoLogin(): Promise<NativeLoginAnswer> {
  const core = require("@react-native-kakao/core") as typeof import("@react-native-kakao/core")
  const user = require("@react-native-kakao/user") as typeof import("@react-native-kakao/user")
  kakaoReady ??= core.initializeKakaoSDK(keys.kakaoNativeAppKey)
  await kakaoReady
  const token = await user.login()
  return { ok: true, accessToken: token.accessToken }
}

let googleReady = false
async function googleLogin(): Promise<NativeLoginAnswer> {
  const { GoogleSignin } = require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin")
  if (!googleReady) {
    GoogleSignin.configure({ webClientId: keys.googleWebClientId, iosClientId: keys.googleIosClientId || undefined })
    googleReady = true
  }
  if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  // 매번 계정을 고를 수 있게 지난 선택을 지움
  await GoogleSignin.signOut().catch(() => null)
  const res = await GoogleSignin.signIn()
  if (res.type !== "success") return { ok: false, canceled: true }
  if (!res.data.idToken) return { ok: false, error: "구글 인증 토큰을 받지 못했어요." }
  return { ok: true, idToken: res.data.idToken }
}

let naverReady = false
async function naverLogin(): Promise<NativeLoginAnswer> {
  const NaverLogin = (require("@react-native-seoul/naver-login") as typeof import("@react-native-seoul/naver-login")).default
  if (!naverReady) {
    NaverLogin.initialize({
      appName: "덕지",
      consumerKey: keys.naverClientId,
      consumerSecret: NAVER_SECRET,
      serviceUrlSchemeIOS: keys.naverIosUrlScheme || undefined,
    })
    naverReady = true
  }
  const res = await NaverLogin.login()
  if (res.isSuccess && res.successResponse?.accessToken) return { ok: true, accessToken: res.successResponse.accessToken }
  if (res.failureResponse?.isCancel) return { ok: false, canceled: true }
  return { ok: false, error: res.failureResponse?.message || "네이버 로그인에 실패했어요." }
}

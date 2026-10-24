"use client"

import { useSyncExternalStore } from "react"

// 덕지 앱(Expo 껍데기 안 웹뷰)에서 열렸는지
// 앱은 User-Agent 에 DuckjiApp 을 붙이고, 처음 여는 주소에 ?app=1 을 붙임 (이 탭에서만 기억, sessionStorage)
// 판정은 app/layout.tsx 의 첫 스크립트(lib/app-mode-script.ts)가 해서 <html class="is-app"> 를 붙이고, 화면은 그 표시만 봄
// 앱에서 바뀌는 것: 상단 언어·노래 버튼·로그인 버튼 숨김(앱 하단 마이 탭이 대신, 햄버거는 전체 메뉴로 남김), 배경 음악·마우스 효과 끔,
// 푸터는 마이페이지에서만, 언어는 휴대폰 언어 기본. 설계: docs/planning/모바일-앱-구성-기획.md 4-2


export const isAppMode = () => typeof document !== "undefined" && document.documentElement.classList.contains("is-app")

const subscribe = () => () => {}
export const useIsApp = () => useSyncExternalStore(subscribe, isAppMode, () => false)

// 휴대폰 화면: 덕지 앱이거나 768px 미만 브라우저 (globals.css 의 phone-hide 와 같은 기준). 마이 탭 모양을 앱과 같게 씀
const PHONE_QUERY = "(max-width: 767px)"
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
export const usePhoneLayout = () => useSyncExternalStore(subscribePhone, () => isAppMode() || window.matchMedia(PHONE_QUERY).matches, () => false)

// 처음 스크립트가 붙인 표시를 React 가 <html> 을 다시 그리며 지울 수 있어, 그려진 뒤에도 다시 붙임
export function detectApp() {
  try {
    return /DuckjiApp/.test(navigator.userAgent) || sessionStorage.getItem("duckji_app") === "1"
  } catch {
    return false
  }
}

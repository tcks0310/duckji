"use client"

import { useEffect } from "react"
import { detectApp } from "@/lib/app-mode"
import { syncPushDevice } from "@/lib/app-bridge"

const USER_KEY = "dukji_user"
const userIdOf = (raw: string | null) => {
  try {
    return (raw && JSON.parse(raw)?.id) || null
  } catch {
    return null
  }
}

// 덕지 앱이면 <html class="is-app"> 를 계속 유지 (React 가 html class 를 다시 쓰면 다시 붙임)
// 앱은 하단 탭마다 화면이 따로 떠 있어서, 다른 탭에서 로그인·로그아웃하면 이 탭을 새로 불러 같은 회원으로 맞춤
export function AppModeMarker() {
  useEffect(() => {
    if (!detectApp()) return
    const root = document.documentElement
    const mark = () => !root.classList.contains("is-app") && root.classList.add("is-app")
    mark()
    const obs = new MutationObserver(mark)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })

    // 이 화면이 직접 바꾼 로그인 정보는 기준만 옮기고, 다른 탭이 바꾼 것만 보고 새로 불러옴
    let known = userIdOf(localStorage.getItem(USER_KEY))
    const proto = Storage.prototype
    const setItem = proto.setItem
    const removeItem = proto.removeItem
    proto.setItem = function (key: string, value: string) {
      setItem.call(this, key, value)
      if (this === localStorage && key === USER_KEY) known = userIdOf(value)
    }
    proto.removeItem = function (key: string) {
      removeItem.call(this, key)
      if (this === localStorage && key === USER_KEY) known = null
    }
    const check = () => {
      if (userIdOf(localStorage.getItem(USER_KEY)) !== known) window.location.reload()
    }
    const timer = setInterval(check, 1500)
    window.addEventListener("storage", check)

    // 앱 푸시: 로그인한 회원이면 이 기기를 알림 받을 기기로 등록 (로그인하면 화면을 새로 열어 다시 확인함)
    syncPushDevice()
    window.addEventListener("duckji-push", syncPushDevice)
    return () => {
      obs.disconnect()
      clearInterval(timer)
      window.removeEventListener("storage", check)
      window.removeEventListener("duckji-push", syncPushDevice)
      proto.setItem = setItem
      proto.removeItem = removeItem
    }
  }, [])
  return null
}

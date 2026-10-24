"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

// 상단 언어 선택 옆 작은 버튼: 배경 노래와 마우스 포인터(덕지·덕순이)를 한 번에 켜고 끔.
// 노래는 GlobalBgmPlayer, 포인터는 MouseDuckjiFollower 가 같은 localStorage 값·이벤트를 씀.
export function EffectsToggle() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    try {
      const followerOff = localStorage.getItem("duckji_follower_enabled") === "false"
      const bgmPaused = localStorage.getItem("duckji_bgm_paused_by_user") === "true"
      setOn(!(followerOff && bgmPaused))
    } catch {}
  }, [])

  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      localStorage.setItem("duckji_follower_enabled", String(next))
      if (next) localStorage.removeItem("duckji_bgm_paused_by_user")
      else localStorage.setItem("duckji_bgm_paused_by_user", "true")
    } catch {}
    window.dispatchEvent(new CustomEvent("toggle-duckji-follower", { detail: { enabled: next } }))
    window.dispatchEvent(new CustomEvent("toggle-duckji-bgm", { detail: { playing: next } }))
  }

  const label = on ? "노래·마우스 효과 끄기" : "노래·마우스 효과 켜기"
  return (
    <button
      type="button"
      onClick={toggle}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors shrink-0 hover:bg-zinc-800/60 ${
        on ? "text-amber-300 hover:text-amber-200" : "text-zinc-500 hover:text-zinc-300"
      }`}
      title={label}
      aria-label={label}
      aria-pressed={on}
    >
      {on ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
    </button>
  )
}

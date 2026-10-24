"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchPrefs, savePrefs, type NotificationPrefs } from "@/lib/notifications"

// 마이페이지 '알림 설정' (/mypage/?tab=notifications). 받은 알림은 알림 페이지(/notifications)
// 주문·결제·예약·계정 알림은 꼭 필요한 안내라 끌 수 없음 (설계: docs/planning/알림-구성-설계.md 4장)

const TOGGLES: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "popup", label: "팝업 소식", description: "찜하거나 알림 신청한 팝업의 오픈·마감 임박·기간 변경" },
  { key: "funding", label: "펀딩", description: "내가 연 펀딩의 진행 상황, 참여한 펀딩의 결과·새 공지" },
  { key: "quietNight", label: "밤에는 알림 끄기", description: "밤 9시 ~ 아침 8시에는 앱 푸시를 보내지 않아요. 알림함에는 그대로 쌓여요." },
]

export function NotificationsPanel() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchPrefs().then(setPrefs)
  }, [])

  const toggle = async (key: keyof NotificationPrefs) => {
    if (!prefs) return
    setSaving(key)
    setError("")
    try {
      setPrefs(await savePrefs({ [key]: !prefs[key] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 저장하지 못했어요.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="border-y border-zinc-800 divide-y divide-zinc-800">
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-200">주문·결제·예약·계정</div>
              <p className="mt-0.5 text-[13px] text-zinc-500">주문 접수·배송, DP 충전, 예약·웨이팅 호출처럼 꼭 필요한 안내라 항상 받아요.</p>
            </div>
            <span className="text-xs font-bold text-zinc-500 whitespace-nowrap">항상 받음</span>
          </div>
          {TOGGLES.map((t) => {
            const on = prefs ? prefs[t.key] : true
            return (
              <div key={t.key} className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-200">{t.label}</div>
                  <p className="mt-0.5 text-[13px] text-zinc-500">{t.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t.label}
                  disabled={!prefs || saving !== null}
                  onClick={() => toggle(t.key)}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-60 ${on ? "bg-red-600" : "bg-zinc-700"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
                </button>
              </div>
            )
          })}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-3 text-[13px] text-zinc-500">이벤트·혜택 같은 광고 소식은 '수신 동의·탈퇴'의 마케팅 수신 동의를 따라요.</p>
      </section>
      <Link href="/notifications/" className="inline-block text-sm font-bold text-zinc-400 hover:text-white">
        받은 알림 보기 →
      </Link>
    </div>
  )
}

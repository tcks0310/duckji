"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X, CheckCircle2, Phone, Mail } from "lucide-react"
import { PopupEvent } from "@/data/popup-data"
import { Button } from "@/components/ui/button"
import { removePopupAlert, setPopupAlert, useSavedItems, type AlertChannel } from "@/lib/saved-items"

// 팝업 오픈·티켓팅 알림 신청: 로그인한 회원 계정에 저장 (lib/saved-items, 마이페이지 '찜·알림'에서 확인·취소)
// 연락처는 따로 받지 않고 회원 정보(가입 이메일·휴대폰)로 보냄. 실제 발송은 메일·알림톡 연결 뒤
interface AlertModalProps {
  event: PopupEvent | null
  isOpen: boolean
  onClose: () => void
  onRequireLogin: () => void
}

export function AlertModal({ event, isOpen, onClose, onRequireLogin }: AlertModalProps) {
  const saved = useSavedItems()
  const [channel, setChannel] = useState<AlertChannel>("email")
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen || !event) return null

  const existing = saved.alerts.find((a) => a.popupId === event.id)

  const close = () => {
    setIsSuccess(false)
    setError("")
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError("")
    const r = await setPopupAlert(event.id, channel)
    setIsSaving(false)
    if (r.status === "login") {
      close()
      onRequireLogin()
    } else if (r.status === "error") {
      setError(r.error || "저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
    } else {
      setIsSuccess(true)
    }
  }

  const handleCancel = async () => {
    setIsSaving(true)
    const r = await removePopupAlert(event.id)
    setIsSaving(false)
    if (r === "ok") close()
    else setError("취소하지 못했습니다. 잠시 후 다시 시도해주세요.")
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 bg-black/40"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 shadow-2xl z-10 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  오픈 & 티켓팅 알림 신청
                </h3>
                <p className="text-xs text-zinc-400">
                  {event.title}
                </p>
              </div>
            </div>
            <button
              onClick={close}
              className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">
                알림 신청을 저장했습니다
              </h4>
              <p className="text-xs text-zinc-400">
                마이페이지 &apos;찜·알림&apos;에서 확인하고 취소할 수 있습니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Channel selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel("kakao")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    channel === "kakao"
                      ? "bg-amber-400/10 border-amber-400 text-amber-300 shadow-md"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  <span>카카오톡 알림톡</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    channel === "email"
                      ? "bg-emerald-500/10 border-emerald-400 text-emerald-300 shadow-md"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  <span>이메일 알림</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-500 leading-relaxed">
                * {channel === "kakao" ? "회원 정보의 휴대폰 번호" : "가입한 이메일"}로 오픈·티켓팅 소식을 보내 드립니다. 로그인한 회원만 신청할 수 있어요. 지금은 덕지 알림함과 앱 푸시로 먼저 알려 드리고, 카카오 알림톡·이메일 발송은 준비 중입니다.
              </div>

              {existing && (
                <div className="text-[11px] text-emerald-300">
                  이미 {existing.channel === "kakao" ? "카카오톡 알림톡" : "이메일"}으로 신청했습니다.
                </div>
              )}
              {error && <div className="text-[11px] text-red-300">{error}</div>}

              <Button
                type="submit"
                disabled={isSaving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold h-11 rounded-xl shadow-lg"
              >
                {existing ? "알림 방법 바꾸기" : "무료 알림 신청하기"}
              </Button>
              {existing && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="w-full text-xs text-zinc-400 hover:text-white"
                >
                  알림 신청 취소
                </button>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

"use client"

import * as React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { NOTICE_DISMISS_LABELS, type NoticeDismiss, type NoticeTemplate } from "@/lib/site-notices"
import { NoticeImage, NoticeLink } from "./notice-image"

// 레이어 팝업 (관리자 센터 > 사이트 공지 팝업·배너)
// · 이미지형: 디자이너가 만든 이미지를 원본 크기 그대로 보여 주고(화면보다 크면 화면 안에 맞게 줄임) 이미지 전체가 링크. 아래에 "보지 않기 | 닫기" 줄
// · 텍스트형: 관리자가 입력한 이미지·제목·본문·버튼 (시안 없을 때 쓰는 임시 모양, 강동 공지 팝업과 같은 색·모서리)
export interface SiteNoticeContent {
  template: NoticeTemplate
  title: string
  body: string
  imageUrl: string | null
  mobileImageUrl: string | null
  linkUrl: string | null
  linkLabel: string
  linkNewTab: boolean
  dismiss: NoticeDismiss
}

interface SiteNoticeModalProps {
  notice: SiteNoticeContent
  onClose: (dismiss: boolean) => void // dismiss: "보지 않기"를 고르고 닫음
  onLinkClick?: () => void
  preview?: "pc" | "mobile" // 관리자 미리보기: 화면 전체를 덮지 않고 그 자리에 그림
}

export function SiteNoticeModal({ notice, onClose, onLinkClick, preview }: SiteNoticeModalProps) {
  const [dontShow, setDontShow] = useState(false)
  const close = () => onClose(dontShow)
  const followLink = () => {
    onLinkClick?.()
    if (!notice.linkNewTab) onClose(false)
  }

  const card =
    notice.template === "image" && notice.imageUrl ? (
      <motion.div
        initial={preview ? false : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        role="dialog"
        aria-modal={!preview}
        aria-label={notice.title || "공지"}
        className="relative w-fit max-w-full rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_25px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10 z-10 my-auto"
      >
        <NoticeLink href={notice.linkUrl} newTab={notice.linkNewTab} onClick={followLink} className="block">
          <NoticeImage
            imageUrl={notice.imageUrl}
            mobileImageUrl={notice.mobileImageUrl}
            alt={notice.title || "공지"}
            forceDevice={preview}
            className="block w-auto h-auto max-w-full max-h-[calc(100dvh-6rem)] object-contain bg-zinc-950"
          />
        </NoticeLink>
        <div className="flex text-xs font-bold text-zinc-300 border-t border-zinc-800 bg-zinc-950">
          {notice.dismiss !== "none" && (
            <button onClick={() => onClose(true)} className="flex-1 py-3 hover:text-white hover:bg-zinc-900 border-r border-zinc-800 cursor-pointer">
              {NOTICE_DISMISS_LABELS[notice.dismiss]}
            </button>
          )}
          <button onClick={() => onClose(false)} className="flex-1 py-3 hover:text-white hover:bg-zinc-900 cursor-pointer">
            닫기
          </button>
        </div>
      </motion.div>
    ) : (
      <motion.div
        initial={preview ? false : { scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        role="dialog"
        aria-modal={!preview}
        aria-label={notice.title || "공지"}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden z-10 my-auto text-white flex flex-col max-h-[92vh]"
      >
        <button
          onClick={close}
          aria-label="닫기"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/60 text-zinc-400 hover:text-white hover:bg-black border border-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {notice.imageUrl && (
          <img src={notice.imageUrl} alt={notice.title || "공지 이미지"} className="w-full max-h-[55vh] object-cover shrink-0" />
        )}

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-left">
          {notice.title && <h2 className="text-lg sm:text-xl font-black text-white leading-tight pr-8">{notice.title}</h2>}
          {notice.body && <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{notice.body}</p>}

          {notice.linkUrl && (
            <NoticeLink
              href={notice.linkUrl}
              newTab={notice.linkNewTab}
              onClick={followLink}
              className="block w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-center font-black text-sm shadow-md transition-colors"
            >
              {notice.linkLabel || "자세히 보기"}
            </NoticeLink>
          )}

          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            {notice.dismiss !== "none" ? (
              <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  className="rounded border-zinc-700 text-red-500 focus:ring-red-500 bg-zinc-900"
                />
                <span>{NOTICE_DISMISS_LABELS[notice.dismiss]}</span>
              </label>
            ) : (
              <span />
            )}
            <button onClick={close} className="hover:text-white font-semibold transition-colors cursor-pointer">
              닫기
            </button>
          </div>
        </div>
      </motion.div>
    )

  if (preview) return <div className="flex justify-center">{card}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} className="fixed inset-0 bg-black/50" />
      {card}
    </div>
  )
}

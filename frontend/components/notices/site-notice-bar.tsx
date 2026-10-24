"use client"

import * as React from "react"
import { X } from "lucide-react"
import { NoticeImage, NoticeLink } from "./notice-image"
import type { SiteNoticeContent } from "./site-notice-modal"

// 띠 배너 (화면 아래 고정). 맨 위는 메뉴바가 고정돼 있어 아래에 둠
// · 이미지형: 디자인한 띠 이미지를 가로로 꽉 채움 (모바일 이미지 따로 가능), 이미지 전체가 링크
// · 텍스트형: 디자이너 시안 전 임시 모양, 사이트 공통 색(zinc·red·amber)만 씀
interface SiteNoticeBarProps {
  notice: SiteNoticeContent
  onClose: () => void
  onLinkClick?: () => void
  preview?: "pc" | "mobile"
}

export function SiteNoticeBar({ notice, onClose, onLinkClick, preview }: SiteNoticeBarProps) {
  const position = preview ? "relative rounded-2xl overflow-hidden" : "fixed bottom-0 left-0 right-0 z-[45] pb-[env(safe-area-inset-bottom)]"

  if (notice.template === "image" && notice.imageUrl) {
    return (
      <div role="region" aria-label="공지 배너" className={`${position} bg-zinc-950 border-t border-zinc-800`}>
        <NoticeLink href={notice.linkUrl} newTab={notice.linkNewTab} onClick={onLinkClick} className="block">
          <NoticeImage
            imageUrl={notice.imageUrl}
            mobileImageUrl={notice.mobileImageUrl}
            alt={notice.title || "공지"}
            forceDevice={preview}
            className="block w-full h-auto max-h-24 object-cover"
          />
        </NoticeLink>
        <button
          onClick={onClose}
          aria-label="배너 닫기"
          className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded-full bg-black/60 text-zinc-300 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const text = (
    <span className="truncate">
      <span className="font-black text-white">{notice.title}</span>
      {notice.body && <span className="hidden sm:inline text-zinc-300"> · {notice.body}</span>}
    </span>
  )

  return (
    <div role="region" aria-label="공지 배너" className={`${position} bg-zinc-950/95 border-t border-amber-500/40 backdrop-blur-xl text-xs`}>
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-2.5">
        {notice.imageUrl && <img src={notice.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
        {notice.linkUrl ? (
          <NoticeLink href={notice.linkUrl} newTab={notice.linkNewTab} onClick={onLinkClick} className="flex-1 min-w-0 flex items-center gap-2 hover:opacity-90">
            {text}
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-[11px]">
              {notice.linkLabel || "보기"}
            </span>
          </NoticeLink>
        ) : (
          <div className="flex-1 min-w-0 flex items-center">{text}</div>
        )}
        <button onClick={onClose} aria-label="배너 닫기" className="shrink-0 p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

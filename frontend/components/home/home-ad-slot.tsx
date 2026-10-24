"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Megaphone } from "lucide-react"
import { recordNoticeEvent, useHomeAds, type AdPlacement, type PublicSiteNotice } from "@/lib/site-notices"

// 홈 광고 자리 (왼쪽·오른쪽 날개, 아래 가로 칸). 광고는 관리자 센터 › 공지 팝업·광고 배너에서 이미지·링크·기간을 정함
// 걸린 광고가 없으면 빈 광고 자리와 '광고 제휴 문의' 버튼만 보여 줌. 기간이 끝난 광고는 서버가 빼서 저절로 내려감
// 같은 자리에 광고가 여러 개면 우선순위 순으로 8초마다 돌아가며 보여 줌

export const AD_APPLY_HREF = "/partners/apply/"
const applyHref = (slot: AdPlacement) => `${AD_APPLY_HREF}?slot=${slot}`
const ROTATE_MS = 8000
const NO_ADS: PublicSiteNotice[] = []

function useRotation(ads: PublicSiteNotice[]) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    setIndex(0)
    if (ads.length < 2) return
    const t = window.setInterval(() => setIndex((i) => (i + 1) % ads.length), ROTATE_MS)
    return () => window.clearInterval(t)
  }, [ads])
  const ad = ads[index] || null
  // 한 페이지에서 광고마다 노출 한 번만 기록
  const seen = useRef(new Set<number>())
  useEffect(() => {
    if (ad && !seen.current.has(ad.id)) {
      seen.current.add(ad.id)
      recordNoticeEvent(ad.id, "view")
    }
  }, [ad])
  return ad
}

type AdView = Pick<PublicSiteNotice, "id" | "imageUrl" | "mobileImageUrl" | "title" | "body" | "linkUrl" | "linkNewTab" | "linkLabel">

// 광고 이미지 (모바일 이미지가 있으면 좁은 화면에서 그것을 씀). 이미지 전체가 링크
function AdImage({ ad, className, imgClassName }: { ad: AdView; className?: string; imgClassName?: string }) {
  const picture = (
    <picture className="block w-full h-full">
      {ad.mobileImageUrl && <source media="(max-width: 767px)" srcSet={ad.mobileImageUrl} />}
      <img src={ad.imageUrl || ""} alt={ad.title || "광고"} className={imgClassName} />
    </picture>
  )
  if (!ad.linkUrl) return <div className={className}>{picture}</div>
  return (
    <a
      href={ad.linkUrl}
      target={ad.linkNewTab ? "_blank" : undefined}
      rel={ad.linkNewTab ? "noopener noreferrer sponsored" : "sponsored"}
      onClick={() => ad.id > 0 && recordNoticeEvent(ad.id, "click")}
      className={className}
    >
      {picture}
    </a>
  )
}

function ApplyButton({ slot, compact }: { slot: AdPlacement; compact?: boolean }) {
  return (
    <a
      href={applyHref(slot)}
      className={`flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/90 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300 transition-colors font-semibold ${
        compact ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-xs"
      }`}
    >
      <Megaphone className="w-3.5 h-3.5 shrink-0" />
      <span>광고 제휴 문의</span>
    </a>
  )
}

// 광고 글 (제목·설명·바로가기). 사진 크기와 상관없이 칸 크기는 그대로고, 넘치는 글은 줄임표로 자름
function AdText({ ad, className = "", bodyClamp = "line-clamp-4" }: { ad: AdView; className?: string; bodyClamp?: string }) {
  if (!ad.title && !ad.body) return null
  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      {ad.title && <p className="text-sm font-bold text-zinc-100 leading-snug line-clamp-2 break-keep">{ad.title}</p>}
      {ad.body && <p className={`text-xs text-zinc-400 leading-relaxed whitespace-pre-line break-keep ${bodyClamp}`}>{ad.body}</p>}
      {ad.linkUrl && (
        <a
          href={ad.linkUrl}
          target={ad.linkNewTab ? "_blank" : undefined}
          rel={ad.linkNewTab ? "noopener noreferrer sponsored" : "sponsored"}
          onClick={() => ad.id > 0 && recordNoticeEvent(ad.id, "click")}
          className="inline-block pt-0.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
        >
          {ad.linkLabel || "자세히 보기"} →
        </a>
      )}
    </div>
  )
}

// 왼쪽·오른쪽 날개 광고. 폭은 고정이고 사진은 따로 테두리 없이 폭에 맞춰 줄어들며, 글은 사진 아래로 이어짐. 제휴 문의 버튼은 광고가 없을 때만
// 넓은 화면(1024px 이상)에서는 가운데 큰 카드와 같은 높이로 붙어 있고, 스크롤해도 사라지지 않음
// 좁은 화면에서는 가운데 카드 아래 가로 두 칸으로 들어감
export function WingAdSlot({ slot, className = "", preview }: { slot: "ad_left" | "ad_right"; className?: string; preview?: PublicSiteNotice | null }) {
  // preview: 관리자 화면 미리보기 (주면 서버 광고 대신 그것만 보여 줌)
  const live = useHomeAds(slot)
  const ad = useRotation(preview !== undefined ? NO_ADS : live.ads) || (preview ?? null)
  const side = slot === "ad_left" ? "왼쪽" : "오른쪽"
  const hasText = !!ad && !!(ad.title || ad.body)
  // 홈: 넓은 화면에서 옆 카드 높이를 따라감(칸 자체는 높이를 늘리지 않음). 미리보기: 홈 카드 높이(550px)로 고정
  const frame = preview === undefined ? "lg:self-stretch lg:relative" : "relative h-[550px]"
  const inner = preview === undefined ? "lg:absolute lg:inset-0" : "absolute inset-0"

  return (
    <aside aria-label={`광고 (${side})`} className={`w-full lg:w-52 xl:w-60 2xl:w-64 shrink-0 ${frame} ${className}`}>
      <div className={`${inner} flex flex-col gap-2.5 p-3 rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl text-xs overflow-hidden`}>
        <div className="text-[10px] leading-none text-zinc-600 font-semibold tracking-wider shrink-0">AD · 광고</div>
        {ad ? (
          <>
            <AdImage
              ad={ad}
              className={`block w-full max-w-[15rem] mx-auto lg:max-w-none ${hasText ? "shrink-0" : "lg:flex-1 lg:min-h-0"}`}
              imgClassName={`w-full rounded-xl object-contain object-top ${hasText ? "h-auto max-h-80" : "h-auto max-h-96 lg:max-h-none lg:h-full"}`}
            />
            {hasText && <AdText ad={ad} className="flex-1 min-h-0 overflow-hidden" />}
          </>
        ) : (
          <div className="flex-1 min-h-[8rem] flex flex-col items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 text-center px-4">
            <span className="text-sm font-bold text-zinc-400">광고 자리</span>
            <span className="text-[11px] text-zinc-500 leading-relaxed break-keep">이 자리에 행사와 브랜드를 알려 보세요</span>
          </div>
        )}
        {/* 광고가 걸려 있으면 '광고 제휴 문의'는 숨김 (빈 자리일 때만 보임) */}
        {!ad && (
          <div className="shrink-0">
            <ApplyButton slot={slot} compact />
          </div>
        )}
      </div>
    </aside>
  )
}

// 홈 아래 가로 광고 칸 (본문 끝, 푸터 위). 높이는 고정. 글은 왼쪽 일정 폭, 사진은 남은 칸 안에 잘리지 않게 원래 비율로 들어감
// 글 없이 사진만 건 광고는 칸 전체에 사진만 보여 줌
export function BottomAdSlot({ className = "", preview }: { className?: string; preview?: PublicSiteNotice | null }) {
  const live = useHomeAds("ad_bottom")
  const ad = useRotation(preview !== undefined ? NO_ADS : live.ads) || (preview ?? null)
  const hasText = !!ad && !!(ad.title || ad.body)

  return (
    <section aria-label="광고 (아래)" className={`w-full ${className}`}>
      {ad ? (
        <div className="space-y-2">
          <div className="flex items-stretch gap-4 h-36 sm:h-40 rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
            {hasText && <AdText ad={ad} bodyClamp="line-clamp-2" className="w-[38%] sm:w-[24%] lg:w-[20%] max-w-[17rem] shrink-0 self-center py-3 pl-4 overflow-hidden" />}
            <AdImage
              ad={ad}
              className="block h-full flex-1 min-w-0 py-2 px-2"
              imgClassName="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>AD · 광고</span>
            <a href={applyHref("ad_bottom")} className="hover:text-emerald-300 underline underline-offset-4">
              광고 제휴 문의
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 h-36 sm:h-40 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/80 px-5">
          <div className="text-center sm:text-left space-y-1 pt-5 sm:pt-0">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">AD</p>
            <p className="text-sm font-bold text-zinc-300">광고 자리</p>
            <p className="text-xs text-zinc-500 break-keep">홈 아래 가로 배너 자리입니다. 행사·브랜드 광고를 걸어 보세요.</p>
          </div>
          <div className="pb-5 sm:pb-0">
            <ApplyButton slot="ad_bottom" />
          </div>
        </div>
      )}
    </section>
  )
}

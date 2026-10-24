"use client"

import * as React from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { memberHref } from "@/lib/community-api"
import { daysLeft, displayStatus, fundingTypeLabel, isPastDeadline, progressOf, scheduleText } from "@/lib/funding-service"
import type { FundingProject } from "@/types/funding"

// 덕지 펀딩 화면 공통 조각 (목록 카드·진행 막대·개설자 표시)
// 박스를 겹겹이 두르지 않고 사진·글자·얇은 선으로 나눔

export const detailHref = (id: string) => `/funding/detail/?id=${encodeURIComponent(id)}`

export const won = (n: number) => `${n.toLocaleString()}원`
export const dp = (n: number) => `${n.toLocaleString()} DP`

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div className={`h-1 w-full bg-white/10 overflow-hidden ${className}`}>
      <div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  )
}

// 개설자·참여자 프로필 (커뮤니티 피드로 이동)
export function ProfileLink({
  id,
  name,
  avatarUrl,
  size = "sm",
  suffix,
}: {
  id: string
  name: string
  avatarUrl?: string
  size?: "sm" | "md"
  suffix?: React.ReactNode
}) {
  const box = size === "md" ? "w-10 h-10 text-sm" : "w-6 h-6 text-[11px]"
  return (
    <Link href={memberHref(id)} className="inline-flex items-center gap-2 min-w-0 group" title={`${name} 님의 갤러리`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className={`${box} rounded-full object-cover bg-zinc-800 shrink-0`} />
      ) : (
        <span className={`${box} rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center font-semibold shrink-0`}>
          {name.slice(0, 1)}
        </span>
      )}
      <span className="truncate text-zinc-200 group-hover:text-white group-hover:underline underline-offset-4">{name}</span>
      {suffix}
    </Link>
  )
}

// 진행률 숫자 줄: 42% · 1,240,000원 · D-5
export function ProgressLine({ project }: { project: FundingProject }) {
  const percent = progressOf(project)
  const left = daysLeft(project.endDate)
  const closed = isPastDeadline(project) || !["live", "success"].includes(project.status)
  return (
    <div className="space-y-2">
      <ProgressBar percent={percent} />
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-emerald-300 tabular-nums">{percent}%</span>
          <span className="text-zinc-400 tabular-nums truncate">
            {project.targetAmount > 0 ? won(project.currentAmount) : `${project.currentCount.toLocaleString()}명`}
          </span>
        </div>
        <span className="text-zinc-400 shrink-0">{closed ? displayStatus(project) : left <= 0 ? "오늘 마감" : `${left}일 남음`}</span>
      </div>
    </div>
  )
}

// 둘러보기·메인 카드: 사진 위 한 줄 분류, 아래 제목·한 줄 소개·진행률
export function FundingCard({
  project,
  liked,
  onToggleLike,
}: {
  project: FundingProject
  liked?: boolean
  onToggleLike?: () => void
}) {
  const image = project.thumbnailUrl || project.images?.[0]
  const place = project.venueName || project.region
  return (
    <article className="group space-y-3">
      <Link href={detailHref(project.id)} className="block relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-900">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-end p-4 bg-gradient-to-br from-emerald-900/40 to-zinc-900">
            <span className="text-2xl font-bold text-white/80 leading-tight line-clamp-3">{project.title}</span>
          </div>
        )}
        {onToggleLike && (
          <button
            type="button"
            aria-label={liked ? "찜 해제" : "찜하기"}
            onClick={(e) => {
              e.preventDefault()
              onToggleLike()
            }}
            className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
        )}
      </Link>
      <div className="space-y-1">
        <p className="text-xs text-zinc-400 truncate">
          <span className="text-emerald-300">{fundingTypeLabel(project.type)}</span>
          {project.topicName && <> · {project.topicName}</>}
          {place && <> · {place}</>}
        </p>
        <Link href={detailHref(project.id)} className="block">
          <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 group-hover:underline underline-offset-4">{project.title}</h3>
        </Link>
        {project.summary && <p className="text-sm text-zinc-400 line-clamp-1">{project.summary}</p>}
        {scheduleText(project) && <p className="text-xs text-zinc-500">{scheduleText(project)}</p>}
      </div>
      <ProgressLine project={project} />
    </article>
  )
}

// 단계 표시 글자 (색은 의미만: 진행 중 초록, 준비 노랑, 끝 회색, 반려 빨강)
export function StatusText({ project }: { project: Pick<FundingProject, "status" | "endDate"> }) {
  const tone =
    project.status === "live" && !isPastDeadline(project)
      ? "text-emerald-300"
      : project.status === "pending" || project.status === "preparing"
        ? "text-amber-300"
        : project.status === "rejected"
          ? "text-red-300"
          : "text-zinc-400"
  return <span className={`text-xs font-semibold ${tone}`}>{displayStatus(project)}</span>
}

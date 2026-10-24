"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Users } from "lucide-react"
import { Avatar, LevelBadge } from "@/components/gallery/gallery-shell"
import { SquadIcon } from "@/components/community/squad-icon"
import { squadHomeHref, type Profile } from "@/lib/community-api"

// 갤러리 홈 머리 (내 홈·다른 회원 홈 공통): 사진·이름·레벨·덕력 진행·소개·SNS·스쿼드·숫자
export function ProfileHeader({ profile, actions }: { profile: Profile; actions?: React.ReactNode }) {
  const { level } = profile
  // 이번 레벨 시작 덕력 → 다음 레벨 덕력 사이에서 얼마나 왔는지
  const pct = level.next ? Math.min(100, Math.max(0, Math.round(((level.duckryeok - level.min) / Math.max(1, level.next.min - level.min)) * 100))) : 100

  return (
    <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={profile.name} src={profile.avatarUrl} size={72} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{profile.name}</h1>
            <LevelBadge level={level} />
            <span className="text-sm text-emerald-300">{level.title}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span>
              글 <b className="text-zinc-100">{profile.counts.posts.toLocaleString()}</b>
            </span>
            <span>
              댓글 <b className="text-zinc-100">{profile.counts.comments.toLocaleString()}</b>
            </span>
            <span>
              받은 덕업 <b className="text-zinc-100">{profile.counts.ups.toLocaleString()}</b>
            </span>
            <span>
              덕력 <b className="text-zinc-100">{level.duckryeok.toLocaleString()}</b>
            </span>
          </div>
          {profile.bio && <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{profile.bio}</p>}
          {profile.links.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {profile.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-zinc-700 text-xs text-zinc-200 hover:border-emerald-500"
                >
                  {l.label}
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </a>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>
            Lv.{level.level} {level.title}
          </span>
          <span>{level.next ? `Lv.${level.next.level}까지 덕력 ${level.next.remaining.toLocaleString()}` : "최고 레벨"}</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {profile.squad ? (
        <Link href={squadHomeHref(profile.squad.id)} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 hover:border-emerald-500/60 bg-zinc-950/40">
          <SquadIcon icon={profile.squad.icon} color={profile.squad.color} size="sm" />
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">소속 스쿼드{profile.squad.isLeader ? " · 리더" : ""}</div>
            <div className="text-sm font-semibold text-white truncate">{profile.squad.name}</div>
          </div>
          <span className="ml-auto text-xs text-zinc-400">스쿼드 홈</span>
        </Link>
      ) : null}
    </header>
  )
}

export function NoSquadCard() {
  return (
    <Link href="/community/gallery/squads/?tab=browse" className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-zinc-700 hover:border-emerald-500/60">
      <Users className="w-5 h-5 text-zinc-500" />
      <div className="text-sm text-zinc-300">아직 스쿼드가 없어요. 스쿼드를 만들거나 들어가 보세요.</div>
    </Link>
  )
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Trophy } from "lucide-react"
import { Avatar, LevelBadge, Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { SquadBadge } from "@/components/community/squad-badge"
import { fetchRanking, memberHref, type RankingRow } from "@/lib/community-api"

const LEVELS = [
  [1, 0, "새싹 덕후"],
  [2, 60, "입덕"],
  [3, 150, "덕질 입문"],
  [4, 300, "덕후"],
  [5, 500, "열혈 덕후"],
  [6, 800, "찐덕"],
  [7, 1200, "고인물"],
  [8, 1800, "성덕"],
  [9, 2600, "덕지 명예회원"],
  [10, 3600, "덕지 레전드"],
] as const

// 덕력 랭킹 + 레벨표·덕력 받는 법
export default function RankingPage() {
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    fetchRanking(50)
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <GalleryLayout nav="ranking">
      <h1 className="flex items-center gap-2 text-2xl font-black text-white">
        <Trophy className="w-6 h-6 text-amber-400" />
        덕력 랭킹
      </h1>
      <div className="grid lg:grid-cols-[1fr_18rem] gap-6 items-start">
        <section>
          {error && <Notice tone="error">{error}</Notice>}
          {!rows && !error && <Notice>불러오는 중...</Notice>}
          {rows && !rows.length && <Notice>아직 덕력을 모은 회원이 없어요.</Notice>}
          {rows && rows.length > 0 && (
            <ol className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70">
              {rows.map((r, i) => (
                <li key={r.memberId} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-7 text-center text-base font-bold ${i < 3 ? "text-amber-400" : "text-zinc-500"}`}>{i + 1}</span>
                  <Avatar name={r.name} src={r.avatarUrl} size={36} />
                  <div className="flex-1 min-w-0">
                    <Link href={memberHref(r.memberId)} className="block text-sm font-semibold text-zinc-100 truncate hover:underline">
                      {r.name}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <LevelBadge level={r} />
                      <span>{r.title}</span>
                      <SquadBadge squad={r.squad} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-zinc-200">{r.duckryeok.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <h2 className="text-base font-bold text-white">덕력 받는 법</h2>
            <ul className="text-sm text-zinc-300 space-y-1">
              <li>하루 첫 글 +30</li>
              <li>댓글 하나 +10 (하루 5번까지)</li>
              <li>내 글이 덕업을 받으면 +1</li>
              <li>내 글이 덕다운을 받으면 -1</li>
            </ul>
            <p className="text-xs text-zinc-500">글·댓글을 지우면 그걸로 받은 덕력도 빠져요.</p>
          </section>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
            <h2 className="text-base font-bold text-white">레벨</h2>
            <ul className="text-sm space-y-1">
              {LEVELS.map(([lv, min, title]) => (
                <li key={lv} className="flex items-center gap-2">
                  <LevelBadge level={{ level: lv, title }} />
                  <span className="text-zinc-200">{title}</span>
                  <span className="ml-auto text-xs text-zinc-500">{min.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </GalleryLayout>
  )
}

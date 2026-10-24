"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Users } from "lucide-react"
import { SquadIcon } from "@/components/community/squad-icon"
import { fetchSquads, fmtDate, type SquadCard } from "@/lib/squads"

// 스쿼드 둘러보기: 지금 있는 스쿼드 카드 (아이콘·이름·인원·소개·결성일), 검색·정렬
export function SquadDirectory({ mySquadId }: { mySquadId: number | null }) {
  const [q, setQ] = useState("")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"members" | "newest">("members")
  const [squads, setSquads] = useState<SquadCard[] | null>(null)
  const [maxMembers, setMaxMembers] = useState(20)
  const [error, setError] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let alive = true
    fetchSquads(query, sort).then((r) => {
      if (!alive) return
      if (!r.ok) return setError(r.error)
      setError("")
      setSquads(r.data.squads)
      setMaxMembers(r.data.maxMembers)
    })
    return () => {
      alive = false
    }
  }, [query, sort])

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="스쿼드 이름·소개로 찾기"
            aria-label="스쿼드 검색"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex rounded-xl border border-zinc-700 p-0.5 bg-zinc-900 self-start" role="group" aria-label="정렬">
          {(
            [
              ["members", "인원 많은 순"],
              ["newest", "최신 순"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              aria-pressed={sort === id}
              className={`px-3 py-1.5 rounded-lg text-sm ${sort === id ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-300 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}

      {squads === null && !error && <div className="py-12 text-center text-sm text-zinc-500">불러오는 중...</div>}
      {squads?.length === 0 && (
        <div className="py-12 text-center text-sm text-zinc-400 rounded-2xl border border-dashed border-zinc-800">
          {query ? `'${query}'에 맞는 스쿼드가 없어요.` : "아직 만들어진 스쿼드가 없어요. 첫 스쿼드를 만들어 보세요."}
        </div>
      )}

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {squads?.map((s) => (
          <li key={s.id}>
            <Link
              href={`/community/gallery/squad/?id=${s.id}`}
              className="h-full flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start gap-3">
                <SquadIcon icon={s.icon} color={s.color} imageUrl={s.imageUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-white truncate">{s.name}</span>
                    {mySquadId === s.id && <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-semibold">내 스쿼드</span>}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">리더 {s.leaderName}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-300 line-clamp-2 min-h-[2.5rem]">{s.intro || "소개가 아직 없어요."}</p>
              <div className="mt-auto flex items-center justify-between text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1 text-sm text-zinc-200">
                  <Users className="w-4 h-4 text-zinc-400" />
                  {s.memberCount}
                  <span className="text-zinc-500">/ {maxMembers}명</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={s.joinPolicy === "open" ? "text-emerald-400" : "text-zinc-400"}>{s.joinPolicy === "open" ? "바로 가입" : "신청 후 승인"}</span>
                  <span>{fmtDate(s.createdAt)}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { FundingCard } from "@/components/funding/funding-ui"
import { BROWSE_GROUPS, fundingService, isPastDeadline, progressOf } from "@/lib/funding-service"
import type { FundingProject, FundingTopic } from "@/types/funding"

// 펀딩 둘러보기 (/funding/browse): 1. 대관 펀딩(대관만·대관+굿즈) · 2. 굿즈 공동구매 로 나눠 보기
// ?group=venue | group_buy 로 들어오면 그 분류부터

type Group = "all" | (typeof BROWSE_GROUPS)[number]["id"]
type Sort = "popular" | "closing" | "progress" | "latest"

const SORTS: { id: Sort; label: string }[] = [
  { id: "popular", label: "인기순" },
  { id: "closing", label: "마감 임박순" },
  { id: "progress", label: "달성률순" },
  { id: "latest", label: "최신순" },
]

export default function FundingBrowsePage() {
  const [projects, setProjects] = useState<FundingProject[] | null>(null)
  const [topics, setTopics] = useState<FundingTopic[]>([])
  const [error, setError] = useState("")
  const [group, setGroup] = useState<Group>("all")
  const [topic, setTopic] = useState<number | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const [sort, setSort] = useState<Sort>("popular")
  const [query, setQuery] = useState("")
  const [, setLikeTick] = useState(0)

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("group")
    if (g === "venue" || g === "group_buy") setGroup(g)
    fundingService
      .getAllProjects()
      .then(setProjects)
      .catch((e) => {
        setError(e?.message || "펀딩을 불러오지 못했습니다.")
        setProjects([])
      })
    fundingService.getTopics().then(setTopics).catch(() => {})
  }, [])

  const isOpen = (p: FundingProject) => (p.status === "live" || p.status === "success") && !isPastDeadline(p)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const types = group === "all" ? null : BROWSE_GROUPS.find((g) => g.id === group)!.types
    return (projects || [])
      .filter((p) => (showEnded ? !isOpen(p) : isOpen(p)))
      .filter((p) => !types || types.includes(p.type))
      .filter((p) => topic === null || p.topicId === topic)
      .filter(
        (p) =>
          !q ||
          [p.title, p.summary, p.creatorName, p.venueName || "", p.region || "", p.workTag || "", ...(p.goodsItems || []).map((g) => g.name)].some((v) =>
            v.toLowerCase().includes(q)
          )
      )
      .sort((a, b) => {
        if (sort === "closing") return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
        if (sort === "progress") return progressOf(b) - progressOf(a)
        if (sort === "latest") return new Date(b.openedAt || b.createdAt).getTime() - new Date(a.openedAt || a.createdAt).getTime()
        return b.currentCount + b.likesCount * 2 - (a.currentCount + a.likesCount * 2)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, group, topic, showEnded, sort, query])

  const usedTopics = topics.filter((t) => (projects || []).some((p) => p.topicId === t.id))

  const toggleLike = async (id: string) => {
    try {
      await fundingService.toggleLike(id)
      setLikeTick((n) => n + 1)
    } catch (e: any) {
      if (e?.status === 401) {
        if (window.confirm("로그인하면 펀딩을 찜할 수 있어요. 로그인할까요?")) window.location.href = "/login"
      } else alert(e?.message || "찜하지 못했습니다.")
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" itemId="funding-browse" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-8">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">펀딩 둘러보기</h1>
            <p className="text-sm sm:text-base text-zinc-400">참여는 DP 로 하고, 목표를 못 채우면 그대로 돌려드려요.</p>
          </div>
          <Link href="/funding/new" className="self-start md:self-auto inline-flex items-center h-10 px-5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
            펀딩 열기
          </Link>
        </section>

        {/* 분류 */}
        <div className="border-b border-zinc-800 flex gap-6 overflow-x-auto">
          {([{ id: "all", label: "전체" }, ...BROWSE_GROUPS] as { id: Group; label: string }[]).map((g) => (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              className={`pb-3 -mb-px text-base whitespace-nowrap border-b-2 ${
                group === g.id ? "border-emerald-400 text-white font-semibold" : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {usedTopics.length > 0 && (
              <>
                <Chip active={topic === null} onClick={() => setTopic(null)}>
                  모든 주제
                </Chip>
                {usedTopics.map((t) => (
                  <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(topic === t.id ? null : t.id)}>
                    {t.name}
                  </Chip>
                ))}
                <span className="w-px h-4 bg-zinc-700 mx-2" />
              </>
            )}
            <Chip active={!showEnded} onClick={() => setShowEnded(false)}>
              진행 중
            </Chip>
            <Chip active={showEnded} onClick={() => setShowEnded(true)}>
              마감·종료
            </Chip>
          </div>
          <div className="flex items-center gap-4">
            <label className="relative flex-1 lg:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute left-0 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제목·작품·장소·굿즈 검색"
                className="w-full bg-transparent border-b border-zinc-700 pl-6 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="정렬"
              className="bg-transparent text-sm text-zinc-200 py-2 focus:outline-none [color-scheme:dark]"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-zinc-300">{error}</p>}

        {projects === null ? (
          <p className="py-16 text-center text-sm text-zinc-500">불러오는 중...</p>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-base text-zinc-300">{showEnded ? "끝난 펀딩이 아직 없어요." : "조건에 맞는 펀딩이 없어요."}</p>
            {!showEnded && (
              <Link href="/funding/new" className="text-sm text-emerald-300 underline underline-offset-4">
                원하는 펀딩을 직접 열어 보세요
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {shown.map((p) => (
              <FundingCard key={p.id} project={p} liked={fundingService.isLiked(p.id)} onToggleLike={() => toggleLike(p.id)} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-full text-sm whitespace-nowrap border ${
        active ? "bg-white text-zinc-950 border-white font-semibold" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  )
}

"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Hash, PenSquare, Trophy, X } from "lucide-react"
import { Avatar, LevelBadge, Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { HotStrip, MoreButton, NoticeStrip, PostGrid, useFeed } from "@/components/gallery/post-cards"
import { SquadBadge } from "@/components/community/squad-badge"
import { fetchFeed, fetchGalleryHome, memberHref, tagHref, type PostSummary, type RankingRow } from "@/lib/community-api"

// 덕지 갤러리 첫 화면 (/community 로 들어오면 여기): 공지·오늘의 핫 게시글·인기 해시태그·전체 사진 피드
// ?tag=<해시태그> 이면 그 태그 글만
export default function GalleryHomePage() {
  return (
    <Suspense fallback={null}>
      <GalleryHome />
    </Suspense>
  )
}

type Home = { notices: PostSummary[]; hot: PostSummary[]; tags: { tag: string; count: number }[]; ranking: RankingRow[] }

function GalleryHome() {
  const tag = useSearchParams().get("tag") || ""
  const [home, setHome] = useState<Home | null>(null)
  const feed = useFeed((cursor) => fetchFeed({ tag, cursor }), [tag])

  useEffect(() => {
    fetchGalleryHome()
      .then(setHome)
      .catch(() => setHome({ notices: [], hot: [], tags: [], ranking: [] }))
  }, [])

  return (
    <GalleryLayout nav="feed">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white">{tag ? `#${tag}` : "덕지 갤러리"}</h1>
          <p className="text-sm text-zinc-400">
            {tag ? "이 해시태그가 달린 글이에요." : "굿즈·코스프레 사진을 올리고 덕업으로 응원해요. 글을 쓰고 댓글을 달면 덕력이 쌓여요."}
          </p>
        </div>
        <div className="flex gap-2">
          {tag && (
            <Link href="/community/gallery/" className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800">
              <X className="w-3.5 h-3.5" />
              태그 해제
            </Link>
          )}
          <Link
            href="/community/gallery/write/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
          >
            <PenSquare className="w-4 h-4" />
            글쓰기
          </Link>
        </div>
      </div>

      {!tag && home && <NoticeStrip notices={home.notices} />}
      {!tag && home && <HotStrip posts={home.hot} />}

      {home && home.tags.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
            <Hash className="w-4 h-4 text-sky-400" />
            인기 해시태그
          </h2>
          <div className="flex flex-wrap gap-2">
            {home.tags.map((t) => (
              <Link
                key={t.tag}
                href={tagHref(t.tag)}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  t.tag === tag ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-zinc-700 text-zinc-300 hover:border-sky-500 hover:text-sky-300"
                }`}
              >
                #{t.tag} <span className="text-xs text-zinc-500">{t.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid xl:grid-cols-[1fr_15rem] gap-6 items-start">
        <section className="space-y-3 min-w-0">
          <h2 className="text-base font-bold text-white">{tag ? "글" : "새 글"}</h2>
          {feed.error && <Notice tone="error">{feed.error}</Notice>}
          {feed.posts === null ? <Notice>불러오는 중...</Notice> : <PostGrid posts={feed.posts} showGallery />}
          <MoreButton onClick={feed.more} />
        </section>
        {home && home.ranking.length > 0 && <RankingCard rows={home.ranking} />}
      </div>
    </GalleryLayout>
  )
}

function RankingCard({ rows }: { rows: RankingRow[] }) {
  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
        <Trophy className="w-4 h-4 text-amber-400" />
        덕력 순위
      </h2>
      <ol className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.memberId} className="flex items-center gap-2 min-w-0">
            <span className="w-5 text-sm font-bold text-zinc-500 text-center">{i + 1}</span>
            <Avatar name={r.name} src={r.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <Link href={memberHref(r.memberId)} className="block text-sm font-semibold text-zinc-100 truncate hover:underline">
                {r.name}
              </Link>
              <div className="flex items-center gap-1">
                <LevelBadge level={r} />
                <SquadBadge squad={r.squad} />
              </div>
            </div>
            <span className="text-xs text-zinc-400 shrink-0">{r.duckryeok.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <Link href="/community/gallery/ranking/" className="block text-center text-sm text-emerald-400 hover:underline">
        전체 순위
      </Link>
    </aside>
  )
}

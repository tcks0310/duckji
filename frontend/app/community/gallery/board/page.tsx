"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, PenSquare } from "lucide-react"
import { Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { HotStrip, MoreButton, NoticeStrip, PostGrid, PostList, useFeed } from "@/components/gallery/post-cards"
import { fetchFeed, fetchGallery, fetchHot, type Gallery, type Permissions, type PostSummary } from "@/lib/community-api"

// 갤러리 한 곳 (/community/gallery/board?slug=goods-monthly): 공지 고정 + 사진 격자(또는 글 목록)
export default function GalleryBoardPage() {
  return (
    <Suspense fallback={null}>
      <GalleryBoard />
    </Suspense>
  )
}

function GalleryBoard() {
  const slug = useSearchParams().get("slug") || ""
  const [info, setInfo] = useState<{ gallery: Gallery; notices: PostSummary[]; viewer: Permissions } | null>(null)
  const [hot, setHot] = useState<PostSummary[]>([])
  const [error, setError] = useState("")
  const feed = useFeed((cursor) => fetchFeed({ gallery: slug, cursor }), [slug])

  useEffect(() => {
    setInfo(null)
    setError("")
    if (!slug) return setError("갤러리를 골라 주세요.")
    fetchGallery(slug)
      .then(setInfo)
      .catch((e) => setError(e.message))
    fetchHot(slug, 6)
      .then(setHot)
      .catch(() => setHot([]))
  }, [slug])

  const gallery = info?.gallery
  // 공지로 고정한 글은 피드에서 빠지고 위 공지 띠에만 보임
  const posts = feed.posts || []

  return (
    <GalleryLayout activeSlug={slug}>
      {error && <Notice tone="error">{error}</Notice>}
      {gallery && info && (
        <>
          <header className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/60">
            {gallery.coverImageUrl && <img src={gallery.coverImageUrl} alt="" className="w-full h-32 sm:h-44 object-cover" />}
            <div className="p-4 sm:p-5 flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-black text-white">
                  {gallery.name}
                  {gallery.writeRole === "admin" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-semibold">
                      <Lock className="w-3 h-3" />
                      운영팀 글
                    </span>
                  )}
                </h1>
                {gallery.description && <p className="text-sm text-zinc-400">{gallery.description}</p>}
                <p className="text-xs text-zinc-500">
                  글 {(gallery.posts ?? 0).toLocaleString()}개{gallery.status === "dormant" && " · 휴면 중"}
                </p>
              </div>
              {info.viewer.canWrite ? (
                <Link
                  href={`/community/gallery/write/?slug=${encodeURIComponent(gallery.slug)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
                >
                  <PenSquare className="w-4 h-4" />
                  글쓰기
                </Link>
              ) : (
                info.viewer.writeBlockedReason && (
                  <span className="text-sm text-zinc-500">
                    {info.viewer.writeBlockedReason}
                    {info.viewer.writeBlockedReason.startsWith("로그인") && (
                      <Link href="/login" className="ml-1.5 text-emerald-400 font-semibold">
                        로그인
                      </Link>
                    )}
                  </span>
                )
              )}
            </div>
          </header>

          <NoticeStrip notices={info.notices} />
          {gallery.layout === "grid" && <HotStrip posts={hot.filter((p) => p.upCount > 0 || p.commentCount > 0)} />}

          {feed.error && <Notice tone="error">{feed.error}</Notice>}
          {feed.posts === null ? (
            <Notice>불러오는 중...</Notice>
          ) : gallery.layout === "grid" ? (
            <PostGrid posts={posts} />
          ) : (
            <PostList posts={posts} />
          )}
          <MoreButton onClick={feed.more} />
        </>
      )}
    </GalleryLayout>
  )
}

"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { BarChart3, ChevronLeft, ChevronRight, Copy, Flame, MessageCircle, Pin, Play, ThumbsUp } from "lucide-react"
import { AuthorName } from "@/components/gallery/gallery-shell"
import { formatPostDate, galleryHref, postHref, tagHref, type MediaItem, type PostSummary } from "@/lib/community-api"

// 해시태그 줄 (누르면 그 태그 피드)
export function HashtagList({ tags, max }: { tags: string[]; max?: number }) {
  const shown = max ? tags.slice(0, max) : tags
  if (!shown.length) return null
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {shown.map((t) => (
        <Link key={t} href={tagHref(t)} onClick={(e) => e.stopPropagation()} className="text-sm text-sky-400 hover:underline underline-offset-2">
          #{t}
        </Link>
      ))}
    </div>
  )
}

// 사진 칸 하나 (사진이 없으면 제목 글자 카드)
function Cover({ post }: { post: PostSummary }) {
  if (!post.cover) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-zinc-800 to-zinc-900">
        <span className="text-sm font-bold text-zinc-200 text-center line-clamp-4">{post.title}</span>
      </div>
    )
  }
  if (post.cover.type === "video") {
    return <video src={`${post.cover.url}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
  }
  return <img src={post.cover.url} alt="" loading="lazy" className="w-full h-full object-cover" />
}

// 인스타처럼 정사각형 사진 격자. 마우스를 올리면 덕업·댓글 수
export function PostGrid({ posts, showGallery = false, emptyText = "아직 글이 없어요. 첫 글을 올려 보세요!" }: { posts: PostSummary[]; showGallery?: boolean; emptyText?: string }) {
  if (!posts.length) return <div className="p-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center text-sm text-zinc-500">{emptyText}</div>
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {posts.map((p) => (
        <li key={p.id} className="min-w-0">
          <Link href={postHref(p.id)} className="group relative block aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900">
            <Cover post={p} />
            <div className="absolute top-2 right-2 flex gap-1 text-white drop-shadow">
              {p.cover?.type === "video" && <Play className="w-4 h-4 fill-white" aria-label="동영상" />}
              {p.mediaCount > 1 && <Copy className="w-4 h-4" aria-label={`${p.mediaCount}개`} />}
              {p.hasPoll && <BarChart3 className="w-4 h-4" aria-label="투표" />}
            </div>
            {p.isNotice && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500 text-white text-xs font-bold">
                <Pin className="w-3 h-3" />
                공지
              </span>
            )}
            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-bold">
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-4 h-4" />
                {p.upCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                {p.commentCount}
              </span>
            </div>
          </Link>
          <div className="pt-1.5 px-0.5 space-y-0.5 min-w-0">
            <Link href={postHref(p.id)} className="block text-sm font-semibold text-zinc-100 truncate hover:text-emerald-300">
              {p.head && <span className="text-zinc-500 mr-1">[{p.head}]</span>}
              {p.title}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
              {p.postedAsSquad ? (
                <span className="truncate font-semibold text-zinc-300">{p.postedAsSquad.name}</span>
              ) : (
                <AuthorName author={p} compact />
              )}
              <span className="shrink-0">· {formatPostDate(p.createdAt)}</span>
            </div>
            {showGallery && (
              <Link href={galleryHref(p.gallerySlug)} className="block text-xs text-zinc-500 hover:text-zinc-300 truncate">
                {p.galleryName}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// 글 목록 (공지 갤러리처럼 글 위주인 곳)
export function PostList({ posts, showGallery = false, emptyText = "아직 글이 없어요." }: { posts: PostSummary[]; showGallery?: boolean; emptyText?: string }) {
  if (!posts.length) return <div className="p-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center text-sm text-zinc-500">{emptyText}</div>
  return (
    <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70 overflow-hidden">
      {posts.map((p) => (
        <li key={p.id} className={`flex gap-3 p-3 sm:p-4 ${p.isNotice ? "bg-red-500/5" : ""}`}>
          <div className="flex-1 min-w-0 space-y-1">
            <Link href={postHref(p.id)} className="block text-sm sm:text-base font-semibold text-zinc-100 hover:text-emerald-300 truncate">
              {p.isNotice && <span className="mr-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold align-middle">공지</span>}
              {p.head && <span className="text-zinc-500 mr-1">[{p.head}]</span>}
              {p.title}
              {p.commentCount > 0 && <span className="ml-1.5 text-emerald-400 text-sm">[{p.commentCount}]</span>}
            </Link>
            {p.excerpt && <p className="text-sm text-zinc-400 line-clamp-1">{p.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              {p.postedAsSquad ? <span className="font-semibold text-zinc-300">{p.postedAsSquad.name}</span> : <AuthorName author={p} />}
              <span>{formatPostDate(p.createdAt)}</span>
              <span>조회 {p.viewCount}</span>
              <span>덕업 {p.upCount}</span>
              {showGallery && (
                <Link href={galleryHref(p.gallerySlug)} className="hover:text-zinc-300">
                  {p.galleryName}
                </Link>
              )}
            </div>
          </div>
          {p.cover && (
            <Link href={postHref(p.id)} className="shrink-0 w-[60px] h-20 sm:w-[72px] sm:h-24 rounded-lg overflow-hidden bg-zinc-900">
              <Cover post={p} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

// 공지 띠 (갤러리·피드 맨 위에 고정)
export function NoticeStrip({ notices }: { notices: PostSummary[] }) {
  if (!notices.length) return null
  return (
    <ul className="rounded-2xl border border-red-500/25 bg-red-500/5 divide-y divide-red-500/10">
      {notices.map((n) => (
        <li key={n.id}>
          <Link href={postHref(n.id)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-red-500/5">
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold">
              <Pin className="w-3 h-3" />
              공지
            </span>
            <span className="font-semibold text-zinc-100 truncate">{n.title}</span>
            <span className="ml-auto shrink-0 text-xs text-zinc-500">{formatPostDate(n.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// 오늘의 핫 게시글 (가로로 넘기는 줄)
export function HotStrip({ posts }: { posts: PostSummary[] }) {
  if (!posts.length) return null
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
        <Flame className="w-4 h-4 text-orange-400" />
        오늘의 핫 게시글
      </h2>
      <ol className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {posts.map((p, i) => (
          <li key={p.id} className="snap-start shrink-0 w-36 sm:w-44">
            <Link href={postHref(p.id)} className="group block space-y-1.5">
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900">
                <Cover post={p} />
                <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              </div>
              <div className="text-sm font-semibold text-zinc-100 truncate group-hover:text-emerald-300">{p.title}</div>
              <div className="text-xs text-zinc-500 truncate">
                {p.galleryName} · 덕업 {p.upCount} · 댓글 {p.commentCount}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 글 상세의 사진·동영상 넘기기
export function MediaCarousel({ media }: { media: MediaItem[] }) {
  const [index, setIndex] = useState(0)
  if (!media.length) return null
  const item = media[Math.min(index, media.length - 1)]
  const go = (d: number) => setIndex((i) => (i + d + media.length) % media.length)
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      <div className="aspect-[3/4] max-h-[80vh] mx-auto flex items-center justify-center">
        {item.type === "video" ? (
          <video key={item.url} src={item.url} controls playsInline className="max-w-full max-h-full" />
        ) : (
          <img key={item.url} src={item.url} alt="" className="max-w-full max-h-full object-contain" />
        )}
      </div>
      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="이전"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="다음"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <button
                key={m.url}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}번째`}
                className={`w-2 h-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
            {index + 1}/{media.length}
          </span>
        </>
      )}
    </div>
  )
}

// 피드 더 보기 (커서 방식)
export function useFeed<T>(loader: (cursor: string | null) => Promise<{ posts: T[]; nextCursor: string | null }>, deps: React.DependencyList) {
  const [posts, setPosts] = useState<T[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const load = React.useCallback(
    async (cursor: string | null) => {
      setIsLoading(true)
      try {
        const page = await loader(cursor)
        setPosts((prev) => (cursor && prev ? [...prev, ...page.posts] : page.posts))
        setNextCursor(page.nextCursor)
        setError("")
      } catch (e: any) {
        setError(e?.message || "불러오지 못했습니다.")
        setPosts((prev) => prev ?? [])
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )
  React.useEffect(() => {
    setPosts(null)
    load(null)
  }, [load])
  return { posts, error, isLoading, more: nextCursor && !isLoading ? () => load(nextCursor) : null, reload: () => load(null) }
}

export function MoreButton({ onClick }: { onClick: (() => void) | null }) {
  if (!onClick) return null
  return (
    <button onClick={onClick} className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-semibold text-zinc-300">
      더 보기
    </button>
  )
}

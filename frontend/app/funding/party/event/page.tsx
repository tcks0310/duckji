"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, MessageSquare, ThumbsUp } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { formatPostDate } from "@/lib/community-api"
import { fundingService, progressOf } from "@/lib/funding-service"
import {
  PARTY_EVENT_KIND_LABELS,
  PARTY_GALLERY_SLUG,
  fetchPartyEvent,
  formatDDay,
  formatEventDate,
  partyFundingHref,
  type PartyEvent,
  type PartyPost,
} from "@/lib/party-api"
import type { FundingProject } from "@/types/funding"

// 파티 이벤트 상세 (/funding/party/event?slug=naruto-birthday)
// "파티할래요?" 글(덕지 갤러리)로 자유 토론 → 그날로 펀딩 열기 (/funding/new 에 일정·제목을 채워 감)
export default function PartyEventPage() {
  return (
    <Suspense fallback={null}>
      <PartyEventDetail />
    </Suspense>
  )
}

function PartyEventDetail() {
  const slug = useSearchParams().get("slug") || ""
  const [event, setEvent] = useState<PartyEvent | null>(null)
  const [posts, setPosts] = useState<PartyPost[]>([])
  const [gallerySlug, setGallerySlug] = useState(PARTY_GALLERY_SLUG)
  const [fundings, setFundings] = useState<FundingProject[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!slug) return
    fundingService.getProjectsByPartyEvent(slug).then(setFundings).catch(() => setFundings([]))
    fetchPartyEvent(slug)
      .then((r) => {
        setEvent(r.event)
        setPosts(r.posts)
        setGallerySlug(r.partyGallerySlug)
      })
      .catch((e) => setError(e?.status === 404 ? "이벤트를 찾을 수 없습니다." : e.message))
  }, [slug])

  const writeHref = event
    ? `/community/gallery/write?slug=${encodeURIComponent(gallerySlug)}&partyEvent=${encodeURIComponent(event.slug)}`
    : "#"
  const fundingHref = event ? partyFundingHref(event) : "#"

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-14">
        <Link href="/funding/#party" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          파티 캘린더
        </Link>

        {error && <p className="py-4 text-sm text-red-300 border-y border-zinc-800">{error}</p>}

        {event && (
          <>
            <section className={`grid gap-8 lg:gap-12 items-start ${event.imageUrl ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : ""}`}>
              {event.imageUrl && (
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900">
                  <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-emerald-300">{PARTY_EVENT_KIND_LABELS[event.kind]}</span>
                  <span className="text-zinc-400">{formatEventDate(event)}</span>
                  <span className="text-emerald-300 tabular-nums">{formatDDay(event)}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight break-keep">{event.title}</h1>
                <p className="text-base text-zinc-300">
                  {event.workTitle}
                  {event.characterName && ` · ${event.characterName}`}
                </p>
                {event.description && <p className="text-base text-zinc-300 leading-relaxed whitespace-pre-wrap break-keep">{event.description}</p>}
                {event.source && <p className="text-xs text-zinc-500">출처: {event.source}</p>}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link href={writeHref} className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold">
                    파티할래요? 글 쓰기
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href={fundingHref} className="inline-flex items-center h-12 px-6 rounded-full border border-zinc-600 hover:border-zinc-400 text-white">
                    이 날로 펀딩 열기
                  </Link>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">
                파티할래요? <span className="text-zinc-500 font-semibold tabular-nums">{posts.length}</span>
              </h2>
              {posts.length === 0 ? (
                <p className="py-6 text-sm text-zinc-400 border-y border-zinc-800">아직 글이 없어요. 첫 번째로 파티를 제안해 보세요.</p>
              ) : (
                <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <Link href={`/community/gallery/post?id=${post.id}`} className="flex items-center justify-between gap-4 py-4 group">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">
                            <span className="text-emerald-300 mr-1.5">[{post.head}]</span>
                            {post.title}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {post.authorName} · {formatPostDate(post.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5" />
                            {post.voteCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {post.commentCount}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">
                이 이벤트로 열린 펀딩 <span className="text-zinc-500 font-semibold tabular-nums">{fundings.length}</span>
              </h2>
              {fundings.length === 0 ? (
                <p className="py-6 text-sm text-zinc-400 border-y border-zinc-800">아직 열린 펀딩이 없어요.</p>
              ) : (
                <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                  {fundings.map((p) => (
                    <li key={p.id}>
                      <Link href={`/funding/detail?id=${encodeURIComponent(p.id)}`} className="flex items-center justify-between gap-4 py-4 group">
                        <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">{p.title}</p>
                        <p className="text-xs text-zinc-400 shrink-0 tabular-nums">
                          <span className="text-emerald-300">{`${progressOf(p)}% 달성`}</span>
                          {p.eventDate && ` · ${p.eventDate}`}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

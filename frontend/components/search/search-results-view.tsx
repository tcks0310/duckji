"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, ExternalLink, Heart, MessageSquare, Search, X } from "lucide-react"
import { popupDetailHref } from "@/lib/popup-service"
import { PARTY_EVENT_KIND_LABELS, formatEventDate } from "@/lib/party-api"
import {
  fetchWebSearch,
  googleSearchUrl,
  daumSearchUrl,
  naverSearchUrl,
  recordSearch,
  searchPageHref,
  usePopularKeywords,
  useSiteSearch,
  type WebSearchItem,
  type WebSearchResult,
} from "@/lib/site-search"

type TabId = "all" | "popups" | "fundings" | "parties" | "gallery" | "web"

const RECENT_KEY = "duckji_recent_searches"
// 같은 검색어를 새로 고침 없이 두 번 집계하지 않게 (개발 모드 이펙트 두 번 실행 포함)
let lastRecorded = ""

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, 8) : []
  } catch {
    return []
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)))
  } catch {
    // 저장 못 해도 검색에는 지장 없음
  }
}

export function SearchResultsView() {
  const router = useRouter()
  const params = useSearchParams()
  const q = (params.get("q") || "").trim()

  const [text, setText] = useState(q)
  const [tab, setTab] = useState<TabId>("all")
  const [recent, setRecent] = useState<string[]>([])

  // 주소의 검색어가 바뀌면 입력칸·탭을 맞추고 검색어를 집계
  useEffect(() => {
    setText(q)
    setTab("all")
    if (!q) return
    if (lastRecorded !== q) {
      lastRecorded = q
      recordSearch(q, "search-page")
    }
    const next = [q, ...loadRecent().filter((s) => s !== q)]
    saveRecent(next)
    setRecent(next.slice(0, 8))
  }, [q])
  useEffect(() => setRecent(loadRecent()), [])

  const site = useSiteSearch(q, { limit: 30, delay: 0 })
  const r = site.result

  // 네이버 검색 (사이트 안 결과 다음)
  const [web, setWeb] = useState<{ query: string; result: WebSearchResult } | null>(null)
  useEffect(() => {
    if (!q) return
    let cancelled = false
    fetchWebSearch(q).then((result) => {
      if (!cancelled) setWeb({ query: q, result })
    })
    return () => {
      cancelled = true
    }
  }, [q])
  const webReady = web?.query === q
  // 출처별(네이버 → 다음) 결과 묶음. 결과가 하나도 없는 출처는 빈 배열
  const webGroupsOf = (provider: "kakao" | "naver") =>
    webReady ? (web!.result.sections.find((x) => x.provider === provider)?.groups ?? []).filter((g) => g.items.length > 0) : []
  const naverGroups = webGroupsOf("naver")
  const daumGroups = webGroupsOf("kakao")
  const countOf = (groups: { items: WebSearchItem[] }[]) => groups.reduce((n, g) => n + g.items.length, 0)
  const webCount = countOf(naverGroups) + countOf(daumGroups)

  const popular = usePopularKeywords(!q)

  const counts = useMemo(
    () => ({
      popups: r?.popups.length ?? 0,
      fundings: r?.fundings.length ?? 0,
      parties: r?.parties.length ?? 0,
      posts: r?.posts.length ?? 0,
      galleries: r?.galleries.length ?? 0,
    }),
    [r]
  )
  const siteTotal = counts.popups + counts.fundings + counts.parties + counts.posts + counts.galleries

  const tabs: { id: TabId; label: string; count: number | null }[] = [
    { id: "all", label: "전체", count: r ? siteTotal : null },
    { id: "popups", label: "팝업", count: r ? counts.popups : null },
    { id: "fundings", label: "펀딩", count: r ? counts.fundings : null },
    { id: "parties", label: "파티", count: r ? counts.parties : null },
    { id: "gallery", label: "덕지 갤러리", count: r ? counts.posts + counts.galleries : null },
    { id: "web", label: "네이버·다음·구글", count: webReady && webCount > 0 ? webCount : null },
  ]

  const submit = (value: string) => {
    const v = value.trim()
    if (!v) return
    if (v === q) {
      // 같은 검색어면 탭만 처음으로
      setTab("all")
      return
    }
    router.push(searchPageHref(v))
  }

  const isAll = tab === "all"
  const show = (id: TabId) => isAll || tab === id
  const limit = (n: number) => (isAll ? n : 100)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-5">
      {/* 검색어 입력 (다시 검색) */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
        className="flex items-stretch rounded-md border-2 border-amber-400/90 focus-within:border-amber-300 bg-zinc-950"
      >
        <div className="flex items-center pl-3 sm:pl-4 pr-2 text-amber-400 shrink-0">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="search"
          enterKeyHint="search"
          value={text}
          autoFocus={!q}
          onChange={(e) => setText(e.target.value)}
          placeholder="팝업, 작품·캐릭터, 펀딩·파티, 덕지 갤러리 글 검색"
          aria-label="검색어"
          className="w-full min-w-0 py-2.5 sm:py-3 pr-2 bg-transparent text-base text-white placeholder-zinc-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => setText("")}
            aria-label="검색어 지우기"
            className="self-center p-1.5 mr-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          className="m-1 px-4 sm:px-5 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold shrink-0"
        >
          검색
        </button>
      </form>

      {!q ? (
        <EmptyQuery
          recent={recent}
          popular={(popular.items || []).map((i) => i.target)}
          onClearRecent={() => {
            saveRecent([])
            setRecent([])
          }}
        />
      ) : (
        <>
          <div className="space-y-3">
            <h1 className="text-lg sm:text-xl font-bold text-white break-words">
              &lsquo;{q}&rsquo; 검색 결과
            </h1>
            {/* 분야별 탭 */}
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
              <div className="flex gap-1.5 border-b border-zinc-800 pb-2 min-w-max">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={`px-3 py-1.5 rounded text-sm font-semibold whitespace-nowrap transition-colors ${
                      tab === t.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                    }`}
                  >
                    {t.label}
                    {t.count !== null && (
                      <span className={`ml-1.5 ${tab === t.id ? "text-zinc-600" : "text-zinc-500"}`}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {tab !== "web" && (
            <div className="space-y-8">
              {!r && <p className="py-6 text-sm text-zinc-400">덕지 안에서 &lsquo;{q}&rsquo; 찾는 중…</p>}

              {r && r.failed.length > 0 && (
                <p className="text-sm text-zinc-400">일부 분야를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.</p>
              )}

              {/* 덕지 안 결과가 없을 때 */}
              {r && (isAll ? siteTotal === 0 : counts[tab as keyof typeof counts] === 0) && (
                <div className="py-10 text-center space-y-2 border border-zinc-800 rounded-md">
                  <Search className="w-8 h-8 mx-auto text-zinc-600" />
                  <p className="text-base font-semibold text-zinc-200">
                    {isAll ? `덕지 안에는 '${q}' 결과가 없어요` : `'${q}' ${tabs.find((t) => t.id === tab)?.label} 결과가 없어요`}
                  </p>
                  <p className="text-sm text-zinc-400">
                    작품명이나 장소처럼 짧은 단어로 다시 검색해 보세요.
                    {isAll && " 아래 네이버·구글 결과도 확인해 보세요."}
                  </p>
                </div>
              )}

              {r && show("popups") && counts.popups > 0 && (
                <ResultSection title="팝업" count={counts.popups} more={isAll && counts.popups > 6 ? () => setTab("popups") : undefined}>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {r.popups.slice(0, limit(6)).map((p) => (
                      <li key={p.id}>
                        <a
                          href={popupDetailHref(p.id)}
                          className="flex gap-3 p-2.5 rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900 transition-colors"
                        >
                          {p.posterUrl ? (
                            <img src={p.posterUrl} alt="" className="w-14 h-[72px] rounded object-cover border border-zinc-800 shrink-0" />
                          ) : (
                            <div className="w-14 h-[72px] rounded bg-zinc-800 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={p.status === "ended" ? "text-zinc-500" : "text-amber-300 font-semibold"}>{p.statusLabel}</span>
                              {p.categoryLabel && <span className="text-zinc-500">{p.categoryLabel}</span>}
                            </div>
                            <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                            <p className="text-sm text-zinc-400 truncate">{p.venueName}</p>
                            <p className="text-xs text-zinc-500">
                              {p.startDate} ~ {p.endDate}
                            </p>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {r && show("fundings") && counts.fundings > 0 && (
                <ResultSection title="펀딩" count={counts.fundings} more={isAll && counts.fundings > 4 ? () => setTab("fundings") : undefined}>
                      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-md">
                    {r.fundings.slice(0, limit(4)).map((f) => (
                      <li key={f.id}>
                        <a href={`/funding/detail/?id=${encodeURIComponent(f.id)}`} className="block px-3.5 py-3 hover:bg-zinc-900 transition-colors">
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="text-amber-300 font-semibold">{f.typeName || "펀딩"}</span>
                            <span className="truncate">{f.creatorName}</span>
                            <span className="ml-auto shrink-0">{f.endDate.slice(0, 10)} 마감</span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-white">{f.title}</p>
                          {f.summary && <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{f.summary}</p>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {r && show("parties") && counts.parties > 0 && (
                <ResultSection title="파티" count={counts.parties} more={isAll && counts.parties > 4 ? () => setTab("parties") : undefined}>
                      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-md">
                    {r.parties.slice(0, limit(4)).map((e) => (
                      <li key={e.id}>
                        <a href={`/funding/party/event?slug=${encodeURIComponent(e.slug)}`} className="block px-3.5 py-3 hover:bg-zinc-900 transition-colors">
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="text-amber-300 font-semibold">{PARTY_EVENT_KIND_LABELS[e.kind] || "파티"}</span>
                            <span className="truncate">{e.workTitle}</span>
                            <span className="ml-auto shrink-0">{formatEventDate(e)}</span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-white">{e.title}</p>
                          {e.description && <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{e.description}</p>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}

              {r && show("gallery") && counts.posts + counts.galleries > 0 && (
                <ResultSection
                  title="덕지 갤러리"
                  count={counts.posts + counts.galleries}
                  more={isAll && (counts.posts > 5 || counts.galleries > 8) ? () => setTab("gallery") : undefined}
                >
                  <div className="space-y-3">
                    {/* 이름이 맞는 갤러리 바로가기 → 글 */}
                    {counts.galleries > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.galleries.slice(0, limit(8)).map((g) => (
                          <a
                            key={g.id}
                            href={`/community/gallery/board?slug=${encodeURIComponent(g.slug)}`}
                            className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 hover:border-amber-400 hover:text-amber-300 transition-colors"
                          >
                            {g.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {counts.posts > 0 && (
                      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-md">
                        {r.posts.slice(0, limit(5)).map((post) => (
                          <li key={post.id}>
                            <a href={`/community/gallery/post/?id=${post.id}`} className="block px-3.5 py-3 hover:bg-zinc-900 transition-colors">
                              <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <span className="text-amber-300 font-semibold shrink-0">{post.galleryName || "갤러리"}</span>
                                {post.head && <span className="shrink-0">[{post.head}]</span>}
                                <span className="truncate">{post.authorName}</span>
                              </div>
                              <p className="mt-0.5 text-sm font-semibold text-white truncate">{post.title}</p>
                              {post.excerpt && <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{post.excerpt}</p>}
                              {post.hashtags.length > 0 && <p className="mt-0.5 text-xs text-sky-400 truncate">{post.hashtags.map((t) => `#${t}`).join(" ")}</p>}
                              <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                                <span>{post.createdAt.slice(0, 10)}</span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {post.commentCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  {post.voteCount}
                                </span>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </ResultSection>
              )}
            </div>
          )}

          {/* 네이버 결과(없으면 바로가기) → 다음 결과 → 구글 (사이트 안 결과 다음) */}
          {(isAll || tab === "web") && (
            <div className="space-y-8 pt-2">
              {(
                [
                  { key: "naver", title: "네이버 검색 결과", site: "네이버", groups: naverGroups, more: naverSearchUrl(q) },
                  { key: "daum", title: "다음 검색 결과", site: "다음", groups: daumGroups, more: daumSearchUrl(q) },
                ] as const
              ).map((src) => {
                const count = countOf(src.groups)
                // 다음은 결과가 없으면 칸째 숨기고, 네이버는 결과가 없으면 바로가기 버튼
                if (webReady && count === 0 && src.key === "daum") return null
                return (
                  <ResultSection key={src.key} title={src.title} count={webReady && count > 0 ? count : undefined}>
                    {!webReady ? (
                      <p className="text-sm text-zinc-400">{src.site} 검색 결과를 불러오는 중…</p>
                    ) : count > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {src.groups.map(({ label, items: list }) => (
                          <div key={label} className="space-y-2 min-w-0">
                            <p className="text-sm font-semibold text-zinc-300">{label}</p>
                            <ul className="space-y-2">
                              {list.map((item) => (
                                <li key={item.link}>
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 transition-colors"
                                  >
                                    <p className="text-sm font-semibold text-white line-clamp-1">{item.title}</p>
                                    <p className="mt-0.5 text-sm text-zinc-400 line-clamp-2">{item.description}</p>
                                    <p className="mt-1 text-xs text-zinc-500 truncate">
                                      {item.source}
                                      {item.date ? ` · ${item.date}` : ""}
                                    </p>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <a
                        href={src.more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#03C75A] hover:bg-[#02b350] text-white text-sm font-bold"
                      >
                        네이버에서 &lsquo;{q}&rsquo; 검색
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {webReady && count > 0 && (
                      <a
                        href={src.more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-zinc-300 hover:text-white"
                      >
                        {src.site}에서 더 보기
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </ResultSection>
                )
              })}

              <ResultSection title="구글">
                <a
                  href={googleSearchUrl(q)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-bold"
                >
                  구글에서 &lsquo;{q}&rsquo; 검색
                  <ExternalLink className="w-4 h-4" />
                </a>
              </ResultSection>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ResultSection({
  title,
  count,
  more,
  children,
}: {
  title: string
  count?: number
  more?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white">
          {title}
          {count !== undefined && <span className="ml-1.5 text-sm font-semibold text-zinc-400">{count}건</span>}
        </h2>
        {more && (
          <button type="button" onClick={more} className="flex items-center gap-0.5 text-sm text-zinc-400 hover:text-white">
            더보기
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

// 검색어 없이 들어왔을 때: 최근 검색어 · 실시간 인기 검색어
function EmptyQuery({ recent, popular, onClearRecent }: { recent: string[]; popular: string[]; onClearRecent: () => void }) {
  return (
    <div className="space-y-6 pt-2">
      <div className="py-8 text-center space-y-1.5">
        <p className="text-base font-semibold text-zinc-200">찾고 싶은 걸 입력해 주세요</p>
        <p className="text-sm text-zinc-400">팝업, 작품·캐릭터 이름, 펀딩·파티, 덕지 갤러리 글을 한 번에 찾아 드려요.</p>
      </div>
      {recent.length > 0 && (
        <KeywordRow
          title="최근 검색어"
          words={recent}
          action={
            <button type="button" onClick={onClearRecent} className="text-sm text-zinc-400 hover:text-white">
              모두 지우기
            </button>
          }
        />
      )}
      {popular.length > 0 && <KeywordRow title="실시간 인기 검색어" words={popular} numbered />}
    </div>
  )
}

function KeywordRow({ title, words, numbered, action }: { title: string; words: string[]; numbered?: boolean; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-200">{title}</h2>
        {action}
      </div>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => (
          <a
            key={w}
            href={searchPageHref(w)}
            className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 hover:border-amber-400 hover:text-amber-300 transition-colors"
          >
            {numbered && <span className="mr-1.5 text-amber-400 font-bold">{i + 1}</span>}
            {w}
          </a>
        ))}
      </div>
    </section>
  )
}

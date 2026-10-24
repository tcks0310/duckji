"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Compass, Flame, Heart, ImageIcon, MapPin, MessageCircle, PenSquare, Play } from "lucide-react"
import type { PopupEvent } from "@/data/popup-data"
import { popupDetailHref } from "@/lib/popup-service"
import { fetchFeed, fetchHot, postHref, type PostSummary } from "@/lib/community-api"
import { HOT_CLIP_PLATFORMS, useHotClips } from "@/lib/hot-clips"
import { HomeTodayCalendar } from "@/components/home/home-today-calendar"
import { detectApp } from "@/lib/app-mode"
import { courseDetailHref, fetchCourses, type PilgrimageCourseInfo } from "@/lib/pilgrimage"

// 3D 지구본(덕지순례)은 무거워서 두 번째 화면을 열 때만 불러옴
const OrbitDeliveryHero = dynamic(() => import("@/components/ui/orbit-delivery-hero"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-emerald-400">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
      <p className="text-xs font-bold text-zinc-400">덕지순례 지구본을 준비하는 중...</p>
    </div>
  ),
})

type PanelId = "today" | "popups" | "pilgrimage" | "hot" | "sns"
const PANELS: { id: PanelId; label: string }[] = [
  { id: "today", label: "오늘의 덕지 (날짜별 팝업·이벤트)" },
  { id: "popups", label: "지금 팝업" },
  { id: "pilgrimage", label: "덕지순례" },
  { id: "hot", label: "갤러리 인기글" },
  { id: "sns", label: "SNS 핫클립" },
]

// 홈 가운데 큰 카드: 왼쪽 아래 동그라미로 오늘의 덕지(날짜별 팝업·이벤트) · 팝업 · 덕지순례 · 갤러리 인기글 · SNS 핫클립 화면을 바꿔 봄
// (모든 화면이 같은 크기, 첫 화면은 오늘의 덕지)
export function HomeShowcase({ popups }: { popups: PopupEvent[] }) {
  const [panel, setPanel] = React.useState<PanelId>("today")
  const [opened, setOpened] = React.useState<Set<PanelId>>(() => new Set<PanelId>(["today"]))
  const show = (id: PanelId) => {
    setPanel(id)
    setOpened((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  return (
    <div className="relative w-full h-[500px] sm:h-[520px] lg:h-[550px] rounded-3xl border border-zinc-800/80 bg-zinc-950 shadow-2xl overflow-hidden">
      <style>{SHOWCASE_CSS}</style>
      {PANELS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`home-showcase-${id}`}
          aria-hidden={panel !== id}
          className={`absolute inset-0 transition-opacity duration-500 ${panel === id ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
        >
          {opened.has(id) &&
            (id === "today" ? <HomeTodayCalendar popups={popups} /> : id === "popups" ? <PopupPanel popups={popups} /> : id === "pilgrimage" ? <PilgrimagePanel /> : id === "hot" ? <HotPostsPanel /> : <SnsPanel />)}
        </div>
      ))}

      {/* 화면 바꾸기: 동그라미만 (이름은 마우스를 올리면 보임) */}
      <div role="tablist" aria-label="홈 화면 바꾸기" className="absolute left-5 bottom-5 z-20 flex items-center gap-2.5">
        {PANELS.map(({ id, label }) => {
          const active = panel === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`home-showcase-${id}`}
              aria-label={label}
              title={label}
              onClick={() => show(id)}
              className={`w-3 h-3 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.6)] transition-all duration-300 ${active ? "bg-emerald-400 ring-4 ring-emerald-400/30" : "bg-zinc-400/80 hover:bg-zinc-200"}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. 지금 팝업: 위에는 덕지 캐릭터들이 걸어 다니고, 아래에는 팝업 포스터가 흘러감
//    포스터에 마우스를 올리면 흐름이 멈추고 그 팝업의 간단한 정보가 올라옴
// ---------------------------------------------------------------------------
const CHARACTERS = [
  { src: "/images/characters/duckji.png", name: "덕지", size: "h-[88px] sm:h-[108px]", duration: 22, delay: 0, mode: "walk" },
  { src: "/images/characters/ducksoon.png", name: "덕순이", size: "h-[82px] sm:h-[100px]", duration: 26, delay: -11, mode: "walk" },
  { src: "/images/characters/clow.png", name: "클로우", size: "h-[70px] sm:h-[86px]", duration: 30, delay: -6, mode: "fly" },
] as const

function PopupPanel({ popups }: { popups: PopupEvent[] }) {
  const items = React.useMemo(() => popups.filter((p) => p.status !== "ended" && p.posterUrl).slice(0, 12), [popups])
  // 포스터가 적어도 화면을 채우며 끊김 없이 돌도록 같은 목록을 이어 붙임
  const loop = React.useMemo(() => {
    if (!items.length) return []
    const base: PopupEvent[] = []
    while (base.length < 8) base.push(...items)
    return [...base, ...base]
  }, [items])
  const marquee = usePosterMarquee(loop.length)

  return (
    <div className="h-full flex flex-col">
      {/* 캐릭터 무대 */}
      <div className="relative h-[150px] sm:h-[170px] lg:h-[180px] shrink-0 overflow-hidden bg-gradient-to-b from-[#3a0912] via-[#24060c] to-zinc-950">
        <div className="showcase-stars absolute inset-0 opacity-60" aria-hidden />
        <div className="relative z-10 px-5 sm:px-6 pt-4 sm:pt-5 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Flame className="w-3.5 h-3.5" /> 덕지가 고른 팝업
            </p>
            <h2 className="mt-1 text-lg sm:text-2xl font-black text-white">지금 열려 있는 팝업 {items.length ? `${items.length}곳` : ""}</h2>
          </div>
          <Link
            href="/popups/"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors"
          >
            전체 보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {/* 바닥선 */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        {CHARACTERS.map((c) => (
          <div
            key={c.name}
            className={`showcase-walker absolute ${c.mode === "fly" ? "bottom-14 sm:bottom-16" : "bottom-0"}`}
            style={{ animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
            aria-hidden
          >
            <div className="showcase-flip" style={{ animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}>
              <img
                src={c.src}
                alt=""
                draggable={false}
                className={`${c.size} w-auto select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] ${c.mode === "fly" ? "showcase-float" : "showcase-bob"}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 포스터 흐름 */}
      {/* 마우스를 올리거나(화살표 포함) 포스터에 초점이 있으면 흐름을 멈춤 */}
      <div
        className="relative flex-1 min-h-0 pt-4 pb-14"
        onMouseEnter={() => marquee.setHover(true)}
        onMouseLeave={() => marquee.setHover(false)}
        onFocus={() => marquee.setHover(true)}
        onBlur={() => marquee.setHover(false)}
      >
        {loop.length ? (
          <>
          <div className="h-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
            <ul ref={marquee.trackRef} className="h-full flex gap-3 sm:gap-4 w-max px-2 will-change-transform">
              {loop.map((p, i) => (
                <li key={`${p.id}-${i}`} className="h-full aspect-[3/4] shrink-0" aria-hidden={i >= loop.length / 2}>
                  <PopupPosterCard popup={p} tabIndex={i >= loop.length / 2 ? -1 : 0} />
                </li>
              ))}
            </ul>
          </div>
          {/* 좌우 화살표: 기다리지 않고 포스터를 한 장씩 넘김 */}
          {(["prev", "next"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir === "prev" ? "이전 팝업" : "다음 팝업"}
              onClick={() => marquee.step(dir === "prev" ? -1 : 1)}
              className={`absolute top-[calc(50%-1.25rem)] -translate-y-1/2 z-10 ${dir === "prev" ? "left-2 sm:left-3" : "right-2 sm:right-3"} w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm shadow-lg transition-colors`}
            >
              {dir === "prev" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          ))}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <p className="text-sm font-bold text-zinc-300">지금 열려 있는 팝업을 불러오고 있어요</p>
            <Link href="/popups/" className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
              팝업 목록 보기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// 포스터 흐름: 천천히 저절로 흘러가고(마우스를 올리면 멈춤), 화살표를 누르면 한 장씩 빠르게 넘김
// 목록을 두 번 이어 붙였으므로 절반 길이마다 처음으로 돌아가 끊김 없이 돎
const AUTO_SPEED = 40 // 초당 px

function usePosterMarquee(count: number) {
  const trackRef = React.useRef<HTMLUListElement>(null)
  const offset = React.useRef(0)
  const target = React.useRef<number | null>(null)
  const hover = React.useRef(false)

  React.useEffect(() => {
    const track = trackRef.current
    if (!track || !count) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      if (target.current !== null) {
        const diff = target.current - offset.current
        if (Math.abs(diff) < 0.5) {
          offset.current = target.current
          target.current = null
        } else offset.current += diff * Math.min(1, dt * 10)
      } else if (!hover.current && !reduce) {
        offset.current += AUTO_SPEED * dt
      }
      // 이어 붙인 두 번째 묶음의 첫 카드까지 거리 = 한 바퀴
      const second = track.children[count / 2] as HTMLElement | undefined
      const half = second ? second.offsetLeft - (track.children[0] as HTMLElement).offsetLeft : track.scrollWidth / 2
      const x = half > 0 ? ((offset.current % half) + half) % half : 0
      track.style.transform = `translateX(${-x}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count])

  const step = (dir: -1 | 1) => {
    const track = trackRef.current
    const cards = track?.children
    if (!track || !cards || cards.length < 2) return
    const width = (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft
    // 지금 위치에서 가장 가까운 카드 경계로 맞춘 뒤 한 장 이동
    const base = target.current ?? offset.current
    target.current = (Math.round(base / width) + dir) * width
  }

  return { trackRef, step, setHover: (v: boolean) => (hover.current = v) }
}

const STATUS_STYLE: Record<PopupEvent["status"], string> = {
  ongoing: "bg-emerald-500 text-black",
  closing_soon: "bg-red-500 text-white",
  upcoming: "bg-sky-500 text-black",
  ended: "bg-zinc-600 text-white",
}

function PopupPosterCard({ popup, tabIndex }: { popup: PopupEvent; tabIndex: number }) {
  const shortDate = (d: string) => d.replace(/^\d{4}-/, "").replace("-", ".")
  return (
    <a
      href={popupDetailHref(popup.id)}
      tabIndex={tabIndex}
      className="showcase-card group/card relative block h-full w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <img
        src={popup.posterUrl}
        alt={popup.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
      />
      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[popup.status]}`}>{popup.statusLabel}</span>
      {/* 기본: 아래에 제목 한 줄 */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 group-hover/card:opacity-0 group-focus-visible/card:opacity-0">
        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">{popup.title}</p>
      </div>
      {/* 마우스를 올리면 올라오는 미리보기 */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-zinc-950/92 backdrop-blur-md border-t border-emerald-500/40 translate-y-full transition-transform duration-300 ease-out group-hover/card:translate-y-0 group-focus-visible/card:translate-y-0">
        <p className="text-xs font-bold text-emerald-300">{popup.categoryLabel}</p>
        <p className="mt-0.5 text-sm font-black text-white line-clamp-2 leading-snug">{popup.title}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-300">
          <Calendar className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
          {shortDate(popup.startDate)} ~ {shortDate(popup.endDate)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-300">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">{popup.venueName || popup.location}</span>
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
          자세히 보기 <ArrowRight className="w-3.5 h-3.5" />
        </p>
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// 2. 덕지순례: 덕지·덕순이가 달리는 3D 지구본 (카드 크기에 맞춰 꽉 채움)
//    휴대폰(768px 미만)·앱은 지구본이 무거워 코스 카드로 (hj 10-18)
// ---------------------------------------------------------------------------
function useWideScreen() {
  const [wide, setWide] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setWide(mq.matches && !detectApp())
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return wide
}

function PilgrimagePanel() {
  const wide = useWideScreen()
  if (wide === null) return null
  return wide ? <PilgrimageGlobe /> : <PilgrimageCourses />
}

function PilgrimageCourses() {
  const [courses, setCourses] = React.useState<PilgrimageCourseInfo[] | null>(null)
  React.useEffect(() => {
    let alive = true
    fetchCourses().then((r) => alive && setCourses(r.ok ? r.data.courses : []))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-14">
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Compass className="w-3.5 h-3.5" /> 덕지순례
          </p>
          <h2 className="mt-1 text-lg font-black text-white">성지를 따라 걷는 코스</h2>
        </div>
        <Link
          href="/popups/pilgrimage/"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors"
        >
          전체 코스 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 mt-4 overflow-y-auto space-y-3">
        {courses === null ? (
          <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>
        ) : courses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center rounded-2xl border border-dashed border-white/15">
            <img src="/images/characters/duckji.png" alt="" className="h-20 w-auto showcase-bob" />
            <p className="text-sm font-bold text-zinc-300">곧 덕지순례 코스가 열려요</p>
          </div>
        ) : (
          courses.slice(0, 3).map((c) => (
            <Link key={c.id} href={courseDetailHref(c.id)} className="flex gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 p-2.5 transition-colors">
              <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-zinc-800">
                {c.coverImage && <img src={c.coverImage} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-sm font-bold text-white line-clamp-2">{c.title}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {[c.region, `장소 ${c.spots.length}곳`, c.durationText].filter(Boolean).join(" · ")}
                </p>
                {c.rewardDp > 0 && <p className="mt-1 text-xs font-bold text-amber-300">완주하면 {c.rewardDp.toLocaleString()} DP</p>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

function PilgrimageGlobe() {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 showcase-orbit">
        <OrbitDeliveryHero theme="dark" />
      </div>
      <div className="absolute right-4 bottom-[4.5rem] sm:bottom-4 z-10 flex flex-wrap justify-end gap-2">
        <Link
          href="/popups/calendar/"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-400" /> 이벤트 캘린더
        </Link>
        <Link
          href="/popups/pilgrimage/"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-black transition-colors"
        >
          <Compass className="w-3.5 h-3.5" /> 덕지순례 보기
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. SNS 핫클립: 관리자 센터 › 컨텐츠 관리 › 핫클립 관리에서 건 영상 (자리 1~4, lib/hot-clips)
// ---------------------------------------------------------------------------
function SnsPanel() {
  const clips = useHotClips()
  return (
    <div className="h-full flex flex-col px-4 sm:px-6 pt-4 sm:pt-5 pb-[4.25rem] sm:pb-14">
      <div className="shrink-0">
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> YouTube · CHZZK · TikTok
        </p>
        <h2 className="mt-1 text-base sm:text-2xl font-black text-white">덕지 SNS 핫클립</h2>
      </div>
      {clips && clips.length === 0 ? (
        <div className="flex-1 min-h-0 mt-4 flex flex-col items-center justify-center gap-2 text-center rounded-2xl border border-dashed border-white/15">
          <img src="/images/characters/duckji.png" alt="" className="h-20 w-auto showcase-bob" />
          <p className="text-sm font-bold text-zinc-300">곧 덕지가 고른 영상이 올라와요</p>
        </div>
      ) : (
      <ol className="flex-1 min-h-0 mt-3 sm:mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 content-center">
        {(clips || []).map((item, idx) => {
          const platform = HOT_CLIP_PLATFORMS[item.platform] || HOT_CLIP_PLATFORMS.etc
          return (
          <li key={item.slot} className="min-w-0">
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={item.creator ? `${item.title} - ${item.creator}` : item.title}
              className="group flex flex-col h-full"
            >
              {/* 상자 없이 영상 사이트처럼: 썸네일만 둥글게, 제목·채널은 바로 아래 */}
              <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900 shadow-lg shadow-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                <span className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded text-white ${platform.tone}`}>{platform.label}</span>
                <span className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-black/70 text-amber-300">0{idx + 1}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-9 h-9 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  </span>
                </span>
              </div>
              <div className="pt-2 sm:pt-2.5 px-0.5 flex-1 flex flex-col gap-1">
                <p className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-300 line-clamp-2 leading-snug">{item.title}</p>
                {item.creator && <p className="hidden sm:block text-[11px] text-zinc-400 truncate">{item.creator}</p>}
              </div>
            </a>
          </li>
          )
        })}
      </ol>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. 덕지 갤러리 인기글 (최근 24시간 인기글, 없으면 새 글)
// ---------------------------------------------------------------------------
function HotPostsPanel() {
  const [posts, setPosts] = React.useState<PostSummary[] | null>(null)
  const [isHot, setIsHot] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    fetchHot(undefined, 6)
      .then(async (hot) => {
        if (hot.length) return { list: hot, hot: true }
        const { posts: latest } = await fetchFeed({ limit: 6 })
        return { list: latest, hot: false }
      })
      .then(({ list, hot }) => {
        if (!alive) return
        setPosts(list.slice(0, 6))
        setIsHot(hot)
      })
      .catch(() => alive && setPosts([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="h-full flex flex-col px-4 sm:px-6 pt-4 sm:pt-5 pb-14">
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <ImageIcon className="w-3.5 h-3.5" /> 덕지 갤러리
          </p>
          <h2 className="mt-1 text-lg sm:text-2xl font-black text-white">{isHot ? "오늘의 인기글" : "새로 올라온 글"}</h2>
        </div>
        <Link
          href="/community/gallery/"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors"
        >
          갤러리 가기 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 mt-4">
        {posts === null ? (
          <div className="h-full grid grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`rounded-2xl bg-zinc-900 animate-pulse ${i >= 4 ? "hidden lg:block" : ""}`} />
            ))}
          </div>
        ) : posts.length ? (
          <ul className="h-full grid grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-3">
            {posts.map((p, i) => (
              <li key={p.id} className={`min-h-0 ${i >= 4 ? "hidden lg:block" : ""}`}>
                <HotPostCard post={p} rank={isHot ? i + 1 : null} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center rounded-2xl border border-dashed border-zinc-700">
            <img src="/images/characters/ducksoon.png" alt="" className="h-24 w-auto showcase-bob" />
            <p className="text-sm font-bold text-zinc-200">아직 갤러리에 글이 없어요. 첫 사진을 올려 보세요!</p>
            <Link
              href="/community/gallery/write/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-black text-black transition-colors"
            >
              <PenSquare className="w-4 h-4" /> 글쓰기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function HotPostCard({ post, rank }: { post: PostSummary; rank: number | null }) {
  const cover = post.cover
  return (
    <Link href={postHref(post.id)} className="group relative block h-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-emerald-500/60 transition-colors">
      {cover ? (
        cover.type === "video" ? (
          <video src={cover.url} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={cover.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )
      ) : (
        <div className="absolute inset-0 p-3 text-sm text-zinc-400 line-clamp-5">{post.excerpt}</div>
      )}
      {rank && <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-black flex items-center justify-center">{rank}</span>}
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <p className="text-xs text-zinc-400 truncate">{post.galleryName}</p>
        <p className="text-sm font-bold text-white truncate">{post.title}</p>
        <p className="mt-0.5 flex items-center gap-2.5 text-xs text-zinc-300">
          <span className="inline-flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-400" /> {post.upCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-sky-400" /> {post.commentCount}
          </span>
        </p>
      </div>
    </Link>
  )
}

const SHOWCASE_CSS = `
.showcase-walker { left: 2%; animation: showcase-walk ease-in-out infinite; }
.showcase-flip { animation: showcase-face steps(1) infinite; }
@keyframes showcase-walk {
  0% { left: 2%; }
  50% { left: calc(98% - 110px); }
  100% { left: 2%; }
}
@keyframes showcase-face { 0% { transform: scaleX(1); } 50% { transform: scaleX(-1); } 100% { transform: scaleX(1); } }
.showcase-bob { animation: showcase-bob 0.6s ease-in-out infinite alternate; transform-origin: bottom center; }
@keyframes showcase-bob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-7px) rotate(3deg); } }
.showcase-float { animation: showcase-float 2.4s ease-in-out infinite alternate; }
@keyframes showcase-float { from { transform: translateY(0) rotate(-4deg); } to { transform: translateY(-14px) rotate(4deg); } }

.showcase-stars {
  background-image:
    radial-gradient(1px 1px at 12% 30%, rgba(255,255,255,.7), transparent 60%),
    radial-gradient(1px 1px at 38% 18%, rgba(255,230,160,.8), transparent 60%),
    radial-gradient(1.5px 1.5px at 64% 40%, rgba(255,255,255,.6), transparent 60%),
    radial-gradient(1px 1px at 82% 22%, rgba(255,230,160,.7), transparent 60%),
    radial-gradient(1px 1px at 92% 58%, rgba(255,255,255,.5), transparent 60%),
    radial-gradient(120px 60px at 70% 100%, rgba(251,191,36,.18), transparent 70%);
}

.showcase-orbit .orbit-delivery, .showcase-orbit .orbit-delivery > .page { height: 100%; }

@media (prefers-reduced-motion: reduce) {
  .showcase-walker, .showcase-flip, .showcase-bob, .showcase-float { animation: none; }
}
`

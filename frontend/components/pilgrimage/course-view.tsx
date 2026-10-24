"use client"

import Link from "next/link"
import { Check, Clock, ExternalLink, Footprints, Gift, Heart, MapPin, Route as RouteIcon, Star, Trophy } from "lucide-react"
import { StampMark } from "@/components/pilgrimage/stamp-mark"
import { courseDetailHref, fullAddress, legBetween, naverMapLink, stepPalette, type PilgrimageCourseInfo, type RouteLeg, type PilgrimageSpotInfo } from "@/lib/pilgrimage"

// 덕지순례 코스 화면 조각: 목록 카드, 동선 타임라인, 지도 대신 보여 줄 순서 목록, 별점

// 두 장소 사이 직선거리 (m)
export function straightMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)))
}
const distanceText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.max(10, Math.round(m / 10) * 10)}m`)

// 번호 색은 지도 마커와 같은 무지개 색 (lib/pilgrimage STEP_COLORS)
export const stepColor = (i: number, _n?: number) => stepPalette(i).cls
// 도장 찍은 장소: 번호 색은 그대로, 숫자 대신 ✓ + 흰 테두리 (색이 겹치지 않게)
export const STAMPED_RING = "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"

// ---- 별점 ----

export function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`5점 중 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
      ))}
    </span>
  )
}

export function RatingText({ course }: { course: PilgrimageCourseInfo }) {
  if (!course.reviewCount || course.avgRating === null) return <span className="text-zinc-400">아직 후기 없음</span>
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <strong className="text-white">{course.avgRating.toFixed(1)}</strong>
      <span className="text-zinc-400">({course.reviewCount})</span>
    </span>
  )
}

// ---- 목록 카드 ----

export function CourseCard({
  course,
  visited,
  completed,
  liked,
  onToggleLike,
}: {
  course: PilgrimageCourseInfo
  visited?: Set<string>
  completed?: boolean
  liked?: boolean
  onToggleLike?: () => void
}) {
  const done = visited ? course.spots.filter((s) => visited.has(s.id)).length : 0
  const total = course.spots.length
  // 모든 장소에 도장을 찍었으면 사진 왼쪽 위에 완주 표시
  const finished = Boolean(completed || (visited && total > 0 && done === total))
  return (
    <div className="group relative flex flex-col">
      <Link href={courseDetailHref(course.id)} className="flex flex-col flex-1">
        <div className="relative aspect-[16/9] rounded-2xl bg-zinc-800 overflow-hidden">
          {course.coverImage ? (
            <img src={course.coverImage} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              <RouteIcon className="w-8 h-8" />
            </div>
          )}
          {finished && <CompletedBadge />}
        </div>
        <div className="pt-3 space-y-2.5 flex-1 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {course.region && <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-semibold">{course.region}</span>}
            {course.theme && <span className="text-zinc-400">{course.theme}</span>}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">{course.title}</h3>
            {course.summary && <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{course.summary}</p>}
          </div>

          {/* 동선 미리보기: 1 → 2 → 3 */}
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm">
            {course.spots.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1 min-w-0">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    visited?.has(s.id) ? `${stepColor(i)} ${STAMPED_RING}` : stepColor(i, total)
                  }`}
                >
                  {visited?.has(s.id) ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span className="text-zinc-200 truncate max-w-[9rem]">{s.name}</span>
                {i < total - 1 && <span className="text-zinc-600 px-0.5">→</span>}
              </li>
            ))}
          </ol>

          <div className="mt-auto flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
            <RatingText course={course} />
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <MapPin className="w-4 h-4 text-zinc-500" />
              {total}곳
            </span>
            {course.durationText && (
              <span className="inline-flex items-center gap-1 text-zinc-300">
                <Clock className="w-4 h-4 text-zinc-500" />
                {course.durationText}
              </span>
            )}
            {course.rewardDp > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Gift className="w-4 h-4" />
                완주 {course.rewardDp.toLocaleString()} DP
              </span>
            )}
          </div>
          {visited && total > 0 && done > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>내 스탬프</span>
                <span className={finished ? "text-emerald-400 font-bold" : ""}>{finished ? "완주" : `${done}/${total}`}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </Link>
      {onToggleLike && (
        <button
          type="button"
          onClick={onToggleLike}
          aria-label={liked ? "찜 해제" : "찜하기"}
          className={`absolute top-3 right-3 p-2 rounded-full border ${liked ? "bg-rose-600 border-rose-600 text-white" : "bg-zinc-950/80 border-zinc-700 text-zinc-300 hover:text-white"}`}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-white" : ""}`} />
        </button>
      )}
    </div>
  )
}

// ---- 완주 표시 (코스 사진 왼쪽 위) ----

export function CompletedBadge({ large }: { large?: boolean }) {
  return (
    <span
      className={`absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold shadow-lg ${
        large ? "px-3 py-1.5 text-sm sm:text-base" : "px-2.5 py-1 text-sm"
      }`}
    >
      <Trophy className={large ? "w-5 h-5" : "w-4 h-4"} />
      완주
    </span>
  )
}

// ---- 스탬프 북: 장소마다 칸 하나, 찍은 곳은 도장 ----

export function StampBook({ spots, visited, justStamped }: { spots: PilgrimageSpotInfo[]; visited: Set<string>; justStamped?: string | null }) {
  return (
    <ol className="grid grid-cols-4 sm:grid-cols-5 gap-2">
      {spots.map((s, i) => {
        const done = visited.has(s.id)
        return (
          <li key={s.id} className="flex flex-col items-center gap-1 min-w-0" title={s.name}>
            <span
              className={`relative w-14 h-14 rounded-full flex items-center justify-center ${
                done ? "" : "border-2 border-dashed border-zinc-700 text-zinc-500 text-sm font-bold"
              }`}
            >
              {done ? <StampMark number={i + 1} size={56} rotate={i % 2 ? 8 : -10} pressed={justStamped === s.id} /> : i + 1}
            </span>
            <span className={`w-full text-center text-[11px] leading-tight truncate ${done ? "text-zinc-200" : "text-zinc-500"}`}>{s.name}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ---- 지도 대신: 순서 목록 ----

export function RouteList({ spots }: { spots: PilgrimageSpotInfo[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">지도를 불러오지 못해 순서대로 보여 드려요. 장소마다 네이버 지도에서 위치를 확인할 수 있어요.</p>
      <ol className="space-y-2.5">
        {spots.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3">
            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${stepColor(i, spots.length)}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{s.name}</div>
              {fullAddress(s) && <div className="text-sm text-zinc-400">{fullAddress(s)}</div>}
              <a href={naverMapLink(s)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline">
                네이버 지도에서 보기 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---- 동선 타임라인 ----

export function RouteTimeline({
  spots,
  legs,
  visited,
  highlight,
  justStamped,
  renderAction,
}: {
  spots: PilgrimageSpotInfo[]
  legs?: (RouteLeg | null)[]
  visited?: Set<string>
  highlight?: number | null
  // 방금 도장을 찍은 장소: 도장이 꾹 눌리는 움직임
  justStamped?: string | null
  renderAction?: (spot: PilgrimageSpotInfo, index: number) => React.ReactNode
}) {
  const n = spots.length
  return (
    <ol>
      {spots.map((s, i) => {
        const done = visited?.has(s.id)
        const last = i === n - 1
        const next = spots[i + 1]
        const walk = next ? legBetween(legs, s, next) : null
        const meters = walk?.distanceM ?? (next && s.lat && next.lat ? straightMeters(s, next) : null)
        return (
          <li key={s.id} id={`spot-${i}`} className="relative flex gap-3 sm:gap-4 scroll-mt-28">
            {/* 번호 + 세로선 */}
            <div className="flex flex-col items-center shrink-0">
              <span className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center ${done ? `${stepColor(i)} ${STAMPED_RING}` : stepColor(i, n)}`}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              {!last && <span className="w-0.5 flex-1 bg-zinc-700 my-1" />}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div
                className={`relative rounded-xl -mx-2 px-2 py-1 space-y-3 transition-colors ${highlight === i ? "bg-white/5" : ""}`}
              >
                {/* 도장을 찍은 장소: 카드 오른쪽 위에 도장 자국 */}
                {done && <StampMark number={i + 1} size={72} rotate={i % 2 ? 9 : -12} pressed={justStamped === s.id} className="absolute -top-1 right-1 sm:top-0 sm:right-2 z-10" />}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {s.imageUrl && <img src={s.imageUrl} alt="" className="w-full sm:w-28 h-40 sm:h-24 rounded-xl object-cover bg-zinc-800 shrink-0" />}
                  <div className={`min-w-0 flex-1 space-y-1.5 ${done ? "sm:pr-20" : ""}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                      {i === 0 && <span className="text-emerald-400">출발</span>}
                      {last && n > 1 && <span className="text-amber-400">도착</span>}
                      {s.stayTime && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {s.stayTime} 머물기
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-white leading-snug">{s.name}</h4>
                    {fullAddress(s) && (
                      <p className="text-sm text-zinc-400 flex items-start gap-1">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />
                        <span>{fullAddress(s)}</span>
                      </p>
                    )}
                    {s.description && <p className="text-sm text-zinc-300 leading-relaxed">{s.description}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <a href={naverMapLink(s)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white underline-offset-2 hover:underline">
                    네이버 지도에서 보기 <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {renderAction?.(s, i)}
                </div>
              </div>

              {/* 다음 장소까지 */}
              {!last && (
                <div className="flex items-center gap-2 py-3 text-sm text-zinc-400">
                  <Footprints className="w-4 h-4 text-zinc-500" />
                  <span>
                    다음 장소까지 {s.nextMove && <strong className="text-zinc-200 font-semibold">{s.nextMove}</strong>}
                    {meters !== null && <span className="text-zinc-500">{s.nextMove ? " · " : ""}{walk?.distanceM != null ? "걸어서" : "직선"} {distanceText(meters)}
                        {walk?.durationS ? ` (약 ${Math.max(1, Math.round(walk.durationS / 60))}분)` : ""}</span>}
                  </span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

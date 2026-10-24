"use client"

import * as React from "react"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Clock, Gift, MapPin, Share2, Stamp, Users } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { RouteMap } from "@/components/map/route-map"
import { CompletedBadge, RatingText, RouteList, RouteTimeline, STAMPED_RING, StampBook, stepColor } from "@/components/pilgrimage/course-view"
import { CourseReviews } from "@/components/pilgrimage/course-reviews"
import { useMemberPoints } from "@/lib/member-points"
import { checkInPilgrimage } from "@/lib/rewards"
import { fetchCourse, type CourseDetail, type PilgrimageCourseInfo, type PilgrimageSpotInfo } from "@/lib/pilgrimage"

// 정적 배포용: /popups/pilgrimage/detail/?id=<코스 id>
export default function PilgrimageDetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailContent />
    </Suspense>
  )
}

function DetailContent() {
  const params = useSearchParams()
  const id = params.get("id") || ""

  const points = useMemberPoints()
  const isMember = points.status === "member"
  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [toast, setToast] = useState("")
  const [completed, setCompleted] = useState<{ title: string; dp: number } | null>(null)
  const [photo, setPhoto] = useState(0)
  // 방금 도장을 찍은 장소 (도장이 꾹 눌리는 움직임)
  const [justStamped, setJustStamped] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchCourse(id).then((r) => {
      if (r.ok) {
        setDetail(r.data)
        setError("")
      } else setError(r.status === 404 ? "덕지순례를 찾을 수 없어요. 비공개로 바뀌었거나 주소가 잘못되었어요." : r.error)
    })
  }, [id, points.status])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  const course: PilgrimageCourseInfo | null = detail?.course || null
  const visited = useMemo(() => new Set(detail?.visited || []), [detail])
  const points4map = useMemo(
    () => (course?.spots || []).filter((s) => s.lat && s.lng).map((s) => ({ lat: s.lat, lng: s.lng, title: s.name, stamped: visited.has(s.id) })),
    [course, visited]
  )

  const selectSpot = (i: number) => {
    setHighlight(i)
    document.getElementById(`spot-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const checkIn = async (spot: PilgrimageSpotInfo) => {
    if (!course || checking) return
    if (!isMember) {
      if (window.confirm("로그인하면 도장을 찍고 DP 를 받을 수 있어요. 로그인할까요?")) window.location.href = "/login"
      return
    }
    setChecking(spot.id)
    const result = await checkInPilgrimage(spot.id)
    setChecking(null)
    if (result.status === "login") {
      if (window.confirm("로그인이 필요해요. 로그인할까요?")) window.location.href = "/login"
      return
    }
    if (result.status === "error") return showToast(result.error)
    showToast(`'${spot.name}'에 도장을 찍었어요. +${result.data.rewardDp} DP`)
    setJustStamped(spot.id)
    setDetail((prev) => (prev ? { ...prev, visited: [...prev.visited, spot.id], completed: result.data.courseCompleted ? [...prev.completed, course.id] : prev.completed } : prev))
    // 도장이 찍히는 모습을 먼저 보여 준 뒤 완주 창
    if (result.data.courseCompleted) setTimeout(() => setCompleted({ title: course.title, dp: result.data.courseRewardDp }), 900)
  }

  if (!id) return <Shell><Message text="덕지순례를 찾을 수 없어요." /></Shell>
  if (error) return <Shell><Message text={error} /></Shell>
  if (!course) return <Shell><p className="py-20 text-center text-sm text-zinc-400">불러오는 중...</p></Shell>

  const total = course.spots.length
  const doneCount = course.spots.filter((s) => visited.has(s.id)).length
  const photos = [course.coverImage, ...course.gallery].filter(Boolean)
  const isCompleted = !!detail?.completed.includes(course.id) || (isMember && total > 0 && doneCount === total)

  return (
    <Shell
      onShare={() => {
        navigator.clipboard?.writeText(window.location.href)
        showToast("링크를 복사했어요.")
      }}
    >
      {toast && (
        <div role="status" className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <Link href="/popups/pilgrimage/" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" />
        덕지순례 목록
      </Link>

      {/* 대표 사진 + 소개 */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr] items-start">
        <div className="space-y-2">
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
            {photos[photo] ? <img src={photos[photo]} alt="" className="w-full h-full object-cover" /> : null}
            {/* 모든 장소에 도장을 찍었으면 왼쪽 위 완주 표시 */}
            {isCompleted && <CompletedBadge large />}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  onClick={() => setPhoto(i)}
                  className={`w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${photo === i ? "border-emerald-500" : "border-transparent opacity-70 hover:opacity-100"}`}
                  aria-label={`사진 ${i + 1}`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {course.region && <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-semibold">{course.region}</span>}
            {course.theme && <span className="text-zinc-400">{course.theme}</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {course.title}
          </h1>
          {course.summary && <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">{course.summary}</p>}
          {course.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {course.tags.map((t) => (
                <span key={t} className="text-sm text-zinc-400">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <Fact icon={<MapPin className="w-4 h-4" />} label="장소" value={`${total}곳`} />
            <Fact icon={<Clock className="w-4 h-4" />} label="예상 시간" value={course.durationText || "-"} />
            <Fact icon={<Gift className="w-4 h-4" />} label="완주 보상" value={`${course.rewardDp.toLocaleString()} DP`} />
            <Fact icon={<Users className="w-4 h-4" />} label="완주한 사람" value={`${course.completions.toLocaleString()}명`} />
          </dl>
          <div className="text-sm">
            <RatingText course={course} />
          </div>

          {/* 내 진행 */}
          {isMember ? (
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300 font-semibold">내 스탬프</span>
                  <span className={isCompleted ? "text-emerald-400 font-bold" : "text-white font-semibold"}>
                    {isCompleted ? "완주했어요" : `${doneCount} / ${total}`}
                  </span>
                </div>
                <StampBook spots={course.spots} visited={visited} justStamped={justStamped} />
                {!isCompleted && <p className="text-sm text-zinc-400">장소 근처(보통 300m 안)에서 아래 '도장 찍기'를 누르면 도장이 찍혀요.</p>}
              </div>
            ) : (
              <div className="pt-4 border-t border-white/10 text-sm text-zinc-300 flex items-center gap-3 flex-wrap">
                <span>로그인하면 장소마다 스탬프를 찍고 진행이 저장돼요.</span>
                <a href="/login" className="text-emerald-400 font-semibold hover:underline">
                  로그인
                </a>
              </div>
            )}
        </div>
      </section>

      {/* 지도 + 동선 */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-white">동선</h2>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className={`w-2.5 h-4 first:rounded-l-full last:rounded-r-full ${stepColor(i)}`} />
                ))}
              </span>
              1번부터 순서대로
            </span>
            {isMember && (
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center bg-zinc-600 text-white ${STAMPED_RING}`}>
                  <Check className="w-2.5 h-2.5" />
                </span>
                도장 찍음
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)] items-start">
          <div className="lg:order-2 lg:sticky lg:top-24 space-y-3">
            <RouteMap
              points={points4map}
              legs={course.routeLegs}
              onSelect={selectSpot}
              className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900"
              fallback={<RouteList spots={course.spots} />}
            />
            {/* 한눈에 흐름 */}
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm">
              {course.spots.map((s, i) => (
                <li key={s.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => selectSpot(i)} className="flex items-center gap-1 hover:underline underline-offset-2">
                    <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${stepColor(i, total)}`}>{i + 1}</span>
                    <span className="text-zinc-200">{s.name}</span>
                  </button>
                  {i < total - 1 && <span className="text-zinc-500 px-1">→</span>}
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:order-1">
            <RouteTimeline
              spots={course.spots}
              legs={course.routeLegs}
              visited={visited}
              highlight={highlight}
              justStamped={justStamped}
              renderAction={(s) =>
                visited.has(s.id) ? (
                  <span className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-900/50 text-emerald-300 text-sm font-semibold">
                    <Check className="w-4 h-4" />
                    도장 찍음
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => checkIn(s)}
                    disabled={!!checking}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold"
                  >
                    <Stamp className="w-4 h-4" />
                    {checking === s.id ? "위치 확인 중..." : "도장 찍기"}
                  </button>
                )
              }
            />
          </div>
        </div>
      </section>

      {detail && (
        <CourseReviews courseId={course.id} detail={detail} isMember={isMember} onChange={(next) => setDetail(next)} />
      )}

      {completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCompleted(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-6 text-center space-y-3">
            <h3 className="text-xl font-bold text-white">완주했어요</h3>
            <p className="text-sm text-zinc-300">{completed.title}의 모든 장소에 도장을 찍었어요.</p>
            {completed.dp > 0 && <p className="text-base font-semibold text-amber-300">완주 보상 +{completed.dp.toLocaleString()} DP</p>}
            <p className="text-sm text-zinc-400">어땠는지 아래에 한줄평을 남겨 주세요.</p>
            <button
              type="button"
              onClick={() => {
                setCompleted(null)
                document.getElementById("reviews-title")?.scrollIntoView({ behavior: "smooth" })
              }}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              후기 남기러 가기
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, onShare }: { children: React.ReactNode; onShare?: () => void }) {
  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader
        groupId="popup"
        itemId="pilgrimage"
        actions={
          onShare ? (
            <Button size="sm" onClick={onShare} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-full h-8 text-xs font-bold">
              <Share2 className="w-3.5 h-3.5 mr-1" />
              공유
            </Button>
          ) : undefined
        }
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">{children}</main>
      <Footer />
    </div>
  )
}

function Message({ text }: { text: string }) {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="text-sm text-zinc-300">{text}</p>
      <Link href="/popups/pilgrimage/" className="text-sm text-emerald-400 hover:underline">
        목록으로
      </Link>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center gap-1.5 text-zinc-400">
        {icon}
        {label}
      </dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  )
}

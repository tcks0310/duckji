"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { CourseCard } from "@/components/pilgrimage/course-view"
import { toggleLike, useSavedItems } from "@/lib/saved-items"
import { useMemberPoints } from "@/lib/member-points"
import { fetchCourses, type CourseList } from "@/lib/pilgrimage"

// 덕지순례 코스 목록: 관리자가 만든 공개 코스(서버)
// 코스를 누르면 상세(/popups/pilgrimage/detail/?id=)에서 지도·동선·도장·후기

export default function PilgrimagePage() {
  const [data, setData] = useState<CourseList | null>(null)
  const [error, setError] = useState("")
  const [region, setRegion] = useState("전체")
  const [toast, setToast] = useState("")
  const points = useMemberPoints()
  const saved = useSavedItems()
  const liked = new Set(saved.likes.course)

  // 로그인 상태가 바뀌면 내 도장 기록도 다시 받음
  useEffect(() => {
    fetchCourses().then((r) => {
      if (r.ok) {
        setData(r.data)
        setError("")
      } else setError(r.error)
    })
  }, [points.status])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 2500)
  }

  const courses = data?.courses || []
  const visited = useMemo(() => new Set(data?.visited || []), [data])
  const completed = useMemo(() => new Set(data?.completed || []), [data])
  const regions = ["전체", ...Array.from(new Set(courses.map((c) => c.region).filter(Boolean)))]
  const shown = region === "전체" ? courses : courses.filter((c) => c.region === region)
  const spotCount = courses.reduce((n, c) => n + c.spots.length, 0)

  const onToggleLike = async (id: string) => {
    const next = !liked.has(id)
    const result = await toggleLike("course", id)
    if (result === "login") {
      if (window.confirm("로그인하면 덕지순례를 찜할 수 있어요. 로그인할까요?")) window.location.href = "/login"
      return
    }
    if (result === "error") return showToast("저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
    showToast(next ? "찜 목록에 저장했어요." : "찜을 해제했어요.")
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      {toast && (
        <div role="status" className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <SubPageHeader
        groupId="popup"
        itemId="pilgrimage"
        actions={
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href)
              showToast("링크를 복사했어요.")
            }}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-full h-8 text-xs font-bold"
          >
            <Share2 className="w-3.5 h-3.5 mr-1" />
            공유
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* 소개: 박스 없이 제목과 한두 줄 */}
        <section className="space-y-2 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">덕지순례</h1>
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
            가까운 팝업스토어·굿즈샵·테마 카페를 걷기 좋은 순서로 이어 두었어요. 현장에서 장소마다 스탬프를 찍고, 모두 찍으면 완주 표시와 보상 DP 를 드려요.
          </p>
          <p className="text-sm text-zinc-400">
            {data ? `${courses.length}개 · 장소 ${spotCount}곳 · ` : ""}장소마다 {data?.spotDp ?? 100} DP · 휴대폰 위치가 장소 근처(보통 300m 안)일 때 찍혀요
          </p>
        </section>

        {/* 공개된 덕지순례 */}
        <section className="space-y-5">
          {regions.length > 2 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {regions.length > 2 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {regions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(r)}
                    className={`px-3 h-9 rounded-full text-sm whitespace-nowrap border ${
                      region === r ? "bg-white text-zinc-950 border-white font-semibold" : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {error ? (
            <p className="py-6 text-sm text-zinc-300">{error}</p>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-sm text-zinc-300">
              아직 공개된 덕지순례가 없어요. 운영팀이 준비하고 있어요.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {shown.map((c) => (
                <CourseCard key={c.id} course={c} visited={points.status === "member" ? visited : undefined} completed={points.status === "member" && completed.has(c.id)} liked={liked.has(c.id)} onToggleLike={() => onToggleLike(c.id)} />
              ))}
            </div>
          )}
        </section>

      </main>

      <Footer />
    </div>
  )
}

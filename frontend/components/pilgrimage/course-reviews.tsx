"use client"

import { useEffect, useRef, useState } from "react"
import { Route as RouteIcon, Star, User, Users, X } from "lucide-react"
import { deleteMyReview, REVIEW_MAX, saveMyReview, type CourseDetail, type PilgrimageReview, type ReviewAuthor } from "@/lib/pilgrimage"
import { Stars } from "./course-view"

// 코스 후기: 평균 별점 + 내 한줄평 쓰기·고치기 + 후기 목록 (작성자를 누르면 작은 프로필 카드)

const dateText = (v: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "")

function Avatar({ author, size = "w-10 h-10" }: { author: ReviewAuthor; size?: string }) {
  return author.avatarUrl ? (
    <img src={author.avatarUrl} alt="" className={`${size} rounded-full object-cover bg-zinc-800 shrink-0`} />
  ) : (
    <span className={`${size} rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0`}>
      <User className="w-1/2 h-1/2" />
    </span>
  )
}

function ProfileCard({ author, onClose }: { author: ReviewAuthor; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("mousedown", away)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", away)
      document.removeEventListener("keydown", esc)
    }
  }, [onClose])
  return (
    <div ref={ref} role="dialog" aria-label={`${author.nickname} 프로필`} className="absolute z-30 left-0 top-full mt-2 w-72 rounded-2xl bg-zinc-950 border border-zinc-700 shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar author={author} size="w-12 h-12" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-white truncate">{author.nickname}</div>
          {author.joinedAt && <div className="text-sm text-zinc-400">{dateText(author.joinedAt)} 가입</div>}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-white" aria-label="닫기">
          <X className="w-4 h-4" />
        </button>
      </div>
      {!author.withdrawn && (
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-zinc-400">
              <RouteIcon className="w-4 h-4" />
              덕지순례 완주
            </dt>
            <dd className="font-semibold text-white">{author.completions}곳 완주</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-zinc-400">
              <Users className="w-4 h-4" />
              스쿼드
            </dt>
            <dd className="font-semibold text-white text-right">{author.squad ? `${author.squad.name} (${author.squad.size}명)` : "없음"}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function ReviewItem({ review }: { review: PilgrimageReview }) {
  const [open, setOpen] = useState(false)
  const a = review.author
  return (
    <li className="py-4 flex gap-3">
      <div className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`${a.nickname} 프로필 보기`}>
          <Avatar author={a} />
        </button>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="relative flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-white hover:underline underline-offset-2">
            {a.nickname}
          </button>
          {review.mine && <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs">내 후기</span>}
          {review.completedThis && <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-xs font-semibold">완주함</span>}
          {open && <ProfileCard author={a} onClose={() => setOpen(false)} />}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Stars value={review.rating} size="w-3.5 h-3.5" />
          <span>{dateText(review.updatedAt)}</span>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed break-words">{review.comment}</p>
      </div>
    </li>
  )
}

export function CourseReviews({
  courseId,
  detail,
  isMember,
  onChange,
}: {
  courseId: string
  detail: CourseDetail
  isMember: boolean
  onChange: (next: CourseDetail) => void
}) {
  const { course, reviews, myReview } = detail
  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [comment, setComment] = useState(myReview?.comment ?? "")
  const [editing, setEditing] = useState(!myReview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setRating(myReview?.rating ?? 0)
    setComment(myReview?.comment ?? "")
    setEditing(!myReview)
  }, [myReview?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return setError("별점을 골라주세요.")
    if (comment.trim().length < 2) return setError("한줄평을 두 글자 이상 적어주세요.")
    setBusy(true)
    setError("")
    const r = await saveMyReview(courseId, rating, comment.trim())
    setBusy(false)
    if (!r.ok) return setError(r.status === 401 ? "로그인이 필요합니다." : r.error)
    onChange(r.data)
  }

  const remove = async () => {
    if (!window.confirm("내 후기를 지울까요?")) return
    setBusy(true)
    const r = await deleteMyReview(courseId)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    onChange(r.data)
  }

  // 별점 분포
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }))

  return (
    <section className="space-y-5" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-lg font-bold text-white">
        후기 <span className="text-zinc-500 font-normal">{course.reviewCount}</span>
      </h2>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* 평균 */}
        <div className="py-2 flex md:flex-col items-center md:items-start gap-4 md:gap-2">
          <div>
            <div className="text-4xl font-bold text-white">{course.avgRating !== null ? course.avgRating.toFixed(1) : "-"}</div>
            <Stars value={course.avgRating ?? 0} />
            <div className="text-sm text-zinc-400 mt-1">{course.reviewCount ? `${course.reviewCount}명이 평가했어요` : "첫 후기를 남겨 주세요"}</div>
          </div>
          {course.reviewCount > 0 && (
            <ul className="flex-1 w-full space-y-1 md:mt-2">
              {counts.map(({ n, c }) => (
                <li key={n} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="w-3">{n}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <span className="block h-full bg-amber-400" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span className="w-5 text-right">{c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 내 후기 */}
        <div className="rounded-2xl bg-white/5 p-4 sm:p-5">
          {!isMember ? (
            <div className="h-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-zinc-300">로그인하면 별점과 한줄평을 남길 수 있어요.</p>
              <a href="/login" className="inline-flex justify-center items-center h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shrink-0">
                로그인하고 후기 남기기
              </a>
            </div>
          ) : myReview && !editing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">내 후기</span>
                <div className="flex gap-2 text-sm">
                  <button type="button" onClick={() => setEditing(true)} className="text-zinc-300 hover:text-white underline underline-offset-2">
                    고치기
                  </button>
                  <button type="button" onClick={remove} disabled={busy} className="text-zinc-400 hover:text-red-300 underline underline-offset-2">
                    지우기
                  </button>
                </div>
              </div>
              <Stars value={myReview.rating} />
              <p className="text-sm text-zinc-200">{myReview.comment}</p>
              {myReview.hidden && <p className="text-xs text-amber-300">운영 정책에 따라 다른 사람에게는 보이지 않는 후기예요.</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-white">{myReview ? "후기 고치기" : "어땠나요?"}</span>
                <div className="flex gap-1" role="radiogroup" aria-label="별점">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n}점`}
                      onClick={() => setRating(n)}
                      className="p-0.5"
                    >
                      <Star className={`w-7 h-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`} />
                    </button>
                  ))}
                </div>
                {rating > 0 && <span className="text-sm text-zinc-400">{rating}점</span>}
              </div>
              <div className="relative">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, REVIEW_MAX))}
                  maxLength={REVIEW_MAX}
                  placeholder="한줄평 (예: 동선이 짧아서 반나절 나들이로 딱 좋아요)"
                  className="w-full h-11 bg-zinc-950 border border-zinc-700 rounded-xl pl-3 pr-16 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  {comment.length}/{REVIEW_MAX}
                </span>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <div className="flex gap-2 justify-end">
                {myReview && (
                  <button type="button" onClick={() => setEditing(false)} className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">
                    취소
                  </button>
                )}
                <button type="submit" disabled={busy} className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold">
                  {busy ? "저장 중..." : myReview ? "고친 후기 저장" : "후기 남기기"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {reviews.length > 0 ? (
        <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
          {reviews.map((r) => (
            <ReviewItem key={r.key} review={r} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400 py-4">아직 후기가 없어요.</p>
      )}
    </section>
  )
}

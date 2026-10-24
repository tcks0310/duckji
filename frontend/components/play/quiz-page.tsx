"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Footer } from "@/components/footer"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { useMemberPoints } from "@/lib/member-points"
import { fetchQuizCatalog, fetchQuizVersion, submitQuiz, type QuizCatalog, type QuizPlay, type QuizSubmitted } from "@/lib/rewards"

// 덕력 퀴즈 (/play/quiz): 주제별 버전 목록 → ?v=<버전 id> 로 풀기 → 결과
// 문제·정답은 서버(backend rewards 서비스)에 있고, 관리자 '컨텐츠 관리 > 덕력 퀴즈'에서 주제·버전·문제를 만듦
// 회원은 버전마다 처음 푼 결과로 한 번 덕지 포인트를 받음

const primaryBtn =
  "inline-flex h-11 items-center justify-center px-6 rounded-full bg-violet-400 hover:bg-violet-300 text-zinc-950 text-sm font-bold transition-colors disabled:opacity-40 disabled:hover:bg-violet-400"
const lineBtn =
  "inline-flex h-11 items-center justify-center px-5 rounded-full border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"

export function QuizPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <SubPageHeader groupId="play" itemId="quiz" />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <Suspense fallback={<Loading />}>
          <QuizRouter />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function Loading() {
  return <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>
}

function QuizRouter() {
  const v = Number(useSearchParams().get("v"))
  return Number.isSafeInteger(v) && v > 0 ? <QuizPlayer key={v} versionId={v} /> : <QuizList />
}

// ---- 목록 ----

function QuizList() {
  const [catalog, setCatalog] = useState<QuizCatalog | null | undefined>(undefined)
  useEffect(() => {
    fetchQuizCatalog().then(setCatalog)
  }, [])

  const versions = (catalog?.topics ?? []).flatMap((t) => t.versions)
  const done = versions.filter((v) => v.mine).length
  return (
    <div>
      <p className="text-sm text-violet-300">운세·놀이</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">덕력 퀴즈</h1>
      <p className="mt-2 text-sm text-zinc-400 break-keep">주제를 골라 풀어 보세요. 회원은 퀴즈마다 처음 한 번 DP 를 받아요.</p>
      {catalog && versions.length > 0 && (
        <p className="mt-4 text-sm text-zinc-300">
          퀴즈 {versions.length}개 중 <span className="font-semibold text-violet-300">{done}개</span> 풀었어요
        </p>
      )}

      {catalog === undefined ? (
        <Loading />
      ) : catalog === null ? (
        <p className="mt-10 py-14 border-y border-zinc-800 text-center text-sm text-zinc-400">퀴즈를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>
      ) : catalog.topics.length === 0 ? (
        <p className="mt-10 py-14 border-y border-zinc-800 text-center text-sm text-zinc-400">준비 중인 퀴즈가 곧 열려요.</p>
      ) : (
        <div className="mt-10 space-y-12">
          {catalog.topics.map((t) => (
            <section key={t.id} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t.title}</h2>
                {t.description && <p className="mt-1 text-sm text-zinc-400">{t.description}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {t.versions.map((v) => (
                  <Link
                    key={v.id}
                    href={`/play/quiz/?v=${v.id}`}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-violet-400/60 transition-colors flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-base font-bold text-white leading-snug group-hover:underline underline-offset-4">{v.title}</div>
                      {v.mine ? (
                        <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">푼 퀴즈</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-violet-400/15 px-2.5 py-0.5 text-xs font-semibold text-violet-300">NEW</span>
                      )}
                    </div>
                    {v.description && <p className="text-sm text-zinc-400 line-clamp-2">{v.description}</p>}
                    <div className="mt-auto flex items-center justify-between text-sm">
                      <span className="text-zinc-500">
                        {v.questionCount}문제 · 최대 {v.maxRewardDp.toLocaleString()} DP
                      </span>
                      {v.mine ? (
                        <span className="text-zinc-400">
                          {v.mine.correct}/{v.mine.total} 정답 · +{v.mine.rewardDp.toLocaleString()} DP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-violet-300">
                          풀기
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- 풀기 ----

function QuizPlayer({ versionId }: { versionId: number }) {
  const router = useRouter()
  const isMember = useMemberPoints().status === "member"
  const [play, setPlay] = useState<QuizPlay | null>(null)
  const [error, setError] = useState("")
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<QuizSubmitted | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchQuizVersion(versionId).then((r) => {
      if (r.ok) setPlay(r)
      else setError(r.error)
    })
  }, [versionId])

  const back = (
    <Link href="/play/quiz/" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
      <ArrowLeft className="w-4 h-4" />
      퀴즈 목록
    </Link>
  )

  if (error) {
    return (
      <div className="space-y-6">
        {back}
        <p className="py-14 border-y border-zinc-800 text-center text-sm text-zinc-400">{error}</p>
      </div>
    )
  }
  if (!play) return <Loading />

  const { version, questions } = play
  const q = questions[idx]
  const picked = q ? answers[q.id] : undefined
  const isLast = idx === questions.length - 1

  const submit = async () => {
    setBusy(true)
    const r = await submitQuiz(versionId, answers)
    setBusy(false)
    if (!r.ok) return window.alert(r.error)
    setResult(r.data)
  }

  // 다시 풀 때 방금 받은 기록을 머리 문구에 반영 (결과 화면에서는 '이미 푼 퀴즈' 문구를 띄우지 않음)
  const restart = () => {
    if (result?.member && result.mine) setPlay({ ...play, mine: result.mine })
    setAnswers({})
    setIdx(0)
    setResult(null)
  }

  const head = (
    <div className="space-y-4">
      {back}
      <div>
        <div className="text-sm text-zinc-500">{version.topicTitle}</div>
        <h1 className="mt-0.5 text-2xl font-bold text-white">{version.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {play.mine
            ? `이미 푼 퀴즈예요 (${play.mine.correct}/${play.mine.total} 정답, +${play.mine.rewardDp.toLocaleString()} DP). 다시 풀어도 포인트는 더 쌓이지 않아요.`
            : `끝까지 풀면 ${version.baseDp.toLocaleString()} DP, 정답마다 ${version.perCorrectDp.toLocaleString()} DP. 최대 ${version.maxRewardDp.toLocaleString()} DP${isMember ? "" : " (회원만)"}`}
        </p>
      </div>
    </div>
  )

  if (result) {
    return (
      <div className="space-y-8">
        {head}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 py-10 px-6 text-center">
          <div className="text-sm text-zinc-400">결과</div>
          <div className="mt-2 text-5xl font-bold text-white tabular-nums">
            {result.correct}
            <span className="text-2xl text-zinc-500"> / {result.total}</span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">{result.total}문제 중 {result.correct}문제 정답</div>
          <p className="mt-3 text-sm text-zinc-300">
            {!result.member
              ? "로그인하면 정답과 해설을 보고, 처음 한 번 포인트를 받을 수 있어요."
              : result.earnedDp > 0
                ? `덕지 포인트 +${result.earnedDp.toLocaleString()} DP 적립했어요.`
                : result.firstTry
                  ? "이번 퀴즈는 적립할 포인트가 없어요."
                  : "이미 포인트를 받은 퀴즈라 이번에는 적립되지 않았어요."}
          </p>
        </div>

        {result.member && (
          <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
            {result.results.map((r, i) => {
              const qq = questions.find((x) => x.id === r.id)
              const label = (id: number) => qq?.options.find((o) => o.id === id)?.label ?? ""
              return (
                <li key={r.id} className="py-4 space-y-1.5">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 text-sm font-bold ${r.correct ? "text-emerald-400" : "text-rose-400"}`}>{r.correct ? "정답" : "오답"}</span>
                    <span className="text-sm font-bold text-white">
                      {i + 1}. {qq?.question}
                    </span>
                  </div>
                  <div className="pl-11 text-sm text-zinc-400">
                    {r.correct ? `답: ${label(r.answer)}` : `내 답: ${label(r.picked)} · 정답: ${label(r.answer)}`}
                  </div>
                  {r.explanation && <div className="pl-11 text-sm text-zinc-500">{r.explanation}</div>}
                </li>
              )
            })}
          </ol>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={restart} className={lineBtn}>
            다시 풀기
          </button>
          {result.member ? (
            <button onClick={() => router.push("/play/quiz/")} className={primaryBtn}>
              다른 퀴즈 보기
            </button>
          ) : (
            <a href="/login/" className={primaryBtn}>
              로그인하기
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {head}

      <div>
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            {idx + 1} / {questions.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-white leading-relaxed">{q.question}</h2>
        <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="보기">
          {q.options.map((o, i) => {
            const on = picked === o.id
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={on}
                onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                className={`w-full rounded-xl border py-3.5 px-4 flex items-center gap-4 text-left transition-colors ${on ? "border-violet-400 bg-violet-400/10 text-white" : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:text-white"}`}
              >
                <span
                  className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${
                    on ? "bg-violet-400 border-violet-400 text-zinc-950" : "border-zinc-600 text-zinc-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-base ${on ? "font-bold" : ""}`}>{o.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setIdx(idx - 1)} disabled={idx === 0} className="text-sm text-zinc-400 hover:text-white disabled:invisible">
          이전 문제
        </button>
        {isLast ? (
          <button onClick={submit} disabled={busy || questions.some((x) => answers[x.id] === undefined)} className={primaryBtn}>
            {busy ? "채점 중..." : "결과 보기"}
          </button>
        ) : (
          <button onClick={() => setIdx(idx + 1)} disabled={picked === undefined} className={primaryBtn}>
            다음 문제
          </button>
        )}
      </div>
    </div>
  )
}

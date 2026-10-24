"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { SITE_MENU } from "@/lib/site-menu"
import { SAJU_DAILY } from "@/lib/saju-ai"
import { fetchQuizCatalog, type QuizCatalog } from "@/lib/rewards"

// 운세·놀이 대분류 메인 (/play/): 펀딩·스토어 메인과 같은 구성
// 소개·숫자(왼쪽) + 오늘의 운세 5선(오른쪽) → 놀이 전체 → 덕력 퀴즈 → 연결
// 각 놀이 화면은 그대로 두고 여기서는 이어 주기만 함. 예전 바로가기 화면(PortalPage view="play")은 archive/frontend/app/play/page.tsx

const SAJU_HREF = "/play/saju-ai/"

export function PlayMain() {
  const [quiz, setQuiz] = useState<QuizCatalog | null | undefined>(undefined)
  useEffect(() => {
    fetchQuizCatalog().then(setQuiz)
  }, [])

  const items = SITE_MENU.find((g) => g.id === "play")?.items ?? []
  const versions = (quiz?.topics ?? []).flatMap((t) => t.versions.map((v) => ({ ...v, topicTitle: t.title })))
  const maxDp = versions.reduce((n, v) => n + v.maxRewardDp, 0)

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="play" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-20 sm:space-y-24">
        {/* 소개 + 오늘의 운세 (상단 오른쪽) */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start">
          <div className="space-y-5 lg:pt-6">
            <p className="text-sm text-violet-300">덕지 운세·놀이</p>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.2] break-keep">
              오늘 최애와의 케미부터
              <br />
              나의 덕력까지
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl break-keep">
              덕지 도사가 만세력으로 사주와 오늘의 운세를 풀어 주고, 덕력 퀴즈를 풀면 DP 를 받아요. 가볍게 즐기는 덕후 놀이터예요.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href={SAJU_HREF} className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-violet-400 hover:bg-violet-300 text-zinc-950 font-semibold">
                덕지 도사 만나기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/play/quiz/" className="inline-flex items-center h-12 px-6 rounded-full border border-zinc-600 hover:border-zinc-400 text-white">
                덕력 퀴즈 풀기
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-6 pt-8 mt-4 border-t border-zinc-800 max-w-xl">
              <Stat label="오늘의 운세" value={`${SAJU_DAILY.length}가지`} />
              <Stat label="덕력 퀴즈" value={quiz ? `${versions.length}개` : "-"} />
              <Stat label="퀴즈로 받는 DP" value={quiz ? `최대 ${maxDp.toLocaleString()}` : "-"} small />
            </dl>
          </div>

          <aside className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">오늘의 운세</h2>
              <span className="text-xs text-zinc-400">날마다 바뀌어요 · 회원 전용</span>
            </div>
            <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
              {SAJU_DAILY.map((t) => (
                <li key={t.id}>
                  <Link href={SAJU_HREF} className="flex items-center gap-3 py-3 group">
                    <span className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:underline underline-offset-4">{t.label}</p>
                      <p className="text-xs text-zinc-400 truncate">{t.ask}</p>
                    </div>
                    <span className="text-xs text-violet-300 shrink-0">{t.tag}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="text-xs text-zinc-500">덕지 도사 AI 사주 안에서 볼 수 있어요. 지수는 날마다, 시간대 기운은 2시간마다 바뀌어요.</p>
          </aside>
        </section>

        {/* 놀이 전체 */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">놀이 전체</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.id} href={item.href} className="group rounded-2xl border border-white/10 bg-black/20 p-6 flex gap-4 hover:border-violet-400/60 transition-colors">
                  <span className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg ?? "bg-violet-500/10 text-violet-300 border-violet-500/30"}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white group-hover:underline underline-offset-4">{item.label}</h3>
                      {item.badge && <span className="text-[11px] text-violet-300">{item.badge.replace("★", "")}</span>}
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed break-keep">{item.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* 덕력 퀴즈 */}
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">덕력 퀴즈</h2>
              <p className="text-sm text-zinc-400">회원은 퀴즈마다 처음 한 번 DP 를 받아요.</p>
            </div>
            <Link href="/play/quiz/" className="text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1 shrink-0">
              퀴즈 전체
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {quiz === undefined ? (
            <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
          ) : versions.length === 0 ? (
            <p className="py-10 text-base text-zinc-300 border-y border-zinc-800">준비 중인 퀴즈가 곧 열려요.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {versions.slice(0, 4).map((v) => (
                <Link key={v.id} href={`/play/quiz/?v=${v.id}`} className="group rounded-2xl border border-white/10 bg-black/20 p-5 hover:border-violet-400/60 transition-colors flex flex-col">
                  <p className="text-xs text-violet-300 truncate">{v.topicTitle}</p>
                  <p className="mt-1 text-base font-semibold text-white leading-snug line-clamp-2 group-hover:underline underline-offset-4">{v.title}</p>
                  <p className="mt-auto pt-4 text-xs text-zinc-400">
                    {v.mine ? `푼 퀴즈 · ${v.mine.correct}/${v.mine.total} 정답` : `${v.questionCount}문제 · 최대 ${v.maxRewardDp.toLocaleString()} DP`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 연결 */}
        <section className="grid md:grid-cols-3 gap-8 border-t border-zinc-800 pt-10 text-sm">
          <Connect title="사주는 재미로" body="덕지 도사 풀이는 놀이예요. 중요한 결정은 꼭 스스로, 필요하면 전문가와 상의하세요." href={SAJU_HREF} label="덕지 도사 AI 사주" />
          <Connect title="퀴즈로 DP 모으기" body="받은 DP 는 굿즈샵과 펀딩에서 1 DP = 1원처럼 쓸 수 있어요." href="/store/" label="스토어 가기" />
          <Connect title="오프라인에서도" body="팝업 현장에서 받은 영수증 코드를 등록하면 물상 카드 특전을 받아요." href="/play/mbti/code" label="현장 코드 등록" />
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className={`${small ? "text-lg sm:text-xl pt-1.5" : "text-2xl sm:text-3xl"} font-semibold text-white tabular-nums mt-1`}>{value}</dd>
    </div>
  )
}

function Connect({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed break-keep">{body}</p>
      <Link href={href} className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
        {label}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

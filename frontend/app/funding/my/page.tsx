"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { ProgressBar, StatusText, detailHref } from "@/components/funding/funding-ui"
import { getSessionMember } from "@/lib/member-auth"
import { fundingService, fundingTypeLabel, isPastDeadline, progressOf, scheduleText } from "@/lib/funding-service"
import type { FundingParticipant, FundingProject } from "@/types/funding"

// 내 펀딩 관리 (/funding/my): 내가 연 펀딩(단계별) · 참여한 펀딩(취소)
// 연 펀딩을 누르면 상세의 '내 펀딩 관리' 탭에서 견적서·담당자와 대화·공지·참여자 명단

type View = "opened" | "joined"

const GROUPS: { id: string; label: string; statuses: string[] }[] = [
  { id: "ready", label: "준비 중", statuses: ["pending", "preparing"] },
  { id: "open", label: "진행 중", statuses: ["live", "success"] },
  { id: "done", label: "끝난 펀딩", statuses: ["failed", "canceled", "rejected"] },
]

const PAYMENT_LABEL: Record<string, string> = { reserved: "결제 예약", completed: "DP 결제", refunded: "DP 환불", canceled: "취소" }

export default function MyFundingPage() {
  const [member, setMember] = useState<boolean | null>(null)
  const [view, setView] = useState<View>("opened")
  const [projects, setProjects] = useState<FundingProject[] | null>(null)
  const [parts, setParts] = useState<FundingParticipant[] | null>(null)

  const load = () => {
    fundingService.getMyProjects().then(setProjects).catch(() => setProjects([]))
    fundingService.getMyParticipations().then(setParts).catch(() => setParts([]))
  }

  useEffect(() => {
    getSessionMember().then((m) => {
      setMember(Boolean(m))
      if (m) load()
    })
    if (new URLSearchParams(window.location.search).get("view") === "joined") setView("joined")
  }, [])

  const cancel = async (p: FundingParticipant) => {
    if (!confirm(`'${p.project?.title || "펀딩"}' 참여를 취소할까요? 결제한 ${p.totalPrice.toLocaleString()} DP 를 돌려드려요.`)) return
    try {
      await fundingService.cancelParticipation(p.id)
      load()
    } catch (e: any) {
      alert(e?.message || "취소하지 못했습니다.")
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" itemId="funding-my" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">내 펀딩 관리</h1>
          <Link href="/funding/new" className="self-start inline-flex items-center h-10 px-5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
            펀딩 열기
          </Link>
        </div>

        {member === null ? (
          <p className="py-16 text-center text-sm text-zinc-500">불러오는 중...</p>
        ) : !member ? (
          <div className="py-12 space-y-3">
            <p className="text-base text-zinc-300">로그인하면 내가 연 펀딩과 참여한 펀딩을 볼 수 있어요.</p>
            <Link href="/login/?next=/funding/my" className="inline-flex h-11 px-6 items-center rounded-full bg-emerald-400 text-zinc-950 font-semibold">
              로그인
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-800 flex gap-6">
              {(
                [
                  ["opened", `내가 연 펀딩 ${projects?.length ?? ""}`],
                  ["joined", `참여한 펀딩 ${parts?.length ?? ""}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`pb-3 -mb-px text-base border-b-2 ${view === id ? "border-emerald-400 text-white font-semibold" : "border-transparent text-zinc-400 hover:text-white"}`}
                >
                  {label.trim()}
                </button>
              ))}
            </div>

            {view === "opened" &&
              (projects === null ? (
                <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
              ) : projects.length === 0 ? (
                <div className="py-10 space-y-2">
                  <p className="text-base text-zinc-300">아직 연 펀딩이 없어요.</p>
                  <Link href="/funding/new" className="text-sm text-emerald-300 underline underline-offset-4">
                    첫 펀딩 열기
                  </Link>
                </div>
              ) : (
                <div className="space-y-10">
                  {GROUPS.map((g) => {
                    const list = projects.filter((p) => g.statuses.includes(p.status))
                    if (!list.length) return null
                    return (
                      <section key={g.id} className="space-y-2">
                        <h2 className="text-sm text-zinc-400">
                          {g.label} {list.length}
                        </h2>
                        <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                          {list.map((p) => (
                            <OpenedRow key={p.id} project={p} />
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              ))}

            {view === "joined" &&
              (parts === null ? (
                <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
              ) : parts.length === 0 ? (
                <div className="py-10 space-y-2">
                  <p className="text-base text-zinc-300">아직 참여한 펀딩이 없어요.</p>
                  <Link href="/funding/browse" className="text-sm text-emerald-300 underline underline-offset-4">
                    펀딩 둘러보기
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                  {parts.map((p) => {
                    const pr = p.project
                    const cancelable =
                      (p.paymentStatus === "completed" || p.paymentStatus === "reserved") && pr && ["live", "success"].includes(pr.status) && !isPastDeadline(pr)
                    return (
                      <li key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <Link href={detailHref(p.projectId)} className="flex-1 min-w-0 group">
                          <p className="text-base text-white truncate group-hover:underline underline-offset-4">{pr?.title || "펀딩"}</p>
                          <p className="text-sm text-zinc-400 truncate">
                            {p.rewardTitle} {p.quantity}개 · {p.totalPrice.toLocaleString()} DP · {PAYMENT_LABEL[p.paymentStatus] || p.paymentStatus}
                            {pr && <> · <StatusText project={pr} /></>}
                          </p>
                        </Link>
                        {cancelable && (
                          <button onClick={() => cancel(p)} className="self-start sm:self-auto text-sm text-zinc-400 hover:text-red-300">
                            참여 취소
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ))}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

function OpenedRow({ project }: { project: FundingProject }) {
  const publicStage = ["live", "success", "failed", "canceled"].includes(project.status)
  const percent = progressOf(project)
  return (
    <li>
      <Link href={`${detailHref(project.id)}&tab=manage`} className="flex items-center gap-4 py-4 group">
        <div className="w-16 h-16 rounded-md overflow-hidden bg-zinc-900 shrink-0">
          {project.thumbnailUrl ? <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-zinc-400">
            {fundingTypeLabel(project.type)} · <StatusText project={project} />
            {project.managerName && <> · 담당 {project.managerName}</>}
          </p>
          <p className="text-base text-white truncate group-hover:underline underline-offset-4">{project.title}</p>
          {publicStage ? (
            <div className="flex items-center gap-3 max-w-sm">
              <ProgressBar percent={percent} />
              <span className="text-xs text-emerald-300 tabular-nums shrink-0">{percent}%</span>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 truncate">{scheduleText(project) || "일정 미정"}</p>
          )}
        </div>
        <span className="text-sm text-zinc-400 group-hover:text-white shrink-0 hidden sm:block">관리</span>
      </Link>
    </li>
  )
}

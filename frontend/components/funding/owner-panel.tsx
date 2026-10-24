"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Check } from "lucide-react"
import { FundingChat } from "@/components/funding/funding-chat"
import { QuoteView } from "@/components/funding/quote-view"
import { fundingService, isPastDeadline } from "@/lib/funding-service"
import type { FundingParticipant, FundingProject, FundingQuote } from "@/types/funding"

// 펀딩 상세 › 내 펀딩 관리 (개설자에게만 보임): 진행 단계 · 견적서 · 담당자와 대화 · 공지 쓰기 · 참여자 명단

const STAGES = [
  { id: "pending", label: "견적 전" },
  { id: "preparing", label: "오픈 준비" },
  { id: "live", label: "펀딩 받는 중" },
  { id: "success", label: "목표 달성" },
] as const

function stageIndex(p: FundingProject) {
  const i = STAGES.findIndex((s) => s.id === p.status)
  return i < 0 ? -1 : i
}

function stageMessage(p: FundingProject): string {
  switch (p.status) {
    case "pending":
      return "담당자가 신청서를 검토하고 있어요. 궁금한 점은 아래 대화로 남겨 주세요. 견적서는 가입한 이메일로도 보내 드려요."
    case "preparing":
      return "견적이 나왔어요. 담당자와 대화로 목표와 예상 참여 가격을 정하면, 담당자가 펀딩을 공개해요."
    case "live":
      return isPastDeadline(p)
        ? "모집 마감일이 지났어요. 담당자와 기간을 늘릴지, 이대로 마감할지 대화로 정해 주세요."
        : "펀딩이 공개됐어요. 공지로 참여자에게 소식을 전해 보세요."
    case "success":
      return isPastDeadline(p) ? "목표를 채우고 모집을 마쳤어요. 담당자가 대관·제작을 진행해요." : "목표를 채웠어요. 마감일까지 계속 참여를 받아요."
    case "failed":
      return "목표를 채우지 못해 펀딩을 마감했어요. 참여한 DP 는 모두 돌려드렸어요."
    case "canceled":
      return `펀딩이 중단됐어요.${p.rejectionReason ? ` 사유: ${p.rejectionReason}` : ""} 참여한 DP 는 모두 돌려드렸어요.`
    case "rejected":
      return `개설이 반려됐어요.${p.rejectionReason ? ` 사유: ${p.rejectionReason}` : ""}`
    default:
      return ""
  }
}

export function OwnerPanel({ project, onChanged }: { project: FundingProject; onChanged: () => void }) {
  const [quotes, setQuotes] = useState<FundingQuote[] | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [participants, setParticipants] = useState<FundingParticipant[] | null>(null)
  const [notice, setNotice] = useState({ title: "", content: "" })
  const [posting, setPosting] = useState(false)
  const [showOld, setShowOld] = useState(false)

  const loadQuotes = useCallback(() => {
    fundingService.getQuotes(project.id).then(setQuotes).catch(() => setQuotes([]))
  }, [project.id])

  useEffect(() => {
    loadQuotes()
    if (["live", "success", "failed", "canceled"].includes(project.status))
      fundingService.getParticipantsByProject(project.id).then(setParticipants).catch(() => setParticipants([]))
  }, [project.id, project.status, loadQuotes])

  const accept = async (q: FundingQuote) => {
    setAccepting(true)
    try {
      await fundingService.acceptQuote(project.id, q.id)
      loadQuotes()
    } catch (e: any) {
      alert(e?.message || "처리하지 못했습니다.")
    } finally {
      setAccepting(false)
    }
  }

  const postNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notice.title.trim() || !notice.content.trim()) return
    setPosting(true)
    try {
      await fundingService.addNotice(project.id, notice.title, notice.content)
      setNotice({ title: "", content: "" })
      onChanged()
    } catch (err: any) {
      alert(err?.message || "공지를 올리지 못했습니다.")
    } finally {
      setPosting(false)
    }
  }

  const loadMessages = useCallback(() => fundingService.getMessages(project.id), [project.id])
  const sendMessage = useCallback((c: string) => fundingService.sendMessage(project.id, c), [project.id])

  const idx = stageIndex(project)
  const latest = quotes?.find((q) => q.status !== "replaced")
  const old = (quotes || []).filter((q) => q !== latest)
  const active = (participants || []).filter((p) => p.paymentStatus === "completed" || p.paymentStatus === "reserved")

  return (
    <div className="space-y-12">
      {/* 진행 단계 */}
      <section className="space-y-4">
        <ol className="grid grid-cols-4 gap-2">
          {STAGES.map((s, i) => (
            <li key={s.id} className="space-y-2">
              <span className={`block h-0.5 ${i <= idx ? "bg-emerald-400" : "bg-zinc-700"}`} />
              <span className={`flex items-center gap-1 text-xs sm:text-sm ${i === idx ? "text-white font-semibold" : i < idx ? "text-zinc-300" : "text-zinc-500"}`}>
                {i < idx && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-zinc-300 leading-relaxed break-keep">{stageMessage(project)}</p>
        <p className="text-sm text-zinc-400">담당자: {project.managerName ? <span className="text-zinc-100">{project.managerName}</span> : "배정 전"}</p>
      </section>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* 담당자와 대화 */}
        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-white">담당자와 대화</h3>
          <FundingChat
            me="creator"
            load={loadMessages}
            send={sendMessage}
            emptyText="아직 대화가 없어요. 일정·장소·굿즈에 대해 궁금한 점이나 바꾸고 싶은 내용을 남겨 주세요."
          />
        </section>

        {/* 견적서 */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-white">견적서</h3>
          {quotes === null ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : !latest ? (
            <p className="text-sm text-zinc-400">아직 견적서가 없어요. 담당자가 검토를 마치면 여기와 이메일로 보내 드려요.</p>
          ) : (
            <QuoteView quote={latest} onAccept={() => accept(latest)} accepting={accepting} />
          )}
          {old.length > 0 && (
            <div className="space-y-4">
              <button type="button" onClick={() => setShowOld((v) => !v)} className="text-sm text-zinc-400 hover:text-white">
                {showOld ? "이전 견적 접기" : `이전 견적 ${old.length}개 보기`}
              </button>
              {showOld && old.map((q) => <QuoteView key={q.id} quote={q} />)}
            </div>
          )}
        </section>
      </div>

      {/* 공지 쓰기 */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">공지 쓰기</h3>
        <p className="text-sm text-zinc-400">펀딩 상세의 공지 탭에 올라가요. 일정 변경, 준비 소식 등을 알려 주세요.</p>
        <form onSubmit={postNotice} className="space-y-3">
          <input
            value={notice.title}
            onChange={(e) => setNotice((n) => ({ ...n, title: e.target.value }))}
            maxLength={200}
            placeholder="제목"
            className="w-full bg-transparent border-b border-zinc-700 py-2.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
          />
          <textarea
            value={notice.content}
            onChange={(e) => setNotice((n) => ({ ...n, content: e.target.value }))}
            rows={4}
            maxLength={5000}
            placeholder="내용"
            className="w-full bg-white/[0.03] border border-zinc-800 rounded-lg p-3.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 resize-y"
          />
          <button
            type="submit"
            disabled={posting || !notice.title.trim() || !notice.content.trim()}
            className="h-10 px-5 rounded-full bg-white text-zinc-950 text-sm font-semibold disabled:opacity-40"
          >
            {posting ? "올리는 중..." : "공지 올리기"}
          </button>
        </form>
      </section>

      {/* 참여자 명단 */}
      {participants && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-white">참여자 명단 {active.length}명</h3>
          {active.length === 0 ? (
            <p className="text-sm text-zinc-400">아직 참여자가 없어요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-zinc-400 text-left">
                  <tr className="border-b border-zinc-800">
                    <th className="py-2 font-normal">이름</th>
                    <th className="py-2 font-normal">옵션</th>
                    <th className="py-2 font-normal text-right">수량</th>
                    <th className="py-2 font-normal">연락처</th>
                    <th className="py-2 font-normal">참여일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {active.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 text-white">{p.userName}</td>
                      <td className="py-2 text-zinc-300">{p.rewardTitle}</td>
                      <td className="py-2 text-right tabular-nums">{p.quantity}</td>
                      <td className="py-2 text-zinc-300">{[p.userPhone, p.userEmail].filter(Boolean).join(" · ")}</td>
                      <td className="py-2 text-zinc-400 tabular-nums">{new Date(p.createdAt).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

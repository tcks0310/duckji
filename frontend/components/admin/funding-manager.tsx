"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ExternalLink, Mail, Plus, RefreshCw, Trash2 } from "lucide-react"
import { FundingChat } from "@/components/funding/funding-chat"
import { QuoteView } from "@/components/funding/quote-view"
import { FundingVenuesManager } from "@/components/admin/funding-venues-manager"
import { memberHref } from "@/lib/community-api"
import {
  STATUS_LABELS,
  displayStatus,
  fundingService,
  fundingTypeLabel,
  hasGoods,
  hasVenue,
  isPastDeadline,
  progressOf,
  scheduleText,
  type AdminProjectList,
} from "@/lib/funding-service"
import type { FundingNotice, FundingParticipant, FundingProject, FundingQuote, FundingReport, FundingStatus, FundingTopic } from "@/types/funding"

// 관리자 > 펀딩 관리 (backend funding 서비스 /api/funding/admin/...)
// 개설 신청 검수 → 견적서 → 담당자 대화 → 공개 설정(목표·마감·참여 옵션·담당자·주제) → 공개 → 마감(연장·성사·무산)
// 견적서 메일은 SES 대신 관리자가 개설자 이메일로 직접 보냄 (이메일 주소는 상세에 표시)

type Section = "projects" | "topics" | "venues" | "reports"
type Stage = "pending" | "preparing" | "live" | "success" | "ended"

const STAGES: { id: Stage; label: string; match: (p: FundingProject) => boolean }[] = [
  { id: "pending", label: "견적 전", match: (p) => p.status === "pending" },
  { id: "preparing", label: "오픈 준비", match: (p) => p.status === "preparing" },
  { id: "live", label: "펀딩 받는 중", match: (p) => p.status === "live" },
  { id: "success", label: "목표 달성", match: (p) => p.status === "success" },
  { id: "ended", label: "무산·중단·반려", match: (p) => ["failed", "canceled", "rejected", "draft"].includes(p.status) },
]

const input = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600 [color-scheme:dark]"
const primary = "h-9 px-4 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
const secondary = "h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50"
const danger = "h-9 px-4 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm disabled:opacity-50"
const card = "p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4"
const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR")
const ymd = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function FundingManager() {
  const [section, setSection] = useState<Section>("projects")
  const tabs: { id: Section; label: string }[] = [
    { id: "projects", label: "펀딩" },
    { id: "topics", label: "주제" },
    { id: "venues", label: "대관 장소" },
    { id: "reports", label: "신고" },
  ]
  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`px-4 h-9 rounded-lg text-sm whitespace-nowrap ${section === t.id ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {section === "projects" && <Projects />}
      {section === "topics" && <Topics />}
      {section === "venues" && <FundingVenuesManager />}
      {section === "reports" && <Reports />}
    </div>
  )
}

// ================================================================ 펀딩 목록·상세
function Projects() {
  const [data, setData] = useState<AdminProjectList | null>(null)
  const [topics, setTopics] = useState<FundingTopic[]>([])
  const [error, setError] = useState("")
  const [stage, setStage] = useState<Stage>("pending")
  const [topic, setTopic] = useState("")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    fundingService
      .adminList()
      .then((d) => {
        setData(d)
        setError("")
      })
      .catch((e) => setError(e?.message || "불러오지 못했습니다."))
    fundingService.getTopics().then(setTopics).catch(() => {})
  }, [])

  useEffect(load, [load])

  const list = data?.projects || []
  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.id, list.filter(s.match).length])), [list])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const st = STAGES.find((s) => s.id === stage)!
    return list
      .filter(st.match)
      .filter((p) => !topic || String(p.topicId || "") === topic)
      .filter((p) => !q || [p.title, p.creatorName, p.managerName || "", data?.contacts[p.creatorId]?.email || ""].some((v) => v.toLowerCase().includes(q)))
  }, [list, stage, topic, query, data])

  const opened = list.find((p) => p.id === openId)
  if (opened && data)
    return (
      <ProjectDetail
        project={opened}
        email={data.contacts[opened.creatorId]?.email || ""}
        topics={topics}
        onBack={() => setOpenId(null)}
        onChanged={load}
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`text-left p-3.5 rounded-xl border transition-colors ${stage === s.id ? "bg-zinc-100 border-zinc-100 text-zinc-900" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}
          >
            <div className="text-sm">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{counts[s.id] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·개설자·이메일·담당자 검색" className={`${input} sm:max-w-xs`} />
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={`${input} sm:max-w-[200px]`}>
          <option value="">모든 주제</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button onClick={load} className={`${secondary} inline-flex items-center gap-1.5 sm:ml-auto`}>
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-zinc-900 text-zinc-400 text-left">
            <tr>
              <th className="p-3 font-normal">펀딩</th>
              <th className="p-3 font-normal">종류 · 주제</th>
              <th className="p-3 font-normal">개설자</th>
              <th className="p-3 font-normal">담당자</th>
              <th className="p-3 font-normal">진행</th>
              <th className="p-3 font-normal">대화</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {!data ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  불러오는 중...
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  이 단계의 펀딩이 없습니다.
                </td>
              </tr>
            ) : (
              shown.map((p) => {
                const last = data.lastMessages[p.id]
                const needsDecision = (p.status === "live" || p.status === "success") && isPastDeadline(p)
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer hover:bg-zinc-900/70">
                    <td className="p-3">
                      <div className="text-white font-medium">{p.title}</div>
                      <div className="text-xs text-zinc-500">신청 {fmt(p.createdAt)}</div>
                    </td>
                    <td className="p-3 text-zinc-300">
                      {fundingTypeLabel(p.type)}
                      <div className="text-xs text-zinc-500">{p.topicName || "주제 없음"}</div>
                    </td>
                    <td className="p-3 text-zinc-300">
                      {p.creatorName}
                      <div className="text-xs text-zinc-500">{data.contacts[p.creatorId]?.email || ""}</div>
                    </td>
                    <td className="p-3 text-zinc-300">{p.managerName || <span className="text-zinc-500">배정 전</span>}</td>
                    <td className="p-3">
                      {needsDecision ? (
                        <span className="text-amber-300">마감 · 연장/마감 결정</span>
                      ) : ["live", "success"].includes(p.status) ? (
                        <span className="text-zinc-200 tabular-nums">{progressOf(p)}% · {p.currentCount}명</span>
                      ) : (
                        <span className="text-zinc-400">{STATUS_LABELS[p.status]}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {last?.sender === "creator" ? <span className="text-amber-300">답장 필요</span> : last ? <span className="text-zinc-500">답장함</span> : <span className="text-zinc-600">-</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProjectDetail({
  project,
  email,
  topics,
  onBack,
  onChanged,
}: {
  project: FundingProject
  email: string
  topics: FundingTopic[]
  onBack: () => void
  onChanged: () => void
}) {
  const [quotes, setQuotes] = useState<FundingQuote[] | null>(null)
  const [participants, setParticipants] = useState<FundingParticipant[] | null>(null)
  const [notices, setNotices] = useState<FundingNotice[]>([])

  const loadExtra = useCallback(() => {
    fundingService.getQuotes(project.id).then(setQuotes).catch(() => setQuotes([]))
    fundingService.getParticipantsByProject(project.id).then(setParticipants).catch(() => setParticipants([]))
    fundingService.getNotices(project.id).then(setNotices)
  }, [project.id])
  useEffect(loadExtra, [loadExtra])

  const refresh = () => {
    onChanged()
    loadExtra()
  }

  const loadMessages = useCallback(() => fundingService.adminGetMessages(project.id), [project.id])
  const sendMessage = useCallback((c: string) => fundingService.adminSendMessage(project.id, c), [project.id])

  const latestQuote = quotes?.find((q) => q.status !== "replaced")
  const mailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(`[덕지 펀딩] ${project.title} 견적서`)}&body=${encodeURIComponent(
        latestQuote
          ? `${project.creatorName} 님, 신청하신 펀딩의 견적을 보내 드립니다.\n\n${latestQuote.lines.map((l) => `- ${l.label}: ${l.amount.toLocaleString()}원`).join("\n")}\n합계: ${latestQuote.totalAmount.toLocaleString()}원\n\n${latestQuote.memo}\n\n자세한 내용은 덕지 > 펀딩 > 내 펀딩 관리에서 확인하고, 담당자와 대화로 남겨 주세요.`
          : ""
      )}`
    : ""

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          목록
        </button>
        <a href={`/funding/detail/?id=${encodeURIComponent(project.id)}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          사이트에서 보기
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-zinc-400">
          {fundingTypeLabel(project.type)} · <span className="text-zinc-100">{displayStatus(project)}</span>
          {project.topicName && ` · ${project.topicName}`}
        </p>
        <h2 className="text-xl font-semibold text-white">{project.title}</h2>
      </div>

      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <StatusActions project={project} onChanged={refresh} />
          <Application project={project} email={email} />
          <EditContent project={project} onChanged={refresh} />
        </div>

        <div className="space-y-5">
          <section className={card}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">담당자 대화</h3>
              <span className="text-xs text-zinc-500">{project.managerName ? `담당 ${project.managerName}` : "담당자 배정 전"}</span>
            </div>
            <FundingChat me="admin" tone="admin" load={loadMessages} send={sendMessage} emptyText="아직 대화가 없습니다. 개설자에게 첫 인사와 확인할 내용을 남겨 주세요." />
          </section>

          <section className={card}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">견적서</h3>
              {email && (
                <a href={mailHref} className="inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200">
                  <Mail className="w-4 h-4" />
                  {latestQuote ? "견적서 메일 쓰기" : "개설자에게 메일"}
                </a>
              )}
            </div>
            {latestQuote ? <QuoteView quote={latestQuote} tone="admin" /> : <p className="text-sm text-zinc-500">보낸 견적서가 없습니다. 견적서를 보내면 견적 전 → 오픈 준비로 바뀝니다.</p>}
            <QuoteForm project={project} onSent={refresh} />
            {(quotes || []).filter((q) => q !== latestQuote).length > 0 && (
              <details className="text-sm text-zinc-400">
                <summary className="cursor-pointer">이전 견적 {(quotes || []).filter((q) => q !== latestQuote).length}개</summary>
                <div className="space-y-4 pt-3">
                  {(quotes || [])
                    .filter((q) => q !== latestQuote)
                    .map((q) => (
                      <QuoteView key={q.id} quote={q} tone="admin" />
                    ))}
                </div>
              </details>
            )}
          </section>

          <Setup project={project} topics={topics} hasParticipants={Boolean(participants?.length)} onSaved={refresh} />
          <AdminNotices project={project} notices={notices} onChanged={refresh} />
          <ParticipantList participants={participants} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 단계 바꾸기
function StatusActions({ project, onChanged }: { project: FundingProject; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const past = isPastDeadline(project)

  const run = async (status: FundingStatus, confirmText: string, needReason = false) => {
    let reason = ""
    if (needReason) {
      reason = prompt(`${confirmText}\n사유를 입력해 주세요. (개설자에게 보입니다)`) || ""
      if (!reason.trim()) return
    } else if (!confirm(confirmText)) return
    setBusy(true)
    try {
      await fundingService.adminSetStatus(project.id, status, reason)
      onChanged()
    } catch (e: any) {
      alert(e?.message || "바꾸지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }

  const s = project.status
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">진행 단계</h3>
      <p className="text-sm text-zinc-300">
        지금: <span className="text-white font-medium">{displayStatus(project)}</span>
        {project.openedAt && <span className="text-zinc-500"> · 공개 {fmt(project.openedAt)}</span>}
        <span className="text-zinc-500"> · 모집 마감 {fmt(project.endDate)}</span>
      </p>
      {(s === "live" || s === "success") && past && (
        <p className="text-sm text-amber-300">
          모집 마감일이 지났습니다. 개설자와 대화로 정한 뒤, 기간을 늘리려면 아래 &apos;공개 설정&apos;에서 마감일을 바꾸고, 끝내려면 성사 또는 무산으로 처리하세요.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {s === "pending" && (
          <button disabled={busy} onClick={() => run("preparing", "견적서 없이 오픈 준비 단계로 넘길까요?")} className={secondary}>
            오픈 준비로
          </button>
        )}
        {(s === "pending" || s === "preparing") && (
          <button disabled={busy} onClick={() => run("live", "펀딩을 공개할까요? 공개하면 누구나 보고 DP 로 참여할 수 있습니다.")} className={primary}>
            펀딩 공개
          </button>
        )}
        {s === "preparing" && (
          <button disabled={busy} onClick={() => run("pending", "견적 전 단계로 되돌릴까요?")} className={secondary}>
            견적 전으로
          </button>
        )}
        {(s === "live" || s === "success") && (
          <button disabled={busy} onClick={() => run("success", "목표 달성(성사)으로 처리할까요? 모인 DP 로 대관·제작을 진행합니다.")} className={primary}>
            성사 처리
          </button>
        )}
        {(s === "live" || s === "success") && (
          <button disabled={busy} onClick={() => run("failed", "무산 처리할까요? 참여한 DP 를 모두 돌려줍니다.", true)} className={danger}>
            무산 (DP 환불)
          </button>
        )}
        {(s === "live" || s === "success" || s === "preparing") && (
          <button disabled={busy} onClick={() => run("canceled", "펀딩을 중단할까요? 참여한 DP 를 모두 돌려줍니다.", true)} className={danger}>
            중단
          </button>
        )}
        {(s === "pending" || s === "preparing") && (
          <button disabled={busy} onClick={() => run("rejected", "개설을 반려할까요?", true)} className={danger}>
            반려
          </button>
        )}
        {(s === "rejected" || s === "canceled") && (
          <button disabled={busy} onClick={() => run("pending", "견적 전 단계로 다시 열까요?")} className={secondary}>
            다시 검토
          </button>
        )}
      </div>
      {project.rejectionReason && <p className="text-sm text-zinc-400">사유: {project.rejectionReason}</p>}
    </section>
  )
}

// ---------------------------------------------------------------- 신청 내용
function Application({ project, email }: { project: FundingProject; email: string }) {
  const rows: [string, React.ReactNode][] = [
    [
      "개설자",
      <span key="c">
        <a href={memberHref(project.creatorId)} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">
          {project.creatorName}
        </a>
        {email && <span className="text-zinc-400"> · {email}</span>}
      </span>,
    ],
    [project.type === "group_buy" ? "수령 희망" : "일정", scheduleText(project) || "-"],
  ]
  if (hasVenue(project.type))
    rows.push(["장소", [project.venueName, project.region, project.venueAddress].filter(Boolean).join(" · ") || "-"], ["예상 인원", project.maxCapacity ? `${project.maxCapacity}명` : "-"])
  if (project.type === "group_buy") rows.push(["받는 방법", project.deliveryMethod === "pickup" ? "현장 수령" : project.deliveryMethod === "both" ? "배송·현장" : "배송"])
  rows.push(
    ["희망 목표", project.goalType === "count" || (!project.targetAmount && project.targetCount) ? `${project.targetCount}명` : `${project.targetAmount.toLocaleString()}원`],
    ["희망 예상 가격", project.desiredPrice ? `${project.desiredPrice.toLocaleString()}원` : "-"],
    ["작품", project.workTag || "-"],
    ["성인 전용", project.ageRestriction === "adult_only" ? "예" : "아니요"],
    ["약관 동의", project.termsAgreedAt ? new Date(project.termsAgreedAt).toLocaleString("ko-KR") : "-"]
  )
  const media = [...(project.images || []), ...(project.videos || [])]
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">신청 내용</h3>
      <dl className="divide-y divide-zinc-800 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[100px_1fr] gap-3 py-2">
            <dt className="text-zinc-400">{k}</dt>
            <dd className="text-zinc-100 break-keep">{v}</dd>
          </div>
        ))}
      </dl>
      {project.summary && <p className="text-sm text-zinc-200">{project.summary}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-400">상세 소개</summary>
        <p className="pt-2 text-zinc-200 whitespace-pre-wrap leading-relaxed">{project.description}</p>
      </details>
      {media.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {media.map((m) => (
            <a key={m} href={m} target="_blank" rel="noopener noreferrer" className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-zinc-800">
              {/\.(mp4|webm|mov)(\?|$)/i.test(m) ? <video src={m} className="w-full h-full object-cover" muted /> : <img src={m} alt="" className="w-full h-full object-cover" />}
            </a>
          ))}
        </div>
      )}
      {hasGoods(project.type) && (
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          <h4 className="text-sm font-semibold text-white">굿즈 (덕지몰 품목)</h4>
          {(project.goodsItems || []).length === 0 ? (
            <p className="text-sm text-zinc-500">고른 품목 없음</p>
          ) : (
            <ul className="text-sm divide-y divide-zinc-800">
              {(project.goodsItems || []).map((g) => (
                <li key={g.id} className="py-1.5 flex justify-between gap-3">
                  <span className="text-zinc-100">
                    {g.name} <span className="text-zinc-500">· {g.categoryName}</span>
                  </span>
                  <span className="text-zinc-300 shrink-0">
                    {g.serviceType} · {g.quantity}개
                  </span>
                </li>
              ))}
            </ul>
          )}
          {project.goodsForm && (
            <dl className="text-sm space-y-1 text-zinc-300">
              {project.goodsForm.eventLocation && <div>설치·배송 장소: {project.goodsForm.eventLocation}</div>}
              {project.goodsForm.needInstallService && <div>현장 설치·철거 필요{project.goodsForm.installDate ? ` · 설치 희망일 ${project.goodsForm.installDate}` : ""}</div>}
              {project.goodsForm.notes && <div className="whitespace-pre-wrap">요청 사항: {project.goodsForm.notes}</div>}
            </dl>
          )}
          {(project.goodsForm?.attachments || []).length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {project.goodsForm!.attachments.map((a) => (
                <a key={a} href={a} target="_blank" rel="noopener noreferrer" className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-zinc-800">
                  <img src={a} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 내용 고치기
function EditContent({ project, onChanged }: { project: FundingProject; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    title: project.title,
    summary: project.summary,
    description: project.description,
    eventStart: project.eventStart || "",
    eventEnd: project.eventEnd || "",
    eventTime: project.eventTime || "",
    venueName: project.venueName || "",
    venueAddress: project.venueAddress || "",
    region: project.region || "",
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await fundingService.adminEdit(project.id, { ...project, ...f })
      setOpen(false)
      onChanged()
    } catch (e: any) {
      alert(e?.message || "저장하지 못했습니다.")
    } finally {
      setSaving(false)
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={secondary}>
        내용 고치기
      </button>
    )
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">내용 고치기</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <L label="제목" wide>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={input} />
        </L>
        <L label="한 줄 소개" wide>
          <input value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} className={input} />
        </L>
        <L label="시작일">
          <input type="date" value={f.eventStart} onChange={(e) => set("eventStart", e.target.value)} className={input} />
        </L>
        <L label="종료일">
          <input type="date" value={f.eventEnd} onChange={(e) => set("eventEnd", e.target.value)} className={input} />
        </L>
        <L label="시간">
          <input value={f.eventTime} onChange={(e) => set("eventTime", e.target.value)} maxLength={50} className={input} />
        </L>
        {hasVenue(project.type) && (
          <>
            <L label="장소 이름">
              <input value={f.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={100} className={input} />
            </L>
            <L label="지역">
              <input value={f.region} onChange={(e) => set("region", e.target.value)} maxLength={30} className={input} />
            </L>
            <L label="주소">
              <input value={f.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} maxLength={200} className={input} />
            </L>
          </>
        )}
        <L label="상세 소개" wide>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={8} className={input} />
        </L>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className={secondary}>
          취소
        </button>
        <button onClick={save} disabled={saving} className={primary}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </section>
  )
}

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------- 견적서 작성
function QuoteForm({ project, onSent }: { project: FundingProject; onSent: () => void }) {
  const initial = () => {
    const lines: { label: string; amount: string }[] = []
    if (hasVenue(project.type)) lines.push({ label: `장소 대관${project.venueName ? ` (${project.venueName})` : ""}`, amount: "" })
    for (const g of project.goodsItems || []) lines.push({ label: `${g.name} ${g.serviceType} ${g.quantity}개`, amount: "" })
    return lines.length ? lines : [{ label: "", amount: "" }]
  }
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState(initial)
  const [memo, setMemo] = useState("")
  const [fileUrl, setFileUrl] = useState("")
  const [sending, setSending] = useState(false)
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const send = async () => {
    const clean = lines.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim(), amount: Number(l.amount) || 0 }))
    if (!clean.length) return alert("견적 항목을 입력해 주세요.")
    if (!confirm(`합계 ${total.toLocaleString()}원 견적서를 개설자에게 보낼까요?`)) return
    setSending(true)
    try {
      await fundingService.adminSendQuote(project.id, { lines: clean, memo, fileUrl })
      setOpen(false)
      setLines(initial())
      setMemo("")
      setFileUrl("")
      onSent()
    } catch (e: any) {
      alert(e?.message || "보내지 못했습니다.")
    } finally {
      setSending(false)
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={secondary}>
        새 견적서 쓰기
      </button>
    )
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input value={l.label} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="항목" className={input} />
          <input
            type="number"
            min={0}
            value={l.amount}
            onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
            placeholder="금액(원)"
            className={`${input} w-36 shrink-0`}
          />
          <button onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="항목 지우기" className="text-zinc-500 hover:text-red-300 px-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={() => setLines([...lines, { label: "", amount: "" }])} className="inline-flex items-center gap-1 text-sm text-sky-300">
        <Plus className="w-3.5 h-3.5" />
        항목 추가
      </button>
      <p className="text-sm text-zinc-200">
        합계 <span className="font-semibold tabular-nums">{total.toLocaleString()}원</span>
      </p>
      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="안내 문구 (제작 기간, 포함 내역, 추천 예상 가격 등)" className={input} />
      <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="견적서 파일 링크 (선택, https://...)" className={input} />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className={secondary}>
          취소
        </button>
        <button onClick={send} disabled={sending} className={primary}>
          {sending ? "보내는 중..." : "견적서 보내기"}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 공개 설정
type RewardRow = { title: string; description: string; price: string; maxQuantity: string }

function Setup({ project, topics, hasParticipants, onSaved }: { project: FundingProject; topics: FundingTopic[]; hasParticipants: boolean; onSaved: () => void }) {
  const toRows = (): RewardRow[] =>
    (project.rewards || []).length
      ? (project.rewards || []).map((r) => ({ title: r.title, description: r.description, price: String(r.price), maxQuantity: r.maxQuantity ? String(r.maxQuantity) : "" }))
      : [{ title: project.type === "group_buy" ? "굿즈 1세트" : "참여권", description: "", price: project.desiredPrice ? String(project.desiredPrice) : "", maxQuantity: "" }]
  const [f, setF] = useState({
    targetAmount: String(project.targetAmount || ""),
    targetCount: String(project.targetCount || ""),
    endDate: ymd(project.endDate),
    managerName: project.managerName || "",
    topicId: project.topicId ? String(project.topicId) : "",
  })
  const [rows, setRows] = useState<RewardRow[]>(toRows)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await fundingService.adminSetup(project.id, {
        targetAmount: Number(f.targetAmount) || 0,
        targetCount: Number(f.targetCount) || 0,
        endDate: new Date(`${f.endDate}T23:59:59+09:00`).toISOString(),
        managerName: f.managerName,
        topicId: f.topicId ? Number(f.topicId) : null,
        rewards: hasParticipants
          ? undefined
          : rows
              .filter((r) => r.title.trim())
              .map((r) => ({ title: r.title.trim(), description: r.description, price: Number(r.price) || 0, maxQuantity: Number(r.maxQuantity) || undefined })),
      })
      onSaved()
      alert("저장했습니다.")
    } catch (e: any) {
      alert(e?.message || "저장하지 못했습니다.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">공개 설정</h3>
      <p className="text-xs text-zinc-500">개설자와 대화로 정한 목표·예상 참여 가격을 넣습니다. 참여 가격은 예상 가격으로 표시되고, 최종 가격은 모집이 끝난 뒤 정합니다. 마감일을 늦추면 기간 연장이 됩니다.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <L label="목표 금액 (원, 0 이면 인원 기준)">
          <input type="number" min={0} value={f.targetAmount} onChange={(e) => setF({ ...f, targetAmount: e.target.value })} className={input} />
        </L>
        <L label="목표 인원 (명)">
          <input type="number" min={0} value={f.targetCount} onChange={(e) => setF({ ...f, targetCount: e.target.value })} className={input} />
        </L>
        <L label="모집 마감일">
          <input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={input} />
        </L>
        <L label="담당자">
          <input value={f.managerName} onChange={(e) => setF({ ...f, managerName: e.target.value })} maxLength={50} placeholder="예: 김덕지" className={input} />
        </L>
        <L label="주제" wide>
          <select value={f.topicId} onChange={(e) => setF({ ...f, topicId: e.target.value })} className={input}>
            <option value="">주제 없음</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </L>
      </div>
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">참여 옵션 (예상 가격, DP)</h4>
          {hasParticipants && <span className="text-xs text-amber-300">참여자가 있어 옵션은 바꿀 수 없음</span>}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_90px_auto] gap-2">
            <input disabled={hasParticipants} value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="옵션 이름" className={input} />
            <input disabled={hasParticipants} type="number" min={0} value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="DP" className={input} />
            <input disabled={hasParticipants} type="number" min={0} value={r.maxQuantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, maxQuantity: e.target.value } : x)))} placeholder="한정" className={input} />
            <button disabled={hasParticipants} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="옵션 지우기" className="text-zinc-500 hover:text-red-300 px-1 disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </button>
            <input
              disabled={hasParticipants}
              value={r.description}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              placeholder="포함 내용 (예: 입장 + 컵홀더 1개)"
              className={`${input} col-span-4`}
            />
          </div>
        ))}
        {!hasParticipants && (
          <button onClick={() => setRows([...rows, { title: "", description: "", price: "", maxQuantity: "" }])} className="inline-flex items-center gap-1 text-sm text-sky-300">
            <Plus className="w-3.5 h-3.5" />
            옵션 추가
          </button>
        )}
      </div>
      <button onClick={save} disabled={saving} className={primary}>
        {saving ? "저장 중..." : "설정 저장"}
      </button>
    </section>
  )
}

// ---------------------------------------------------------------- 덕지 공지
function AdminNotices({ project, notices, onChanged }: { project: FundingProject; notices: FundingNotice[]; onChanged: () => void }) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [busy, setBusy] = useState(false)
  const post = async () => {
    if (!title.trim() || !content.trim()) return
    setBusy(true)
    try {
      await fundingService.addNotice(project.id, title, content)
      setTitle("")
      setContent("")
      onChanged()
    } catch (e: any) {
      alert(e?.message || "올리지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">공지 {notices.length}</h3>
      {notices.length > 0 && (
        <ul className="text-sm divide-y divide-zinc-800">
          {notices.map((n) => (
            <li key={n.id} className="py-2 flex items-center gap-2">
              <span className={`text-xs ${n.authorType === "admin" ? "text-sky-300" : "text-zinc-400"}`}>{n.authorType === "admin" ? "덕지" : "개설자"}</span>
              <span className="flex-1 text-zinc-100 truncate">{n.title}</span>
              <span className="text-xs text-zinc-500">{fmt(n.createdAt)}</span>
              <button
                aria-label="공지 지우기"
                onClick={async () => {
                  if (!confirm("이 공지를 지울까요?")) return
                  await fundingService.deleteNotice(project.id, n.id).catch((e) => alert(e?.message))
                  onChanged()
                }}
                className="text-zinc-500 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="덕지 공지 제목" className={input} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={5000} placeholder="내용" className={input} />
      <button onClick={post} disabled={busy || !title.trim() || !content.trim()} className={secondary}>
        덕지 공지 올리기
      </button>
    </section>
  )
}

function ParticipantList({ participants }: { participants: FundingParticipant[] | null }) {
  const list = (participants || []).filter((p) => p.paymentStatus === "completed" || p.paymentStatus === "reserved")
  const total = list.reduce((s, p) => s + p.totalPrice, 0)
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">
        참여자 {list.length}명 · {total.toLocaleString()} DP
      </h3>
      {participants === null ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-zinc-500">참여자가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-zinc-400 text-left">
              <tr className="border-b border-zinc-800">
                <th className="py-2 font-normal">이름</th>
                <th className="py-2 font-normal">옵션</th>
                <th className="py-2 font-normal text-right">DP</th>
                <th className="py-2 font-normal">연락처·배송지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-zinc-100">{p.userName}</td>
                  <td className="py-2 text-zinc-300">
                    {p.rewardTitle} × {p.quantity}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.totalPrice.toLocaleString()}</td>
                  <td className="py-2 text-zinc-400 text-xs">
                    {[p.userPhone, p.userEmail].filter(Boolean).join(" · ")}
                    {p.deliveryAddress && <div>{p.deliveryAddress}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ================================================================ 주제
function Topics() {
  const [topics, setTopics] = useState<FundingTopic[] | null>(null)
  const [name, setName] = useState("")
  const load = () => fundingService.getTopics().then(setTopics).catch(() => setTopics([]))
  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    if (!name.trim()) return
    try {
      await fundingService.adminCreateTopic(name.trim(), (topics?.length || 0) * 10)
      setName("")
      load()
    } catch (e: any) {
      alert(e?.message)
    }
  }

  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">주제</h3>
      <p className="text-sm text-zinc-400">펀딩 종류와 별개로 묶어 보는 분류입니다. 펀딩 상세의 공개 설정에서 고르고, 둘러보기에서 걸러 볼 수 있습니다.</p>
      <div className="flex gap-2 max-w-md">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} maxLength={40} placeholder="예: 생일카페" className={input} />
        <button onClick={add} className={primary}>
          추가
        </button>
      </div>
      {topics === null ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-zinc-500">등록된 주제가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 max-w-xl">
          {topics.map((t) => (
            <TopicRow key={t.id} topic={t} onChanged={load} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TopicRow({ topic, onChanged }: { topic: FundingTopic; onChanged: () => void }) {
  const [name, setName] = useState(topic.name)
  const [order, setOrder] = useState(String(topic.sortOrder))
  const dirty = name !== topic.name || order !== String(topic.sortOrder)
  return (
    <li className="py-2 flex items-center gap-2">
      <input value={order} onChange={(e) => setOrder(e.target.value)} type="number" aria-label="순서" className={`${input} w-20`} />
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
      <span className="text-xs text-zinc-500 shrink-0 w-14 text-right">{topic.projectCount}개</span>
      {dirty && (
        <button
          onClick={async () => {
            await fundingService.adminUpdateTopic(topic.id, name.trim(), Number(order) || 0).catch((e) => alert(e?.message))
            onChanged()
          }}
          className={secondary}
        >
          저장
        </button>
      )}
      <button
        aria-label="주제 지우기"
        onClick={async () => {
          if (!confirm(`'${topic.name}' 주제를 지울까요? 이 주제의 펀딩은 '주제 없음'이 됩니다.`)) return
          await fundingService.adminDeleteTopic(topic.id).catch((e) => alert(e?.message))
          onChanged()
        }}
        className="text-zinc-500 hover:text-red-300 px-1"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  )
}

// ================================================================ 신고
const REASON_LABELS: Record<string, string> = { copyright: "저작권·상표권", false_info: "사실과 다름", inappropriate: "부적절", other: "기타" }
const REPORT_STATUS: Record<string, string> = { received: "접수", investigating: "확인 중", resolved: "조치 완료", dismissed: "문제 없음" }

function Reports() {
  const [reports, setReports] = useState<FundingReport[] | null>(null)
  const load = () => fundingService.getReports().then(setReports).catch(() => setReports([]))
  useEffect(() => {
    load()
  }, [])
  const update = async (r: FundingReport, status: FundingReport["status"]) => {
    const note = prompt("처리 메모 (선택)") ?? undefined
    await fundingService.updateReportStatus(r.id, status, note).catch((e) => alert(e?.message))
    load()
  }
  return (
    <section className={card}>
      <h3 className="text-base font-semibold text-white">신고</h3>
      {reports === null ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-zinc-500">신고가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {reports.map((r) => (
            <li key={r.id} className="py-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/funding/detail/?id=${encodeURIComponent(r.projectId)}`} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
                  {r.projectTitle}
                </a>
                <span className="text-zinc-400">· {REASON_LABELS[r.reason] || r.reason}</span>
                <span className="text-zinc-500">· {fmt(r.createdAt)}</span>
                <span className={`ml-auto ${r.status === "received" ? "text-amber-300" : "text-zinc-400"}`}>{REPORT_STATUS[r.status]}</span>
              </div>
              <p className="text-zinc-300 whitespace-pre-wrap">{r.details}</p>
              {r.adminNote && <p className="text-xs text-zinc-500">메모: {r.adminNote}</p>}
              {(r.status === "received" || r.status === "investigating") && (
                <div className="flex gap-2">
                  <button onClick={() => update(r, "resolved")} className={secondary}>
                    조치 완료
                  </button>
                  <button onClick={() => update(r, "dismissed")} className={secondary}>
                    문제 없음
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

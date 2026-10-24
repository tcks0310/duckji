"use client"

import * as React from "react"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Heart, Share2, Trash2 } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { ProfileLink, ProgressBar, StatusText, won } from "@/components/funding/funding-ui"
import { OwnerPanel } from "@/components/funding/owner-panel"
import { formatPostDate } from "@/lib/community-api"
import { getMyInfo, getSessionMember, type MyAddress } from "@/lib/member-auth"
import { loadPoints, useMemberPoints } from "@/lib/member-points"
import { useIsApp } from "@/lib/app-mode"
import { cardAmountFor, payShortByCard, takeCardReturn } from "@/lib/card-pay"
import {
  daysLeft,
  fundingService,
  fundingTypeLabel,
  hasGoods,
  hasVenue,
  isPastDeadline,
  progressOf,
  scheduleText,
} from "@/lib/funding-service"
import type { FundingComment, FundingNotice, FundingProject, FundingReward, FundingSupporter } from "@/types/funding"

// 펀딩 상세 (/funding/detail/?id=): 사진·소개 / 일정·장소 / 공지 / 댓글 / 참여자 프로필 + DP 로 참여
// 앱에서는 DP 충전 대신 모자란 금액만 카드로 내고 바로 참여 (lib/card-pay.ts)
// 개설자에게는 '내 펀딩 관리' 탭(견적서·담당자와 대화·공지 쓰기·참여자 명단)이 더 보임

type Tab = "intro" | "notices" | "comments" | "supporters" | "manage"

export default function FundingDetailPage() {
  return (
    <Suspense fallback={null}>
      <FundingDetail />
    </Suspense>
  )
}

function FundingDetail() {
  const params = useSearchParams()
  const id = params.get("id") || ""
  const [project, setProject] = useState<FundingProject | null | undefined>(undefined)
  const [error, setError] = useState("")
  const [viewer, setViewer] = useState<{ id: string } | null>(null)
  const [notices, setNotices] = useState<FundingNotice[]>([])
  const [comments, setComments] = useState<FundingComment[]>([])
  const [supporters, setSupporters] = useState<FundingSupporter[]>([])
  const [tab, setTab] = useState<Tab>("intro")
  const [liked, setLiked] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [toast, setToast] = useState("")
  // 앱 카드 결제창에서 돌아오면(?paymentId=) 참여 칸을 다시 열어 이어서 참여
  const [joining, setJoining] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("paymentId")) setJoining(true)
  }, [])
  const isApp = useIsApp()

  const load = useCallback(async () => {
    if (!id) return setProject(null)
    try {
      const p = await fundingService.getProjectById(id)
      setProject(p)
      setLiked(fundingService.isLiked(id))
      if (p) {
        fundingService.getNotices(id).then(setNotices)
        fundingService.getComments(id).then(setComments)
        fundingService.getSupporters(id).then(setSupporters)
      }
    } catch (e: any) {
      setError(e?.message || "펀딩을 불러오지 못했습니다.")
      setProject(null)
    }
  }, [id])

  useEffect(() => {
    load()
    getSessionMember().then((m) => setViewer(m ? { id: m.id } : null))
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t === "manage" || t === "notices" || t === "comments" || t === "supporters") setTab(t)
  }, [load])

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(""), 2500)
  }

  if (project === undefined)
    return (
      <Frame>
        <p className="py-24 text-center text-sm text-zinc-500">불러오는 중...</p>
      </Frame>
    )
  if (!project)
    return (
      <Frame>
        <div className="py-24 text-center space-y-3">
          <p className="text-base text-zinc-300">{error || "펀딩을 찾을 수 없어요. 공개 전이거나 삭제된 펀딩일 수 있어요."}</p>
          <Link href="/funding/browse" className="text-sm text-emerald-300 underline underline-offset-4">
            펀딩 둘러보기
          </Link>
        </div>
      </Frame>
    )

  const isOwner = viewer?.id === project.creatorId
  const media = [...(project.images || []).filter(Boolean), ...(project.videos || [])]
  const current = media[mediaIndex]
  const isVideo = (u?: string) => Boolean(u && /\.(mp4|webm|mov)(\?|$)/i.test(u))
  const percent = progressOf(project)
  const open = (project.status === "live" || project.status === "success") && !isPastDeadline(project)
  const left = daysLeft(project.endDate)
  const place = [project.venueName, project.region].filter(Boolean).join(" · ")

  const toggleLike = async () => {
    try {
      setLiked(await fundingService.toggleLike(project.id))
    } catch (e: any) {
      if (e?.status === 401) {
        if (window.confirm("로그인하면 펀딩을 찜할 수 있어요. 로그인할까요?")) window.location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`
      } else showToast(e?.message || "찜하지 못했습니다.")
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "intro", label: "소개" },
    { id: "notices", label: `공지 ${notices.length || ""}`.trim() },
    { id: "comments", label: `댓글 ${comments.length || ""}`.trim() },
    { id: "supporters", label: `참여자 ${supporters.length || ""}`.trim() },
  ]
  if (isOwner) tabs.push({ id: "manage", label: "내 펀딩 관리" })

  return (
    <Frame>
      {toast && (
        <div role="status" className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {isOwner && !["live", "success", "failed", "canceled"].includes(project.status) && (
        <div className="border-l-2 border-amber-300 pl-4 py-1 text-sm text-zinc-200 break-keep">
          아직 공개 전이라 나와 담당자에게만 보여요.{" "}
          <button type="button" onClick={() => setTab("manage")} className="text-amber-200 underline underline-offset-4">
            진행 상황 보기
          </button>
        </div>
      )}

      {/* 머리: 사진 + 요약 */}
      <section className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-8 lg:gap-12">
        <div className="space-y-3">
          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-zinc-900">
            {current ? (
              isVideo(current) ? (
                <video src={current} controls className="w-full h-full object-contain bg-black" />
              ) : (
                <img src={current} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-end p-6 bg-gradient-to-br from-emerald-900/40 to-zinc-900">
                <span className="text-3xl font-bold text-white/80">{project.title}</span>
              </div>
            )}
          </div>
          {media.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {media.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMediaIndex(i)}
                  className={`w-16 h-16 shrink-0 rounded-md overflow-hidden ring-2 ${i === mediaIndex ? "ring-emerald-400" : "ring-transparent opacity-70 hover:opacity-100"}`}
                >
                  {isVideo(m) ? <video src={m} className="w-full h-full object-cover" muted /> : <img src={m} alt="" className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              <span className="text-emerald-300">{fundingTypeLabel(project.type)}</span>
              {project.topicName && <> · {project.topicName}</>}
              {project.workTag && <> · {project.workTag}</>}
              {project.ageRestriction === "adult_only" && <> · 성인 전용</>}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug break-keep">{project.title}</h1>
            {project.summary && <p className="text-base text-zinc-300 leading-relaxed break-keep">{project.summary}</p>}
            <div className="flex items-center gap-2 text-sm">
              <ProfileLink id={project.creatorId} name={project.creatorName} avatarUrl={project.creatorAvatar} />
              <span className="text-zinc-500">개설</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-5">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-emerald-300 tabular-nums">{percent}%</span>
              <span className="text-base text-zinc-200 tabular-nums">
                {project.targetAmount > 0 ? won(project.currentAmount) : `${project.currentCount.toLocaleString()}명`}
              </span>
              <span className="ml-auto">
                <StatusText project={project} />
              </span>
            </div>
            <ProgressBar percent={percent} />
            <dl className="grid grid-cols-3 gap-4 pt-1 text-sm">
              <Info label="목표" value={project.targetAmount > 0 ? won(project.targetAmount) : `${project.targetCount.toLocaleString()}명`} />
              <Info label="참여" value={`${project.currentCount.toLocaleString()}명`} />
              <Info label="마감" value={open ? (left <= 0 ? "오늘" : `${left}일 남음`) : new Date(project.endDate).toLocaleDateString("ko-KR")} />
            </dl>
          </div>

          <dl className="divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
            {scheduleText(project) && <Row label={project.type === "group_buy" ? "수령" : "일정"} value={scheduleText(project)} />}
            {hasVenue(project.type) && place && <Row label="장소" value={place} sub={project.venueAddress} />}
            {project.type === "group_buy" && (
              <Row label="받는 방법" value={project.deliveryMethod === "pickup" ? "현장 수령" : project.deliveryMethod === "both" ? "배송 또는 현장 수령" : "배송"} />
            )}
            {hasGoods(project.type) && project.goodsItems && project.goodsItems.length > 0 && (
              <Row label="굿즈" value={project.goodsItems.map((g) => g.name).join(", ")} />
            )}
          </dl>

          {open && !joining && (
            <button
              type="button"
              onClick={() => setJoining(true)}
              className="w-full h-13 py-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-base font-semibold"
            >
              {isApp ? "참여하기" : "DP 로 참여하기"}
            </button>
          )}
          {!open && project.status !== "pending" && project.status !== "preparing" && (
            <p className="text-sm text-zinc-400">지금은 참여를 받지 않아요.</p>
          )}
          {joining && (
            <JoinPanel
              project={project}
              onClose={() => setJoining(false)}
              onDone={(msg) => {
                setJoining(false)
                showToast(msg)
                load()
              }}
            />
          )}

          <div className="flex items-center gap-5 text-sm text-zinc-300">
            <button type="button" onClick={toggleLike} className="inline-flex items-center gap-1.5 hover:text-white">
              <Heart className={`w-4 h-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
              찜
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href)
                showToast("링크를 복사했어요.")
              }}
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Share2 className="w-4 h-4" />
              공유
            </button>
            <ReportLink projectId={project.id} onDone={showToast} />
          </div>
        </div>
      </section>

      {/* 탭 */}
      <div className="sticky top-16 z-10 bg-[hsl(var(--background))]/95 backdrop-blur border-b border-zinc-800 flex gap-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-3.5 -mb-px text-base whitespace-nowrap border-b-2 ${
              tab === t.id ? "border-emerald-400 text-white font-semibold" : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="min-h-[240px]">
        {tab === "intro" && <Intro project={project} />}
        {tab === "notices" && <Notices notices={notices} canDelete={isOwner} projectId={project.id} onChanged={load} />}
        {tab === "comments" && <Comments project={project} comments={comments} viewerId={viewer?.id} onChanged={load} />}
        {tab === "supporters" && <Supporters supporters={supporters} />}
        {tab === "manage" && isOwner && <OwnerPanel project={project} onChanged={load} />}
      </section>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" itemId="funding-browse" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 space-y-10">{children}</main>
      <Footer />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-100 tabular-nums mt-0.5">{value}</dd>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 py-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-100 break-keep">
        {value}
        {sub && <span className="block text-zinc-400 text-xs mt-0.5">{sub}</span>}
      </dd>
    </div>
  )
}

function Intro({ project }: { project: FundingProject }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-10 pt-8">
      <div className="text-base text-zinc-200 leading-[1.85] whitespace-pre-wrap break-keep max-w-3xl">{project.description || "소개가 아직 없어요."}</div>
      {(project.rewards || []).length > 0 && (
        <aside className="space-y-3">
          <h3 className="text-sm text-zinc-400">참여 옵션 · 예상 가격</h3>
          <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
            {(project.rewards || []).map((r) => (
              <li key={r.id} className="py-3 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{r.title}</span>
                  <span className="text-sm text-emerald-300 tabular-nums shrink-0">{r.price.toLocaleString()} DP</span>
                </div>
                {r.description && <p className="text-xs text-zinc-400 leading-relaxed">{r.description}</p>}
                {r.maxQuantity ? <p className="text-xs text-zinc-500">남은 수량 {Math.max(0, r.maxQuantity - r.currentQuantity)}개</p> : null}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

function Notices({ notices, canDelete, projectId, onChanged }: { notices: FundingNotice[]; canDelete: boolean; projectId: string; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(notices[0]?.id || null)
  if (!notices.length) return <p className="pt-8 text-sm text-zinc-400">아직 공지가 없어요.</p>
  return (
    <ul className="divide-y divide-zinc-800 border-b border-zinc-800 max-w-3xl">
      {notices.map((n) => (
        <li key={n.id} className="py-4">
          <button type="button" onClick={() => setOpenId(openId === n.id ? null : n.id)} className="w-full text-left flex items-baseline gap-3">
            <span className={`text-xs shrink-0 ${n.authorType === "admin" ? "text-sky-300" : "text-emerald-300"}`}>{n.authorType === "admin" ? "덕지" : "개설자"}</span>
            <span className="flex-1 text-base text-white">{n.title}</span>
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">{new Date(n.createdAt).toLocaleDateString("ko-KR")}</span>
          </button>
          {openId === n.id && (
            <div className="pt-3 pl-12 space-y-2">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{n.content}</p>
              {canDelete && n.authorType === "creator" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("이 공지를 지울까요?")) return
                    await fundingService.deleteNotice(projectId, n.id).catch((e) => alert(e?.message))
                    onChanged()
                  }}
                  className="text-xs text-zinc-500 hover:text-red-300"
                >
                  지우기
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function Comments({ project, comments, viewerId, onChanged }: { project: FundingProject; comments: FundingComment[]; viewerId?: string; onChanged: () => void }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      await fundingService.addComment(project.id, text)
      setText("")
      onChanged()
    } catch (err: any) {
      if (err?.status === 401) window.location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`
      else alert(err?.message || "댓글을 올리지 못했습니다.")
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="pt-6 space-y-6 max-w-3xl">
      <form onSubmit={submit} className="flex items-end gap-3 border-b border-zinc-700 focus-within:border-emerald-400 pb-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={viewerId ? "응원이나 궁금한 점을 남겨 주세요" : "로그인하면 댓글을 남길 수 있어요"}
          className="flex-1 bg-transparent resize-none text-base text-white placeholder-zinc-500 focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} className="h-9 px-4 rounded-full bg-white text-zinc-950 text-sm font-semibold disabled:opacity-40">
          등록
        </button>
      </form>
      {comments.length === 0 ? (
        <p className="text-sm text-zinc-400">첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul className="space-y-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <ProfileLink
                    id={c.userId}
                    name={c.userName}
                    avatarUrl={c.userAvatar}
                    suffix={c.userId === project.creatorId ? <span className="text-xs text-emerald-300">개설자</span> : undefined}
                  />
                  <span className="text-xs text-zinc-500">{formatPostDate(c.createdAt)}</span>
                  {viewerId === c.userId && (
                    <button
                      type="button"
                      aria-label="댓글 지우기"
                      onClick={async () => {
                        if (!confirm("댓글을 지울까요?")) return
                        await fundingService.deleteComment(project.id, c.id).catch((e) => alert(e?.message))
                        onChanged()
                      }}
                      className="ml-auto text-zinc-500 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words pl-8">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Supporters({ supporters }: { supporters: FundingSupporter[] }) {
  if (!supporters.length) return <p className="pt-8 text-sm text-zinc-400">아직 참여한 사람이 없어요.</p>
  return (
    <div className="pt-6 space-y-3">
      <p className="text-sm text-zinc-400">이름을 누르면 덕지 갤러리 피드로 가요.</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
        {supporters.map((s) => (
          <li key={s.id} className="min-w-0">
            <ProfileLink id={s.id} name={s.name} avatarUrl={s.avatarUrl} size="md" />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- DP 로 참여
type JoinDraft = { rewardId: string | number; quantity: number; info: { name: string; phone: string; email: string }; addressId: number | null; notes: string; adult: boolean }

function JoinPanel({ project, onClose, onDone }: { project: FundingProject; onClose: () => void; onDone: (msg: string) => void }) {
  const points = useMemberPoints()
  const isApp = useIsApp()
  const [autoJoin, setAutoJoin] = useState(false)
  const restored = React.useRef(false)
  const rewards = project.rewards || []
  const [reward, setReward] = useState<FundingReward | null>(rewards.length === 1 ? rewards[0] : null)
  const [quantity, setQuantity] = useState(1)
  const [info, setInfo] = useState({ name: "", phone: "", email: "" })
  const [addresses, setAddresses] = useState<MyAddress[]>([])
  const [addressId, setAddressId] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [adult, setAdult] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const needAddress = project.type === "group_buy" && project.deliveryMethod !== "pickup"

  useEffect(() => {
    getMyInfo().then((r) => {
      if (!r.success) return
      setAddresses(r.info.addresses)
      if (restored.current) return
      setInfo({ name: r.info.profile.realName || r.info.user.name, phone: r.info.profile.phone || "", email: r.info.user.email || "" })
      const def = r.info.addresses.find((a) => a.isDefault) || r.info.addresses[0]
      if (def) setAddressId(def.id)
    })
    takeCardReturn<JoinDraft>().then((back) => {
      if (!back) return
      const d = back.draft
      if (d) {
        restored.current = true
        setReward(rewards.find((r) => String(r.id) === String(d.rewardId)) || null)
        setQuantity(d.quantity)
        setInfo(d.info)
        setAddressId(d.addressId)
        setNotes(d.notes)
        setAdult(d.adult)
      }
      loadPoints()
      if (back.result.status === "ok") setAutoJoin(!!d)
      else setError(back.result.status === "canceled" ? back.result.message : back.result.status === "pending" ? "카드 결제 확인이 아직 안 됐어요. 잠시 뒤 다시 시도해 주세요." : back.result.error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 카드 결제를 마치고 DP 가 들어오면 바로 참여
  useEffect(() => {
    if (!autoJoin || points.status !== "member" || points.balance === null || !rewards.length) return
    setAutoJoin(false)
    const total = (reward?.price || 0) * quantity
    if (total > (points.balance ?? 0)) return setError("카드 결제는 됐지만 DP 가 아직 모자라요. 다시 참여하기를 눌러 주세요.")
    submit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, points.status, points.balance])

  if (points.status === "guest")
    return (
      <div className="border-t border-zinc-800 pt-5 space-y-3">
        <p className="text-sm text-zinc-300">참여하려면 로그인해 주세요.</p>
        <Link href={`/login/?next=${encodeURIComponent(`/funding/detail/?id=${project.id}`)}`} className="inline-flex h-10 px-5 items-center rounded-full bg-emerald-400 text-zinc-950 text-sm font-semibold">
          로그인
        </Link>
      </div>
    )

  if (!rewards.length) return <p className="text-sm text-zinc-400">참여 옵션을 준비하고 있어요.</p>

  const total = (reward?.price || 0) * quantity
  const balance = points.balance ?? 0
  const short = total > balance
  const address = addresses.find((a) => a.id === addressId)
  const addressText = address ? `[${address.zipCode}] ${address.address1 || ""} ${address.address2 || ""} (${address.recipient || ""} ${address.phone || ""})`.trim() : ""

  const submit = async (confirmed = false) => {
    setError("")
    if (!reward) return setError("참여 옵션을 골라 주세요.")
    if (!info.name.trim()) return setError("참여자 이름을 입력해 주세요.")
    if (needAddress && !addressText) return setError("배송지를 골라 주세요.")
    if (project.ageRestriction === "adult_only" && !adult) return setError("성인 확인에 동의해 주세요.")
    if (short && isApp) return payByCard()
    if (!confirmed && !confirm(`${total.toLocaleString()} DP 로 참여할까요?`)) return
    setSending(true)
    try {
      const r = await fundingService.participate({
        projectId: project.id,
        rewardId: reward.id,
        quantity,
        userName: info.name,
        userPhone: info.phone,
        userEmail: info.email,
        deliveryAddress: needAddress ? addressText : "",
        notes,
        isAdultConfirmed: adult,
      })
      onDone(r.goalReached ? "참여했어요. 덕분에 목표를 채웠어요!" : `${r.paidDp.toLocaleString()} DP 로 참여했어요.`)
    } catch (e: any) {
      setError(e?.message || "참여하지 못했습니다.")
    } finally {
      setSending(false)
    }
  }

  // 앱: 모자란 금액만 카드로 → 입금되면 바로 참여 (모바일 결제창은 페이지를 다녀온 뒤 autoJoin)
  const payByCard = async () => {
    const card = cardAmountFor(total - balance)
    if (!confirm(`모자란 ${card.toLocaleString()}원을 카드로 결제하고 참여할까요?`)) return
    setSending(true)
    const r = await payShortByCard<JoinDraft>(total - balance, "funding", { rewardId: reward!.id, quantity, info, addressId, notes, adult })
    setSending(false)
    if (r.status === "ok") return setAutoJoin(true)
    if (r.status === "pending") return
    setError(r.status === "canceled" ? r.message : r.error)
  }

  const input = "w-full bg-transparent border-b border-zinc-700 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"

  return (
    <div className="border-t border-zinc-800 pt-5 space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">참여 옵션 · 예상 가격</p>
        <ul className="space-y-2">
          {rewards.map((r) => {
            const soldOut = Boolean(r.maxQuantity && r.currentQuantity >= r.maxQuantity)
            return (
              <li key={r.id}>
                <label className={`flex items-start gap-3 py-2 ${soldOut ? "opacity-40" : "cursor-pointer"}`}>
                  <input type="radio" name="reward" disabled={soldOut} checked={reward?.id === r.id} onChange={() => setReward(r)} className="mt-1 accent-emerald-400" />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-white">{r.title}</span>
                      <span className="text-sm text-emerald-300 tabular-nums">{r.price.toLocaleString()} DP</span>
                    </span>
                    {r.description && <span className="block text-xs text-zinc-400">{r.description}</span>}
                    {soldOut && <span className="block text-xs text-zinc-400">모두 팔렸어요</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">수량</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full border border-zinc-700 text-zinc-300">
            −
          </button>
          <span className="w-6 text-center tabular-nums">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(100, q + 1))} className="w-8 h-8 rounded-full border border-zinc-700 text-zinc-300">
            +
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <input value={info.name} onChange={(e) => setInfo((i) => ({ ...i, name: e.target.value }))} placeholder="이름" maxLength={50} className={input} />
        <input value={info.phone} onChange={(e) => setInfo((i) => ({ ...i, phone: e.target.value }))} placeholder="연락처" maxLength={30} className={input} />
        <input value={info.email} onChange={(e) => setInfo((i) => ({ ...i, email: e.target.value }))} placeholder="이메일" maxLength={200} className={`${input} col-span-2`} />
      </div>
      {needAddress && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">배송지</p>
          {addresses.length === 0 ? (
            <p className="text-sm text-zinc-300">
              등록한 배송지가 없어요.{" "}
              <Link href="/mypage/?tab=address" className="text-emerald-300 underline underline-offset-4">
                마이페이지에서 배송지 추가
              </Link>
            </p>
          ) : (
            <select
              value={addressId ?? ""}
              onChange={(e) => setAddressId(Number(e.target.value))}
              className="w-full bg-transparent border-b border-zinc-700 py-2 text-sm text-white [color-scheme:dark]"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label} · ` : ""}
                  {a.address1} {a.address2}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="남길 말 (선택)" maxLength={1000} className={input} />
      {project.ageRestriction === "adult_only" && (
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="accent-emerald-400" />
          만 19세 이상이에요
        </label>
      )}
      <div className="space-y-1 border-t border-zinc-800 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-zinc-400">지금 결제할 DP</span>
          <span className="text-xl font-semibold text-white tabular-nums">{total.toLocaleString()} DP</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-zinc-500">보유 {balance.toLocaleString()} DP</span>
          {short && !isApp && (
            <Link href="/mypage/charge" className="text-emerald-300 underline underline-offset-4">
              {(total - balance).toLocaleString()} DP 충전하기
            </Link>
          )}
          {short && isApp && <span className="text-zinc-300">모자란 {cardAmountFor(total - balance).toLocaleString()}원은 카드로</span>}
        </div>
        <p className="text-xs text-zinc-500">가격은 예상 가격이에요. 최종 가격은 모집이 끝난 뒤 확정돼요.</p>
        <p className="text-xs text-zinc-500">목표를 못 채우고 마감되거나 마감 전에 취소하면 DP 를 그대로 돌려드려요.</p>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="h-12 px-5 rounded-full border border-zinc-700 text-zinc-300">
          닫기
        </button>
        <button
          type="button"
          onClick={() => submit()}
          disabled={sending || !reward || (short && !isApp)}
          className="flex-1 h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold disabled:opacity-40"
        >
          {sending ? "참여하는 중..." : short && isApp ? "카드로 결제하고 참여하기" : "참여하기"}
        </button>
      </div>
    </div>
  )
}

function ReportLink({ projectId, onDone }: { projectId: string; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState("")
  const [reason, setReason] = useState<"copyright" | "false_info" | "inappropriate" | "other">("other")
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="ml-auto text-zinc-500 hover:text-zinc-300">
        신고
      </button>
    )
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white">펀딩 신고</h3>
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="w-full bg-transparent border-b border-zinc-700 py-2 text-sm text-white [color-scheme:dark]">
          <option value="copyright">저작권·상표권 침해</option>
          <option value="false_info">사실과 다른 내용</option>
          <option value="inappropriate">부적절한 내용</option>
          <option value="other">기타</option>
        </select>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} placeholder="신고 내용" className="w-full bg-white/[0.03] border border-zinc-800 rounded-lg p-3 text-sm text-white" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 text-sm text-zinc-300">
            취소
          </button>
          <button
            type="button"
            disabled={!details.trim()}
            onClick={async () => {
              try {
                await fundingService.addReport({ projectId, reason, details })
                setOpen(false)
                onDone("신고를 받았어요. 운영팀이 확인할게요.")
              } catch (e: any) {
                alert(e?.message || "신고하지 못했습니다.")
              }
            }}
            className="h-10 px-5 rounded-full bg-white text-zinc-950 text-sm font-semibold disabled:opacity-40"
          >
            신고하기
          </button>
        </div>
      </div>
    </div>
  )
}

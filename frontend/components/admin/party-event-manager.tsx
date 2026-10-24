"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Plus, RefreshCw } from "lucide-react"
import { ImageUploadField } from "@/components/admin/image-upload-field"
import { fundingService } from "@/lib/funding-service"
import { memberHref } from "@/lib/community-api"
import {
  PARTY_EVENT_KIND_LABELS,
  PARTY_EVENT_STATUS_LABELS,
  createPartyEvent,
  fetchAdminPartyEvents,
  updatePartyEvent,
  type PartyEvent,
  type PartyEventKind,
  type PartyEventStatus,
} from "@/lib/party-api"

// 관리자 > 펀딩 > 이벤트 캘린더 관리 (backend party 서비스)
// 캘린더: 게시·숨김 이벤트를 달별로 보고 등록·수정·숨김
// 추천받은 이벤트: 회원이 펀딩 메인 파티 캘린더에서 '이벤트 제보하기'로 보낸 것. 승인(바로·고쳐서)·반려
// 예전 화면 코드는 archive/frontend/components/admin/party-event-manager.tsx

type Section = "calendar" | "suggested"

const KINDS = Object.keys(PARTY_EVENT_KIND_LABELS) as PartyEventKind[]
const input = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600 [color-scheme:dark]"
const primary = "h-9 px-4 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
const secondary = "h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50"
const danger = "h-9 px-4 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm disabled:opacity-50"
const card = "p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4"
const fmt = (iso: string) => new Date(iso).toLocaleDateString("ko-KR")
const dateText = (e: PartyEvent) => `${e.year ? `${e.year}년 ` : "매년 "}${e.month}월 ${e.day}일`

// 연도 선택지: 올해 기준 앞뒤로, 이미 저장된 연도도 포함
const yearOptions = (current: string) => {
  const now = new Date().getFullYear()
  const list = Array.from({ length: 8 }, (_, i) => String(now - 2 + i))
  if (current && !list.includes(current)) list.push(current)
  return list.sort()
}

type FormState = {
  slug: string
  title: string
  kind: PartyEventKind
  workTitle: string
  characterName: string
  month: string
  day: string
  year: string
  description: string
  imageUrl: string
  source: string
  gallerySlug: string
  status: PartyEventStatus
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  kind: "birthday",
  workTitle: "",
  characterName: "",
  month: "1",
  day: "1",
  year: "",
  description: "",
  imageUrl: "",
  source: "",
  gallerySlug: "",
  status: "published",
}

const toForm = (e: PartyEvent, status?: PartyEventStatus): FormState => ({
  slug: e.slug,
  title: e.title,
  kind: e.kind,
  workTitle: e.workTitle,
  characterName: e.characterName || "",
  month: String(e.month),
  day: String(e.day),
  year: e.year ? String(e.year) : "",
  description: e.description,
  imageUrl: e.imageUrl || "",
  source: e.source,
  gallerySlug: e.gallerySlug || "",
  status: status || e.status,
})

export function PartyEventManager() {
  const [section, setSection] = useState<Section>("calendar")
  const [events, setEvents] = useState<PartyEvent[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [fundingCounts, setFundingCounts] = useState<Record<string, number>>({})
  // null: 닫힘, "": 새 이벤트, 그 밖: 수정 중인 slug
  const [editing, setEditing] = useState<{ slug: string; form: FormState; fromSuggestion?: boolean } | null>(null)

  const load = async () => {
    setLoadError("")
    try {
      setEvents(await fetchAdminPartyEvents())
    } catch (e: any) {
      setLoadError(e?.message || "이벤트 목록을 불러오지 못했습니다.")
      setEvents([])
    }
    fundingService.adminGetPartyEventCounts().then(setFundingCounts).catch(() => setFundingCounts({}))
  }

  useEffect(() => {
    load()
  }, [])

  const suggested = (events || []).filter((e) => e.status === "submitted")

  const changeStatus = async (e: PartyEvent, status: PartyEventStatus) => {
    let reason: string | undefined
    if (status === "rejected") {
      reason = prompt("반려 사유를 적어 주세요. 제보한 회원에게는 보이지 않고 관리 기록으로 남아요.")?.trim()
      if (!reason) return
    }
    try {
      await updatePartyEvent(e.slug, { status, reason })
      load()
    } catch (err: any) {
      alert(err?.message || "상태를 바꾸지 못했습니다.")
    }
  }

  const tabs: { id: Section; label: string }[] = [
    { id: "calendar", label: "캘린더" },
    { id: "suggested", label: `추천받은 이벤트${suggested.length ? ` ${suggested.length}` : ""}` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
        <div className="flex gap-2">
          <button onClick={load} className={`${secondary} inline-flex items-center gap-1.5`}>
            <RefreshCw className="w-3.5 h-3.5" />
            새로고침
          </button>
          <button onClick={() => setEditing({ slug: "", form: EMPTY_FORM })} className={`${primary} inline-flex items-center gap-1.5`}>
            <Plus className="w-3.5 h-3.5" />
            이벤트 등록
          </button>
        </div>
      </div>

      {loadError && <p className="text-sm text-red-300">{loadError}</p>}

      {editing && (
        <EventForm
          key={editing.slug || "new"}
          slug={editing.slug}
          initial={editing.form}
          fromSuggestion={editing.fromSuggestion}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {section === "calendar" && (
        <Calendar events={events} fundingCounts={fundingCounts} onEdit={(e) => setEditing({ slug: e.slug, form: toForm(e) })} onStatus={changeStatus} />
      )}
      {section === "suggested" && (
        <Suggested
          events={events}
          onApprove={(e) => changeStatus(e, "published")}
          onEditApprove={(e) => setEditing({ slug: e.slug, form: toForm(e, "published"), fromSuggestion: true })}
          onReject={(e) => changeStatus(e, "rejected")}
          onRestore={(e) => changeStatus(e, "submitted")}
        />
      )}
    </div>
  )
}

// ================================================================ 캘린더 (게시·숨김)
function Calendar({
  events,
  fundingCounts,
  onEdit,
  onStatus,
}: {
  events: PartyEvent[] | null
  fundingCounts: Record<string, number>
  onEdit: (e: PartyEvent) => void
  onStatus: (e: PartyEvent, s: PartyEventStatus) => void
}) {
  const [month, setMonth] = useState<number | "all">(new Date().getMonth() + 1)
  const [kind, setKind] = useState<PartyEventKind | "all">("all")
  const [showHidden, setShowHidden] = useState(false)
  const [q, setQ] = useState("")

  const base = useMemo(
    () => (events || []).filter((e) => e.status === "published" || (showHidden && e.status === "hidden")),
    [events, showHidden]
  )
  const perMonth = useMemo(() => {
    const m = new Map<number, number>()
    for (const e of base) m.set(e.month, (m.get(e.month) || 0) + 1)
    return m
  }, [base])
  const shown = base
    .filter(
      (e) =>
        (month === "all" || e.month === month) &&
        (kind === "all" || e.kind === kind) &&
        (!q.trim() || [e.title, e.workTitle, e.characterName || ""].some((v) => v.toLowerCase().includes(q.trim().toLowerCase())))
    )
    .sort((a, b) => a.month - b.month || a.day - b.day || a.title.localeCompare(b.title))

  return (
    <div className="space-y-5">
      {/* 달 선택: 달마다 이벤트 수 */}
      <div className="flex gap-1 overflow-x-auto">
        {(["all", ...Array.from({ length: 12 }, (_, i) => i + 1)] as const).map((m) => {
          const count = m === "all" ? base.length : perMonth.get(m) || 0
          const active = month === m
          return (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className={`flex-1 min-w-[52px] py-2 rounded-lg text-center ${active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300 hover:text-white"}`}
            >
              <span className="block text-sm font-semibold">{m === "all" ? "전체" : `${m}월`}</span>
              <span className={`block text-xs tabular-nums ${active ? "text-zinc-600" : "text-zinc-500"}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select className={`${input} sm:w-40`} value={kind} onChange={(e) => setKind(e.target.value as PartyEventKind | "all")}>
          <option value="all">종류 전체</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {PARTY_EVENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input className={`${input} sm:w-64`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이벤트·작품·캐릭터로 찾기" />
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="accent-sky-600" />
          숨긴 이벤트도 보기
        </label>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        {events === null ? (
          <p className="p-8 text-center text-sm text-zinc-500">불러오는 중...</p>
        ) : shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">{month === "all" ? "" : `${month}월에 `}등록된 이벤트가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {shown.map((e) => (
              <li key={e.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 ${e.status === "hidden" ? "opacity-60" : ""}`}>
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold text-white tabular-nums">
                    {e.month}.{e.day}
                  </p>
                  <p className="text-xs text-zinc-500">{e.year ? `${e.year}년만` : "매년"}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {e.title}
                    {e.status === "hidden" && <span className="ml-2 text-xs text-zinc-500">숨김</span>}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {PARTY_EVENT_KIND_LABELS[e.kind]} · {e.workTitle}
                    {e.characterName && ` · ${e.characterName}`}
                  </p>
                </div>
                <div className="text-xs text-zinc-400 tabular-nums sm:w-36">
                  파티 글 {e.postCount} · 펀딩 {fundingCounts[e.slug] || 0}
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0">
                  <a href={`/funding/party/event?slug=${encodeURIComponent(e.slug)}`} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white inline-flex items-center gap-1">
                    보기
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={() => onEdit(e)} className="text-sky-400 hover:text-sky-300">
                    수정
                  </button>
                  {e.status === "published" ? (
                    <button onClick={() => onStatus(e, "hidden")} className="text-zinc-400 hover:text-white">
                      숨김
                    </button>
                  ) : (
                    <button onClick={() => onStatus(e, "published")} className="text-zinc-400 hover:text-white">
                      다시 게시
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ================================================================ 추천받은 이벤트 (회원 제보)
function Suggested({
  events,
  onApprove,
  onEditApprove,
  onReject,
  onRestore,
}: {
  events: PartyEvent[] | null
  onApprove: (e: PartyEvent) => void
  onEditApprove: (e: PartyEvent) => void
  onReject: (e: PartyEvent) => void
  onRestore: (e: PartyEvent) => void
}) {
  const waiting = (events || []).filter((e) => e.status === "submitted").sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const rejected = (events || []).filter((e) => e.status === "rejected" && e.suggestedBy)
  const approved = (events || []).filter((e) => e.status !== "submitted" && e.status !== "rejected" && e.suggestedBy)
  const [past, setPast] = useState<"approved" | "rejected">("approved")
  const pastList = (past === "approved" ? approved : rejected).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // 같은 날짜·작품에 이미 게시된 이벤트가 있으면 중복일 수 있다고 알려 줌
  const duplicateOf = (e: PartyEvent) =>
    (events || []).find(
      (o) => o.id !== e.id && o.status === "published" && o.month === e.month && o.day === e.day && o.workTitle.trim() === e.workTitle.trim()
    )

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-400">
        회원이 펀딩 메인의 파티 캘린더에서 &apos;이벤트 제보하기&apos;로 보낸 이벤트예요. 승인하면 바로 캘린더에 올라가요. 이름이나 날짜를 다듬을 땐 &apos;고쳐서 승인&apos;을 눌러요.
      </p>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-white">확인 대기 {waiting.length}건</h3>
        {events === null ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : waiting.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 rounded-xl border border-zinc-800">새로 추천받은 이벤트가 없어요.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {waiting.map((e) => {
              const dup = duplicateOf(e)
              return (
                <article key={e.id} className={card}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-400">
                        {PARTY_EVENT_KIND_LABELS[e.kind]} · {dateText(e)}
                      </p>
                      <h4 className="text-base font-semibold text-white mt-0.5">{e.title}</h4>
                      <p className="text-sm text-zinc-300">
                        {e.workTitle}
                        {e.characterName && ` · ${e.characterName}`}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0">{fmt(e.createdAt)}</span>
                  </div>
                  <dl className="text-sm space-y-1">
                    <div className="flex gap-3">
                      <dt className="w-14 text-zinc-500 shrink-0">출처</dt>
                      <dd className="text-zinc-300 break-all">{e.source || "적지 않음"}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-14 text-zinc-500 shrink-0">제보</dt>
                      <dd>
                        {e.suggestedBy ? (
                          <a href={memberHref(e.suggestedBy)} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300">
                            회원 피드 보기
                          </a>
                        ) : (
                          <span className="text-zinc-400">알 수 없음</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {dup && (
                    <p className="text-xs text-amber-300">
                      같은 날짜·작품에 이미 &apos;{dup.title}&apos;이(가) 있어요. 중복인지 확인해 주세요.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => onApprove(e)} className={primary}>
                      승인
                    </button>
                    <button onClick={() => onEditApprove(e)} className={secondary}>
                      고쳐서 승인
                    </button>
                    <button onClick={() => onReject(e)} className={danger}>
                      반려
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-white mr-3">처리한 추천</h3>
          {(
            [
              ["approved", `승인 ${approved.length}`],
              ["rejected", `반려 ${rejected.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPast(id)}
              className={`px-3 h-8 rounded-lg text-sm ${past === id ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {pastList.length === 0 ? (
          <p className="text-sm text-zinc-500">없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {pastList.map((e) => (
              <li key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
                <span className="w-28 shrink-0 text-zinc-400 tabular-nums">{dateText(e)}</span>
                <span className="flex-1 min-w-0 text-white truncate">
                  {e.title} <span className="text-zinc-500">· {e.workTitle}</span>
                </span>
                {past === "rejected" ? (
                  <>
                    <span className="text-xs text-zinc-400 sm:max-w-[260px] truncate">사유: {e.rejectReason || "-"}</span>
                    <button onClick={() => onRestore(e)} className="text-sky-400 hover:text-sky-300 shrink-0">
                      다시 검토
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400">{PARTY_EVENT_STATUS_LABELS[e.status]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ================================================================ 등록·수정
function EventForm({
  slug,
  initial,
  fromSuggestion,
  onClose,
  onSaved,
}: {
  slug: string
  initial: FormState
  fromSuggestion?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSaving(true)
    setError("")
    const body = {
      ...form,
      month: Number(form.month),
      day: Number(form.day),
      year: form.year ? Number(form.year) : null,
      characterName: form.characterName || null,
      imageUrl: form.imageUrl || null,
      gallerySlug: form.gallerySlug || null,
    }
    try {
      if (slug) await updatePartyEvent(slug, body)
      else await createPartyEvent(body)
      onSaved()
    } catch (err: any) {
      setError(err?.message || "저장하지 못했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const label = "block text-xs text-zinc-400 mb-1.5"
  const daysInMonth = form.month ? new Date(2024, Number(form.month), 0).getDate() : 31

  return (
    <form onSubmit={submit} className={card}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{fromSuggestion ? "추천받은 이벤트 고쳐서 승인" : slug ? "이벤트 수정" : "새 이벤트 등록"}</h3>
        <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-white">
          닫기
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          <span className={label}>이벤트 이름</span>
          <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 우즈마키 나루토 생일" required />
        </label>
        <label>
          <span className={label}>주소용 ID (영문 소문자·숫자·하이픈)</span>
          <input className={input} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="예: naruto-birthday" required />
        </label>
        <label>
          <span className={label}>작품</span>
          <input className={input} value={form.workTitle} onChange={(e) => set("workTitle", e.target.value)} required />
        </label>
        <label>
          <span className={label}>캐릭터 (선택)</span>
          <input className={input} value={form.characterName} onChange={(e) => set("characterName", e.target.value)} />
        </label>
        <label>
          <span className={label}>종류</span>
          <select className={input} value={form.kind} onChange={(e) => set("kind", e.target.value as PartyEventKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {PARTY_EVENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className={label}>날짜 (매년 반복이면 연도는 &apos;매년&apos;)</span>
          <div className="flex gap-2">
            <select className={input} aria-label="월" value={form.month} onChange={(e) => set("month", e.target.value)} required>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <select className={input} aria-label="일" value={form.day} onChange={(e) => set("day", e.target.value)} required>
              {Array.from({ length: daysInMonth }, (_, i) => String(i + 1)).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
            <select className={input} aria-label="연도" value={form.year} onChange={(e) => set("year", e.target.value)}>
              <option value="">매년</option>
              {yearOptions(form.year).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="sm:col-span-2">
          <span className={label}>설명</span>
          <textarea className={input} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <ImageUploadField label="대표 이미지" target="party" value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
        <div className="space-y-4">
          <label className="block">
            <span className={label}>출처</span>
            <input className={input} value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="공식 설정집, 방영 정보 등" />
          </label>
          <label className="block">
            <span className={label}>파티할래요? 글을 쓸 갤러리 ID (비우면 기본 갤러리)</span>
            <input className={input} value={form.gallerySlug} onChange={(e) => set("gallerySlug", e.target.value)} placeholder="예: naruto" />
          </label>
          {!fromSuggestion && (
            <label className="block">
              <span className={label}>상태</span>
              <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as PartyEventStatus)}>
                {(Object.keys(PARTY_EVENT_STATUS_LABELS) as PartyEventStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PARTY_EVENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>
          취소
        </button>
        <button type="submit" disabled={saving} className={primary}>
          {saving ? "저장 중..." : fromSuggestion ? "고쳐서 승인" : slug ? "수정 저장" : "등록"}
        </button>
      </div>
    </form>
  )
}

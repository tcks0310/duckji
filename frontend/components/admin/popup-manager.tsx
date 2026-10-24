"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Ban, CheckCircle2, ExternalLink, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { PopupEvent } from "@/data/popup-data"
import { deletePopup, fetchPopups, popupDetailHref, updatePopup } from "@/lib/popup-service"
import { fetchPopupQrStats, PopupQrStats } from "@/lib/popup-qr"
import {
  CANDIDATE_CATEGORY_LABELS,
  blockSource,
  changeCandidate,
  convertCandidate,
  endExpired,
  fetchBlockedSources,
  fetchCandidates,
  unblockSource,
  type PopupCandidate,
} from "@/lib/popup-intake-service"
import { PopupQrPanel } from "@/components/admin/popup-qr-panel"
import { CATEGORY_OPTIONS, OPERATION_OPTIONS, PopupForm, RESERVATION_OPTIONS, type OperationType } from "@/components/admin/popup-form"

// 관리자 > 팝업 관리 (backend popups 서비스)
//   등록된 팝업: 제휴·자사·일반 → 진행 중·오픈 예정·종료로 나눠 보기, 팝업을 누르면 상세(정보·QR·수정)
//   자동 수집·등록 대기: 비공개 초안 팝업 + 자동 수집 후보(popup-collector) + 수집 제외 사이트

type MainTab = "registered" | "waiting"
type TypeFilter = "all" | OperationType
type StatusFilter = "all" | "ongoing" | "upcoming" | "ended"
type View = { mode: "list" } | { mode: "detail"; id: string; editing: boolean } | { mode: "create" }

const panel = "p-6 rounded-2xl bg-zinc-900 border border-zinc-800"
const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold disabled:opacity-50"
const btnPrimary = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
const btnDanger = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-semibold disabled:opacity-50"

const typeOf = (p: PopupEvent): OperationType => p.operationType || "listing"
const typeLabel = (t: OperationType) => OPERATION_OPTIONS.find((o) => o.value === t)?.label || t
// 등록 대기: 공개 전 초안 (종료 처리로 비공개가 된 팝업은 등록된 팝업의 '종료'에 남음)
const isDraft = (p: PopupEvent) => p.isPublished === false && !p.endedAt
const statusGroup = (p: PopupEvent): Exclude<StatusFilter, "all"> =>
  p.status === "ended" ? "ended" : p.status === "upcoming" ? "upcoming" : "ongoing"
const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "ongoing", label: "진행 중" },
  { value: "upcoming", label: "오픈 예정" },
  { value: "ended", label: "종료" },
]
// 목록 순서: 진행 중 → 오픈 예정(가까운 순) → 종료(최근 종료 순)
const STATUS_ORDER: Record<string, number> = { ongoing: 0, upcoming: 1, ended: 2 }
const byStatusThenDate = (a: PopupEvent, b: PopupEvent) => {
  const ga = statusGroup(a)
  const gb = statusGroup(b)
  if (ga !== gb) return STATUS_ORDER[ga] - STATUS_ORDER[gb]
  if (ga === "ended") return b.endDate.localeCompare(a.endDate)
  if (ga === "upcoming") return a.startDate.localeCompare(b.startDate)
  return a.endDate.localeCompare(b.endDate)
}
const TYPE_BADGE: Record<string, string> = {
  partner: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  own: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  listing: "bg-zinc-800 text-zinc-300 border-zinc-700",
}
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })

function StatusBadge({ p }: { p: PopupEvent }) {
  const g = statusGroup(p)
  const cls = g === "ongoing" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : g === "upcoming" ? "bg-sky-500/10 text-sky-300 border-sky-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"
  return <span className={`px-2 py-0.5 rounded border text-xs ${cls}`}>{p.statusLabel || STATUS_TABS.find((t) => t.value === g)?.label}</span>
}

// 좁은 화면에서도 한 줄로: 이름 + 드롭다운 (항목 옆 개수)
function FilterSelect<T extends string>({ label, items, value, onChange }: { label: string; items: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <span className="shrink-0 font-semibold text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-600"
      >
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count !== undefined ? ` (${o.count})` : ""}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PopupManager() {
  const [popups, setPopups] = useState<PopupEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [qrStats, setQrStats] = useState<Record<string, PopupQrStats>>({})
  const [tab, setTab] = useState<MainTab>("registered")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<View>({ mode: "list" })
  const [pendingCandidates, setPendingCandidates] = useState<number | null>(null)

  const load = async () => {
    setIsLoading(true)
    setLoadError("")
    try {
      setPopups(await fetchPopups({ includeUnpublished: true }))
      // QR 유입 집계는 실패해도 팝업 목록은 그대로 보여줌
      fetchPopupQrStats().then(setQrStats).catch(() => {})
    } catch (e: any) {
      setLoadError(e?.message || "팝업 목록을 불러오지 못했습니다. backend 연결을 확인해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetchCandidates("pending").then((r) => r.success && setPendingCandidates(r.candidates.length))
  }, [])

  const registered = useMemo(() => popups.filter((p) => !isDraft(p)), [popups])
  const drafts = useMemo(() => popups.filter(isDraft), [popups])

  const openDetail = (id: string, editing = false) => setView({ mode: "detail", id, editing })
  const backToList = () => setView({ mode: "list" })

  // ---- 새 팝업 등록 ----
  if (view.mode === "create") {
    return (
      <div className={`${panel} space-y-5`}>
        <div className="flex items-center gap-3">
          <button onClick={backToList} className={btn}>
            <ArrowLeft className="w-3.5 h-3.5" />
            목록
          </button>
          <h3 className="font-semibold text-lg text-white">새 팝업 등록</h3>
        </div>
        <PopupForm
          popup={null}
          defaults={{ sortOrder: popups.length, operationType: typeFilter === "all" ? "listing" : typeFilter }}
          onCancel={backToList}
          onSaved={async (p) => {
            await load()
            openDetail(p.id)
          }}
        />
      </div>
    )
  }

  // ---- 팝업 상세 ----
  if (view.mode === "detail") {
    const popup = popups.find((p) => p.id === view.id)
    if (!popup) {
      return (
        <div className={`${panel} space-y-3`}>
          <button onClick={backToList} className={btn}>
            <ArrowLeft className="w-3.5 h-3.5" />
            목록
          </button>
          <p className="text-sm text-zinc-400">{isLoading ? "불러오는 중..." : "팝업을 찾을 수 없습니다."}</p>
        </div>
      )
    }
    return (
      <PopupDetail
        popup={popup}
        stats={qrStats[popup.id]}
        editing={view.editing}
        onBack={backToList}
        onEdit={(editing) => setView({ mode: "detail", id: popup.id, editing })}
        onChanged={load}
        onDeleted={async () => {
          backToList()
          await load()
        }}
      />
    )
  }

  // ---- 목록 ----
  const q = query.trim().toLowerCase()
  const matched = q ? registered.filter((p) => [p.title, p.venueName, p.location].some((t) => (t || "").toLowerCase().includes(q))) : registered
  const byType = typeFilter === "all" ? matched : matched.filter((p) => typeOf(p) === typeFilter)
  const shown = (statusFilter === "all" ? byType : byType.filter((p) => statusGroup(p) === statusFilter)).slice().sort(byStatusThenDate)
  const countStatus = (g: Exclude<StatusFilter, "all">) => registered.filter((p) => statusGroup(p) === g).length
  const noLocation = registered.filter((p) => p.latitude == null && statusGroup(p) !== "ended").length
  const today = todayKst()
  const expiredOpen = registered.filter((p) => p.isPublished !== false && p.endDate < today)

  return (
    <div className="space-y-5">
      <div className={`${panel} space-y-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-lg text-white">팝업</h3>
          <div className="flex items-center gap-2">
            <button onClick={load} className={btn}>
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </button>
            <button onClick={() => setView({ mode: "create" })} className={btnPrimary}>
              <Plus className="w-3.5 h-3.5" />
              새 팝업 등록
            </button>
          </div>
        </div>

        <div className="flex gap-6 border-b border-zinc-800">
          {(
            [
              ["registered", "현재 등록된 팝업", registered.length],
              ["waiting", "자동 수집·등록 대기 팝업", drafts.length + (pendingCandidates ?? 0)],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`-mb-px pb-3 text-sm font-semibold border-b-2 ${tab === id ? "border-sky-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
            >
              {label}
              <span className="ml-1.5 text-xs tabular-nums text-zinc-500">{count}</span>
            </button>
          ))}
        </div>

        {loadError && <div className="text-xs text-red-300">{loadError}</div>}

        {tab === "registered" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["진행 중", countStatus("ongoing"), "ongoing", "text-emerald-300"],
                  ["오픈 예정", countStatus("upcoming"), "upcoming", "text-sky-300"],
                  ["종료", countStatus("ended"), "ended", "text-zinc-300"],
                ] as const
              ).map(([label, n, value, color]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === value ? "all" : value)}
                  className={`text-left rounded-xl border px-4 py-3 ${statusFilter === value ? "border-zinc-500 bg-zinc-800/60" : "border-zinc-800 hover:border-zinc-700"}`}
                >
                  <div className="text-xs text-zinc-400">{label}</div>
                  <div className={`text-xl font-bold tabular-nums ${color}`}>{n}</div>
                </button>
              ))}
              <div className="rounded-xl border border-zinc-800 px-4 py-3">
                <div className="text-xs text-zinc-400">지도 위치 없음</div>
                <div className={`text-xl font-bold tabular-nums ${noLocation ? "text-amber-300" : "text-zinc-500"}`}>{noLocation}</div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect<TypeFilter>
                  label="종류"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  items={[
                    { value: "all", label: "전체", count: matched.length },
                    ...OPERATION_OPTIONS.map((o) => ({ value: o.value as TypeFilter, label: o.label, count: matched.filter((p) => typeOf(p) === o.value).length })),
                  ]}
                />
                <FilterSelect<StatusFilter>
                  label="상태"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  items={STATUS_TABS.map((t) => ({ ...t, count: t.value === "all" ? byType.length : byType.filter((p) => statusGroup(p) === t.value).length }))}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="팝업 이름·장소 검색"
                  className="flex-1 min-w-[160px] sm:flex-none sm:w-56 sm:ml-auto bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div className="text-xs text-zinc-500">
                {shown.length}개 표시 · 진행 중 → 오픈 예정 → 종료 순
                {(typeFilter !== "all" || statusFilter !== "all" || q) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter("all")
                      setStatusFilter("all")
                      setQuery("")
                    }}
                    className="ml-2 underline underline-offset-2 hover:text-zinc-300"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            </div>

            {expiredOpen.length > 0 && <ExpiredNotice popups={expiredOpen} onDone={load} />}

            <PopupTable popups={shown} isLoading={isLoading} qrStats={qrStats} onOpen={(id) => openDetail(id)} empty="이 조건에 맞는 팝업이 없습니다." />
          </div>
        )}

        {tab === "waiting" && (
          <div className="space-y-8">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white">등록 대기 팝업</h4>
                <p className="text-xs text-zinc-400">공개하지 않은 초안입니다. 눌러서 내용을 다듬고 공개하면 &apos;현재 등록된 팝업&apos;으로 옮겨집니다.</p>
              </div>
              <PopupTable popups={drafts} isLoading={isLoading} qrStats={qrStats} onOpen={(id) => openDetail(id)} empty="등록 대기 중인 팝업이 없습니다." />
            </div>
            <CandidatesSection
              onConverted={async (id) => {
                await load()
                openDetail(id, true)
              }}
              onCount={setPendingCandidates}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---- 팝업 표 ----

// 기간 칸 아래 작은 안내: 오픈까지 / 종료까지 남은 날
function periodHint(p: PopupEvent) {
  const day = 86_400_000
  const today = Date.parse(todayKst())
  const g = statusGroup(p)
  if (g === "upcoming") {
    const d = Math.round((Date.parse(p.startDate) - today) / day)
    return d > 0 ? `오픈까지 ${d}일` : "오늘 오픈"
  }
  if (g === "ongoing") {
    const d = Math.round((Date.parse(p.endDate) - today) / day)
    return d > 0 ? `종료까지 ${d}일` : d === 0 ? "오늘 종료" : "기간 지남"
  }
  return ""
}

function PopupTable({
  popups,
  isLoading,
  qrStats,
  onOpen,
  empty,
}: {
  popups: PopupEvent[]
  isLoading: boolean
  qrStats: Record<string, PopupQrStats>
  onOpen: (id: string) => void
  empty: string
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950">
            <th className="p-3 font-semibold">팝업</th>
            <th className="p-3 font-semibold">종류</th>
            <th className="p-3 font-semibold">장소</th>
            <th className="p-3 font-semibold">기간</th>
            <th className="p-3 font-semibold">상태</th>
            <th className="p-3 font-semibold text-right">QR 유입</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-zinc-500">불러오는 중...</td>
            </tr>
          ) : popups.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-zinc-500">{empty}</td>
            </tr>
          ) : (
            popups.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer hover:bg-zinc-950/70">
                <td className="p-3">
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="w-10 h-12 rounded bg-zinc-800 overflow-hidden shrink-0">{p.posterUrl && <img src={p.posterUrl} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{p.title}</div>
                      <div className="text-zinc-500 truncate">{p.categoryLabel || p.category}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded border text-xs ${TYPE_BADGE[typeOf(p)]}`}>{typeLabel(typeOf(p))}</span>
                </td>
                <td className="p-3 text-zinc-300">
                  <div className="max-w-[220px] truncate">{p.venueName || "-"}</div>
                  {p.latitude == null && <div className="text-amber-300">지도 위치 없음</div>}
                </td>
                <td className="p-3 text-zinc-300 tabular-nums whitespace-nowrap">
                  {p.startDate} ~ {p.endDate}
                  <div className="text-zinc-500">{periodHint(p)}</div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge p={p} />
                    {p.isPublished === false && <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-xs">비공개</span>}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums text-zinc-300">{qrStats[p.id]?.total ?? 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---- 기간이 지났는데 공개 중인 팝업 ----

function ExpiredNotice({ popups, onDone }: { popups: PopupEvent[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = async () => {
    if (!confirm(`종료일이 지난 ${popups.length}개 팝업을 종료 처리할까요? 사이트에서 내려가고, 삭제되지는 않습니다.`)) return
    setBusy(true)
    const r = await endExpired(popups.map((p) => p.id))
    setBusy(false)
    if (!r.success) return setError(r.errors[0])
    onDone()
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs">
      <div className="text-amber-200">
        종료일이 지났는데 아직 사이트에 보이는 팝업이 {popups.length}개 있어요: {popups.slice(0, 3).map((p) => p.title).join(", ")}
        {popups.length > 3 && ` 외 ${popups.length - 3}개`}
        {error && <span className="block text-red-300">{error}</span>}
      </div>
      <button onClick={run} disabled={busy} className={btn}>
        종료 처리
      </button>
    </div>
  )
}

// ---- 팝업 상세: 정보 · QR · 수정 ----

function PopupDetail({
  popup,
  stats,
  editing,
  onBack,
  onEdit,
  onChanged,
  onDeleted,
}: {
  popup: PopupEvent
  stats?: PopupQrStats
  editing: boolean
  onBack: () => void
  onEdit: (editing: boolean) => void
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const published = popup.isPublished !== false

  const togglePublish = async () => {
    setBusy(true)
    setError("")
    const r = await updatePopup(popup.id, { isPublished: !published, ...(published ? {} : { endedAt: null }) })
    setBusy(false)
    if (!r.success) return setError(r.errors.join(" "))
    await onChanged()
  }

  const handleDelete = async () => {
    if (!confirm(`'${popup.title}' 팝업을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBusy(true)
    const ok = await deletePopup(popup.id)
    setBusy(false)
    if (ok) onDeleted()
    else setError("삭제하지 못했습니다.")
  }

  const rows: [string, React.ReactNode][] = [
    ["종류", typeLabel(typeOf(popup))],
    ["카테고리", popup.categoryLabel || CATEGORY_OPTIONS.find((o) => o.value === popup.category)?.label],
    ["기간", `${popup.startDate} ~ ${popup.endDate}`],
    ["운영 시간", popup.operatingHours || "-"],
    ["장소 이름", popup.venueName || "-"],
    ["주소", popup.location || "-"],
    ["지도 위치", popup.latitude != null && popup.longitude != null ? `${popup.latitude.toFixed(5)}, ${popup.longitude.toFixed(5)}` : <span className="text-amber-300">없음</span>],
    ["입장", popup.admission || "-"],
    ["예약", popup.reservationLabel || RESERVATION_OPTIONS.find((o) => o.value === popup.reservationType)?.label || "-"],
    ["공식 페이지", popup.officialUrl ? <a href={popup.officialUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline break-all">{popup.officialUrl}</a> : "-"],
    ["정보 출처", [popup.sourceName, popup.verifiedDate && `확인 ${popup.verifiedDate}`].filter(Boolean).join(" · ") || "-"],
    ["조회 · 찜", `${(popup.viewCount ?? 0).toLocaleString()} · ${(popup.likeCount ?? 0).toLocaleString()}`],
    ["ID", <span className="font-mono text-zinc-400">{popup.id}</span>],
  ]

  return (
    <div className="space-y-5">
      <div className={`${panel} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={editing ? () => onEdit(false) : onBack} className={btn}>
            <ArrowLeft className="w-3.5 h-3.5" />
            {editing ? "상세로" : "목록"}
          </button>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              {published && (
                <a href={popupDetailHref(popup.id)} target="_blank" rel="noreferrer" className={btn}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  사이트에서 보기
                </a>
              )}
              <button onClick={togglePublish} disabled={busy} className={btn}>
                {published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {published ? "비공개로" : "공개하기"}
              </button>
              <button onClick={() => onEdit(true)} className={btnPrimary}>
                <Pencil className="w-3.5 h-3.5" />
                정보 수정
              </button>
              <button onClick={handleDelete} disabled={busy} className={btnDanger}>
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className="w-20 h-24 rounded-lg bg-zinc-800 overflow-hidden shrink-0">{popup.posterUrl && <img src={popup.posterUrl} alt="" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge p={popup} />
              <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 text-xs">{typeLabel(typeOf(popup))}</span>
              {!published && <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-xs">{popup.endedAt ? "종료 처리됨" : "등록 대기"}</span>}
              {popup.origin === "collector" && <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-xs">자동 수집</span>}
            </div>
            <h3 className="text-xl font-semibold text-white break-keep">{popup.title}</h3>
            {popup.subTitle && <p className="text-sm text-zinc-400">{popup.subTitle}</p>}
          </div>
        </div>
        {error && <div className="text-xs text-red-300">{error}</div>}
      </div>

      {editing ? (
        <div className={panel}>
          <PopupForm
            popup={popup}
            defaults={{ sortOrder: popup.sortOrder ?? 0 }}
            onCancel={() => onEdit(false)}
            onSaved={async () => {
              await onChanged()
              onEdit(false)
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,520px)] gap-5 items-start">
          <div className={`${panel} space-y-5`}>
            <h4 className="text-sm font-semibold text-white">팝업 정보</h4>
            <dl className="divide-y divide-zinc-800 border-y border-zinc-800">
              {rows.map(([label, value]) => (
                <div key={label} className="flex gap-4 py-2.5 text-sm">
                  <dt className="w-24 shrink-0 text-zinc-400">{label}</dt>
                  <dd className="flex-1 min-w-0 text-zinc-100 break-keep">{value}</dd>
                </div>
              ))}
            </dl>
            {popup.description && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-400">소개</div>
                <p className="text-sm text-zinc-200 whitespace-pre-line leading-relaxed">{popup.description}</p>
              </div>
            )}
            {(popup.galleryImages?.length ?? 0) > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {popup.galleryImages.map((src) => (
                  <img key={src} src={src} alt="" className="w-24 h-20 rounded-lg object-cover border border-zinc-800 shrink-0" />
                ))}
              </div>
            )}
          </div>
          <PopupQrPanel popup={popup} stats={stats} />
        </div>
      )}
    </div>
  )
}

// ---- 자동 수집 후보 ----

function CandidatesSection({ onConverted, onCount }: { onConverted: (popupId: string) => void; onCount: (n: number) => void }) {
  const [status, setStatus] = useState<PopupCandidate["status"] | "">("pending")
  const [items, setItems] = useState<PopupCandidate[]>([])
  const [blocked, setBlocked] = useState<{ host: string; reason: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [dupInput, setDupInput] = useState<Record<string, string>>({})

  const load = async () => {
    setIsLoading(true)
    const [r, b] = await Promise.all([fetchCandidates(status || undefined), fetchBlockedSources()])
    setIsLoading(false)
    if (r.success) {
      setItems(r.candidates)
      if (status === "pending") onCount(r.candidates.length)
    } else setError(r.errors[0])
    if (b.success) setBlocked(b.sources)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const act = async (p: Promise<{ success: boolean; errors?: string[] }>) => {
    setError("")
    const r = await p
    if (!r.success) return setError(r.errors?.[0] || "처리하지 못했습니다.")
    load()
  }

  const convert = async (c: PopupCandidate) => {
    setError("")
    const r = await convertCandidate(c.id)
    if (!r.success) return setError(r.errors[0])
    onConverted(r.popup.id)
  }

  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">자동 수집된 팝업</h4>
          <p className="text-xs text-zinc-400">자동 수집이 찾은 팝업 소식과 확인 결과입니다. 자동 수집은 지금 꺼져 있어요. 확인한 후보만 등록 대기 팝업으로 옮깁니다.</p>
        </div>
        <select className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-600" value={status} onChange={(e) => setStatus(e.target.value as PopupCandidate["status"] | "")}>
          <option value="pending">미검토</option>
          <option value="converted">등록 대기로 옮김</option>
          <option value="duplicate">중복</option>
          <option value="dismissed">무시</option>
          <option value="">전체</option>
        </select>
      </div>

      {error && <div className="text-xs text-red-300">{error}</div>}

      {isLoading ? (
        <p className="p-6 text-center text-xs text-zinc-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-center text-xs text-zinc-500 rounded-xl border border-zinc-800">해당하는 수집 후보가 없습니다.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
          {items.map((c) => (
            <div key={c.id} className="p-4 space-y-3 text-xs">
              <div className="flex flex-col md:flex-row justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-white text-sm">{c.title}</div>
                  <div className="text-zinc-400">
                    {CANDIDATE_CATEGORY_LABELS[c.category] || c.category} · {c.startDate ?? "?"} ~ {c.endDate ?? "?"} · {c.venueName || c.location || "장소 미상"}
                  </div>
                  <div className="text-zinc-500">
                    출처{" "}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline inline-flex items-center gap-0.5">
                      {c.sourceName || hostOf(c.sourceUrl)}
                      <ExternalLink className="w-3 h-3" />
                    </a>{" "}
                    · 수집 {fmt(c.collectedAt)}
                  </div>
                </div>
                <div className={`text-lg font-semibold tabular-nums ${c.score >= 70 ? "text-emerald-300" : c.score >= 40 ? "text-amber-300" : "text-red-300"}`}>{c.score}점</div>
              </div>
              {c.summary && <p className="text-zinc-300">{c.summary}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {c.checks.map((ch) => (
                  <div key={ch.key} className={ch.ok ? "text-emerald-300" : "text-red-300"}>
                    {ch.ok ? "✓" : "✗"} {ch.label}
                    {ch.detail && <span className="text-zinc-500"> · {ch.detail}</span>}
                  </div>
                ))}
              </div>
              {c.status === "converted" ? (
                <div className="text-emerald-300">등록 대기 팝업으로 옮겼어요{c.popupId && ` (${c.popupId})`}</div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button onClick={() => convert(c)} className={btnPrimary}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    등록 대기로 옮기기
                  </button>
                  {c.status !== "dismissed" && (
                    <button onClick={() => act(changeCandidate(c.id, { status: "dismissed" }))} className={btn}>
                      무시
                    </button>
                  )}
                  <input
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-white w-44 font-mono"
                    placeholder="중복 대상 팝업 ID"
                    value={dupInput[c.id] ?? c.duplicateOf ?? ""}
                    onChange={(e) => setDupInput((p) => ({ ...p, [c.id]: e.target.value }))}
                  />
                  <button onClick={() => act(changeCandidate(c.id, { status: "duplicate", duplicateOf: dupInput[c.id] ?? c.duplicateOf ?? "" }))} className={btn}>
                    중복으로 표시
                  </button>
                  {c.status !== "pending" && (
                    <button onClick={() => act(changeCandidate(c.id, { status: "pending" }))} className={btn}>
                      미검토로
                    </button>
                  )}
                  <button
                    onClick={() => confirm(`${hostOf(c.sourceUrl)} 을(를) 다음 수집부터 제외할까요?`) && act(blockSource(hostOf(c.sourceUrl), `후보 #${c.id} 에서 차단`))}
                    className={btnDanger}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    출처 제외
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {blocked.length > 0 && (
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-zinc-400">수집 제외 사이트</div>
          <div className="flex flex-wrap gap-2">
            {blocked.map((b) => (
              <span key={b.host} className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                {b.host}
                <button onClick={() => act(unblockSource(b.host))} className="text-zinc-500 hover:text-white" aria-label={`${b.host} 제외 풀기`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

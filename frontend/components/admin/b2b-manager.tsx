"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { CalendarRange, FileText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  APPLY_KIND_LABELS,
  B2bApplication,
  B2bContract,
  B2bContractInput,
  B2bStatus,
  B2bStatusInfo,
  CONTRACT_PERIOD_LABELS,
  ContractSlot,
  SLOT_LABELS,
  createContract,
  deleteContract,
  fetchB2bApplications,
  fetchB2bStatuses,
  fetchContracts,
  updateB2bApplication,
  updateContract,
  type ApplyKind,
  type ContractPeriod,
} from "@/lib/b2b-service"
import { contractPeriod, syncNoticesWithContract } from "@/lib/site-notices"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 > 파트너 및 운영 > B2B 제휴 관리 (backend b2b 서비스)
// 안쪽 탭: 입점·광고 신청 내역 / 계약·광고 기간
// 신청 건(또는 전화·메일로 받은 건)에 계약·광고 기간을 붙여 기간별로 보고, 광고·공지는 '공지 팝업·광고 배너' 탭에서 계약을 골라 걺.
// 계약 기간이 끝나면 그 계약으로 건 광고·공지는 사이트에서 저절로 내려감 (계약 기간 = 노출 기간)

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"

const statusBadge = (s: B2bStatus) =>
  s === "published" || s === "approved"
    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
    : s === "rejected" || s === "ended" || s === "archived"
      ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"

const periodBadge = (p: ContractPeriod) =>
  p === "running"
    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
    : p === "upcoming"
      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
      : "bg-zinc-800 text-zinc-400 border border-zinc-700"

const range = (from: string | null, until: string | null) => (from || until ? `${from || "?"} ~ ${until || "?"}` : "-")
const won = (n: number | null) => (n === null ? "미정" : `${n.toLocaleString()}원`)

function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : ""}>
      <span className="text-zinc-500">{label}: </span>
      <strong className="text-zinc-200 font-semibold">{children}</strong>
    </div>
  )
}

function ApplicationCard({
  app,
  statuses,
  contracts,
  onSaved,
  onAddContract,
}: {
  app: B2bApplication
  statuses: B2bStatusInfo[]
  contracts: B2bContract[]
  onSaved: () => void
  onAddContract: (app: B2bApplication) => void
}) {
  const label = (s: B2bStatus) => statuses.find((x) => x.value === s)?.label || s
  const next = statuses.find((x) => x.value === app.status)?.next || []
  const [status, setStatus] = useState<B2bStatus | "">("")
  const [reason, setReason] = useState("")
  const [placement, setPlacement] = useState(app.placement)
  const [keywords, setKeywords] = useState(app.keywords.join(", "))
  const [adminNote, setAdminNote] = useState(app.adminNote)
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const mine = contracts.filter((c) => c.applicationId === app.id)

  const save = async () => {
    setIsSaving(true)
    const result = await updateB2bApplication(app.id, {
      ...(status ? { status, reason } : {}),
      placement,
      keywords,
      adminNote,
    })
    setIsSaving(false)
    if (!result.success) return setErrors(result.errors)
    setErrors([])
    setStatus("")
    setReason("")
    onSaved()
  }

  return (
    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white">{app.brandName}</span>
          <span className="text-zinc-400 text-sm">/ {app.eventName}</span>
          <span className="text-zinc-600 text-xs font-mono">{app.code}</span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs">{APPLY_KIND_LABELS[app.applyKind] || app.applyKind}</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(app.status)}`}>{label(app.status)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-zinc-900/60 p-3 rounded-xl">
        <Info label="담당자">
          {app.managerName}
          {app.managerCompany ? ` (${app.managerCompany})` : ""}
        </Info>
        <Info label="연락처">{app.managerPhone}</Info>
        <Info label="이메일">{app.managerEmail}</Info>
        <Info label="접수">{app.createdAt.slice(0, 16).replace("T", " ")}</Info>
        <Info label="행사 기간">{app.eventFrom ? range(app.eventFrom, app.eventUntil) : app.schedule || "-"}</Info>
        <Info label="장소">{app.location || "-"}</Info>
        <Info label="예약·웨이팅">{app.nativeBooking ? "사용 희망" : "-"}</Info>
        <Info label="링크">
          {app.linkUrl ? (
            <a href={app.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline break-all">
              열기
            </a>
          ) : (
            "-"
          )}
        </Info>
        {app.applyKind !== "listing" && (
          <>
            <Info label="희망 광고 자리" wide>
              {app.adSlots.length ? app.adSlots.map((s) => SLOT_LABELS[s] || s).join(", ") : app.placementWish || "-"}
            </Info>
            <Info label="희망 광고 기간">{range(app.adFrom, app.adUntil)}</Info>
            <Info label="예산">{app.budget || "-"}</Info>
          </>
        )}
        {app.applyKind === "listing" && app.placementWish && <Info label="희망 노출 위치" wide>{app.placementWish}</Info>}
        {app.content && <div className="col-span-2 sm:col-span-4 whitespace-pre-line text-zinc-300">{app.content}</div>}
        {app.statusReason && <Info label="사유" wide>{app.statusReason}</Info>}
      </div>

      {app.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {app.attachments.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={`첨부 ${i + 1}`}>
              <img src={url} alt={`첨부 ${i + 1}`} className="w-16 h-16 rounded-lg object-cover bg-zinc-900 border border-zinc-800" />
            </a>
          ))}
        </div>
      )}

      {/* 계약 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">계약:</span>
        {mine.length === 0 && <span className="text-zinc-500">아직 없음</span>}
        {mine.map((c) => (
          <span key={c.id} className={`px-2 py-0.5 rounded-md ${periodBadge(c.period)}`}>
            {c.code} {c.startsOn} ~ {c.endsOn} · {CONTRACT_PERIOD_LABELS[c.period]}
          </span>
        ))}
        <button onClick={() => onAddContract(app)} className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 font-semibold">
          <Plus className="w-3.5 h-3.5" />
          이 신청으로 계약 추가
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as B2bStatus | "")}>
          <option value="">상태 유지</option>
          {next.map((s) => (
            <option key={s} value={s}>{label(s)}(으)로 변경</option>
          ))}
        </select>
        <input className={`${inputClass} sm:col-span-3`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (반려·보완요청은 필수, 신청자에게 메일로 전달)" />
        <input className={`${inputClass} sm:col-span-2`} value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="확정 노출 위치" />
        <input className={`${inputClass} sm:col-span-2`} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="키워드 (쉼표로 구분)" />
        <input className={`${inputClass} sm:col-span-4`} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="내부 메모 (신청자에게 안 보임)" />
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" onClick={save} disabled={isSaving} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold rounded-xl">
          {isSaving ? "저장 중..." : "저장"}
        </Button>
      </div>
      {errors.length > 0 && <div className="text-xs text-red-400">{errors.join(" ")}</div>}
    </div>
  )
}

// ---------------- 계약·광고 기간 ----------------

const CONTRACT_SLOTS: ContractSlot[] = ["ad_left", "ad_right", "ad_bottom", "modal", "bar", "listing"]

type ContractForm = Omit<B2bContractInput, "amount"> & { amount: string }

const EMPTY_CONTRACT: ContractForm = {
  applicationId: null,
  kind: "ad",
  brandName: "",
  title: "",
  slots: [],
  startsOn: "",
  endsOn: "",
  amount: "",
  managerName: "",
  managerPhone: "",
  managerEmail: "",
  memo: "",
  status: "active",
}

export const contractFromApplication = (app: B2bApplication): ContractForm => ({
  ...EMPTY_CONTRACT,
  applicationId: app.id,
  kind: app.applyKind,
  brandName: app.brandName,
  title: app.eventName,
  slots: app.applyKind === "listing" ? ["listing"] : [...app.adSlots, ...(app.applyKind === "both" ? (["listing"] as ContractSlot[]) : [])],
  startsOn: app.adFrom || app.eventFrom || "",
  endsOn: app.adUntil || app.eventUntil || "",
  managerName: app.managerName,
  managerPhone: app.managerPhone,
  managerEmail: app.managerEmail,
})

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function ContractEditor({
  initial,
  editingId,
  applications,
  onDone,
  onCancel,
}: {
  initial: ContractForm
  editingId: number | null
  applications: B2bApplication[]
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ContractForm>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const input: B2bContractInput = { ...form, amount: form.amount.trim() ? Number(form.amount.replace(/[^\d]/g, "")) : null }
    const result = editingId ? await updateContract(editingId, input) : await createContract(input)
    if (!result.success) {
      setSaving(false)
      return setErrors(result.errors)
    }
    // 이 계약으로 건 광고·공지의 기간을 계약 기간에 맞춤 (취소면 숨김)
    let synced = 0
    if (editingId) {
      const c = result.contract
      synced = await syncNoticesWithContract(c.id, c.status === "cancelled" ? null : contractPeriod(c.startsOn, c.endsOn)).catch(() => -1)
    }
    setSaving(false)
    onDone(synced > 0 ? `저장했습니다. 이 계약으로 건 광고·공지 ${synced}개의 기간도 맞췄습니다.` : synced < 0 ? "저장했지만 연결된 광고·공지 기간은 맞추지 못했습니다. 공지 팝업·광고 배너 탭에서 확인해 주세요." : "저장했습니다.")
  }

  return (
    <form onSubmit={save} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
      <div className="text-sm font-semibold text-white">{editingId ? "계약 수정" : "새 계약 추가"}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">신청 건 (선택)</span>
          <select
            className={inputClass}
            value={form.applicationId ?? ""}
            onChange={(e) => {
              const app = applications.find((a) => a.id === Number(e.target.value))
              setForm(app ? { ...contractFromApplication(app), amount: form.amount, memo: form.memo, status: form.status } : { ...form, applicationId: null })
            }}
          >
            <option value="">신청 없이 직접 추가 (전화·메일로 받은 건)</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.brandName} / {a.eventName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">계약 종류</span>
          <select className={inputClass} value={form.kind} onChange={(e) => set("kind", e.target.value as ApplyKind)}>
            {(Object.keys(APPLY_KIND_LABELS) as ApplyKind[]).map((k) => (
              <option key={k} value={k}>{APPLY_KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">주최사·광고주 *</span>
          <input className={inputClass} required maxLength={100} value={form.brandName} onChange={(e) => set("brandName", e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">계약 이름 *</span>
          <input className={inputClass} required maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 11월 홈 왼쪽 광고" />
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-bold text-zinc-400">계약한 자리</span>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_SLOTS.map((slot) => (
              <label key={slot} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.slots.includes(slot)}
                  onChange={(e) => set("slots", e.target.checked ? [...form.slots, slot] : form.slots.filter((s) => s !== slot))}
                />
                {SLOT_LABELS[slot]}
              </label>
            ))}
          </div>
        </div>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">계약·광고 시작일 *</span>
          <DatePicker className={inputClass} value={form.startsOn} max={form.endsOn || undefined} onChange={(v) => set("startsOn", v)} placeholder="시작일" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">종료일 * (이 날 밤 12시에 광고가 내려감)</span>
          <DatePicker className={inputClass} value={form.endsOn} min={form.startsOn || undefined} onChange={(v) => set("endsOn", v)} placeholder="종료일" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">계약 금액 (원, 비우면 미정)</span>
          <input className={inputClass} inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="예: 500000" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">상태</span>
          <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value as "active" | "cancelled")}>
            <option value="active">진행 (기간에 따라 예정·진행 중·끝남)</option>
            <option value="cancelled">취소 (연결된 광고·공지를 숨김)</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">담당자</span>
          <input className={inputClass} maxLength={100} value={form.managerName} onChange={(e) => set("managerName", e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">연락처 / 이메일</span>
          <div className="flex gap-2">
            <input className={inputClass} maxLength={30} value={form.managerPhone} onChange={(e) => set("managerPhone", e.target.value)} placeholder="연락처" />
            <input className={inputClass} maxLength={200} value={form.managerEmail} onChange={(e) => set("managerEmail", e.target.value)} placeholder="이메일" />
          </div>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-bold text-zinc-400">메모</span>
          <textarea className={inputClass} rows={2} maxLength={3000} value={form.memo} onChange={(e) => set("memo", e.target.value)} placeholder="입금·세금계산서·시안 일정 등" />
        </label>
      </div>
      {errors.length > 0 && <div className="text-xs text-red-400">{errors.join(" ")}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold">
          취소
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
          {saving ? "저장 중..." : editingId ? "수정 저장" : "계약 추가"}
        </button>
      </div>
    </form>
  )
}

function ContractsPanel({
  applications,
  draft,
  onDraftUsed,
  onChanged,
}: {
  applications: B2bApplication[]
  draft: ContractForm | null
  onDraftUsed: () => void
  onChanged: () => void
}) {
  const [period, setPeriod] = useState<"" | ContractPeriod>("")
  const [month, setMonth] = useState("")
  const [contracts, setContracts] = useState<B2bContract[]>([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editing, setEditing] = useState<{ id: number | null; form: ContractForm } | null>(null)

  const load = async () => {
    const r = await fetchContracts({ period: period || undefined, month: month || undefined })
    if (!r.success) return setError(r.errors.join(" "))
    setError("")
    setContracts(r.contracts)
  }

  useEffect(() => {
    load()
  }, [period, month])

  // 신청 카드의 '이 신청으로 계약 추가'
  useEffect(() => {
    if (!draft) return
    setEditing({ id: null, form: draft })
    setMessage("")
    onDraftUsed()
  }, [draft])

  const remove = async (c: B2bContract) => {
    if (!confirm(`${c.code} "${c.title}" 계약을 삭제할까요? 이 계약으로 건 광고·공지는 숨겨집니다.`)) return
    await syncNoticesWithContract(c.id, null).catch(() => 0)
    const r = await deleteContract(c.id)
    if (!r.success) return alert(r.errors.join("\n"))
    load()
    onChanged()
  }

  const total = contracts.filter((c) => c.status === "active").reduce((n, c) => n + (c.amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="font-semibold text-lg text-white flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-zinc-400" />
            <span>계약·광고 기간</span>
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            신청 건이나 직접 받은 건을 계약 기간과 함께 추가합니다. 광고·공지는 &lsquo;공지 팝업·광고 배너&rsquo; 탭에서 이 계약을 골라 걸면 계약 종료일 밤 12시에 저절로 내려갑니다.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing({ id: null, form: EMPTY_CONTRACT })
            setMessage("")
          }}
          className="bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white rounded-xl shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          새 계약 추가
        </Button>
      </div>

      {editing && (
        <ContractEditor
          key={`${editing.id ?? "new"}-${editing.form.applicationId ?? ""}`}
          initial={editing.form}
          editingId={editing.id}
          applications={applications}
          onCancel={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null)
            setMessage(msg)
            load()
            onChanged()
          }}
        />
      )}
      {message && <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">{message}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {(["", "running", "upcoming", "ended", "cancelled"] as const).map((p) => (
          <button
            key={p || "all"}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${period === p ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"}`}
          >
            {p ? CONTRACT_PERIOD_LABELS[p] : "전체"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-800" />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          월별
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white [color-scheme:dark]"
          />
        </label>
        {month ? (
          <button onClick={() => setMonth("")} className="text-xs text-zinc-500 hover:text-white">월 선택 지우기</button>
        ) : (
          <button onClick={() => setMonth(thisMonth())} className="text-xs text-zinc-500 hover:text-white">이번 달</button>
        )}
        <Button size="sm" onClick={load} className="ml-auto bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          새로고침
        </Button>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/60">
              <th className="p-3">계약</th>
              <th className="p-3">주최사·광고주</th>
              <th className="p-3">자리</th>
              <th className="p-3">기간</th>
              <th className="p-3">금액</th>
              <th className="p-3">상태</th>
              <th className="p-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {contracts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  {period || month ? "조건에 맞는 계약이 없습니다." : "추가한 계약이 없습니다."}
                </td>
              </tr>
            )}
            {contracts.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <div className="font-semibold text-white">{c.title}</div>
                  <div className="text-zinc-500 font-mono">
                    {c.code}
                    {c.applicationId ? ` · 신청 B2B-${c.applicationId}` : " · 직접 추가"}
                  </div>
                </td>
                <td className="p-3 text-zinc-200">
                  {c.brandName}
                  {c.managerName && <div className="text-zinc-500">{c.managerName} {c.managerPhone}</div>}
                </td>
                <td className="p-3 text-zinc-300">{c.slots.length ? c.slots.map((s) => SLOT_LABELS[s] || s).join(", ") : APPLY_KIND_LABELS[c.kind]}</td>
                <td className="p-3 text-zinc-200 whitespace-nowrap">
                  {c.startsOn} ~ {c.endsOn}
                </td>
                <td className="p-3 text-zinc-300 whitespace-nowrap">{won(c.amount)}</td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${periodBadge(c.period)}`}>{CONTRACT_PERIOD_LABELS[c.period]}</span>
                </td>
                <td className="p-3 text-right whitespace-nowrap space-x-3">
                  <button
                    onClick={() => {
                      const { id, code, period: _p, createdAt, updatedAt, amount, ...rest } = c
                      setEditing({ id: c.id, form: { ...rest, amount: amount === null ? "" : String(amount) } })
                      setMessage("")
                    }}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    수정
                  </button>
                  <button onClick={() => remove(c)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contracts.length > 0 && <p className="text-xs text-zinc-500">목록의 계약 금액 합계 (취소 제외): {total.toLocaleString()}원</p>}
    </div>
  )
}

// ---------------- 탭 ----------------

type Tab = "applications" | "contracts"

export function B2bManager({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [tab, setTab] = useState<Tab>("applications")
  const [apps, setApps] = useState<B2bApplication[]>([])
  const [allApps, setAllApps] = useState<B2bApplication[]>([])
  const [contracts, setContracts] = useState<B2bContract[]>([])
  const [statuses, setStatuses] = useState<B2bStatusInfo[]>([])
  const [filter, setFilter] = useState("")
  const [kindFilter, setKindFilter] = useState<"" | ApplyKind>("")
  const [loadError, setLoadError] = useState("")
  const [draft, setDraft] = useState<ContractForm | null>(null)

  const load = async () => {
    const [s, a, all, c] = await Promise.all([
      fetchB2bStatuses(),
      fetchB2bApplications(filter),
      filter ? fetchB2bApplications() : Promise.resolve(null),
      fetchContracts(),
    ])
    if (!a.success) {
      setLoadError(a.errors.join(" ") || "신청 목록을 불러오지 못했습니다. backend 연결을 확인해주세요.")
      return
    }
    setLoadError("")
    if (s.success) setStatuses(s.statuses)
    setApps(a.applications)
    setAllApps(all && all.success ? all.applications : a.applications)
    if (!filter) onCountChange?.(a.total)
    if (c.success) setContracts(c.contracts)
  }

  useEffect(() => {
    load()
  }, [filter])

  const shown = kindFilter ? apps.filter((a) => a.applyKind === kindFilter) : apps
  const running = contracts.filter((c) => c.period === "running").length

  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "applications", label: `입점·광고 신청 내역 (${allApps.length})`, icon: FileText },
    { id: "contracts", label: `계약·광고 기간 (진행 중 ${running})`, icon: CalendarRange },
  ]

  return (
    <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5">
      <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-3">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "applications" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-semibold text-lg text-white">팝업 주최사 입점·광고 제휴 신청 내역</h3>
              <p className="text-sm text-zinc-400">입점·광고 신청 페이지(/partners/apply)로 들어온 신청서입니다. 계약이 되면 &lsquo;이 신청으로 계약 추가&rsquo;로 기간을 붙입니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <select className={inputClass} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "" | ApplyKind)}>
                <option value="">전체 종류</option>
                {(Object.keys(APPLY_KIND_LABELS) as ApplyKind[]).map((k) => (
                  <option key={k} value={k}>{APPLY_KIND_LABELS[k]}</option>
                ))}
              </select>
              <select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">전체 상태</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <Button size="sm" onClick={load} className="bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 rounded-xl shrink-0">
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                새로고침
              </Button>
            </div>
          </div>

          {loadError && <div className="text-xs text-red-400">{loadError}</div>}
          {!loadError && shown.length === 0 && <div className="text-sm text-zinc-500">신청 내역이 없습니다.</div>}

          <div className="space-y-3">
            {shown.map((app) => (
              <ApplicationCard
                key={`${app.id}-${app.status}-${app.updatedAt}`}
                app={app}
                statuses={statuses}
                contracts={contracts}
                onSaved={load}
                onAddContract={(a) => {
                  setDraft(contractFromApplication(a))
                  setTab("contracts")
                }}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "contracts" && <ContractsPanel applications={allApps} draft={draft} onDraftUsed={() => setDraft(null)} onChanged={load} />}

    </div>
  )
}

"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, ImageOff, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { ImageListUploadField } from "@/components/admin/image-upload-field"
import { fmtDateTime } from "@/components/admin/goods-shared"
import { MALL_CATEGORIES, SUPPLY_TYPES, type MallItem, type SupplyType } from "@/lib/mall"

// 관리자 '스토어 > 덕지몰 관리' 탭 (backend b2b 서비스 /api/b2b/admin/inquiries, /api/b2b/admin/mall/items)
// 위: 품목 추가·건수 요약 / 왼쪽: 덕지몰 품목 목록(품목별 새 요청·전체 요청) / 오른쪽: 고른 품목의 견적 요청(상태별)
// 결제는 없음 (PG 미연동): 요청자에게 직접 연락하고 상태와 메모만 남김. 알림 발송은 추후 개선

type Inquiry = {
  id: number
  code: string
  kind: "mall_quote" | "custom_order"
  status: string
  statusLabel: string
  companyName: string
  contactName: string
  contactPhone: string
  contactEmail: string
  items: { id?: string; name: string; quantity: number; [k: string]: unknown }[]
  itemIds: number[]
  details: Record<string, unknown>
  message: string
  adminMemo: string
  createdAt: string
}

type AdminItem = MallItem & { requests: { total: number; new: number } }
type Count = { kind: string; status: string; n: number; noItem: number }
// 요청 묶음: 전체 / 품목 하나 / 품목 없는 덕지몰 문의 / 커스텀샵
type Group = { type: "all" } | { type: "item"; id: number } | { type: "none" } | { type: "custom" }

const OPTION_LABEL: Record<string, string> = { serviceType: "방식", size: "규격", coating: "코팅", finish: "가공", text: "문구", fileName: "첨부 파일" }
const input =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const card = "p-5 rounded-2xl bg-zinc-900 border border-zinc-800"

async function call<T = any>(path: string, method = "GET", json?: unknown): Promise<T> {
  const res = await apiFetch(`/api/b2b/admin${path}`, {
    method,
    cache: "no-store",
    headers: json === undefined ? undefined : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || body.errors?.[0] || "요청을 처리하지 못했습니다.")
  return body
}

const fmtDate = (s: string) => s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3")

function detailRows(q: Inquiry): [string, string][] {
  const d = q.details || {}
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "")
  if (q.kind === "mall_quote") {
    const range = s("eventStart") || s("eventEnd") ? `${fmtDate(s("eventStart")) || "?"} ~ ${fmtDate(s("eventEnd")) || "?"}` : s("eventDates")
    return [
      ["행사 기간", range],
      ["장소", s("eventLocation")],
      ["현장 설치", d.needInstallService ? `필요${s("installDate") ? ` (설치 희망일 ${fmtDate(s("installDate"))})` : ""}` : ""],
    ].filter(([, v]) => v) as [string, string][]
  }
  return [
    ["배송지", s("address")],
    ["화면 예상 금액", typeof d.estimatedTotal === "number" ? `${d.estimatedTotal.toLocaleString()}원 (예시 단가 기준)` : ""],
  ].filter(([, v]) => v) as [string, string][]
}

type ItemForm = {
  id: number | null
  name: string
  category: string
  supplyTypes: SupplyType[]
  description: string
  spec: string
  imageUrls: string[]
  sortOrder: number
  isActive: boolean
}
const emptyForm = (): ItemForm => ({
  id: null,
  name: "",
  category: MALL_CATEGORIES[0].id,
  supplyTypes: ["렌탈"],
  description: "",
  spec: "",
  imageUrls: [],
  sortOrder: 0,
  isActive: true,
})


// 행사 기간 (덕지몰 견적 요청만)
function eventPeriod(q: Inquiry) {
  const d = q.details || {}
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "")
  if (s("eventStart") || s("eventEnd")) return `${fmtDate(s("eventStart")) || "?"} ~ ${fmtDate(s("eventEnd")) || "?"}`
  return s("eventDates")
}

const toForm = (item: AdminItem): ItemForm => ({
  id: item.id,
  name: item.name,
  category: item.category,
  supplyTypes: item.supplyTypes,
  description: item.description,
  spec: item.spec,
  imageUrls: item.imageUrls,
  sortOrder: item.sortOrder,
  isActive: item.isActive,
})

export function MallManager() {
  const [mallItems, setMallItems] = useState<AdminItem[]>([])
  const [counts, setCounts] = useState<Count[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [group, setGroup] = useState<Group>({ type: "all" })
  const [status, setStatus] = useState("")
  const [form, setForm] = useState<ItemForm | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(() => {
    call<{ items: AdminItem[] }>("/mall/items")
      .then((r) => setMallItems(r.items))
      .catch((e) => setError(e.message))
  }, [])

  // 묶음의 요청을 상태 구분 없이 받아 와서, 상태 칩 건수와 거르기는 화면에서 함
  const loadInquiries = useCallback(() => {
    const q = new URLSearchParams()
    if (group.type === "item") q.set("item", String(group.id))
    if (group.type === "none") q.set("item", "none")
    if (group.type === "custom") q.set("kind", "custom_order")
    if (group.type === "all") q.set("kind", "mall_quote")
    setLoading(true)
    call<{ inquiries: Inquiry[]; statuses: Record<string, string>; counts: Count[] }>(`/inquiries?${q}`)
      .then((r) => {
        setInquiries(r.inquiries)
        setStatuses(r.statuses)
        setCounts(r.counts)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [group])

  useEffect(loadItems, [loadItems])
  useEffect(loadInquiries, [loadInquiries])

  const summary = useMemo(() => {
    const sum = (f: (c: Count) => boolean, by: (c: Count) => number = (c) => c.n) => counts.filter(f).reduce((a, c) => a + by(c), 0)
    return {
      newMall: sum((c) => c.kind === "mall_quote" && c.status === "received"),
      totalMall: sum((c) => c.kind === "mall_quote"),
      noItem: sum((c) => c.kind === "mall_quote", (c) => c.noItem),
      noItemNew: sum((c) => c.kind === "mall_quote" && c.status === "received", (c) => c.noItem),
      custom: sum((c) => c.kind === "custom_order"),
      customNew: sum((c) => c.kind === "custom_order" && c.status === "received"),
    }
  }, [counts])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const q of inquiries) m[q.status] = (m[q.status] || 0) + 1
    return m
  }, [inquiries])
  const shown = status ? inquiries.filter((q) => q.status === status) : inquiries

  const refresh = () => {
    setError("")
    loadItems()
    loadInquiries()
  }

  const patchItem = async (item: AdminItem, body: Record<string, unknown>) => {
    setError("")
    try {
      await call(`/mall/items/${item.id}`, "PATCH", body)
      loadItems()
    } catch (e: any) {
      setError(e.message)
    }
  }
  const deleteItem = async (item: AdminItem) => {
    if (!window.confirm(`'${item.name}' 품목을 지울까요? 되돌릴 수 없습니다.`)) return
    setError("")
    try {
      await call(`/mall/items/${item.id}`, "DELETE")
      if (group.type === "item" && group.id === item.id) setGroup({ type: "all" })
      loadItems()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const selectedItem = group.type === "item" ? mallItems.find((i) => i.id === group.id) : undefined
  const groupTitle =
    group.type === "item" ? selectedItem?.name || "품목" : group.type === "none" ? "품목 없는 일반 문의" : group.type === "custom" ? "지난 커스텀샵 의뢰" : "전체 견적 요청"
  const sameGroup = (g: Group) => g.type === group.type && (g.type !== "item" || (group.type === "item" && g.id === group.id))

  // 왼쪽 목록 한 줄
  const groupButton = ({ g, label, sub, thumb, fresh, total, muted }: { g: Group; label: string; sub?: string; thumb?: React.ReactNode; fresh: number; total: number; muted?: boolean }) => {
    const on = sameGroup(g)
    return (
      <button
        onClick={() => setGroup(g)}
        aria-current={on ? "true" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${on ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
      >
        {thumb}
        <span className="flex-1 min-w-0">
          <span className={`block text-sm truncate ${on ? "text-white font-semibold" : muted ? "text-zinc-500" : "text-zinc-200"}`}>{label}</span>
          {sub && <span className="block text-xs text-zinc-500 truncate">{sub}</span>}
        </span>
        <span className="shrink-0 flex items-center gap-1.5 text-xs tabular-nums">
          {fresh > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 font-semibold">새 {fresh}</span>}
          <span className="w-9 text-right text-zinc-400">{total}건</span>
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* 위: 할 일과 요약 */}
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-white">덕지몰</h3>
            <p className="text-sm text-zinc-400">제작·대여할 수 있는 품목을 올리고, 품목별로 들어온 견적 요청을 확인합니다. 연락한 뒤 상태를 바꿔 두세요.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
            <button
              onClick={() => setForm(emptyForm())}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4" />
              품목 추가
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "새 요청", value: summary.newMall, hint: "아직 연락 전", strong: summary.newMall > 0 },
            { label: "전체 요청", value: summary.totalMall, hint: "덕지몰 견적 요청" },
            { label: "덕지몰 품목", value: mallItems.length, hint: `노출 중 ${mallItems.filter((i) => i.isActive).length}개` },
            { label: "품목 없는 일반 문의", value: summary.noItem, hint: `새 문의 ${summary.noItemNew}건` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3">
              <dt className="text-xs text-zinc-400">{s.label}</dt>
              <dd className={`text-2xl font-bold tabular-nums ${s.strong ? "text-sky-400" : "text-white"}`}>{s.value}</dd>
              <dd className="text-xs text-zinc-500">{s.hint}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-zinc-500">요청한 분께는 지금은 연락처로 직접 연락해 주세요. 알림 발송은 추후 개선 예정입니다.</p>
        {error && (
          <div className="flex items-start justify-between gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="닫기">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {form && (
          <ItemEditor
            form={form}
            onCancel={() => setForm(null)}
            onSaved={() => {
              setForm(null)
              loadItems()
            }}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)] gap-5 items-start">
        {/* 왼쪽: 품목별 요청 수 */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h4 className="font-semibold text-white">품목별 요청</h4>
            <p className="text-xs text-zinc-500">품목을 누르면 그 품목의 요청만 보입니다.</p>
          </div>
          <div className="divide-y divide-zinc-800 lg:max-h-[70vh] lg:overflow-y-auto">
            {groupButton({ g: { type: "all" }, label: "전체 견적 요청", fresh: summary.newMall, total: summary.totalMall })}
            {mallItems.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zinc-400">
                아직 올린 품목이 없습니다. 위의 <strong className="text-zinc-200">품목 추가</strong>로 덕지몰에 보일 품목을 올려 주세요.
              </p>
            )}
            {mallItems.map((item) => (
              <React.Fragment key={item.id}>
                {groupButton({
                  g: { type: "item", id: item.id },
                  label: item.name,
                  sub: `${item.categoryName}${item.isActive ? "" : " · 숨김"}`,
                  muted: !item.isActive,
                  fresh: item.requests.new,
                  total: item.requests.total,
                  thumb: item.imageUrls[0] ? (
                    <img src={item.imageUrls[0]} alt="" className={`w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0 ${item.isActive ? "" : "opacity-50"}`} />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                      <ImageOff className="w-4 h-4" />
                    </span>
                  ),
                })}
              </React.Fragment>
            ))}
            {groupButton({ g: { type: "none" }, label: "품목 없는 일반 문의", fresh: summary.noItemNew, total: summary.noItem })}
            {summary.custom > 0 &&
              groupButton({ g: { type: "custom" }, label: "지난 커스텀샵 의뢰", sub: "커스텀샵 페이지는 닫힘", muted: true, fresh: summary.customNew, total: summary.custom })}
          </div>
        </div>

        {/* 오른쪽: 고른 묶음의 요청 */}
        <div className={`${card} space-y-4 min-w-0`}>
          {selectedItem ? (
            <div className="flex flex-wrap items-start gap-4">
              {selectedItem.imageUrls[0] ? (
                <img src={selectedItem.imageUrls[0]} alt="" className="w-16 h-16 rounded-xl object-cover bg-zinc-800 shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white text-base truncate">{selectedItem.name}</h4>
                  {!selectedItem.isActive && <span className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400">숨김</span>}
                </div>
                <p className="text-xs text-zinc-400">
                  {selectedItem.categoryName} · {selectedItem.supplyTypes.join(" / ")}
                  {selectedItem.spec && ` · ${selectedItem.spec}`}
                </p>
                <p className="text-sm text-zinc-300 mt-1 tabular-nums">
                  요청 {selectedItem.requests.total}건{selectedItem.requests.new > 0 && <span className="text-sky-400"> · 새 요청 {selectedItem.requests.new}건</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <IconButton label="수정" onClick={() => setForm(toForm(selectedItem))}>
                  <Pencil className="w-4 h-4" />
                </IconButton>
                <IconButton label={selectedItem.isActive ? "숨기기" : "다시 보이기"} onClick={() => patchItem(selectedItem, { isActive: !selectedItem.isActive })}>
                  {selectedItem.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </IconButton>
                {selectedItem.requests.total === 0 && (
                  <IconButton label="삭제" onClick={() => deleteItem(selectedItem)}>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                )}
              </div>
            </div>
          ) : (
            <h4 className="font-semibold text-white text-base">{groupTitle}</h4>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {[["", "전체", inquiries.length] as const, ...Object.entries(statuses).map(([v, l]) => [v, l, statusCounts[v] || 0] as const)].map(([v, l, n]) => (
              <button
                key={v || "all"}
                onClick={() => setStatus(v)}
                className={`px-3 py-1.5 rounded-lg ${status === v ? "bg-zinc-100 text-zinc-900 font-semibold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
              >
                {l} <span className="tabular-nums">{n}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
            <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_10rem_8.5rem_5.5rem] gap-3 px-4 py-2 text-xs text-zinc-500 bg-zinc-950/60 rounded-t-xl">
              <span>업체·담당자</span>
              <span>{group.type === "item" ? "요청 수량" : "요청 품목"}</span>
              <span>행사 기간</span>
              <span>접수</span>
              <span>상태</span>
            </div>
            {shown.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">{loading ? "불러오는 중..." : "요청이 없습니다."}</div>}
            {shown.map((q) => (
              <InquiryRow
                key={q.id}
                q={q}
                focusItemId={group.type === "item" ? group.id : undefined}
                statuses={statuses}
                onChanged={(next) => {
                  setInquiries((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                  loadItems()
                  loadInquiries()
                }}
                onRemoved={() => {
                  setInquiries((prev) => prev.filter((x) => x.id !== q.id))
                  loadItems()
                  loadInquiries()
                }}
                onError={setError}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
      {children}
    </button>
  )
}

// 요청 한 줄: 업체·담당자 / 요청 수량(고른 품목) 또는 요청 품목 / 행사 기간 / 접수 시각 / 상태. 누르면 자세히
function InquiryRow({
  q,
  focusItemId,
  statuses,
  onChanged,
  onRemoved,
  onError,
}: {
  q: Inquiry
  focusItemId?: number
  statuses: Record<string, string>
  onChanged: (q: Inquiry) => void
  onRemoved: () => void
  onError: (e: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [memo, setMemo] = useState(q.adminMemo)
  const attachments = Array.isArray(q.details?.attachments) ? (q.details.attachments as string[]) : []

  const update = async (body: Record<string, unknown>) => {
    onError("")
    try {
      const r = await call<{ inquiry: Inquiry }>(`/inquiries/${q.id}`, "PATCH", body)
      onChanged(r.inquiry)
    } catch (e: any) {
      onError(e.message)
    }
  }

  // 취소한 요청만 지울 수 있음 (테스트로 넣은 요청 정리용)
  const remove = async () => {
    if (!window.confirm(`'${q.companyName || q.contactName}' 요청(${q.code})을 지울까요? 되돌릴 수 없습니다.`)) return
    onError("")
    try {
      await call(`/inquiries/${q.id}`, "DELETE")
      onRemoved()
    } catch (e: any) {
      onError(e.message)
    }
  }

  const focus = focusItemId === undefined ? undefined : q.items.find((i) => Number(i.id) === focusItemId)
  const others = q.items.length - (focus ? 1 : 0)
  const requested = focus
    ? `${focus.quantity.toLocaleString()}개${others > 0 ? ` · 다른 품목 ${others}개 함께` : ""}`
    : q.items.length
      ? q.items.map((i) => `${i.name} ${i.quantity}개`).join(", ")
      : "품목 없음 (일반 문의)"
  const period = q.kind === "mall_quote" ? eventPeriod(q) : ""

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`w-full px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_10rem_8.5rem_5.5rem] gap-x-3 gap-y-1 items-center text-left ${open ? "bg-zinc-800/40" : "hover:bg-zinc-800/40"}`}
      >
        <span className="min-w-0">
          <span className="block text-white font-semibold truncate">{q.companyName || q.contactName}</span>
          <span className="block text-xs text-zinc-400 truncate">
            {q.companyName ? `${q.contactName} · ` : ""}
            {q.contactPhone}
          </span>
        </span>
        <span className="md:order-none order-last col-span-2 md:col-span-1 min-w-0 text-zinc-200">
          <span className={`block truncate ${focus ? "font-semibold tabular-nums" : ""}`}>{requested}</span>
          {attachments.length > 0 && <span className="block text-xs text-zinc-500">첨부 사진 {attachments.length}장</span>}
        </span>
        <span className="hidden md:block text-xs text-zinc-300 tabular-nums">{period || <span className="text-zinc-600">-</span>}</span>
        <span className="hidden md:block text-xs text-zinc-400 tabular-nums">{fmtDateTime(q.createdAt)}</span>
        <span className="justify-self-end md:justify-self-start">
          <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${q.status === "received" ? "bg-sky-900/60 text-sky-300 font-semibold" : q.status === "cancelled" ? "bg-zinc-900 text-zinc-500 border border-zinc-800" : "bg-zinc-800 text-zinc-300"}`}>
            {q.statusLabel}
          </span>
        </span>
        <span className="md:hidden col-span-2 order-last text-xs text-zinc-500 tabular-nums">
          {period ? `행사 ${period} · ` : ""}접수 {fmtDateTime(q.createdAt)}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 space-y-4 text-zinc-300">
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {(
              [
                ["접수 번호", q.code],
                ["담당자", q.contactName],
                ["연락처", <a key="t" href={`tel:${q.contactPhone}`} className="underline">{q.contactPhone}</a>],
                ["이메일", <a key="m" href={`mailto:${q.contactEmail}`} className="underline break-all">{q.contactEmail}</a>],
                ...detailRows(q),
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-20 shrink-0 text-zinc-500">{k}</dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
          {q.items.length > 0 && (
            <div>
              <p className="text-zinc-500 mb-1">요청 품목</p>
              <ul className="space-y-0.5">
                {q.items.map((i, idx) => (
                  <li key={idx}>
                    {i.name} <span className="text-zinc-400">{i.quantity}개</span>
                    <span className="text-zinc-500">
                      {Object.entries(OPTION_LABEL)
                        .filter(([k]) => i[k])
                        .map(([k, l]) => ` · ${l} ${i[k]}`)
                        .join("")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {attachments.length > 0 && (
            <div>
              <p className="text-zinc-500 mb-1.5">첨부 사진 (누르면 원본, 주소는 1시간 동안만 열림)</p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={u} alt={`첨부 ${i + 1}`} className="w-20 h-20 rounded-lg object-cover bg-zinc-800 border border-zinc-700 hover:border-zinc-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {q.message && (
            <div>
              <p className="text-zinc-500 mb-1">요청 사항</p>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 whitespace-pre-wrap leading-relaxed">{q.message}</div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-zinc-500">상태</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(statuses).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => update({ status: v })}
                  className={`px-3 py-1.5 rounded-lg ${q.status === v ? "bg-sky-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="관리자 메모 (문의자에게 안 보임)"
              className={`${input} min-h-[64px]`}
            />
            <button onClick={() => update({ adminMemo: memo })} className="px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold shrink-0">
              메모 저장
            </button>
          </div>
          {q.status === "cancelled" && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-zinc-500">취소한 요청은 목록에서 지울 수 있어요.</p>
              <button onClick={remove} className="px-3 py-1.5 rounded-lg border border-red-900/60 text-red-300 hover:bg-red-950/40 text-sm shrink-0">
                요청 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemEditor({ form: initial, onCancel, onSaved }: { form: ItemForm; onCancel: () => void; onSaved: () => void }) {
  const [f, setF] = useState<ItemForm>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => setF(initial), [initial])
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const { id, ...body } = f
      await call(id ? `/mall/items/${id}` : "/mall/items", id ? "PATCH" : "POST", body)
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-white">{f.id ? "품목 수정" : "새 품목"}</h4>
        <button type="button" onClick={onCancel} className="p-1 text-zinc-400 hover:text-white" aria-label="닫기">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">품목 이름 *</span>
          <input className={input} required maxLength={150} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 3단 아크릴 진열대" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">분류 *</span>
          <select className={input} value={f.category} onChange={(e) => set("category", e.target.value)}>
            {MALL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">공급 방식 * (하나 이상)</span>
          <div className="flex gap-2">
            {SUPPLY_TYPES.map((t) => {
              const on = f.supplyTypes.includes(t)
              return (
                <label key={t} className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${on ? "border-sky-600 text-white bg-sky-950/40" : "border-zinc-800 text-zinc-400"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => set("supplyTypes", on ? f.supplyTypes.filter((x) => x !== t) : SUPPLY_TYPES.filter((x) => x === t || f.supplyTypes.includes(x)))}
                  />
                  {t}
                </label>
              )
            })}
          </div>
        </div>
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">규격</span>
          <input className={input} maxLength={300} value={f.spec} onChange={(e) => set("spec", e.target.value)} placeholder="예: 600 x 300 x 250mm, 아크릴 5T" />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-zinc-400">설명</span>
        <textarea
          className={`${input} min-h-[90px]`}
          maxLength={3000}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="어떤 용도에 좋은지, 재질, 최소 수량, 납기 등"
        />
      </label>
      <ImageListUploadField label="사진 (첫 장이 대표)" value={f.imageUrls} onChange={(v) => set("imageUrls", v)} target="mall" max={8} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-bold text-zinc-400">순서 (작을수록 앞)</span>
          <input type="number" className={`${input} w-28`} value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm text-zinc-200 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          덕지몰에 보이기
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "저장 중..." : f.id ? "수정 저장" : "품목 올리기"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200">
          취소
        </button>
      </div>
    </form>
  )
}

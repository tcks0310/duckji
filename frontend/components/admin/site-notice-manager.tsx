"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Eye, Megaphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageUploadField as SharedImageUploadField } from "@/components/admin/image-upload-field"
import { SiteNoticeBar } from "@/components/notices/site-notice-bar"
import { SiteNoticeModal } from "@/components/notices/site-notice-modal"
import { BottomAdSlot, WingAdSlot } from "@/components/home/home-ad-slot"
import { CONTRACT_PERIOD_LABELS, fetchContracts, SLOT_LABELS, type B2bContract } from "@/lib/b2b-service"
import {
  AD_PLACEMENT_LABELS,
  contractPeriod,
  isAdPlacement,
  type AdPlacement,
  NOTICE_AUDIENCE_LABELS,
  NOTICE_DEVICE_LABELS,
  NOTICE_DISMISS_LABELS,
  NOTICE_PAGES_LABELS,
  NOTICE_STATUS_LABELS,
  NOTICE_TEMPLATE_LABELS,
  createSiteNotice,
  deleteSiteNotice,
  fetchAdminSiteNotices,
  updateSiteNotice,
  uploadNoticeImage,
  type NoticeAudience,
  type NoticeDevice,
  type NoticeDismiss,
  type NoticePages,
  type NoticePlacement,
  type NoticeStatus,
  type NoticeTemplate,
  type SiteNotice,
} from "@/lib/site-notices"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 > 파트너 및 운영 > 공지 팝업·광고 배너 (backend site-notices 서비스)
// 안쪽 탭: 공지 팝업 / 하단 띠 배너 / 좌측 배너 / 우측 배너 / 하단 배너
// 공지·광고 모두 이미지·링크·기간·게시를 여기서 정하고, 기간(종료 일시)이 지나면 사이트에서 저절로 내려감 (스케줄러 없이 /live 가 거름)
// 계약(B2B 제휴 관리 › 계약·광고 기간)을 고르면 계약 기간이 노출 기간으로 들어가고, 계약 기간을 고치거나 취소하면 여기 기간도 따라 바뀜

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"

type FormState = {
  name: string
  placement: NoticePlacement
  template: NoticeTemplate
  title: string
  body: string
  imageUrl: string
  mobileImageUrl: string
  linkUrl: string
  linkLabel: string
  linkNewTab: boolean
  pages: NoticePages
  audience: NoticeAudience
  device: NoticeDevice
  dismiss: NoticeDismiss
  priority: string
  startsAt: string // datetime-local (브라우저 시간대)
  endsAt: string
  status: NoticeStatus
  contractId: string // 비우면 계약 없음
}

// 탭 하나 = 노출 위치(placement) 하나
type Section = NoticePlacement
const SECTIONS: { id: Section; label: string }[] = [
  { id: "modal", label: "공지 팝업" },
  { id: "bar", label: "하단 띠 배너" },
  { id: "ad_left", label: AD_PLACEMENT_LABELS.ad_left },
  { id: "ad_right", label: AD_PLACEMENT_LABELS.ad_right },
  { id: "ad_bottom", label: AD_PLACEMENT_LABELS.ad_bottom },
]

// 광고 자리별 권장 이미지 크기 (홈 화면에 보이는 폭의 2배)
const AD_SIZE_HINT: Record<AdPlacement, string> = {
  ad_left: "사진 칸은 가로 4 : 세로 5 (권장 800×1000)이고, 칸 폭은 고정이라 다른 비율은 남는 곳이 검게 보입니다. 글은 사진 아래에 붙습니다.",
  ad_right: "사진 칸은 가로 4 : 세로 5 (권장 800×1000)이고, 칸 폭은 고정이라 다른 비율은 남는 곳이 검게 보입니다. 글은 사진 아래에 붙습니다.",
  ad_bottom: "칸 높이는 고정(PC 160)입니다. 글이 있으면 사진은 글 오른쪽 남은 칸(PC 약 950×145, 권장 1900×290), 글 없이 사진만이면 칸 전체(권장 2400×290)에 잘리지 않고 원래 비율로 들어갑니다. 비율이 다르면 남는 곳은 비어 보입니다.",
}

const EMPTY_FORM: FormState = {
  name: "",
  placement: "modal",
  template: "image",
  title: "",
  body: "",
  imageUrl: "",
  mobileImageUrl: "",
  linkUrl: "",
  linkLabel: "",
  linkNewTab: false,
  pages: "home",
  audience: "all",
  device: "all",
  dismiss: "today",
  priority: "0",
  startsAt: "",
  endsAt: "",
  status: "draft",
  contractId: "",
}

const emptyForm = (section: Section): FormState =>
  isAdPlacement(section) ? { ...EMPTY_FORM, placement: section, template: "image", pages: "home", dismiss: "none" } : { ...EMPTY_FORM, placement: section }

const SECTION_DESC: Record<"modal" | "bar", string> = {
  modal: "사이트에 들어오면 화면 가운데 뜨는 공지 팝업을 정합니다. 조건이 맞는 것이 여러 개면 우선순위가 가장 높은 것 하나만 뜨고, 한 번 방문하는 동안에는 다시 뜨지 않습니다. 종료 일시가 지나면 저절로 내려갑니다.",
  bar: "화면 아래에 붙는 띠 배너를 정합니다. 조건이 맞는 것이 여러 개면 우선순위가 가장 높은 것 하나만 보이고, 종료 일시가 지나면 저절로 내려갑니다.",
}

// ISO → datetime-local 입력값 (브라우저 시간대)
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""

// 게시 상태 + 기간으로 지금 실제로 뜨는지
function liveState(n: SiteNotice): { label: string; className: string } {
  if (n.status !== "published") return { label: NOTICE_STATUS_LABELS[n.status], className: "text-zinc-500" }
  const now = Date.now()
  if (n.startsAt && new Date(n.startsAt).getTime() > now) return { label: "예약됨", className: "text-sky-400" }
  if (n.endsAt && new Date(n.endsAt).getTime() <= now) return { label: "기간 끝남", className: "text-zinc-500" }
  return { label: "노출 중", className: "text-emerald-400 font-bold" }
}

function Field({ label, children, wide, hint }: { label: string; children: React.ReactNode; wide?: boolean; hint?: string }) {
  return (
    <label className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

function Select<T extends string>({ value, labels, onChange }: { value: T; labels: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {(Object.keys(labels) as T[]).map((k) => (
        <option key={k} value={k}>{labels[k]}</option>
      ))}
    </select>
  )
}

// 이미지 올리기: 공통 칸(components/admin/image-upload-field.tsx)에 공지용 형식·크기 검사를 붙여 씀
function ImageUploadField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return <SharedImageUploadField {...props} target="notices" upload={uploadNoticeImage} />
}

function LinkFields({ form, set }: { form: FormState; set: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  return (
    <div className="space-y-1.5">
      <Field label="누르면 이동할 주소 (https:// 또는 /)" hint="비우면 눌러도 이동하지 않습니다.">
        <input className={inputClass} value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="예: /funding" />
      </Field>
      <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
        <input type="checkbox" checked={form.linkNewTab} onChange={(e) => set("linkNewTab", e.target.checked)} />
        새 창으로 열기 (다른 사이트로 보낼 때)
      </label>
    </div>
  )
}

export function SiteNoticeManager() {
  const [section, setSection] = useState<Section>("modal")
  const [contracts, setContracts] = useState<B2bContract[]>([])
  const [notices, setNotices] = useState<SiteNotice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [editingId, setEditingId] = useState<number | "new" | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<"pc" | "mobile">("pc")

  const load = async () => {
    setIsLoading(true)
    setLoadError("")
    try {
      setNotices(await fetchAdminSiteNotices())
      // 계약 목록 (공지·광고에 계약을 붙일 때). 못 받아도 공지 관리는 그대로
      const c = await fetchContracts()
      if (c.success) setContracts(c.contracts)
    } catch (e: any) {
      setLoadError(e?.message || "공지 목록을 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const openEdit = (n: SiteNotice) => {
    setForm({
      name: n.name,
      placement: n.placement,
      template: n.template,
      title: n.title,
      body: n.body,
      imageUrl: n.imageUrl || "",
      mobileImageUrl: n.mobileImageUrl || "",
      linkUrl: n.linkUrl || "",
      linkLabel: n.linkLabel,
      linkNewTab: n.linkNewTab,
      pages: n.pages,
      audience: n.audience,
      device: n.device,
      dismiss: n.dismiss,
      priority: String(n.priority),
      startsAt: toLocalInput(n.startsAt),
      endsAt: toLocalInput(n.endsAt),
      status: n.status,
      contractId: n.contractId ? String(n.contractId) : "",
    })
    setErrors([])
    setPreviewOpen(false)
    setEditingId(n.id)
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setIsSaving(true)
    const input = {
      ...form,
      priority: Number(form.priority) || 0,
      imageUrl: form.imageUrl || null,
      mobileImageUrl: form.mobileImageUrl || null,
      linkUrl: form.linkUrl || null,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      contractId: form.contractId ? Number(form.contractId) : null,
    }
    try {
      if (editingId === "new") await createSiteNotice(input)
      else if (editingId) await updateSiteNotice(editingId, input)
      setEditingId(null)
      load()
    } catch (err: any) {
      setErrors([err?.message || "저장하지 못했습니다."])
    } finally {
      setIsSaving(false)
    }
  }

  const changeStatus = async (n: SiteNotice, status: NoticeStatus) => {
    try {
      await updateSiteNotice(n.id, { status })
      load()
    } catch (err: any) {
      alert(err?.message || "상태를 바꾸지 못했습니다.")
    }
  }

  const remove = async (n: SiteNotice) => {
    if (!confirm(`"${n.name}" ${isAdPlacement(n.placement) ? "광고" : "공지"}를 삭제할까요? 노출·클릭 기록도 함께 지워집니다.`)) return
    try {
      await deleteSiteNotice(n.id)
      load()
    } catch (err: any) {
      alert(err?.message || "삭제하지 못했습니다.")
    }
  }

  const isAd = isAdPlacement(section)
  const sectionLabel = SECTIONS.find((t) => t.id === section)?.label || ""
  const shown = notices.filter((n) => n.placement === section)
  const liveModals = notices.filter((n) => n.placement === "modal" && liveState(n).label === "노출 중")
  const liveAds = isAd ? shown.filter((n) => liveState(n).label === "노출 중") : []
  const contractById = new Map(contracts.map((c) => [c.id, c]))
  // 계약을 고르면 계약 기간을 노출 기간으로 채움 (종료일 밤 12시에 내려감)
  const pickContract = (id: string) => {
    const c = contractById.get(Number(id))
    setForm((prev) => {
      if (!c) return { ...prev, contractId: "" }
      const period = contractPeriod(c.startsOn, c.endsOn)
      return { ...prev, contractId: id, startsAt: toLocalInput(period.startsAt), endsAt: toLocalInput(period.endsAt) }
    })
  }
  const isImage = form.template === "image"
  const isBar = form.placement === "bar"
  const previewContent = {
    template: form.template,
    title: form.title,
    body: form.body,
    imageUrl: form.imageUrl || null,
    mobileImageUrl: form.mobileImageUrl || null,
    linkUrl: form.linkUrl || null,
    linkLabel: form.linkLabel,
    linkNewTab: form.linkNewTab,
    dismiss: form.dismiss,
  }
  // 광고 미리보기: 홈 광고 자리 모양 그대로 (이미지가 없으면 빈 광고 자리)
  const adPreview = form.imageUrl
    ? { id: 0, placement: form.placement, template: "image" as const, title: form.title, body: form.body, imageUrl: previewDevice === "mobile" ? form.mobileImageUrl || form.imageUrl : form.imageUrl, mobileImageUrl: null, linkUrl: form.linkUrl || null, linkLabel: form.linkLabel, linkNewTab: true, pages: "home" as const, audience: "all" as const, device: "all" as const, dismiss: "none" as const, priority: 0, startsAt: null, endsAt: null }
    : null

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-semibold text-lg text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-zinc-400" />
              <span>{sectionLabel}</span>
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isAd
                ? "홈 화면 광고 자리에 걸 광고 이미지와 링크를 정합니다. 걸린 광고가 없으면 빈 광고 자리와 '광고 제휴 문의' 버튼만 보이고, 여러 개면 우선순위 순으로 8초마다 돌아갑니다. 종료 일시가 지나면 저절로 내려갑니다."
                : SECTION_DESC[section as "modal" | "bar"]}
            </p>
            {isAd && <p className="text-xs text-zinc-500 mt-1">지금 걸린 광고 {liveAds.length}개</p>}
            {section === "modal" && liveModals.length > 1 && (
              <p className="text-xs text-amber-400 mt-1">
                지금 노출 중인 공지 팝업이 {liveModals.length}개입니다. 같은 조건의 방문자에게는 우선순위가 가장 높은 &ldquo;{liveModals[0].name}&rdquo;만 뜹니다.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={load} className="bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 rounded-xl">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              새로고침
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setForm(emptyForm(section))
                setErrors([])
                setPreviewOpen(false)
                setEditingId("new")
              }}
              className="bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {isAd ? "새 광고 등록" : "새 공지 등록"}
            </Button>
          </div>
        </div>

        {/* 안쪽 탭: 공지 팝업 / 하단 띠 배너 / 좌측·우측·하단 배너 */}
        <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-3">
          {SECTIONS.map((t) => {
            const count = notices.filter((n) => n.placement === t.id).length
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={section === t.id}
                onClick={() => {
                  setSection(t.id)
                  setEditingId(null)
                  setPreviewOpen(false)
                }}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  section === t.id ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                {t.label} <span className={section === t.id ? "text-zinc-500" : "text-zinc-600"}>{count}</span>
              </button>
            )
          })}
        </div>

        {editingId !== null && (
          <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="text-sm font-semibold text-white">
              {editingId === "new" ? `새로 등록 (${sectionLabel})` : `${isAd ? "광고" : "공지"} 수정: ${form.name}`}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="관리용 이름 (사용자에게 안 보임)" wide>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={isAd ? "예: OO 팝업 11월 왼쪽 광고" : "예: 10월 굿즈 펀딩 오픈 안내"}
                  required
                />
              </Field>
              {!isAd && (
                <>
                  <Field label="디자인">
                    <Select value={form.template} labels={NOTICE_TEMPLATE_LABELS} onChange={(v) => set("template", v)} />
                  </Field>
                </>
              )}

              {isAd ? (
                <>
                  <div className="sm:col-span-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl p-3 leading-relaxed">
                    광고 사진과 글(선택)을 넣습니다. 사진이나 글을 누르면 아래 주소로 이동합니다. 사진 크기와 상관없이 광고 칸 크기는 그대로입니다.
                    <br />
                    {AD_SIZE_HINT[section as AdPlacement]} JPG·PNG·WEBP·GIF, 5MB 이하.
                  </div>
                  <ImageUploadField label="광고 이미지 (필수)" value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
                  <ImageUploadField label="모바일 이미지 (선택)" value={form.mobileImageUrl} onChange={(v) => set("mobileImageUrl", v)} />
                  <Field label="광고 제목 (선택)" hint="사진 아래(아래 칸은 사진 옆)에 굵게 보이고, 이미지 설명으로도 읽힙니다. 두 줄 넘으면 줄임표로 잘립니다.">
                    <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="예: 철인 캉타우 50주년 기념 도록 특별전" />
                  </Field>
                  <Field label="설명 문구 (선택)" hint="네 줄 넘으면 줄임표로 잘립니다.">
                    <textarea className={inputClass} rows={3} value={form.body} onChange={(e) => set("body", e.target.value)} maxLength={300} placeholder="예: 한국만화박물관(부천)에서 열리는 특별전" />
                  </Field>
                  <Field label="바로가기 문구 (선택)">
                    <input className={inputClass} value={form.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} maxLength={40} placeholder="비우면 자세히 보기" />
                  </Field>
                  <LinkFields form={form} set={set} />
                </>
              ) : isImage ? (
                <>
                  <div className="sm:col-span-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl p-3 leading-relaxed">
                    디자이너가 만든 이미지를 그대로 올립니다. 글자·버튼까지 이미지 안에 넣고, 이미지 전체를 누르면 아래 주소로 이동합니다.
                    <br />
                    {isBar
                      ? "권장 크기: PC 1920×120, 모바일 750×160 (가로로 꽉 차고 위아래가 넘치면 잘림, 중요한 내용은 가운데). JPG·PNG·WEBP·GIF, 5MB 이하."
                      : "권장 크기: 가로 880 × 세로 1000~1200 (화면에 가로 440으로 보임, 2배로 만들면 선명). 모바일 이미지를 따로 안 올리면 PC 이미지를 씁니다. JPG·PNG·WEBP·GIF, 5MB 이하."}
                  </div>
                  <ImageUploadField label="PC 이미지 (필수)" value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
                  <ImageUploadField label="모바일 이미지 (선택)" value={form.mobileImageUrl} onChange={(v) => set("mobileImageUrl", v)} />
                  <Field label="이미지 설명 (대체 텍스트)" hint="이미지가 안 뜰 때와 화면 낭독기에서 읽힙니다. 이미지 속 문구를 짧게 적어 주세요.">
                    <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="예: 10월 굿즈 펀딩 오픈, 선착순 한정" />
                  </Field>
                  <LinkFields form={form} set={set} />
                </>
              ) : (
                <>
                  <Field label={isBar ? "배너 문구" : "제목"} wide>
                    <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
                  </Field>
                  <Field label={isBar ? "보조 문구 (PC에서만 보임)" : "본문"} wide>
                    <textarea className={inputClass} rows={isBar ? 1 : 4} value={form.body} onChange={(e) => set("body", e.target.value)} maxLength={2000} />
                  </Field>
                  <ImageUploadField
                    label={isBar ? "아이콘 이미지 (선택)" : "위쪽 이미지 (선택, 가로형)"}
                    value={form.imageUrl}
                    onChange={(v) => set("imageUrl", v)}
                  />
                  <Field label="버튼 문구">
                    <input className={inputClass} value={form.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} maxLength={40} placeholder="비우면 자세히 보기" />
                  </Field>
                  <LinkFields form={form} set={set} />
                </>
              )}

              {!isAd && (
                <>
                  <Field label="노출 화면">
                    <Select value={form.pages} labels={NOTICE_PAGES_LABELS} onChange={(v) => set("pages", v)} />
                  </Field>
                  <Field label="대상">
                    <Select value={form.audience} labels={NOTICE_AUDIENCE_LABELS} onChange={(v) => set("audience", v)} />
                  </Field>
                  <Field label="기기">
                    <Select value={form.device} labels={NOTICE_DEVICE_LABELS} onChange={(v) => set("device", v)} />
                  </Field>
                  <Field label="보지 않기 선택지" hint={form.placement === "bar" ? "띠 배너는 닫으면 이 기간 동안 안 보입니다." : undefined}>
                    <Select value={form.dismiss} labels={NOTICE_DISMISS_LABELS} onChange={(v) => set("dismiss", v)} />
                  </Field>
                </>
              )}
              <Field
                label="계약 (선택)"
                wide
                hint={
                  form.contractId
                    ? "계약 기간이 노출 기간으로 들어갔습니다. 계약 기간을 고치거나 취소하면 여기 기간도 따라 바뀌고, 종료일 밤 12시에 저절로 내려갑니다."
                    : "B2B 제휴 › 계약·광고 기간에 추가한 계약을 고르면 그 기간 동안만 걸립니다."
                }
              >
                <select className={inputClass} value={form.contractId} onChange={(e) => pickContract(e.target.value)}>
                  <option value="">계약 없음 (기간을 직접 정함)</option>
                  {contracts
                    .filter((c) => c.status === "active" || String(c.id) === form.contractId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.brandName} · {c.title} ({c.startsOn} ~ {c.endsOn}, {CONTRACT_PERIOD_LABELS[c.period]})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="우선순위 (클수록 먼저, -1000~1000)">
                <input className={inputClass} type="number" min={-1000} max={1000} value={form.priority} onChange={(e) => set("priority", e.target.value)} />
              </Field>
              <Field label="시작 일시 (비우면 바로)">
                <DatePicker withTime className={inputClass} value={form.startsAt} onChange={(v) => set("startsAt", v)} placeholder="바로 시작" />
              </Field>
              <Field label="종료 일시 (비우면 계속)">
                <DatePicker withTime className={inputClass} value={form.endsAt} onChange={(v) => set("endsAt", v)} placeholder="계속 노출" />
              </Field>
              <Field label="상태" hint="게시로 두면 기간 안에서만 뜹니다.">
                <Select value={form.status} labels={NOTICE_STATUS_LABELS} onChange={(v) => set("status", v)} />
              </Field>
            </div>

            {(
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-zinc-300 hover:text-white"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewOpen ? "미리보기 닫기" : "미리보기"}
                </button>
                {previewOpen && (
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-dashed border-zinc-700 space-y-3">
                    <div className="flex gap-2 text-xs font-bold">
                      {(["pc", "mobile"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPreviewDevice(d)}
                          className={`px-3 py-1 rounded-full ${previewDevice === d ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
                        >
                          {d === "pc" ? "PC" : "모바일"}
                        </button>
                      ))}
                    </div>
                    <div className={`mx-auto ${previewDevice === "mobile" ? "max-w-[390px]" : ""}`}>
                      {isAd ? (
                        section === "ad_bottom" ? (
                          <BottomAdSlot preview={adPreview} />
                        ) : (
                          <div className="flex justify-center">
                            <WingAdSlot slot={section as "ad_left" | "ad_right"} preview={adPreview} className={previewDevice === "pc" ? "!w-60" : ""} />
                          </div>
                        )
                      ) : form.placement === "modal" ? (
                        <SiteNoticeModal preview={previewDevice} notice={previewContent} onClose={() => setPreviewOpen(false)} />
                      ) : (
                        <SiteNoticeBar preview={previewDevice} notice={previewContent} onClose={() => setPreviewOpen(false)} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <ul className="text-xs text-red-400 space-y-1 list-disc pl-5">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold">
                취소
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
                {isSaving ? "저장 중..." : editingId === "new" ? "등록" : "수정 저장"}
              </button>
            </div>
          </form>
        )}

        {loadError && <div className="text-xs text-red-400">{loadError}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-bold bg-zinc-950">
                <th className="p-3.5">이름</th>
                <th className="p-3.5">{isAd ? "계약" : "화면"}</th>
                <th className="p-3.5">{isAd ? "이동 주소" : "대상"}</th>
                <th className="p-3.5">기간</th>
                <th className="p-3.5">우선순위</th>
                <th className="p-3.5">상태</th>
                <th className="p-3.5">노출 / 클릭</th>
                <th className="p-3.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">불러오는 중...</td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    {isAd ? "등록된 광고가 없습니다. 지금 홈에는 빈 광고 자리와 '광고 제휴 문의' 버튼만 보입니다." : "등록된 공지가 없습니다."}
                  </td>
                </tr>
              ) : (
                shown.map((n) => {
                  const live = liveState(n)
                  const contract = n.contractId ? contractById.get(n.contractId) : undefined
                  return (
                    <tr key={n.id}>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {n.imageUrl && (
                            <img src={n.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-zinc-950" />
                          )}
                          <div>
                            <div className="font-bold text-white">{n.name}</div>
                            <div className="text-xs text-zinc-500">
                              {n.template === "image" ? "이미지형" : n.template === "basic" ? "텍스트형" : "기존 디자인"}
                              {n.title ? ` · ${n.title}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      {isAd ? (
                        <>
                          <td className="p-3.5 text-zinc-300">
                            {contract ? `${contract.code} · ${contract.brandName}` : n.contractId ? `C-${n.contractId} (삭제된 계약)` : "없음"}
                            {contract && <div className="text-xs text-zinc-500">{contract.title}</div>}
                          </td>
                          <td className="p-3.5 text-zinc-400 max-w-[200px] truncate">{n.linkUrl || "없음"}</td>
                        </>
                      ) : (
                        <>
                          <td className="p-3.5 text-zinc-300 whitespace-nowrap">
                            {NOTICE_PAGES_LABELS[n.pages]}
                            {contract && <div className="text-xs text-zinc-500">계약 {contract.code} · {contract.brandName}</div>}
                          </td>
                          <td className="p-3.5 text-zinc-300 whitespace-nowrap">
                            {NOTICE_AUDIENCE_LABELS[n.audience]}
                            <div className="text-xs text-zinc-500">{NOTICE_DEVICE_LABELS[n.device]}</div>
                          </td>
                        </>
                      )}
                      <td className="p-3.5 text-zinc-300 whitespace-nowrap">
                        {n.startsAt || n.endsAt ? `${formatDate(n.startsAt) || "바로"} ~ ${formatDate(n.endsAt) || "계속"}` : "기간 없음"}
                      </td>
                      <td className="p-3.5 text-zinc-300">{n.priority}</td>
                      <td className={`p-3.5 whitespace-nowrap ${live.className}`}>{live.label}</td>
                      <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                        {n.viewCount.toLocaleString()} / {n.clickCount.toLocaleString()}
                        {n.viewCount > 0 && <div className="text-xs text-zinc-500">클릭률 {((n.clickCount / n.viewCount) * 100).toFixed(1)}%</div>}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-3">
                        {n.status === "published" ? (
                          <button onClick={() => changeStatus(n, "hidden")} className="text-zinc-400 hover:text-white">숨김</button>
                        ) : (
                          <button onClick={() => changeStatus(n, "published")} className="text-emerald-400 hover:text-emerald-300 font-bold">게시</button>
                        )}
                        <button onClick={() => openEdit(n)} className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
                          <Pencil className="w-3.5 h-3.5" />
                          수정
                        </button>
                        <button onClick={() => remove(n)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

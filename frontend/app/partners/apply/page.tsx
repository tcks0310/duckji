"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AttachmentField, EmailField, FieldLabel, fieldClass, type Attachment } from "@/components/store/inquiry-fields"
import { DatePicker, todayYmd } from "@/components/ui/date-picker"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { AD_SLOTS, APPLY_KIND_LABELS, SLOT_LABELS, submitB2bApplication, type AdSlot, type ApplyKind } from "@/lib/b2b-service"

// 파트너 › 팝업 주최사 제휴 입점·광고 신청 (/partners/apply)
// 예전 입점 신청 창(partner-registration-modal)을 페이지로 옮김. 홈 광고 자리·푸터·사이드 탭의 '광고 제휴 문의'가 여기로 옴
// 접수 건은 관리자 센터 › 파트너 및 운영 › B2B 제휴 관리에서 확인하고 계약·광고 기간을 붙임

const SLOT_DESC: Record<AdSlot, string> = {
  ad_left: "홈 화면 왼쪽에 세로로 떠 있는 칸",
  ad_right: "홈 화면 오른쪽에 세로로 떠 있는 칸",
  ad_bottom: "홈 화면 아래 가로 배너",
  modal: "사이트에 들어오면 뜨는 공지 팝업",
  bar: "화면 아래에 붙는 띠 배너",
}

const KIND_DESC: Record<ApplyKind, string> = {
  listing: "덕지 팝업 목록·지도에 행사를 올려요",
  ad: "홈 광고 자리나 공지 팝업에 광고를 걸어요",
  both: "행사를 올리고 광고도 함께 걸어요",
}

const EVENT_TYPES = [
  { value: "popup", label: "애니메이션·캐릭터 팝업스토어" },
  { value: "cafe", label: "콜라보 카페·생일 카페" },
  { value: "exhibition", label: "전시회·미디어아트" },
  { value: "goods", label: "상설 굿즈샵·브랜드 스토어" },
  { value: "etc", label: "그 밖의 행사·브랜드" },
]

type Form = {
  applyKind: ApplyKind
  brandName: string
  eventType: string
  eventName: string
  eventFrom: string
  eventUntil: string
  location: string
  linkUrl: string
  content: string
  keywords: string
  nativeBooking: boolean
  adSlots: AdSlot[]
  adFrom: string
  adUntil: string
  budget: string
  managerName: string
  managerCompany: string
  managerPhone: string
  managerEmail: string
  privacyAgreed: boolean
  website: string // 봇 막기용 숨은 칸
}

const EMPTY: Form = {
  applyKind: "listing",
  brandName: "",
  eventType: "popup",
  eventName: "",
  eventFrom: "",
  eventUntil: "",
  location: "",
  linkUrl: "",
  content: "",
  keywords: "",
  nativeBooking: false,
  adSlots: [],
  adFrom: "",
  adUntil: "",
  budget: "",
  managerName: "",
  managerCompany: "",
  managerPhone: "",
  managerEmail: "",
  privacyAgreed: false,
  website: "",
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-700 bg-white/[0.03] p-5 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {desc && <p className="text-sm text-zinc-400">{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function PeriodField({ label, from, until, onChange }: { label: string; from: string; until: string; onChange: (from: string, until: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <DatePicker
          aria-label={`${label} 시작일`}
          placeholder="시작일"
          min={todayYmd()}
          value={from}
          onChange={(v) => onChange(v, until && until < v ? v : until)}
          className={`${fieldClass} min-w-0`}
        />
        <span className="text-zinc-500 shrink-0">~</span>
        <DatePicker
          aria-label={`${label} 종료일`}
          placeholder="종료일"
          min={from || todayYmd()}
          value={until}
          onChange={(v) => onChange(from, v)}
          className={`${fieldClass} min-w-0`}
        />
      </div>
    </div>
  )
}

export default function PartnerApplyPage() {
  const shortcuts = useMyPageShortcuts()
  const [form, setForm] = useState<Form>(EMPTY)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ code: string; email: string } | null>(null)

  // 광고 자리의 '광고 제휴 문의'로 오면 (?slot=ad_left 등) 광고 신청으로 그 자리를 골라 둠
  useEffect(() => {
    const slot = new URLSearchParams(window.location.search).get("slot")
    if (slot && (AD_SLOTS as string[]).includes(slot)) setForm((f) => ({ ...f, applyKind: "ad", adSlots: [slot as AdSlot] }))
  }, [])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const onBusy = useCallback((b: boolean) => setUploading(b), [])
  const wantsAd = form.applyKind !== "listing"
  const toggleSlot = (slot: AdSlot) =>
    set("adSlots", form.adSlots.includes(slot) ? form.adSlots.filter((s) => s !== slot) : [...form.adSlots, slot])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || uploading) return
    setError("")
    if (!form.managerEmail) return setError("이메일 아이디와 도메인을 모두 입력해 주세요.")
    if (wantsAd && form.adSlots.length === 0) return setError("원하는 광고 자리를 하나 이상 골라 주세요.")
    if (form.linkUrl && !/^https?:\/\//i.test(form.linkUrl)) return setError("공식 링크는 https:// 로 시작하게 적어 주세요.")
    if (!form.privacyAgreed) return setError("개인정보 수집·이용에 동의해 주세요.")
    setSubmitting(true)
    const result = await submitB2bApplication({
      applyKind: form.applyKind,
      brandName: form.brandName,
      eventType: form.eventType,
      eventName: form.eventName,
      eventFrom: form.eventFrom || null,
      eventUntil: form.eventUntil || null,
      location: form.location,
      linkUrl: form.linkUrl,
      content: form.content,
      keywords: form.keywords,
      nativeBooking: form.nativeBooking,
      adSlots: wantsAd ? form.adSlots : [],
      adFrom: wantsAd ? form.adFrom || null : null,
      adUntil: wantsAd ? form.adUntil || null : null,
      budget: wantsAd ? form.budget : "",
      placementWish: wantsAd ? form.adSlots.map((s) => SLOT_LABELS[s]).join(", ") : "",
      attachments: attachments.map((a) => a.url),
      managerName: form.managerName,
      managerCompany: form.managerCompany,
      managerPhone: form.managerPhone,
      managerEmail: form.managerEmail,
      privacyAgreed: form.privacyAgreed,
      ...(form.website ? { website: form.website } : {}),
    })
    setSubmitting(false)
    if (!result.success) return setError(result.errors.join(" "))
    setDone({ code: result.application?.code || "", email: form.managerEmail })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <Navbar activeTab="" setActiveTab={() => {}} {...shortcuts} searchQuery="" setSearchQuery={() => {}} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-20 space-y-6 app-nav-offset">
        <nav aria-label="현재 위치" className="text-sm text-zinc-500">
          <span>파트너</span>
          <span className="mx-1.5">›</span>
          <span className="text-zinc-300">입점·광고 신청</span>
        </nav>

        {done ? (
          <div className="rounded-xl border border-zinc-700 bg-white/[0.03] px-6 py-12 text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">신청서를 받았어요</h1>
              <p className="text-base text-zinc-300 leading-relaxed break-keep">
                담당자가 확인한 뒤 <strong className="text-white">{done.email}</strong> 또는 남겨 주신 연락처로 진행 방법과 견적을 안내해 드립니다.
              </p>
            </div>
            {done.code && (
              <div className="inline-block rounded-xl border border-zinc-700 px-6 py-4">
                <p className="text-sm text-zinc-400">접수 번호</p>
                <p className="text-2xl font-bold text-white tracking-wide tabular-nums">{done.code}</p>
                <p className="text-xs text-zinc-500 mt-1">문의할 때 이 번호를 알려 주세요.</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <a href="/" className="px-5 py-3 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
                홈으로
              </a>
              <button
                onClick={() => {
                  setDone(null)
                  setForm(EMPTY)
                  setAttachments([])
                }}
                className="px-5 py-3 rounded-full border border-zinc-600 hover:border-zinc-400 text-zinc-100 text-sm font-semibold"
              >
                새 신청서 쓰기
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">팝업 주최사 제휴 입점·광고 신청</h1>
              <p className="text-base text-zinc-400 leading-relaxed break-keep">
                행사와 광고 정보, 담당자 연락처를 남겨 주시면 담당자가 확인해 연락드립니다. 사이트에서 결제하지 않아요.
              </p>
            </header>

            <form onSubmit={submit} className="space-y-5">
              {/* 봇 막기: 사람에게는 보이지 않는 칸 */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              <Section title="신청 종류">
                <div role="radiogroup" className="grid sm:grid-cols-3 gap-2">
                  {(Object.keys(APPLY_KIND_LABELS) as ApplyKind[]).map((k) => (
                    <label
                      key={k}
                      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                        form.applyKind === k ? "border-emerald-400 bg-emerald-400/5" : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="applyKind"
                        checked={form.applyKind === k}
                        onChange={() => set("applyKind", k)}
                        className="mt-1 accent-emerald-400"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-zinc-100">{APPLY_KIND_LABELS[k]}</span>
                        <span className="block text-xs text-zinc-400 break-keep">{KIND_DESC[k]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Section>

              <Section title="행사 정보" desc="정해지지 않은 칸은 비워 두셔도 됩니다.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="p-brand" required>
                      주최사·브랜드명
                    </FieldLabel>
                    <input
                      id="p-brand"
                      required
                      maxLength={100}
                      placeholder="예: 덕지엔터테인먼트"
                      value={form.brandName}
                      onChange={(e) => set("brandName", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-type">행사 종류</FieldLabel>
                    <select id="p-type" value={form.eventType} onChange={(e) => set("eventType", e.target.value)} className={fieldClass}>
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="p-event" required>
                    {wantsAd && form.applyKind === "ad" ? "행사·광고 이름" : "행사 이름"}
                  </FieldLabel>
                  <input
                    id="p-event"
                    required
                    maxLength={200}
                    placeholder="예: OO 애니메이션 10주년 팝업스토어 in 성수"
                    value={form.eventName}
                    onChange={(e) => set("eventName", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <PeriodField
                  label="행사 기간"
                  from={form.eventFrom}
                  until={form.eventUntil}
                  onChange={(from, until) => setForm((f) => ({ ...f, eventFrom: from, eventUntil: until }))}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="p-location">행사 장소</FieldLabel>
                    <input
                      id="p-location"
                      maxLength={300}
                      placeholder="예: 서울 성동구 연무장길 OO, 더현대 서울 B1"
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-link">공식 링크</FieldLabel>
                    <input
                      id="p-link"
                      type="url"
                      inputMode="url"
                      maxLength={1000}
                      placeholder="https:// (예약 페이지·공식 SNS 등)"
                      value={form.linkUrl}
                      onChange={(e) => set("linkUrl", e.target.value.trim())}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="p-content">행사 소개</FieldLabel>
                  <textarea
                    id="p-content"
                    rows={4}
                    maxLength={5000}
                    placeholder="행사 소개, 굿즈·특전, 예약 안내 등을 적어 주세요."
                    value={form.content}
                    onChange={(e) => set("content", e.target.value)}
                    className={`${fieldClass} resize-y`}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="p-keywords">키워드</FieldLabel>
                  <input
                    id="p-keywords"
                    maxLength={300}
                    placeholder="쉼표로 나눠 적어 주세요. 예: 주술회전, 콜라보카페, 성수"
                    value={form.keywords}
                    onChange={(e) => set("keywords", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                {form.applyKind !== "ad" && (
                  <label className="flex items-start gap-3 rounded-xl border border-zinc-700 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.nativeBooking}
                      onChange={(e) => set("nativeBooking", e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-400"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-100">덕지 사전 예약·현장 웨이팅 사용 희망</span>
                      <span className="block text-sm text-zinc-400">덕지 안에서 예약과 웨이팅 번호표를 받을 수 있게 연결해 드립니다.</span>
                    </span>
                  </label>
                )}
              </Section>

              {wantsAd && (
                <Section title="광고 정보" desc="원하는 자리와 기간을 골라 주세요. 자리별 비용은 담당자가 안내해 드립니다.">
                  <div>
                    <FieldLabel required>원하는 광고 자리</FieldLabel>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {AD_SLOTS.map((slot) => (
                        <label
                          key={slot}
                          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                            form.adSlots.includes(slot) ? "border-emerald-400 bg-emerald-400/5" : "border-zinc-700 hover:border-zinc-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.adSlots.includes(slot)}
                            onChange={() => toggleSlot(slot)}
                            className="mt-1 w-4 h-4 accent-emerald-400"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-zinc-100">{SLOT_LABELS[slot]}</span>
                            <span className="block text-xs text-zinc-400">{SLOT_DESC[slot]}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <PeriodField
                    label="희망 광고 기간"
                    from={form.adFrom}
                    until={form.adUntil}
                    onChange={(from, until) => setForm((f) => ({ ...f, adFrom: from, adUntil: until }))}
                  />
                  <div>
                    <FieldLabel htmlFor="p-budget">예산</FieldLabel>
                    <input
                      id="p-budget"
                      maxLength={100}
                      placeholder="예: 월 50만 원 안팎, 협의"
                      value={form.budget}
                      onChange={(e) => set("budget", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </Section>
              )}

              <Section
                title={wantsAd ? "포스터·광고 시안" : "포스터·행사 사진"}
                desc="있으면 올려 주세요. 담당자만 볼 수 있어요."
              >
                <AttachmentField value={attachments} onChange={setAttachments} onBusyChange={onBusy} />
              </Section>

              <Section title="담당자 연락처" desc="진행 안내와 견적을 받을 연락처를 적어 주세요.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="p-name" required>
                      담당자 이름
                    </FieldLabel>
                    <input
                      id="p-name"
                      required
                      maxLength={100}
                      placeholder="예: 김덕지 매니저"
                      value={form.managerName}
                      onChange={(e) => set("managerName", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-company">소속</FieldLabel>
                    <input
                      id="p-company"
                      maxLength={100}
                      placeholder="주최사와 다를 때 (대행사 등)"
                      value={form.managerCompany}
                      onChange={(e) => set("managerCompany", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-phone" required>
                      연락처
                    </FieldLabel>
                    <input
                      id="p-phone"
                      type="tel"
                      required
                      inputMode="tel"
                      placeholder="010-1234-5678"
                      value={form.managerPhone}
                      onChange={(e) => set("managerPhone", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="p-email" required>
                    이메일
                  </FieldLabel>
                  <EmailField id="p-email" value={form.managerEmail} onChange={(v) => set("managerEmail", v)} />
                </div>
              </Section>

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.privacyAgreed}
                    onChange={(e) => set("privacyAgreed", e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-400"
                  />
                  <span>[필수] 입점·광고 상담을 위해 담당자 이름·연락처·이메일을 모으고 쓰는 데 동의합니다.</span>
                </label>
                {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full py-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-base font-semibold disabled:opacity-60"
                >
                  {submitting ? "보내는 중..." : uploading ? "사진 올리는 중..." : "신청서 제출하기"}
                </button>
                <p className="text-center text-sm text-zinc-500">
                  궁금한 점은{" "}
                  <a href="mailto:inc.siaa@gmail.com" className="text-zinc-300 underline underline-offset-4">
                    inc.siaa@gmail.com
                  </a>
                  으로 보내 주세요.
                </p>
              </div>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

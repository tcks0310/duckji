"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, ImageOff, Minus, Plus, Trash2 } from "lucide-react"

import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { AttachmentField, EmailField, FieldLabel, fieldClass, type Attachment } from "@/components/store/inquiry-fields"
import { loadQuoteCart, saveQuoteCart, SUPPLY_TYPES, type QuoteCartItem, type SupplyType } from "@/lib/mall"
import { submitInquiry } from "@/lib/store-inquiries"
import { DatePicker } from "@/components/ui/date-picker"

// 스토어 › 덕지몰 › 견적 신청 (/store/mall/quote)
// 덕지몰에서 담은 품목(견적함)과 일정·장소·첨부를 받아 접수 → 관리자 센터 '덕지몰 관리'에서 품목별로 확인
// 품목 없이 일반 문의로도 보낼 수 있음

const todayStr = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type Form = {
  companyName: string
  contactName: string
  phone: string
  email: string
  eventStart: string
  eventEnd: string
  installDate: string
  eventLocation: string
  needInstallService: boolean
  notes: string
  website: string // 봇 막기용 숨은 칸
}

const EMPTY: Form = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  eventStart: "",
  eventEnd: "",
  installDate: "",
  eventLocation: "",
  needInstallService: false,
  notes: "",
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

export default function MallQuotePage() {
  const [cart, setCart] = useState<QuoteCartItem[]>([])
  const [form, setForm] = useState<Form>(EMPTY)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ code: string; email: string; count: number } | null>(null)

  useEffect(() => setCart(loadQuoteCart()), [])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const updateCart = (next: QuoteCartItem[]) => {
    setCart(next)
    saveQuoteCart(next)
  }
  const onBusy = useCallback((b: boolean) => setUploading(b), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || uploading) return
    setError("")
    if (!form.email) return setError("이메일 아이디와 도메인을 모두 입력해 주세요.")
    if (form.eventStart && form.eventEnd && form.eventEnd < form.eventStart) return setError("행사 종료일이 시작일보다 빠릅니다.")
    if (!cart.length && !form.notes.trim()) return setError("품목 없이 문의할 때는 요청 사항을 적어 주세요.")
    setSubmitting(true)
    const result = await submitInquiry({
      kind: "mall_quote",
      companyName: form.companyName,
      contactName: form.contactName,
      contactPhone: form.phone,
      contactEmail: form.email,
      items: cart.map((c) => ({ id: String(c.id), name: c.name, quantity: c.quantity, serviceType: c.serviceType })),
      details: {
        eventStart: form.eventStart,
        eventEnd: form.eventEnd,
        installDate: form.needInstallService ? form.installDate : "",
        eventLocation: form.eventLocation,
        needInstallService: form.needInstallService,
        attachments: attachments.map((a) => a.url),
      },
      message: form.notes,
      ...(form.website ? { website: form.website } : {}),
    })
    setSubmitting(false)
    if (!result.ok) return setError(result.error)
    setDone({ code: result.code, email: form.email, count: cart.length })
    updateCart([])
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <SubPageHeader groupId="store" itemId="mall" />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-20 space-y-6">
        <Link href="/store/mall" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          덕지몰로 돌아가기
        </Link>

        {done ? (
          <div className="rounded-xl border border-zinc-700 bg-white/[0.03] px-6 py-12 text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">견적 요청을 받았어요</h1>
              <p className="text-base text-zinc-300 leading-relaxed break-keep">
                담당자가 확인한 뒤 <strong className="text-white">{done.email}</strong> 또는 남겨 주신 연락처로 견적서와 일정을 보내 드립니다.
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
              <Link href="/store/mall" className="px-5 py-3 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
                덕지몰로 돌아가기
              </Link>
              <button
                onClick={() => {
                  setDone(null)
                  setForm(EMPTY)
                  setAttachments([])
                }}
                className="px-5 py-3 rounded-full border border-zinc-600 hover:border-zinc-400 text-zinc-100 text-sm font-semibold"
              >
                새 견적 신청하기
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">견적 신청</h1>
              <p className="text-base text-zinc-400 leading-relaxed break-keep">
                일정과 장소를 알려 주시면 담당자가 확인해 견적서를 보내 드립니다. 사이트에서 결제하지 않아요.
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

              <Section
                title="요청 품목"
                desc={cart.length ? `${cart.length}종을 담았어요. 수량과 방식은 여기서 바꿀 수 있어요.` : "담은 품목이 없어 일반 문의로 보냅니다."}
              >
                {cart.length > 0 ? (
                  <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                    {cart.map((c) => (
                      <li key={c.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-3 py-3">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-zinc-800 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                            <ImageOff className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                          <p className="text-xs text-zinc-500">{c.categoryName}</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <select
                            aria-label="공급 방식"
                            value={c.serviceType}
                            onChange={(e) => updateCart(cart.map((x) => (x.id === c.id ? { ...x, serviceType: e.target.value as SupplyType } : x)))}
                            className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-white [color-scheme:dark]"
                          >
                            {SUPPLY_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateCart(cart.map((x) => (x.id === c.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}
                              className="p-1.5 rounded-md bg-zinc-800 text-zinc-300"
                              aria-label="수량 빼기"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              aria-label="수량"
                              value={c.quantity}
                              onChange={(e) =>
                                updateCart(
                                  cart.map((x) => (x.id === c.id ? { ...x, quantity: Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), 9999) } : x))
                                )
                              }
                              className="w-14 bg-zinc-950 border border-zinc-700 rounded-md py-1.5 text-center text-sm text-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateCart(cart.map((x) => (x.id === c.id ? { ...x, quantity: Math.min(x.quantity + 1, 9999) } : x)))}
                              className="p-1.5 rounded-md bg-zinc-800 text-zinc-300"
                              aria-label="수량 더하기"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateCart(cart.filter((x) => x.id !== c.id))}
                            className="p-1.5 text-zinc-500 hover:text-red-400"
                            aria-label={`${c.name} 빼기`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link href="/store/mall" className="inline-block text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4">
                  덕지몰에서 품목 {cart.length ? "더 " : ""}담기
                </Link>
              </Section>

              <Section title="담당자 정보" desc="견적서를 받을 연락처를 적어 주세요.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="q-company" required>
                      회사명·브랜드명
                    </FieldLabel>
                    <input
                      id="q-company"
                      required
                      maxLength={100}
                      placeholder="예: 덕지엔터테인먼트"
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="q-name" required>
                      담당자 이름
                    </FieldLabel>
                    <input
                      id="q-name"
                      required
                      maxLength={100}
                      placeholder="예: 김덕지 매니저"
                      value={form.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="q-phone" required>
                      연락처
                    </FieldLabel>
                    <input
                      id="q-phone"
                      type="tel"
                      required
                      inputMode="tel"
                      placeholder="010-1234-5678"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="q-email" required>
                    이메일
                  </FieldLabel>
                  <EmailField id="q-email" value={form.email} onChange={(v) => set("email", v)} />
                </div>
              </Section>

              <Section title="행사 정보" desc="정해지지 않았다면 비워 두셔도 됩니다.">
                <div>
                  <FieldLabel>행사 기간</FieldLabel>
                  <div className="flex items-center gap-2">
                    <DatePicker
                      aria-label="행사 시작일"
                      placeholder="시작일"
                      min={todayStr()}
                      value={form.eventStart}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, eventStart: v, eventEnd: f.eventEnd && f.eventEnd < v ? v : f.eventEnd }))
                      }}
                      className={`${fieldClass} min-w-0`}
                    />
                    <span className="text-zinc-500 shrink-0">~</span>
                    <DatePicker
                      aria-label="행사 종료일"
                      placeholder="종료일"
                      min={form.eventStart || todayStr()}
                      value={form.eventEnd}
                      onChange={(v) => set("eventEnd", v)}
                      className={`${fieldClass} min-w-0`}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="q-location">행사 장소</FieldLabel>
                  <input
                    id="q-location"
                    maxLength={200}
                    placeholder="예: 성수동 OO빌딩 1층, 더현대 서울 B1"
                    value={form.eventLocation}
                    onChange={(e) => set("eventLocation", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-zinc-700 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.needInstallService}
                    onChange={(e) => set("needInstallService", e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-400"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-zinc-100">현장 설치·철거 필요</span>
                    <span className="block text-sm text-zinc-400">장소와 일정을 보고 가능 여부와 비용을 함께 안내합니다.</span>
                  </span>
                </label>
                {form.needInstallService && (
                  <div>
                    <FieldLabel htmlFor="q-install">설치 희망일</FieldLabel>
                    <DatePicker
                      id="q-install"
                      min={todayStr()}
                      max={form.eventEnd || undefined}
                      value={form.installDate}
                      onChange={(v) => set("installDate", v)}
                      wrapperClassName="w-full sm:max-w-xs"
                      className={fieldClass}
                    />
                  </div>
                )}
              </Section>

              <Section title="시안·참고 사진" desc="원하는 디자인 시안이나 현장 사진이 있으면 올려 주세요. 담당자만 볼 수 있어요.">
                <AttachmentField value={attachments} onChange={setAttachments} onBusyChange={onBusy} />
              </Section>

              <Section title="요청 사항">
                <textarea
                  rows={5}
                  maxLength={3000}
                  placeholder="필요한 규격, 로고 인쇄 여부, 예산 범위 등 자유롭게 적어 주세요."
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className={`${fieldClass} resize-y`}
                />
              </Section>

              <div className="space-y-3">
                <p className="text-sm text-zinc-500">입력한 연락처와 첨부 사진은 견적 안내에만 씁니다.</p>
                {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full py-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-base font-semibold disabled:opacity-60"
                >
                  {submitting ? "보내는 중..." : uploading ? "사진 올리는 중..." : "견적 요청 보내기"}
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

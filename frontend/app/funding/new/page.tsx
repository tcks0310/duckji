"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ImageOff, Minus, Plus, Trash2, Upload, X } from "lucide-react"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { DatePicker, todayYmd } from "@/components/ui/date-picker"
import { detailHref, won } from "@/components/funding/funding-ui"
import { getSessionMember } from "@/lib/member-auth"
import { uploadGalleryMedia, uploadImage } from "@/lib/community-api"
import { FUNDING_TYPES, fundingService, fundingTypeLabel, hasGoods, hasVenue } from "@/lib/funding-service"
import { fetchVenues, VENUE_PARTNER, type VenueSpace } from "@/lib/funding-venues"
import { MALL_CATEGORIES, SUPPLY_TYPES, fetchMallItems, type MallItem, type SupplyType } from "@/lib/mall"
import { searchAddress } from "@/lib/postcode"
import type { FundingGoodsItem, FundingType } from "@/types/funding"

// 펀딩 열기 (/funding/new): 종류 → 일정·장소 → 소개 → 굿즈(덕지몰 품목) → 목표 → 약관 동의 후 신청
// 신청하면 '견적 전' 상태로 개설자와 관리자에게만 보이고, 담당자와 대화하며 견적·참여 가격을 정한 뒤 공개됨
// 파티 캘린더에서 오면 ?eventId=&eventTitle=&workTag=&eventDate= 로 일정·제목을 미리 채움

type Form = {
  type: FundingType | ""
  eventStart: string
  eventEnd: string
  eventTime: string
  venueId: number | null
  venueName: string
  venueAddress: string
  region: string
  maxCapacity: string
  deliveryMethod: "shipping" | "pickup" | "both"
  title: string
  summary: string
  description: string
  workTag: string
  media: string[]
  ageRestriction: "all" | "adult_only"
  goodsItems: FundingGoodsItem[]
  goodsLocation: string
  needInstallService: boolean
  installDate: string
  attachments: string[]
  goodsNotes: string
  goalType: "amount" | "count"
  targetAmount: string
  targetCount: string
  desiredPrice: string
  endDate: string
  partyEventId: string
}

const EMPTY: Form = {
  type: "",
  eventStart: "",
  eventEnd: "",
  eventTime: "",
  venueId: null,
  venueName: "",
  venueAddress: "",
  region: "",
  maxCapacity: "",
  deliveryMethod: "shipping",
  title: "",
  summary: "",
  description: "",
  workTag: "",
  media: [],
  ageRestriction: "all",
  goodsItems: [],
  goodsLocation: "",
  needInstallService: false,
  installDate: "",
  attachments: [],
  goodsNotes: "",
  goalType: "amount",
  targetAmount: "",
  targetCount: "",
  desiredPrice: "",
  endDate: "",
  partyEventId: "",
}

const DRAFT_KEY = "duckji-funding-new-draft"
const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)
const addDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const line =
  "w-full bg-transparent border-b border-zinc-700 py-2.5 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 [color-scheme:dark]"
const datePickerClass = "w-full bg-transparent border-b border-zinc-700 py-2.5 text-base text-white text-left focus:outline-none focus:border-emerald-400"

export default function FundingNewPage() {
  const [member, setMember] = useState<{ id: string; name: string } | null | undefined>(undefined)
  const [form, setForm] = useState<Form>(EMPTY)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [agree, setAgree] = useState({ terms: false, copyright: false, contact: false })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ id: string; title: string } | null>(null)
  const [eventTitle, setEventTitle] = useState("")

  useEffect(() => {
    getSessionMember().then((m) => setMember(m ? { id: m.id, name: m.name } : null))
    let draft: Partial<Form> = {}
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}")
    } catch {}
    const qs = new URLSearchParams(window.location.search)
    const fromParty: Partial<Form> = {}
    if (qs.get("eventId")) {
      fromParty.partyEventId = qs.get("eventId") || ""
      fromParty.workTag = qs.get("workTag") || ""
      fromParty.eventStart = qs.get("eventDate") || ""
      fromParty.eventEnd = qs.get("eventDate") || ""
      fromParty.title = qs.get("eventTitle") ? `${qs.get("eventTitle")} 생일카페` : ""
      setEventTitle(qs.get("eventTitle") || "")
    }
    const type = qs.get("type")
    if (type && FUNDING_TYPES.some((t) => t.id === type)) fromParty.type = type as FundingType
    setForm((f) => ({ ...f, ...draft, ...fromParty }))
  }, [])

  // 쓰던 내용은 이 탭이 열려 있는 동안 기억
  useEffect(() => {
    if (done) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {}
  }, [form, done])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const steps = useMemo(() => {
    const list = [
      { id: "type", label: "종류" },
      { id: "schedule", label: form.type === "group_buy" ? "일정·수령" : "일정·장소" },
      { id: "intro", label: "소개" },
    ]
    if (form.type && hasGoods(form.type)) list.push({ id: "goods", label: "굿즈" })
    list.push({ id: "goal", label: "목표" }, { id: "agree", label: "확인·동의" })
    return list
  }, [form.type])
  const current = steps[Math.min(step, steps.length - 1)].id

  const check = (id: string): string[] => {
    const e: string[] = []
    if (id === "type" && !form.type) e.push("펀딩 종류를 골라 주세요.")
    if (id === "schedule") {
      if (!form.eventStart) e.push(form.type === "group_buy" ? "수령 희망일을 골라 주세요." : "행사 날짜를 골라 주세요.")
      if (form.type && hasVenue(form.type) && !form.venueName.trim() && !form.region.trim()) e.push("장소를 고르거나 직접 입력해 주세요.")
    }
    if (id === "intro") {
      if (!form.title.trim()) e.push("펀딩 제목을 입력해 주세요.")
      if (!form.summary.trim()) e.push("한 줄 소개를 입력해 주세요.")
      if (!form.description.trim()) e.push("상세 소개를 입력해 주세요.")
    }
    if (id === "goods") {
      const hasAnyGoods =
        form.goodsItems.length > 0 ||
        form.attachments.length > 0 ||
        Boolean(form.goodsNotes.trim())
      if (!hasAnyGoods) {
        e.push("만들 굿즈 품목을 고르거나, 시안 사진 또는 요청 사항을 1개 이상 입력해 주세요.")
      }
    }
    if (id === "goal") {
      if (form.goalType === "amount" && !(Number(form.targetAmount) > 0)) e.push("희망 목표 금액을 입력해 주세요.")
      if (form.goalType === "count" && !(Number(form.targetCount) > 0)) e.push("희망 목표 인원을 입력해 주세요.")
      if (!form.endDate) e.push("모집 마감일을 골라 주세요.")
    }
    if (id === "agree") {
      if (!agree.terms) e.push("펀딩 개설 약관에 동의해 주세요.")
      if (!agree.contact) e.push("담당자 연락을 위한 정보 이용에 동의해 주세요.")
      if (form.type && hasGoods(form.type) && !agree.copyright) e.push("저작권·상표권 확인에 동의해 주세요.")
    }
    return e
  }

  const next = () => {
    const e = check(current)
    setErrors(e)
    if (e.length) return
    setStep((s) => Math.min(s + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const back = () => {
    setErrors([])
    setStep((s) => Math.max(0, s - 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const submit = async () => {
    const all = steps.flatMap((s) => check(s.id))
    setErrors(all)
    if (all.length || submitting || !form.type) return
    setSubmitting(true)
    try {
      const images = form.media.filter((m) => !isVideo(m))
      const project = await fundingService.createProject({
        type: form.type,
        title: form.title,
        summary: form.summary,
        description: form.description,
        workTag: form.workTag,
        eventStart: form.eventStart,
        eventEnd: form.eventEnd || form.eventStart,
        eventTime: form.eventTime,
        venueId: form.venueId ?? undefined,
        venueName: hasVenue(form.type) ? form.venueName : "",
        venueAddress: hasVenue(form.type) ? form.venueAddress : "",
        region: hasVenue(form.type) ? form.region : "",
        maxCapacity: Number(form.maxCapacity) || undefined,
        deliveryMethod: form.type === "group_buy" ? form.deliveryMethod : "pickup",
        images,
        videos: form.media.filter(isVideo),
        thumbnailUrl: images[0] || "",
        ageRestriction: form.ageRestriction,
        goodsItems: hasGoods(form.type) ? form.goodsItems : [],
        goodsForm: hasGoods(form.type)
          ? {
              eventLocation: form.goodsLocation || form.venueAddress || form.venueName,
              needInstallService: form.needInstallService,
              installDate: form.needInstallService ? form.installDate : "",
              attachments: form.attachments,
              notes: form.goodsNotes,
            }
          : undefined,
        goalType: form.goalType,
        targetAmount: form.goalType === "amount" ? Number(form.targetAmount) : 0,
        targetCount: form.goalType === "count" ? Number(form.targetCount) : 0,
        desiredPrice: Number(form.desiredPrice) || undefined,
        endDate: new Date(`${form.endDate}T23:59:59+09:00`).toISOString(),
        partyEventId: form.partyEventId || undefined,
        copyrightConfirmed: agree.copyright,
        termsAgreed: agree.terms && agree.contact,
      })
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {}
      setDone({ id: project.id, title: project.title })
      window.scrollTo({ top: 0 })
    } catch (e: any) {
      setErrors([e?.message || "신청하지 못했습니다. 잠시 후 다시 시도해 주세요."])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" itemId="funding-new" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {member === undefined ? (
          <p className="py-20 text-center text-sm text-zinc-500">불러오는 중...</p>
        ) : member === null ? (
          <div className="py-16 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">펀딩 열기</h1>
            <p className="text-base text-zinc-300">펀딩은 회원만 열 수 있어요. 개설자 이름과 사진은 덕지 갤러리 프로필로 보여요.</p>
            <Link href="/login/?next=/funding/new" className="inline-flex items-center h-11 px-6 rounded-full bg-emerald-400 text-zinc-950 font-semibold">
              로그인하고 펀딩 열기
            </Link>
          </div>
        ) : done ? (
          <div className="py-12 space-y-6">
            <div className="w-12 h-12 rounded-full bg-emerald-400 text-zinc-950 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">펀딩 개설 신청을 받았어요</h1>
              <p className="text-base text-zinc-300 leading-relaxed break-keep">
                <strong className="text-white">{done.title}</strong> 신청서를 담당자가 검토하고 있어요. 담당자가 배정되면 펀딩 상세의 &apos;담당자와 대화&apos;에서 견적과 예상 참여 가격을 함께 정하고,
                준비가 끝나면 펀딩을 공개해요. 견적서는 가입한 이메일로도 보내 드려요.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={detailHref(done.id)} className="inline-flex items-center h-11 px-6 rounded-full bg-emerald-400 text-zinc-950 font-semibold">
                신청한 펀딩 보기
              </Link>
              <Link href="/funding/my" className="inline-flex items-center h-11 px-6 rounded-full border border-zinc-600 text-white">
                내 펀딩 관리
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <header className="space-y-5">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">펀딩 열기</h1>
              {eventTitle && <p className="text-sm text-emerald-300">파티 캘린더 &apos;{eventTitle}&apos; 에서 시작했어요.</p>}
              <ol className="flex gap-1 overflow-x-auto">
                {steps.map((s, i) => (
                  <li key={s.id} className="flex-1 min-w-[64px]">
                    <button
                      type="button"
                      onClick={() => i < step && setStep(i)}
                      disabled={i >= step}
                      className="w-full text-left space-y-2 disabled:cursor-default"
                    >
                      <span className={`block h-0.5 ${i <= step ? "bg-emerald-400" : "bg-zinc-700"}`} />
                      <span className={`block text-xs sm:text-sm ${i === step ? "text-white font-semibold" : i < step ? "text-zinc-300" : "text-zinc-500"}`}>
                        {i + 1}. {s.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </header>

            {current === "type" && <TypeStep value={form.type} onChange={(v) => set("type", v)} />}
            {current === "schedule" && <ScheduleStep form={form} set={set} setForm={setForm} />}
            {current === "intro" && <IntroStep form={form} set={set} />}
            {current === "goods" && <GoodsStep form={form} set={set} />}
            {current === "goal" && <GoalStep form={form} set={set} />}
            {current === "agree" && <AgreeStep form={form} agree={agree} setAgree={setAgree} />}

            {errors.length > 0 && (
              <ul className="border-l-2 border-red-400 pl-4 space-y-1 text-sm text-red-200">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-6">
              {step > 0 ? (
                <button type="button" onClick={back} className="inline-flex items-center gap-1.5 h-11 px-4 text-zinc-300 hover:text-white">
                  <ArrowLeft className="w-4 h-4" />
                  이전
                </button>
              ) : (
                <span />
              )}
              {current === "agree" ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="h-12 px-8 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold disabled:opacity-50"
                >
                  {submitting ? "신청하는 중..." : "펀딩 개설 신청"}
                </button>
              ) : (
                <button type="button" onClick={next} className="h-12 px-8 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold">
                  다음
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

type SetFn = <K extends keyof Form>(k: K, v: Form[K]) => void

function StepTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {desc && <p className="text-sm text-zinc-400 leading-relaxed break-keep">{desc}</p>}
    </div>
  )
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-zinc-300">{children}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

// ---------------------------------------------------------------- 1. 종류
function TypeStep({ value, onChange }: { value: FundingType | ""; onChange: (v: FundingType) => void }) {
  return (
    <section className="space-y-6">
      <StepTitle title="어떤 펀딩을 열까요?" desc="장소 대관은 아이노브코리아, 굿즈 제작은 덕지몰 제작 파트너와 함께 진행해요." />
      <div className="divide-y divide-zinc-800 border-y border-zinc-800">
        {FUNDING_TYPES.map((t, i) => {
          const active = value === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`w-full flex items-center gap-5 py-5 px-1 text-left transition-colors ${active ? "" : "hover:bg-white/[0.02]"}`}
            >
              <span className={`text-sm tabular-nums ${active ? "text-emerald-300" : "text-zinc-500"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 min-w-0">
                <span className={`block text-lg ${active ? "text-white font-semibold" : "text-zinc-200"}`}>{t.label}</span>
                <span className="block text-sm text-zinc-400 mt-0.5 break-keep">{t.desc}</span>
              </span>
              <span
                className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                  active ? "bg-emerald-400 border-emerald-400 text-zinc-950" : "border-zinc-600"
                }`}
              >
                {active && <Check className="w-4 h-4" />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- 2. 일정·장소
function ScheduleStep({ form, set, setForm }: { form: Form; set: SetFn; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const [venues, setVenues] = useState<VenueSpace[] | null>(null)
  const [direct, setDirect] = useState(Boolean(form.venueName && !form.venueId))
  const venueType = form.type && hasVenue(form.type)

  useEffect(() => {
    if (venueType) fetchVenues().then(setVenues).catch(() => setVenues([]))
  }, [venueType])

  const pickVenue = (v: VenueSpace) =>
    setForm((f) => ({ ...f, venueId: v.id, venueName: v.name, venueAddress: v.address, region: v.location, maxCapacity: f.maxCapacity || String(v.capacity || "") }))

  const findAddress = async () => {
    try {
      const r = await searchAddress()
      if (r) set("venueAddress", r.address)
    } catch (e: any) {
      alert(e?.message)
    }
  }

  return (
    <section className="space-y-10">
      <StepTitle
        title={venueType ? "언제, 어디서 열까요?" : "언제 받을까요?"}
        desc={venueType ? "확정이 아니어도 괜찮아요. 담당자가 대관 가능 여부를 확인하고 함께 조정해요." : "굿즈를 받고 싶은 때를 알려 주세요. 제작 기간을 보고 담당자가 일정을 조정해요."}
      />

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1">
          <Label>{venueType ? "행사 시작일" : "수령 희망일"}</Label>
          <DatePicker
            aria-label="시작일"
            placeholder="날짜 고르기"
            min={todayYmd()}
            value={form.eventStart}
            onChange={(v) => setForm((f) => ({ ...f, eventStart: v, eventEnd: !f.eventEnd || f.eventEnd < v ? v : f.eventEnd }))}
            className={datePickerClass}
          />
        </div>
        {venueType && (
          <div className="space-y-1">
            <Label hint="하루면 같은 날">행사 종료일</Label>
            <DatePicker
              aria-label="종료일"
              placeholder="날짜 고르기"
              min={form.eventStart || todayYmd()}
              value={form.eventEnd}
              onChange={(v) => set("eventEnd", v)}
              className={datePickerClass}
            />
          </div>
        )}
        {venueType && (
          <div className="space-y-1">
            <Label hint="선택">시간</Label>
            <input value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} maxLength={50} placeholder="예: 12:00 ~ 18:00" className={line} />
          </div>
        )}
        {venueType && (
          <div className="space-y-1">
            <Label hint="선택">예상 인원</Label>
            <input
              type="number"
              min={1}
              value={form.maxCapacity}
              onChange={(e) => set("maxCapacity", e.target.value)}
              placeholder="예: 40"
              className={line}
            />
          </div>
        )}
        {!venueType && (
          <div className="space-y-2">
            <Label>받는 방법</Label>
            <div className="flex gap-4 pt-1">
              {(
                [
                  ["shipping", "배송"],
                  ["pickup", "현장 수령"],
                  ["both", "둘 다"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="inline-flex items-center gap-2 text-base text-zinc-200 cursor-pointer">
                  <input type="radio" name="delivery" checked={form.deliveryMethod === id} onChange={() => set("deliveryMethod", id)} className="accent-emerald-400 w-4 h-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {venueType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label>장소</Label>
            <div className="flex gap-4 text-sm">
              <button type="button" onClick={() => setDirect(false)} className={!direct ? "text-white font-semibold" : "text-zinc-500 hover:text-white"}>
                덕지 대관 장소
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirect(true)
                  set("venueId", null)
                }}
                className={direct ? "text-white font-semibold" : "text-zinc-500 hover:text-white"}
              >
                직접 입력
              </button>
            </div>
          </div>

          {!direct ? (
            venues === null ? (
              <p className="text-sm text-zinc-500">불러오는 중...</p>
            ) : venues.length === 0 ? (
              <p className="text-sm text-zinc-400">
                지금 바로 고를 수 있는 대관 장소가 없어요.{" "}
                <button type="button" onClick={() => setDirect(true)} className="text-emerald-300 underline underline-offset-4">
                  원하는 장소를 직접 적어 주세요
                </button>
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {venues.map((v) => {
                  const active = form.venueId === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => pickVenue(v)}
                      className={`text-left rounded-lg overflow-hidden border transition-colors ${active ? "border-emerald-400" : "border-zinc-800 hover:border-zinc-600"}`}
                    >
                      <div className="aspect-[16/9] bg-zinc-900">
                        {v.imageUrls[0] ? (
                          <img src={v.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <ImageOff className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-semibold text-white truncate">{v.name}</span>
                          {active && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
                        </div>
                        <p className="text-sm text-zinc-400 truncate">
                          {[v.location, v.capacity ? `${v.capacity}명` : "", v.area].filter(Boolean).join(" · ")}
                        </p>
                        {v.priceGuide && <p className="text-xs text-zinc-500 truncate">{v.priceGuide}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1 sm:col-span-2">
                <Label hint="카페·스튜디오 이름">장소 이름</Label>
                <input value={form.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={100} placeholder="예: 성수 카페 OOO" className={line} />
              </div>
              <div className="space-y-1">
                <Label hint="장소가 정해지지 않았다면">희망 지역</Label>
                <input value={form.region} onChange={(e) => set("region", e.target.value)} maxLength={30} placeholder="예: 홍대·합정" className={line} />
              </div>
              <div className="space-y-1">
                <Label hint="선택">주소</Label>
                <div className="flex gap-2">
                  <input value={form.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} maxLength={200} placeholder="주소 검색" className={line} />
                  <button type="button" onClick={findAddress} className="shrink-0 px-3 text-sm text-zinc-300 hover:text-white border-b border-zinc-700">
                    검색
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-zinc-500">덕지 대관 장소는 {VENUE_PARTNER}와 함께 확보한 공간이에요.</p>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 3. 소개
function IntroStep({ form, set }: { form: Form; set: SetFn }) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState("")

  const add = async (files: FileList | null) => {
    if (!files) return
    setError("")
    const room = 10 - form.media.length
    const list = Array.from(files).slice(0, room)
    const added: string[] = []
    for (const file of list) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue
      setUploading((n) => n + 1)
      try {
        added.push(await uploadGalleryMedia(file))
      } catch (e: any) {
        setError(e?.message || "올리지 못했습니다.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (added.length) set("media", [...form.media, ...added])
  }

  return (
    <section className="space-y-8">
      <StepTitle title="펀딩을 소개해 주세요" desc="둘러보기와 상세 화면에 그대로 보여요. 첫 번째 사진이 대표 사진이 돼요." />
      <div className="space-y-1">
        <Label hint={`${form.title.length}/120`}>펀딩 제목</Label>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="예: 우즈마키 나루토 생일카페 in 홍대" className={line} />
      </div>
      <div className="space-y-1">
        <Label hint={`${form.summary.length}/300`}>한 줄 소개</Label>
        <input value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} placeholder="어떤 자리인지 한 문장으로" className={line} />
      </div>
      <div className="space-y-1">
        <Label hint="선택">작품·캐릭터</Label>
        <input value={form.workTag} onChange={(e) => set("workTag", e.target.value)} maxLength={100} placeholder="예: 나루토" className={line} />
      </div>
      <div className="space-y-2">
        <Label>상세 소개</Label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={10}
          maxLength={20000}
          placeholder={"진행 순서, 준비한 이벤트, 참여하면 받는 것 등을 자유롭게 적어 주세요.\n줄바꿈은 그대로 보여요."}
          className="w-full bg-white/[0.03] border border-zinc-800 rounded-lg p-4 text-base text-white placeholder-zinc-500 leading-relaxed focus:outline-none focus:border-emerald-400 resize-y"
        />
      </div>
      <div className="space-y-3">
        <Label hint={`${form.media.length}/10 · 사진 15MB, 동영상 100MB`}>사진·동영상</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {form.media.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-md overflow-hidden bg-zinc-900">
              {isVideo(url) ? <video src={url} className="w-full h-full object-cover" muted /> : <img src={url} alt="" className="w-full h-full object-cover" />}
              {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[11px] text-white">대표</span>}
              <button
                type="button"
                onClick={() => set("media", form.media.filter((m) => m !== url))}
                aria-label="빼기"
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {form.media.length < 10 && (
            <label className="aspect-square rounded-md border border-dashed border-zinc-700 hover:border-zinc-500 flex flex-col items-center justify-center gap-1 text-zinc-400 text-xs cursor-pointer">
              <Upload className="w-5 h-5" />
              {uploading ? `올리는 중 ${uploading}` : "추가"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                multiple
                hidden
                onChange={(e) => {
                  add(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
      <label className="flex items-center gap-2.5 text-base text-zinc-200 cursor-pointer">
        <input type="checkbox" checked={form.ageRestriction === "adult_only"} onChange={(e) => set("ageRestriction", e.target.checked ? "adult_only" : "all")} className="w-4 h-4 accent-emerald-400" />
        성인만 참여할 수 있는 행사예요
      </label>
    </section>
  )
}

// ---------------------------------------------------------------- 4. 굿즈 (덕지몰 품목 · 덕지몰 견적 신청과 같은 양식)
function GoodsStep({ form, set }: { form: Form; set: SetFn }) {
  const [items, setItems] = useState<MallItem[] | null>(null)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("all")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchMallItems().then((r) => {
      if (r.ok) setItems(r.items.filter((i) => i.isActive !== false))
      else {
        setItems([])
        setError(r.error)
      }
    })
  }, [])

  const picked = new Map(form.goodsItems.map((g) => [g.id, g]))
  const shown = (items || []).filter((i) => category === "all" || i.category === category)
  const usedCategories = MALL_CATEGORIES.filter((c) => (items || []).some((i) => i.category === c.id))

  const toggle = (item: MallItem) => {
    if (picked.has(item.id)) return set("goodsItems", form.goodsItems.filter((g) => g.id !== item.id))
    const serviceType: SupplyType = item.supplyTypes.includes("맞춤제작") ? "맞춤제작" : item.supplyTypes[0] || "맞춤제작"
    set("goodsItems", [
      ...form.goodsItems,
      { id: item.id, name: item.name, categoryName: item.categoryName, imageUrl: item.imageUrls[0] || "", quantity: 1, serviceType },
    ])
  }
  const update = (id: number, patch: Partial<FundingGoodsItem>) => set("goodsItems", form.goodsItems.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  const addAttachments = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    const added: string[] = []
    for (const f of Array.from(files).slice(0, 10 - form.attachments.length)) {
      if (!f.type.startsWith("image/")) continue
      try {
        added.push(await uploadImage(f))
      } catch (e: any) {
        alert(e?.message || "사진을 올리지 못했습니다.")
      }
    }
    setUploading(false)
    if (added.length) set("attachments", [...form.attachments, ...added])
  }

  return (
    <section className="space-y-10">
      <StepTitle title="어떤 굿즈를 만들까요?" desc="덕지몰에서 제작하는 품목이에요. 고른 품목과 수량으로 수요를 모으고, 담당자가 단가를 계산해 견적을 드려요." />

      <div className="space-y-4">
        {usedCategories.length > 1 && (
          <div className="flex gap-1 overflow-x-auto text-sm">
            {[{ id: "all", label: "전체" }, ...usedCategories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 h-8 rounded-full whitespace-nowrap ${category === c.id ? "bg-white text-zinc-950 font-semibold" : "text-zinc-300 hover:text-white"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {items === null ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-zinc-300">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-zinc-400">아직 덕지몰에 올라온 품목이 없어요. 만들고 싶은 굿즈를 아래 요청 사항에 적어 주세요.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
            {shown.map((item) => {
              const active = picked.has(item.id)
              return (
                <button key={item.id} type="button" onClick={() => toggle(item)} className="text-left space-y-2 group">
                  <div className={`relative aspect-square rounded-lg overflow-hidden bg-zinc-900 ring-2 transition ${active ? "ring-emerald-400" : "ring-transparent group-hover:ring-zinc-600"}`}>
                    {item.imageUrls[0] ? (
                      <img src={item.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <ImageOff className="w-5 h-5" />
                      </div>
                    )}
                    {active && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-400 text-zinc-950 flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white line-clamp-1">{item.name}</p>
                    <p className="text-xs text-zinc-500 line-clamp-1">{item.spec || item.categoryName}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {form.goodsItems.length > 0 && (
        <div className="space-y-2">
          <Label>고른 품목 {form.goodsItems.length}종</Label>
          <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
            {form.goodsItems.map((g) => (
              <li key={g.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                  <p className="text-xs text-zinc-500">{g.categoryName}</p>
                </div>
                <select
                  aria-label="방식"
                  value={g.serviceType}
                  onChange={(e) => update(g.id, { serviceType: e.target.value })}
                  className="bg-transparent text-sm text-zinc-200 border-b border-zinc-700 py-1 [color-scheme:dark]"
                >
                  {SUPPLY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="수량 빼기" onClick={() => update(g.id, { quantity: Math.max(1, g.quantity - 1) })} className="p-1.5 text-zinc-400 hover:text-white">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    aria-label="예상 수량"
                    value={g.quantity}
                    onChange={(e) => update(g.id, { quantity: Math.min(99999, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                    className="w-16 bg-transparent border-b border-zinc-700 text-center text-sm text-white py-1"
                  />
                  <button type="button" aria-label="수량 더하기" onClick={() => update(g.id, { quantity: Math.min(99999, g.quantity + 1) })} className="p-1.5 text-zinc-400 hover:text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button type="button" aria-label={`${g.name} 빼기`} onClick={() => set("goodsItems", form.goodsItems.filter((x) => x.id !== g.id))} className="p-1.5 text-zinc-500 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">수량은 예상 수량이에요. 최종 수량은 펀딩 결과에 맞춰 정해요.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1 sm:col-span-2">
          <Label hint="선택">설치·배송 장소</Label>
          <input
            value={form.goodsLocation}
            onChange={(e) => set("goodsLocation", e.target.value)}
            maxLength={200}
            placeholder={form.venueName || form.venueAddress || "예: 성수동 OO빌딩 1층"}
            className={line}
          />
        </div>
        <label className="flex items-start gap-2.5 sm:col-span-2 cursor-pointer">
          <input type="checkbox" checked={form.needInstallService} onChange={(e) => set("needInstallService", e.target.checked)} className="mt-1 w-4 h-4 accent-emerald-400" />
          <span>
            <span className="block text-base text-zinc-100">현장 설치·철거 필요</span>
            <span className="block text-sm text-zinc-400">장소와 일정을 보고 가능 여부와 비용을 함께 안내해요.</span>
          </span>
        </label>
        {form.needInstallService && (
          <div className="space-y-1">
            <Label>설치 희망일</Label>
            <DatePicker min={todayYmd()} max={form.eventEnd || undefined} value={form.installDate} onChange={(v) => set("installDate", v)} className={datePickerClass} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label hint={`${form.attachments.length}/10`}>시안·참고 사진</Label>
        <div className="flex flex-wrap gap-2">
          {form.attachments.map((url) => (
            <div key={url} className="relative w-20 h-20 rounded-md overflow-hidden bg-zinc-900">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label="빼기"
                onClick={() => set("attachments", form.attachments.filter((a) => a !== url))}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {form.attachments.length < 10 && (
            <label className="w-20 h-20 rounded-md border border-dashed border-zinc-700 hover:border-zinc-500 flex flex-col items-center justify-center text-xs text-zinc-400 cursor-pointer">
              <Upload className="w-4 h-4 mb-1" />
              {uploading ? "올리는 중" : "추가"}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addAttachments(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label hint="선택">요청 사항</Label>
        <textarea
          value={form.goodsNotes}
          onChange={(e) => set("goodsNotes", e.target.value)}
          rows={4}
          maxLength={3000}
          placeholder="필요한 규격, 로고 인쇄 여부, 예산 범위 등 자유롭게 적어 주세요."
          className="w-full bg-white/[0.03] border border-zinc-800 rounded-lg p-4 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 resize-y"
        />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- 5. 목표
function GoalStep({ form, set }: { form: Form; set: SetFn }) {
  const maxEnd = addDays(todayYmd(), 180)
  return (
    <section className="space-y-10">
      <StepTitle
        title="목표를 정해 주세요"
        desc="지금은 희망 목표예요. 견적이 나오면 담당자와 대화로 목표와 예상 참여 가격을 정하고, 그다음 펀딩을 공개해요."
      />
      <div className="space-y-3">
        <Label>목표 기준</Label>
        <div className="grid grid-cols-2 border border-zinc-700 rounded-full p-1 max-w-sm">
          {(
            [
              ["amount", "목표 금액"],
              ["count", "목표 인원"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set("goalType", id)}
              className={`h-10 rounded-full text-sm ${form.goalType === id ? "bg-white text-zinc-950 font-semibold" : "text-zinc-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        {form.goalType === "amount" ? (
          <div className="space-y-1">
            <Label hint={Number(form.targetAmount) > 0 ? won(Number(form.targetAmount)) : "원"}>희망 목표 금액</Label>
            <input type="number" min={0} step={10000} value={form.targetAmount} onChange={(e) => set("targetAmount", e.target.value)} placeholder="예: 800000" className={line} />
          </div>
        ) : (
          <div className="space-y-1">
            <Label hint="명">희망 목표 인원</Label>
            <input type="number" min={1} value={form.targetCount} onChange={(e) => set("targetCount", e.target.value)} placeholder="예: 30" className={line} />
          </div>
        )}
        <div className="space-y-1">
          <Label hint="선택 · 1인 기준">희망 예상 가격</Label>
          <input type="number" min={0} step={1000} value={form.desiredPrice} onChange={(e) => set("desiredPrice", e.target.value)} placeholder="예: 25000" className={line} />
        </div>
        <div className="space-y-1">
          <Label hint="이날까지 모아요">모집 마감일</Label>
          <DatePicker
            placeholder="날짜 고르기"
            min={addDays(todayYmd(), 1)}
            max={form.eventStart && form.eventStart > addDays(todayYmd(), 1) ? form.eventStart : maxEnd}
            value={form.endDate}
            onChange={(v) => set("endDate", v)}
            className={datePickerClass}
          />
        </div>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed break-keep">
        참여는 DP 로 받아요. 마감일까지 목표를 채우면 대관·제작이 진행되고, 못 채우면 담당자와 기간을 늘릴지 마감할지 정해요. 마감하면 참여한 DP 는 모두 돌려드려요.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------- 6. 확인·동의
function AgreeStep({
  form,
  agree,
  setAgree,
}: {
  form: Form
  agree: { terms: boolean; copyright: boolean; contact: boolean }
  setAgree: React.Dispatch<React.SetStateAction<{ terms: boolean; copyright: boolean; contact: boolean }>>
}) {
  const range = form.eventStart ? (form.eventEnd && form.eventEnd !== form.eventStart ? `${form.eventStart} ~ ${form.eventEnd}` : form.eventStart) : "-"
  const rows: [string, string][] = [
    ["종류", form.type ? fundingTypeLabel(form.type) : "-"],
    ["제목", form.title || "-"],
    [form.type === "group_buy" ? "수령 희망일" : "일정", `${range}${form.eventTime ? ` · ${form.eventTime}` : ""}`],
  ]
  if (form.type && hasVenue(form.type)) rows.push(["장소", [form.venueName, form.region, form.venueAddress].filter(Boolean).join(" · ") || "-"])
  if (form.type && hasGoods(form.type)) {
    const goodsSummary =
      form.goodsItems.map((g) => `${g.name} ${g.quantity}개`).join(", ") ||
      (form.attachments.length > 0 ? `시안 사진 ${form.attachments.length}장 등록` : "") ||
      (form.goodsNotes.trim() ? "직접 요청 사항 등록" : "-")
    rows.push(["굿즈", goodsSummary])
  }
  rows.push(
    ["희망 목표", form.goalType === "amount" ? won(Number(form.targetAmount) || 0) : `${Number(form.targetCount) || 0}명`],
    ["모집 마감", form.endDate || "-"]
  )
  const all = agree.terms && agree.contact && (!form.type || !hasGoods(form.type) || agree.copyright)

  return (
    <section className="space-y-10">
      <StepTitle title="마지막으로 확인해 주세요" desc="신청한 내용은 담당자와 대화하며 공개 전까지 고칠 수 있어요." />
      <dl className="divide-y divide-zinc-800 border-y border-zinc-800">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] sm:grid-cols-[140px_1fr] gap-4 py-3 text-sm">
            <dt className="text-zinc-400">{k}</dt>
            <dd className="text-zinc-100 break-keep">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-4">
        <label className="flex items-center gap-2.5 text-base text-white font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAgree({ terms: e.target.checked, contact: e.target.checked, copyright: e.target.checked })}
            className="w-4 h-4 accent-emerald-400"
          />
          모두 동의해요
        </label>
        <div className="pl-6 space-y-3 text-sm text-zinc-300">
          <Agree checked={agree.terms} onChange={(v) => setAgree((a) => ({ ...a, terms: v }))}>
            (필수) 펀딩 개설 약관: 견적이 나오기 전에는 비용이 들지 않고, 공개 뒤 목표를 채우면 대관·제작이 진행돼요. 목표를 못 채우거나 펀딩이 중단되면 참여자에게 DP 를 돌려드려요.{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-4 text-zinc-200">
              이용약관
            </Link>
          </Agree>
          <Agree checked={agree.contact} onChange={(v) => setAgree((a) => ({ ...a, contact: v }))}>
            (필수) 견적서와 진행 안내를 위해 가입한 이메일로 담당자가 연락해요.
          </Agree>
          {form.type && hasGoods(form.type) && (
            <Agree checked={agree.copyright} onChange={(v) => setAgree((a) => ({ ...a, copyright: v }))}>
              (필수) 굿즈에 쓰는 그림·로고는 제가 만들었거나 사용 권리가 있어요. 권리 침해가 확인되면 펀딩이 중단될 수 있어요.
            </Agree>
          )}
        </div>
      </div>
    </section>
  )
}

function Agree({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer leading-relaxed break-keep">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-emerald-400 shrink-0" />
      <span>{children}</span>
    </label>
  )
}

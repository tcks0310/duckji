import { normalizeKeywords } from "./keywords"
import { isApplicationStatus, type ApplicationStatus } from "./status"
import { DATE_RE } from "./time"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+\-() ]{8,20}$/
const EVENT_TYPES = ["popup", "cafe", "exhibition", "goods", "etc"] as const
const PLANS = ["basic", "standard", "flagship"] as const
export const APPLY_KINDS = ["listing", "ad", "both"] as const
// 광고 자리: 홈 왼쪽·오른쪽·아래 광고, 사이트 공지 팝업(modal)·띠 배너(bar). 계약은 팝업 입점(listing)도 고를 수 있음
export const AD_SLOTS = ["ad_left", "ad_right", "ad_bottom", "modal", "bar"] as const
export const CONTRACT_SLOTS = [...AD_SLOTS, "listing"] as const

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const url = (v: unknown) => {
  const s = str(v, 1000)
  return !s || /^https?:\/\//i.test(s) ? s : null
}

export const isEmail = (v: string) => v.length <= 200 && EMAIL_RE.test(v)
const dateOrNull = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null)
export const cleanSlots = <T extends readonly string[]>(v: unknown, list: T): T[number][] =>
  Array.isArray(v) ? list.filter((s) => v.includes(s)) : []

export interface ApplicationInput {
  brandName: string
  eventName: string
  eventType: (typeof EVENT_TYPES)[number]
  location: string
  schedule: string
  content: string
  linkUrl: string
  imageUrl: string
  keywords: string[]
  plan: (typeof PLANS)[number]
  nativeBooking: boolean
  placementWish: string
  managerName: string
  managerPhone: string
  managerEmail: string
  applyKind: (typeof APPLY_KINDS)[number]
  eventFrom: string | null
  eventUntil: string | null
  adSlots: (typeof AD_SLOTS)[number][]
  adFrom: string | null
  adUntil: string | null
  budget: string
  managerCompany: string
  attachments: string[] // 비공개 저장소 주소 (routes 에서 cleanAttachments 로 거른 값)
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

// 공개 입점 신청 폼 입력
export function validateApplication(body: Record<string, unknown>, attachments: string[] = []): Result<ApplicationInput> {
  const errors: string[] = []
  const linkUrl = url(body.linkUrl)
  const imageUrl = url(body.imageUrl)
  const eventType = str(body.eventType, 20) || "popup"
  const plan = str(body.plan, 20) || "standard"
  const applyKind = str(body.applyKind, 20) || "listing"
  let eventFrom = dateOrNull(body.eventFrom)
  let eventUntil = dateOrNull(body.eventUntil)
  if (eventFrom && eventUntil && eventUntil < eventFrom) [eventFrom, eventUntil] = [eventUntil, eventFrom]
  let adFrom = dateOrNull(body.adFrom)
  let adUntil = dateOrNull(body.adUntil)
  if (adFrom && adUntil && adUntil < adFrom) [adFrom, adUntil] = [adUntil, adFrom]
  // 일정 칸을 따로 안 보내면 행사 기간으로 채움 (관리자 목록에 그대로 보임)
  const schedule = str(body.schedule, 100) || (eventFrom ? `${eventFrom.replace(/-/g, ".")} ~ ${(eventUntil || eventFrom).replace(/-/g, ".")}` : "")

  const value: ApplicationInput = {
    brandName: str(body.brandName, 100),
    eventName: str(body.eventName, 200),
    eventType: eventType as ApplicationInput["eventType"],
    location: str(body.location, 300),
    schedule,
    content: str(body.content, 5000),
    linkUrl: linkUrl ?? "",
    imageUrl: imageUrl ?? "",
    keywords: normalizeKeywords(body.keywords),
    plan: plan as ApplicationInput["plan"],
    nativeBooking: body.nativeBooking === true,
    placementWish: str(body.placementWish, 100),
    managerName: str(body.managerName, 100),
    managerPhone: str(body.managerPhone, 30),
    managerEmail: str(body.managerEmail, 200).toLowerCase(),
    applyKind: applyKind as ApplicationInput["applyKind"],
    eventFrom,
    eventUntil,
    adSlots: applyKind === "listing" ? [] : cleanSlots(body.adSlots, AD_SLOTS),
    adFrom: applyKind === "listing" ? null : adFrom,
    adUntil: applyKind === "listing" ? null : adUntil,
    budget: str(body.budget, 100),
    managerCompany: str(body.managerCompany, 100),
    attachments,
  }

  if (!value.brandName) errors.push("주최사/브랜드명을 입력해 주세요.")
  if (!value.eventName) errors.push("행사명을 입력해 주세요.")
  if (!value.managerName) errors.push("담당자 이름을 입력해 주세요.")
  if (!PHONE_RE.test(value.managerPhone)) errors.push("담당자 연락처를 확인해 주세요.")
  if (!isEmail(value.managerEmail)) errors.push("담당자 이메일을 확인해 주세요.")
  if (!(EVENT_TYPES as readonly string[]).includes(eventType)) errors.push("행사 카테고리가 올바르지 않습니다.")
  if (!(PLANS as readonly string[]).includes(plan)) errors.push("패키지가 올바르지 않습니다.")
  if (!(APPLY_KINDS as readonly string[]).includes(applyKind)) errors.push("신청 종류가 올바르지 않습니다.")
  if (applyKind !== "listing" && value.adSlots.length === 0) errors.push("원하는 광고 자리를 하나 이상 골라 주세요.")
  if (linkUrl === null) errors.push("링크는 http(s):// 로 시작해야 합니다.")
  if (imageUrl === null) errors.push("이미지 주소는 http(s):// 로 시작해야 합니다.")
  if (body.privacyAgreed !== true) errors.push("개인정보 수집·이용에 동의해 주세요.")

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

export interface ApplicationReview {
  status?: ApplicationStatus
  reason?: string
  placement?: string
  publishFrom?: string | null
  publishUntil?: string | null
  keywords?: string[]
  adminNote?: string
  content?: string
}

// 관리자 수정 (보낸 필드만 반영)
export function validateReview(body: Record<string, unknown>): Result<ApplicationReview> {
  const errors: string[] = []
  const value: ApplicationReview = {}

  if (body.status !== undefined) {
    if (isApplicationStatus(body.status)) value.status = body.status
    else errors.push("상태 값이 올바르지 않습니다.")
  }
  if (body.reason !== undefined) value.reason = str(body.reason, 2000)
  if (body.placement !== undefined) value.placement = str(body.placement, 100)
  for (const key of ["publishFrom", "publishUntil"] as const) {
    const v = body[key]
    if (v === undefined) continue
    if (v === null || v === "") value[key] = null
    else if (typeof v === "string" && DATE_RE.test(v)) value[key] = v
    else errors.push(`${key} 는 YYYY-MM-DD 형식이어야 합니다.`)
  }
  if (value.publishFrom && value.publishUntil && value.publishFrom > value.publishUntil) {
    errors.push("배포 종료일이 시작일보다 빠릅니다.")
  }
  if (body.keywords !== undefined) value.keywords = normalizeKeywords(body.keywords)
  if (body.adminNote !== undefined) value.adminNote = str(body.adminNote, 2000)
  if (body.content !== undefined) value.content = str(body.content, 5000)

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

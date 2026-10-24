import { OPERATION_TYPES, POPUP_CATEGORIES, POPUP_ORIGINS, POPUP_STATUSES, RESERVATION_TYPES, type PopupInput } from "./types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[a-z0-9][a-z0-9-]{1,99}$/

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : fallback)
const bool = (v: unknown) => v === true
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0)
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [])
const coord = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN
}

export type ValidationResult = { ok: true; value: PopupInput } | { ok: false; errors: string[] }

// 관리자 등록·수정 입력 검증. existing 이 있으면 수정(PATCH)이라 기존 값 위에 덮어씀
export function validatePopupInput(body: Record<string, unknown>, existing?: PopupInput): ValidationResult {
  const merged = { ...(existing || {}), ...body } as Record<string, unknown>
  const errors: string[] = []

  const value: PopupInput = {
    id: str(merged.id),
    title: str(merged.title),
    subTitle: str(merged.subTitle),
    category: str(merged.category) as PopupInput["category"],
    categoryLabel: str(merged.categoryLabel),
    status: (str(merged.status) || "upcoming") as PopupInput["status"],
    statusLabel: str(merged.statusLabel),
    dDay: int(merged.dDay),
    startDate: str(merged.startDate),
    endDate: str(merged.endDate),
    location: str(merged.location),
    venueName: str(merged.venueName),
    latitude: coord(merged.latitude, -90, 90),
    longitude: coord(merged.longitude, -180, 180),
    admission: str(merged.admission),
    operationType: (str(merged.operationType) || "listing") as PopupInput["operationType"],
    reservationType: (str(merged.reservationType) || "free") as PopupInput["reservationType"],
    reservationLabel: str(merged.reservationLabel),
    operatingHours: str(merged.operatingHours),
    posterUrl: str(merged.posterUrl),
    galleryImages: strList(merged.galleryImages),
    description: str(merged.description),
    highlights: strList(merged.highlights),
    perks: strList(merged.perks),
    officialUrl: str(merged.officialUrl) || undefined,
    sourceName: str(merged.sourceName),
    sourceUrl: str(merged.sourceUrl),
    verifiedDate: str(merged.verifiedDate),
    isFeatured: bool(merged.isFeatured),
    isFlagship: bool(merged.isFlagship),
    isSponsored: bool(merged.isSponsored),
    isPartnerVerified: bool(merged.isPartnerVerified),
    hasNativeBooking: bool(merged.hasNativeBooking),
    hasNativeWaiting: bool(merged.hasNativeWaiting),
    waitingCount: int(merged.waitingCount),
    viewCount: int(merged.viewCount),
    likeCount: int(merged.likeCount),
    isPublished: merged.isPublished === undefined ? true : bool(merged.isPublished),
    sortOrder: int(merged.sortOrder),
    origin: (str(merged.origin) || "manual") as PopupInput["origin"],
    originRef: str(merged.originRef) || null,
    endedAt: str(merged.endedAt) || null,
  }

  if (!ID_RE.test(value.id)) errors.push("id 는 영문 소문자·숫자·하이픈 2~100자여야 합니다.")
  if (!value.title) errors.push("title 은 필수입니다.")
  if (!POPUP_CATEGORIES.includes(value.category)) errors.push(`category 는 ${POPUP_CATEGORIES.join(", ")} 중 하나여야 합니다.`)
  if (!POPUP_STATUSES.includes(value.status)) errors.push(`status 는 ${POPUP_STATUSES.join(", ")} 중 하나여야 합니다.`)
  if (!OPERATION_TYPES.includes(value.operationType)) errors.push(`operationType 은 ${OPERATION_TYPES.join(", ")} 중 하나여야 합니다.`)
  // 예약·웨이팅은 자사·제휴 팝업만
  if (value.operationType === "listing") {
    value.hasNativeBooking = false
    value.hasNativeWaiting = false
  }
  if (!RESERVATION_TYPES.includes(value.reservationType)) errors.push(`reservationType 은 ${RESERVATION_TYPES.join(", ")} 중 하나여야 합니다.`)
  if (!DATE_RE.test(value.startDate) || !DATE_RE.test(value.endDate)) errors.push("startDate, endDate 는 YYYY-MM-DD 형식이어야 합니다.")
  else if (value.startDate > value.endDate) errors.push("endDate 는 startDate 이후여야 합니다.")
  if (!POPUP_ORIGINS.includes(value.origin)) errors.push(`origin 은 ${POPUP_ORIGINS.join(", ")} 중 하나여야 합니다.`)
  if (value.endedAt && Number.isNaN(Date.parse(value.endedAt))) errors.push("endedAt 이 올바른 시각이 아닙니다.")
  if (Number.isNaN(value.latitude) || Number.isNaN(value.longitude)) errors.push("latitude, longitude 가 올바른 좌표가 아닙니다.")
  if ((value.latitude === null) !== (value.longitude === null)) errors.push("latitude, longitude 는 둘 다 입력하거나 둘 다 비워야 합니다.")

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

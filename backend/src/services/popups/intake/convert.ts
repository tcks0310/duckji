import type { PopupInput } from "../types"
import { CATEGORY_LABELS, RESERVATION_LABELS, type PopupCandidate } from "./types"
import { todayKst } from "./validation"

// 자동 수집 후보 → 초안 팝업(비공개, 등록 대기). 관리자가 팝업 관리에서 다듬고 '사이트에 공개'로 저장하면 게시됩니다.

const DAY = 24 * 3600 * 1000

export function statusFor(startDate: string, endDate: string, today = todayKst()) {
  const t = Date.parse(today)
  const dStart = Math.round((Date.parse(startDate) - t) / DAY)
  const dEnd = Math.round((Date.parse(endDate) - t) / DAY)
  if (dEnd < 0) return { status: "ended" as const, statusLabel: "종료", dDay: dEnd }
  if (dStart > 0) {
    const [, m, d] = startDate.split("-").map(Number)
    return { status: "upcoming" as const, statusLabel: dStart <= 7 ? `D-${dStart} 오픈예정` : `${m}/${d} 오픈예정`, dDay: dStart }
  }
  if (dEnd <= 3) return { status: "closing_soon" as const, statusLabel: dEnd === 0 ? "오늘 마감" : `D-${dEnd} 마감임박`, dDay: dEnd }
  return { status: "ongoing" as const, statusLabel: "진행중", dDay: dEnd }
}

const verifiedDate = () => todayKst().replace(/-/g, ".")

const base = (): Omit<PopupInput, "id" | "title" | "category" | "categoryLabel" | "startDate" | "endDate" | "status" | "statusLabel" | "dDay" | "origin" | "originRef"> => ({
  subTitle: "",
  location: "",
  venueName: "",
  latitude: null,
  longitude: null,
  admission: "",
  operationType: "listing", // 수집 팝업은 일반 팝업으로 시작, 관리자가 자사·제휴로 바꿈
  reservationType: "free",
  reservationLabel: RESERVATION_LABELS.free,
  operatingHours: "",
  posterUrl: "",
  galleryImages: [],
  description: "",
  highlights: [],
  perks: [],
  officialUrl: undefined,
  sourceName: "",
  sourceUrl: "",
  verifiedDate: verifiedDate(),
  isFeatured: false,
  isFlagship: false,
  isSponsored: false,
  isPartnerVerified: false,
  hasNativeBooking: false,
  hasNativeWaiting: false,
  waitingCount: 0,
  viewCount: 0,
  likeCount: 0,
  isPublished: false, // 초안
  sortOrder: 1000,
  endedAt: null,
})

export function draftFromCandidate(c: PopupCandidate): PopupInput {
  const startDate = c.startDate || todayKst()
  const endDate = c.endDate || startDate
  return {
    ...base(),
    id: `col-${c.id}-${startDate.replace(/-/g, "")}`,
    title: c.title,
    category: c.category,
    categoryLabel: CATEGORY_LABELS[c.category],
    startDate,
    endDate,
    ...statusFor(startDate, endDate),
    location: c.location,
    venueName: c.venueName,
    admission: c.admission,
    description: c.summary,
    officialUrl: c.officialUrl || undefined,
    sourceName: c.sourceName,
    sourceUrl: c.sourceUrl,
    origin: "collector",
    originRef: c.id,
  }
}

// 팝업 정보 형태. 팝업 목록은 서버(popups 서비스)에서만 받음 — 화면용 예시 팝업은 두지 않음 (lib/popup-service)
export interface PopupEvent {
  id: string
  title: string
  subTitle: string
  category: "flagship" | "anime" | "cafe" | "exhibition" | "goods"
  categoryLabel: string
  status: "ongoing" | "upcoming" | "closing_soon" | "ended"
  statusLabel: string
  startDate: string
  endDate: string
  dDay: number // calculated dynamically or static baseline
  location: string
  venueName: string
  coordinates: string
  admission: string
  // 운영 구분: own 자사(예약·웨이팅을 덕지에서) / partner 연계(운영사 협의 뒤 연결) / listing 단순 소개
  operationType?: "own" | "partner" | "listing"
  reservationType: "native" | "free" | "naver" | "onsite" | "ticket"
  reservationLabel: string
  posterUrl: string
  galleryImages: string[]
  description: string
  highlights: string[]
  perks: string[]
  operatingHours: string
  officialUrl?: string
  sourceName: string
  sourceUrl: string
  verifiedDate: string
  isFeatured?: boolean
  isFlagship?: boolean
  isSponsored?: boolean
  isPartnerVerified?: boolean
  hasNativeBooking?: boolean
  hasNativeWaiting?: boolean
  waitingCount?: number
  viewCount: number
  likeCount: number
  latitude?: number | null
  longitude?: number | null
  isPublished?: boolean
  sortOrder?: number
  origin?: "manual" | "collector"
  originRef?: string | null
  endedAt?: string | null
}

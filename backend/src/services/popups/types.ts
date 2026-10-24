// 팝업 데이터 (frontend/data/popup-data.ts 의 PopupEvent 와 같은 모양 + 위경도·공개 여부)
export const POPUP_CATEGORIES = ["flagship", "anime", "cafe", "exhibition", "goods"] as const
export const POPUP_STATUSES = ["ongoing", "upcoming", "closing_soon", "ended"] as const
export const RESERVATION_TYPES = ["native", "free", "naver", "onsite", "ticket"] as const
// 어디서 온 팝업인지: 관리자 직접 등록 / (예전) 운영사 신청 / 자동 수집 후보
// 운영 구분: 자사(우리가 여는 팝업) / 제휴(운영사와 제휴, 예약·웨이팅을 덕지에서 받음) / 일반(정보 소개만)
export const OPERATION_TYPES = ["own", "partner", "listing"] as const
export const POPUP_ORIGINS = ["manual", "collector"] as const

export interface Popup {
  id: string
  title: string
  subTitle: string
  category: (typeof POPUP_CATEGORIES)[number]
  categoryLabel: string
  status: (typeof POPUP_STATUSES)[number]
  statusLabel: string
  dDay: number
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  location: string
  venueName: string
  latitude: number | null
  longitude: number | null
  coordinates: string // 예: "37.5583° N, 127.1648° E" (기존 화면 호환용, 위경도에서 생성)
  admission: string
  operationType: (typeof OPERATION_TYPES)[number]
  reservationType: (typeof RESERVATION_TYPES)[number]
  reservationLabel: string
  operatingHours: string
  posterUrl: string
  galleryImages: string[]
  description: string
  highlights: string[]
  perks: string[]
  officialUrl?: string
  sourceName: string
  sourceUrl: string
  verifiedDate: string
  isFeatured: boolean
  isFlagship: boolean
  isSponsored: boolean
  isPartnerVerified: boolean
  hasNativeBooking: boolean // 자사 팝업: 예약 받는 중
  hasNativeWaiting: boolean // 자사 팝업: 지금 현장 웨이팅 받는 중
  waitingCount: number // 오늘 대기 팀 수 (조회할 때 계산)
  viewCount: number
  likeCount: number
  isPublished: boolean
  sortOrder: number
  origin: (typeof POPUP_ORIGINS)[number]
  originRef: string | null // 자동 수집 후보 ID
  endedAt: string | null // 기간 종료로 비공개 처리한 시각 (ISO)
}

// 등록·수정 입력 (coordinates 는 서버가 위경도로 만듦)
export type PopupInput = Omit<Popup, "coordinates">

export const formatCoordinates = (lat: number | null, lng: number | null) =>
  lat === null || lng === null
    ? ""
    : `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`

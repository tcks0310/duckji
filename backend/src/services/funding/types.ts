// 덕지 펀딩 협력사 영역
// - 대관: 아이노브코리아(MOU)와 이미 확보한 공간. 펀딩 열기에서 장소로 고름
// - 굿즈 제작: 더클코리아(MOU)
// 예전 대관 문의·굿즈 제작 신청은 2026-10-16 펀딩 새 흐름으로 바뀌며 archive/backend/funding-partners 로 옮김

export const PARTNERS = {
  venue: "아이노브코리아",
  goods: "더클코리아",
} as const

export interface VenueSpace {
  id: number
  name: string
  location: string // 지역 (예: 강동·고덕)
  address: string
  capacity: number
  area: string // 예: 30평
  imageUrls: string[]
  availablePeriod: string // 예: 2026.11 ~ 2027.02 주말
  priceGuide: string
  description: string
  partner: string
  isPublished: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
export type VenueSpaceInput = Omit<VenueSpace, "id" | "createdAt" | "updatedAt">

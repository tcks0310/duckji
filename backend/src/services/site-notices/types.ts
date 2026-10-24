// modal·bar: 사이트 공지 팝업·띠 배너, ad_*: 홈 왼쪽·오른쪽·아래 광고 자리 (이미지형만)
export const NOTICE_PLACEMENTS = ["modal", "bar", "ad_left", "ad_right", "ad_bottom"] as const
export const AD_PLACEMENTS = ["ad_left", "ad_right", "ad_bottom"] as const
// 예전 강동 아이파크 공지(flagship_gangdong, 코드에 박힌 예시 디자인)는 2026-10-07 사용 종료.
// DB 에 남은 행은 사이트에 띄우지 않고, 관리자 센터에서 삭제하면 됨
export const NOTICE_TEMPLATES = ["image", "basic"] as const
export const NOTICE_PAGES = ["home", "all"] as const
export const NOTICE_AUDIENCES = ["all", "guest", "member"] as const
export const NOTICE_DEVICES = ["all", "mobile", "desktop"] as const
export const NOTICE_DISMISS = ["none", "today", "week", "forever"] as const
export const NOTICE_STATUSES = ["draft", "published", "hidden"] as const

export interface SiteNoticeInput {
  name: string
  placement: (typeof NOTICE_PLACEMENTS)[number]
  template: (typeof NOTICE_TEMPLATES)[number]
  title: string
  body: string
  imageUrl: string | null
  mobileImageUrl: string | null
  linkUrl: string | null
  linkLabel: string
  linkNewTab: boolean
  pages: (typeof NOTICE_PAGES)[number]
  audience: (typeof NOTICE_AUDIENCES)[number]
  device: (typeof NOTICE_DEVICES)[number]
  dismiss: (typeof NOTICE_DISMISS)[number]
  priority: number
  startsAt: string | null
  endsAt: string | null
  status: (typeof NOTICE_STATUSES)[number]
  contractId: number | null // 어느 계약(b2b.contracts)으로 건 것인지. 외래키 없음 (서비스 분리)
}

export interface SiteNotice extends SiteNoticeInput {
  id: number
  viewCount: number
  clickCount: number
  createdAt: string
  updatedAt: string
}

// 사이트에 내려주는 값 (관리용 이름·통계 제외)
export type PublicSiteNotice = Omit<SiteNotice, "name" | "status" | "contractId" | "viewCount" | "clickCount" | "createdAt" | "updatedAt">

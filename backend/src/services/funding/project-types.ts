// 덕지 펀딩 프로젝트 (All-or-Nothing). 화면 타입은 frontend/types/funding.ts 와 같은 모양으로 내보냄
// 참여는 DP 로 바로 결제(completed). 예전 결제 없는 참여는 reserved, 취소·무산 때 DP 를 돌려주면 refunded
//
// 흐름
//   개설 신청(pending, 견적 전) → 관리자 검수·견적(preparing, 오픈 준비) → 공개(live, 펀딩 받는 중) → success(목표 달성)
//   목표 미달 failed · 중단 canceled · 개설 반려 rejected

// venue: 장소 대관만 · venue_goods: 장소 대관 + 굿즈 제작 · group_buy: 굿즈 제작·공동구매
export const PROJECT_TYPES = ["venue", "venue_goods", "group_buy"] as const
export const PROJECT_STATUSES = ["draft", "pending", "preparing", "live", "success", "failed", "canceled", "rejected"] as const
// 누구나 볼 수 있는 상태 (견적 전·오픈 준비·반려는 개설자와 관리자만)
export const PUBLIC_STATUSES = ["live", "success", "failed", "canceled"] as const
export const END_STATUSES = ["success", "failed", "canceled"] as const
// 관리자가 바꿀 수 있는 단계
export const ADMIN_STATUSES = ["pending", "preparing", "live", "success", "failed", "canceled", "rejected"] as const
export const GOAL_TYPES = ["amount", "count"] as const
export const ROLE_TYPES = ["seller", "visitor", "standard"] as const
export const DELIVERY_METHODS = ["shipping", "pickup", "both"] as const
export const REPORT_REASONS = ["copyright", "false_info", "inappropriate", "other"] as const
export const REPORT_STATUSES = ["received", "investigating", "resolved", "dismissed"] as const

export const TYPE_NAMES: Record<ProjectType, string> = {
  venue: "장소 대관",
  venue_goods: "장소 대관 + 굿즈",
  group_buy: "굿즈 공동구매",
}
export const hasGoods = (type: string) => type === "venue_goods" || type === "group_buy"
export const hasVenue = (type: string) => type === "venue" || type === "venue_goods"

export type ProjectType = (typeof PROJECT_TYPES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export interface TimetableItem {
  time: string
  title: string
  desc?: string
}

// 펀딩에 넣을 덕지몰 품목 (덕지몰 견적 신청 양식과 같은 모양)
export interface GoodsItem {
  id: number
  name: string
  categoryName: string
  imageUrl: string
  quantity: number
  serviceType: string // 렌탈 · 구매 · 맞춤제작
}

export interface GoodsForm {
  eventLocation?: string
  needInstallService?: boolean
  installDate?: string
  attachments: string[] // 시안·참고 사진
  notes?: string
}

// 종류별 항목 (DB details JSONB)
export interface ProjectDetails {
  // 일정 (YYYY-MM-DD)
  eventStart?: string
  eventEnd?: string
  eventTime?: string // 예: 12:00 ~ 18:00
  venueId?: number // 대관 장소 목록에서 고른 경우 (funding.venues)
  goalType?: (typeof GOAL_TYPES)[number]
  desiredPrice?: number // 개설자가 희망하는 1인 참여 가격 (최종 가격은 견적 때 확정)
  videos?: string[]
  goodsItems?: GoodsItem[]
  goodsForm?: GoodsForm
  termsAgreedAt?: string
  region?: string
  venueName?: string
  venueAddress?: string
  eventDate?: string
  totalRentalCost?: number
  pricePerPerson?: number
  minRequiredParticipants?: number
  workTag?: string
  eventFormat?: string
  maxCapacity?: number
  entryFee?: number
  preparations?: string
  timetable?: TimetableItem[]
  images: string[]
  thumbnailUrl: string
  goodsSpec?: { size?: string; material?: string }
  minProductionQty?: number
  estimatedDeliveryDate?: string
  deliveryMethod?: (typeof DELIVERY_METHODS)[number]
  copyrightConfirmed: boolean
}

export interface RewardInput {
  title: string
  description: string
  price: number
  roleType: (typeof ROLE_TYPES)[number]
  maxQuantity?: number
  itemsIncluded: string[]
}

export interface Reward extends RewardInput {
  id: string
  projectId: string
  currentQuantity: number
}

export interface ProjectInput {
  type: ProjectType
  title: string
  summary: string
  description: string
  targetAmount: number
  targetCount: number
  endDate: string
  ageRestriction: "all" | "adult_only"
  partyEventId?: string
  details: ProjectDetails
}

// 관리자: 견적 확정 뒤 공개 전 설정 (목표·마감·참여 옵션·담당자·주제)
export interface SetupInput {
  targetAmount: number
  targetCount: number
  endDate: string
  managerName: string
  topicId: number | null
  rewards?: RewardInput[] // 없으면 그대로 둠
}

// 관리자: 내용 고치기 (제목·소개·일정·장소 등)
export interface EditInput {
  title: string
  summary: string
  description: string
  ageRestriction: "all" | "adult_only"
  details: ProjectDetails
}

export interface QuoteLine {
  label: string
  amount: number
}

export interface QuoteInput {
  lines: QuoteLine[]
  memo: string
  fileUrl: string
}

export interface Quote extends QuoteInput {
  id: string
  projectId: string
  totalAmount: number
  status: "sent" | "accepted" | "replaced"
  createdAt: string
  acceptedAt?: string
}

export interface Message {
  id: string
  projectId: string
  sender: "creator" | "admin"
  senderName: string
  content: string
  createdAt: string
}

export interface Topic {
  id: number
  name: string
  sortOrder: number
  projectCount: number
}

export interface Project extends ProjectDetails {
  id: string
  type: ProjectType
  typeName: string
  title: string
  summary: string
  description: string
  creatorId: string
  creatorName: string
  creatorLevel: string
  creatorAvatar?: string
  status: ProjectStatus
  rejectionReason?: string
  topicId?: number
  topicName?: string
  managerName?: string
  openedAt?: string
  isOfficialLicense: boolean
  isSample: boolean
  targetAmount: number
  currentAmount: number
  targetCount: number
  currentCount: number
  startDate: string
  endDate: string
  ageRestriction: "all" | "adult_only"
  partyEventId?: string
  rewards: Reward[]
  likesCount: number
  commentsCount: number
  noticesCount: number
  createdAt: string
  updatedAt: string
}

export interface ParticipateInput {
  rewardId: string
  quantity: number
  userName: string
  userPhone: string
  userEmail: string
  deliveryAddress: string
  notes: string
  isAdultConfirmed: boolean
}

export interface Participant {
  id: string
  projectId: string
  rewardId: string
  rewardTitle: string
  userId: string
  userName: string
  userPhone: string
  userEmail: string
  quantity: number
  totalPrice: number
  paymentStatus: "reserved" | "completed" | "refunded" | "canceled"
  deliveryAddress?: string
  notes?: string
  isAdultConfirmed: boolean
  createdAt: string
  project?: Project
}

export interface Comment {
  id: string
  projectId: string
  userId: string
  userName: string
  userAvatar?: string
  userLevel?: string
  content: string
  createdAt: string
}

export interface Notice {
  id: string
  projectId: string
  authorType: "creator" | "admin"
  title: string
  content: string
  createdAt: string
}

export interface ReportInput {
  projectId: string
  reporterEmail: string
  reason: (typeof REPORT_REASONS)[number]
  details: string
}

export interface Report extends ReportInput {
  id: string
  projectTitle: string
  reporterId: string
  status: ReportStatus
  adminNote?: string
  createdAt: string
}

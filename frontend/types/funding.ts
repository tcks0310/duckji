// venue: 장소 대관만 · venue_goods: 장소 대관 + 굿즈 제작 · group_buy: 굿즈 제작·공동구매
export type FundingType = "venue" | "venue_goods" | "group_buy"

// pending 견적 전 · preparing 오픈 준비 · live 펀딩 받는 중 · success 목표 달성 · failed 무산 · canceled 중단 · rejected 반려
export type FundingStatus = "draft" | "pending" | "preparing" | "live" | "success" | "failed" | "canceled" | "rejected"

export type AgeRestriction = "all" | "adult_only"

export type RoleType = "seller" | "visitor" | "standard"

export type PaymentStatus = "reserved" | "completed" | "refunded" | "canceled"

export type ReportReason = "copyright" | "false_info" | "inappropriate" | "other"

export type ReportStatus = "received" | "investigating" | "resolved" | "dismissed"

export interface FundingReward {
  id: string
  projectId: string
  title: string
  description: string
  price: number
  roleType?: RoleType
  maxQuantity?: number
  currentQuantity: number
  itemsIncluded: string[]
}

export interface TimetableItem {
  time: string
  title: string
  desc?: string
}

export interface GoodsSpec {
  size?: string
  material?: string
}

// 펀딩에 넣은 덕지몰 품목 (덕지몰 견적 신청 양식과 같은 모양)
export interface FundingGoodsItem {
  id: number
  name: string
  categoryName: string
  imageUrl: string
  quantity: number
  serviceType: string
}

export interface FundingGoodsForm {
  eventLocation?: string
  needInstallService?: boolean
  installDate?: string
  attachments: string[]
  notes?: string
}

export interface FundingProject {
  id: string
  type: FundingType
  typeName: string
  title: string
  summary: string
  description: string
  creatorId: string
  creatorName: string
  creatorLevel: string
  creatorAvatar?: string
  status: FundingStatus
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
  
  // 일정·장소
  eventStart?: string
  eventEnd?: string
  eventTime?: string
  venueId?: number
  goalType?: "amount" | "count"
  desiredPrice?: number
  videos?: string[]
  goodsItems?: FundingGoodsItem[]
  goodsForm?: FundingGoodsForm
  termsAgreedAt?: string
  region?: string
  venueName?: string
  venueAddress?: string
  eventDate?: string
  totalRentalCost?: number
  pricePerPerson?: number
  minRequiredParticipants?: number
  
  // 교류·파티 (Party) Fields
  workTag?: string
  eventFormat?: string
  maxCapacity?: number
  entryFee?: number
  preparations?: string
  ageRestriction?: AgeRestriction
  timetable?: TimetableItem[]
  partyEventId?: string // 파티 이벤트 캘린더(/party)에서 열린 파티 펀딩의 이벤트 (party.events.slug)
  
  // 굿즈 제작 (Goods) Fields
  images: string[]
  thumbnailUrl: string
  goodsSpec?: GoodsSpec
  minProductionQty?: number
  estimatedDeliveryDate?: string
  deliveryMethod?: "shipping" | "pickup" | "both"
  copyrightConfirmed: boolean
  
  // Rewards & Relations
  rewards?: FundingReward[]
  likesCount: number
  commentsCount: number
  noticesCount: number
  
  createdAt: string
  updatedAt: string
}

export interface FundingParticipant {
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
  paymentStatus: PaymentStatus
  deliveryAddress?: string
  notes?: string
  isAdultConfirmed: boolean
  createdAt: string
  project?: FundingProject
  reward?: FundingReward
}

export interface FundingComment {
  id: string
  projectId: string
  userId: string
  userName: string
  userAvatar?: string
  userLevel?: string
  content: string
  createdAt: string
}

export interface FundingNotice {
  id: string
  projectId: string
  authorType: "creator" | "admin"
  title: string
  content: string
  createdAt: string
}

export interface FundingReport {
  id: string
  projectId: string
  projectTitle: string
  reporterId: string
  reporterEmail: string
  reason: ReportReason
  details: string
  status: ReportStatus
  adminNote?: string
  createdAt: string
}

export interface FundingStats {
  liveProjectsCount: number
  totalParticipantsCount: number
  closingSoonCount: number
  totalFundedAmount: number
}

export interface FundingQuote {
  id: string
  projectId: string
  lines: { label: string; amount: number }[]
  totalAmount: number
  memo: string
  fileUrl: string
  status: "sent" | "accepted" | "replaced"
  createdAt: string
  acceptedAt?: string
}

export interface FundingMessage {
  id: string
  projectId: string
  sender: "creator" | "admin"
  senderName: string
  content: string
  createdAt: string
}

export interface FundingTopic {
  id: number
  name: string
  sortOrder: number
  projectCount: number
}

export interface FundingSupporter {
  id: string
  name: string
  avatarUrl: string
}

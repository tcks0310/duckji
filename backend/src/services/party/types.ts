// 생일 · 기념일 · 작중 사건(결전일 등) · 실제 행사
export const PARTY_EVENT_KINDS = ["birthday", "anniversary", "story", "real"] as const
// 회원 제보는 submitted 로 들어와 관리자가 승인(published) 또는 반려(rejected). 숨김은 hidden
export const PARTY_EVENT_STATUSES = ["submitted", "published", "rejected", "hidden"] as const

export interface PartyEvent {
  id: number
  slug: string
  title: string
  kind: (typeof PARTY_EVENT_KINDS)[number]
  workTitle: string
  characterName: string | null
  month: number
  day: number
  year: number | null // null 이면 매년 반복
  description: string
  imageUrl: string | null
  source: string
  gallerySlug: string | null // "파티할래요?" 글을 쓸 작품 갤러리 (없으면 party 갤러리)
  status: (typeof PARTY_EVENT_STATUSES)[number]
  rejectReason: string | null
  suggestedBy: string | null
  postCount: number
  createdAt: string
}

export type PartyEventInput = Omit<PartyEvent, "id" | "rejectReason" | "suggestedBy" | "postCount" | "createdAt">

// 이벤트에 연결된 "파티할래요?" 글 (gallery.posts 요약)
export interface PartyPost {
  id: number
  head: string
  title: string
  authorId: string
  authorName: string
  voteCount: number
  commentCount: number
  createdAt: string
}

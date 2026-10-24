export interface DukjiUser {
  id: string
  name: string
  email: string
  emailVerified?: boolean
  provider: "kakao" | "naver" | "google" | "apple" | "email" | "cognito"
  avatarUrl?: string
  phone?: string
  joinedAt: string
  lastLoginAt: string
  role: "member" | "creator" | "partner" | "admin"
  points: number
  status: "active" | "dormant" | "suspended" | "banned" | "withdrawn"
  authSource: string
  favoriteAnime?: string[]
}

// 화면에 보여 줄 로그인 회원 정보 (localStorage "dukji_user")
export interface UserProfile {
  id: string
  name: string
  email: string
  provider: "kakao" | "naver" | "google" | "apple" | "email"
  avatarUrl?: string
  bio?: string
  favoriteAnime?: string[]
  notifyOpen?: boolean
}

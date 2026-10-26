import type Feather from "@expo/vector-icons/Feather"

// 앱이 띄우는 웹 주소. 앱 표시는 UA 의 DuckjiApp 으로 함
export const BASE_URL = "https://www.duckji.com"
// 게임 전용 주소 (src/GameScreen.tsx 가 이 주소의 게임만 전체 화면으로 띄움)
export const GAMES_URL = "https://games.duckji.com"

export type TabId = "home" | "popups" | "funding" | "store" | "gallery" | "play" | "my"

// 하단 탭: 홈 + 사이트 대분류 5개(frontend/lib/site-menu.ts) + 마이 (hj 10-19, 앱엔 햄버거 메뉴가 없음)
// 모바일 웹 하단 탭(frontend/components/navigation/mobile-tab-bar.tsx)과 같게 맞출 것
export const TABS: { id: TabId; label: string; path: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "home", label: "홈", path: "/", icon: "home" },
  { id: "popups", label: "팝업", path: "/popups/", icon: "map-pin" },
  { id: "funding", label: "펀딩", path: "/funding/", icon: "gift" },
  { id: "store", label: "스토어", path: "/store/goods/", icon: "shopping-bag" },
  { id: "gallery", label: "커뮤니티", path: "/community/gallery/", icon: "image" },
  { id: "play", label: "운세·놀이", path: "/play/", icon: "star" },
  { id: "my", label: "마이", path: "/mypage/", icon: "user" },
]

// 시안 색 (mobile-app-mockup/source/app.css)
export const COLORS = {
  wine: "#631221",
  deep: "#3a0a14",
  line: "rgba(242,182,54,0.22)",
  gold: "#f2b636",
  cream: "#fbf6ec",
  muted: "#cfa9b0",
  tabOff: "#b88f97",
}

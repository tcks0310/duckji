// 사이트 주소 → 화면 이름 (관리자 방문 통계에서 주소 대신 보여 줌)
// 메뉴에 있는 화면은 site-menu.ts 이름을 그대로 쓰고, 메뉴에 없는 화면만 아래에 적습니다.
import { SITE_MENU, PARTNER_MENU } from "@/lib/site-menu"

const EXTRA_PAGE_NAMES: Record<string, string> = {
  "/": "홈",
  "/admin": "관리자 센터",
  "/mypage": "마이페이지",
  "/notifications": "알림",
  "/login": "로그인",
  "/signup": "회원가입",
  "/join": "회원가입",
  "/join/korean": "내국인 회원가입",
  "/auth/naver/callback": "네이버 로그인",
  "/terms": "이용약관",
  "/privacy": "개인정보처리방침",
  "/refund": "청약철회·환불 안내",
  "/consumer": "소비자보호안내",
  "/community/gallery/board": "갤러리 게시판",
  "/community/gallery/post": "갤러리 글 보기",
  "/community/gallery/write": "갤러리 글쓰기",
  "/funding/browse": "펀딩 둘러보기",
  "/funding/new": "펀딩 열기",
  "/funding/my": "내 펀딩 관리",
  "/funding/detail": "펀딩 상세",
  "/funding/party/event": "파티 상세",
}

function normalize(path: string): string {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, "")
  return p === "" ? "/" : p
}

let cache: Map<string, string> | null = null

function names(): Map<string, string> {
  if (cache) return cache
  const map = new Map<string, string>()
  const add = (href: string, name: string) => {
    if (!href.startsWith("/")) return
    const key = normalize(href)
    if (!map.has(key)) map.set(key, name)
  }
  for (const group of SITE_MENU) {
    add(group.href, `${group.label} 메인`)
    for (const item of group.items) {
      add(item.href, item.label)
      for (const sub of item.children || []) add(sub.href, `${item.label} › ${sub.label}`)
    }
  }
  for (const item of PARTNER_MENU) add(item.href, item.label)
  for (const [href, name] of Object.entries(EXTRA_PAGE_NAMES)) map.set(href, name)
  cache = map
  return map
}

// 이름을 모르는 주소는 주소 그대로 돌려줍니다.
export function pageName(path: string): string {
  return names().get(normalize(path)) || path
}

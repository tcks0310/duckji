"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gift, Home, Image as ImageIcon, MapPin, ShoppingBag, Star, User } from "lucide-react"

// 휴대폰 브라우저(모바일 웹) 하단 탭: 덕지 앱 하단 탭(mobile/src/config.ts TABS)과 같은 7개 (홈 + 대분류 5개 + 마이)
// 앱 안에서는 앱이 직접 그려서 숨기고(app-hide), 768px 이상 화면에서도 숨김
const TABS = [
  { label: "홈", href: "/", Icon: Home, match: (p: string) => p === "/" },
  { label: "팝업", href: "/popups/", Icon: MapPin, match: (p: string) => p.startsWith("/popups") },
  { label: "펀딩", href: "/funding/", Icon: Gift, match: (p: string) => p.startsWith("/funding") },
  { label: "스토어", href: "/store/goods/", Icon: ShoppingBag, match: (p: string) => p.startsWith("/store") },
  { label: "커뮤니티", href: "/community/gallery/", Icon: ImageIcon, match: (p: string) => p.startsWith("/community") },
  { label: "운세·놀이", href: "/play/", Icon: Star, match: (p: string) => p.startsWith("/play") },
  { label: "마이", href: "/mypage/", Icon: User, match: (p: string) => p.startsWith("/mypage") || p.startsWith("/notifications") },
]

export function MobileTabBar() {
  const path = usePathname() || "/"
  if (path.startsWith("/admin")) return null
  return (
    <nav
      aria-label="하단 메뉴"
      className="app-hide md:hidden fixed bottom-0 inset-x-0 z-50 grid grid-cols-7 bg-[#3d0a13] border-t border-amber-400/20 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ label, href, Icon, match }) => {
        const on = match(path)
        return (
          <Link key={label} href={href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] whitespace-nowrap ${on ? "text-amber-300" : "text-rose-100/60"}`}>
            <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.2 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

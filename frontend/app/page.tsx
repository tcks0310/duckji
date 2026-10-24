import { PortalPage } from "@/components/portal/portal-page"

// 홈 화면 내용은 components/portal/portal-page.tsx 에 있음 (대분류·소분류 페이지와 같이 씀)
// 메뉴 이름·순서·소분류는 lib/site-menu.ts
export default function Home() {
  return <PortalPage view="home" />
}

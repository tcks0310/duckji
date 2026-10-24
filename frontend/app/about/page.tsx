import type { Metadata } from "next"
import { AboutView } from "@/components/about/about-view"

export const metadata: Metadata = {
  title: "회사 소개 (About) | DUCKJI — 취미가 깊어질 때, 꿈이 시작되는 곳",
  description:
    "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. 8개의 황금알을 찾아 떠나는 글로벌 순례형 캐릭터 IP DUCKJI 세계관을 소개합니다.",
  openGraph: {
    title: "DUCKJI & DUCKSOON | 회사 소개 (About)",
    description: "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. Where Passion Turns to Dreams.",
    images: ["https://www.duckji.com/images/og-main.jpg"],
  },
}

export default function AboutPage() {
  return <AboutView />
}

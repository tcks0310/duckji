"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FUNDING_RECRUIT_GALLERY_HREF } from "@/lib/gallery-links"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { FundingCard } from "@/components/funding/funding-ui"
import { PartyCalendar } from "@/components/funding/party-calendar"
import { fundingService, isPastDeadline } from "@/lib/funding-service"
import type { FundingProject, FundingStats } from "@/types/funding"

// 덕지 펀딩 대분류 메인 (/funding): 소개(오른쪽 파티 캘린더) → 진행 방식 → 두 종류 → 지금 열린 펀딩 → 갤러리·덕지몰 연결
// 펀딩 둘러보기(/funding/browse) · 펀딩 열기(/funding/new) · 내 펀딩 관리(/funding/my) 는 소분류

const STEPS = [
  { title: "장소를 정해요", body: "카페·스튜디오처럼 행사를 열 곳과 날짜를 고르면, 덕지가 대관 가능 여부를 알아봐요." },
  { title: "굿즈를 더해요", body: "덕지몰 품목 중 만들고 싶은 굿즈를 골라요. 장소 없이 굿즈만 공동구매할 수도 있어요." },
  { title: "견적을 받고 열어요", body: "배정된 담당자와 대화하며 견적과 예상 참여 가격을 정하고, 준비가 끝나면 펀딩을 공개해요." },
  { title: "모이면 진행돼요", body: "참여는 DP 로 해요. 목표를 채우면 실제 대관과 제작으로 이어지고, 못 채우면 DP 를 돌려드려요." },
]

export default function FundingMainPage() {
  const [projects, setProjects] = useState<FundingProject[] | null>(null)
  const [stats, setStats] = useState<FundingStats | null>(null)

  useEffect(() => {
    fundingService.getAllProjects().then(setProjects).catch(() => setProjects([]))
    fundingService.getStats().then(setStats).catch(() => {})
  }, [])

  const open = (projects || []).filter((p) => (p.status === "live" || p.status === "success") && !isPastDeadline(p))
  const featured = [...open].sort((a, b) => b.currentCount + b.likesCount * 2 - (a.currentCount + a.likesCount * 2)).slice(0, 4)
  const countOf = (types: string[]) => open.filter((p) => types.includes(p.type)).length

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <SubPageHeader groupId="funding" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-20 sm:space-y-24">
        {/* 소개 + 파티 캘린더 (상단 오른쪽) */}
        <section className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-12 lg:gap-16 items-start">
          <div className="space-y-5 lg:pt-6">
            <p className="text-sm text-emerald-300">덕지 펀딩</p>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-[1.2] break-keep">
              좋아하는 마음이 모이면
              <br />
              생일카페가 열리고 굿즈가 만들어져요
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl break-keep">
              장소를 빌리고, 함께 나눌 굿즈를 만들고, 같은 작품을 좋아하는 사람을 모아요. 견적과 진행은 덕지 담당자가 처음부터 끝까지 함께해요.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/funding/new" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold">
                펀딩 열기
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/funding/browse" className="inline-flex items-center h-12 px-6 rounded-full border border-zinc-600 hover:border-zinc-400 text-white">
                펀딩 둘러보기
              </Link>
              <Link href={FUNDING_RECRUIT_GALLERY_HREF} className="inline-flex items-center h-12 px-2 text-zinc-300 hover:text-white underline underline-offset-4">
                펀딩 모집 갤러리
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-6 pt-8 mt-4 border-t border-zinc-800 max-w-xl">
              <Stat label="지금 열린 펀딩" value={stats ? `${stats.liveProjectsCount}개` : "-"} />
              <Stat label="함께한 덕후" value={stats ? `${stats.totalParticipantsCount.toLocaleString()}명` : "-"} />
              <Stat label="곧 마감" value={stats ? `${stats.closingSoonCount}개` : "-"} />
            </dl>
          </div>

          <aside id="party" className="space-y-3 scroll-mt-28">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">파티 캘린더</h2>
              <p className="text-xs text-zinc-400">생일·기념일로 펀딩 열기</p>
            </div>
            <PartyCalendar compact />
          </aside>
        </section>

        {/* 진행 방식 */}
        <section className="space-y-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white">이렇게 진행돼요</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-zinc-700 pt-5 space-y-2">
                <span className="text-sm text-emerald-300 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed break-keep">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 두 가지 펀딩 */}
        <section className="grid md:grid-cols-2 gap-px bg-zinc-800 border-y border-zinc-800">
          <KindLink
            href="/funding/browse/?group=venue"
            title="대관 펀딩"
            desc="생일카페, 상영회, 팬 파티처럼 장소를 빌려 여는 펀딩이에요. 필요하면 행사 굿즈 제작도 함께 맡길 수 있어요."
            note={projects ? `지금 ${countOf(["venue", "venue_goods"])}개 진행 중` : ""}
          />
          <KindLink
            href="/funding/browse/?group=group_buy"
            title="굿즈 공동구매"
            desc="장소 없이 굿즈만 함께 만들어요. 덕지몰 품목으로 수요를 모으고, 목표를 채우면 제작해 보내 드려요."
            note={projects ? `지금 ${countOf(["group_buy"])}개 진행 중` : ""}
          />
        </section>

        {/* 지금 열린 펀딩 */}
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">지금 모이고 있어요</h2>
            <Link href="/funding/browse" className="text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1">
              전체 보기
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {projects === null ? (
            <p className="py-10 text-sm text-zinc-500">불러오는 중...</p>
          ) : featured.length === 0 ? (
            <div className="py-10 border-y border-zinc-800 space-y-3">
              <p className="text-base text-zinc-300">아직 열린 펀딩이 없어요. 첫 번째 펀딩을 열어 보세요.</p>
              <Link href="/funding/new" className="text-sm text-emerald-300 underline underline-offset-4">
                펀딩 열기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {featured.map((p) => (
                <FundingCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        {/* 커뮤니티·스토어 연결 */}
        <section className="grid md:grid-cols-3 gap-8 border-t border-zinc-800 pt-10 text-sm">
          <Connect title="같은 프로필로 만나요" body="개설자와 참여자를 누르면 덕지 갤러리 피드로 이어져요. 펀딩 후기도 갤러리에 남겨 보세요." href="/community/" label="덕지 갤러리" />
          <Connect title="굿즈는 덕지몰에서" body="펀딩에 넣는 굿즈는 덕지몰 품목과 같아요. 펀딩 없이 바로 견적을 받고 싶다면 덕지몰로 가요." href="/store/mall" label="덕지몰" />
          <Connect title="참여는 DP 로" body="1 DP 는 1원이에요. 목표를 못 채우거나 참여를 취소하면 쓴 DP 를 그대로 돌려드려요." href="/mypage/charge" label="DP 충전" />
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className="text-2xl sm:text-3xl font-semibold text-white tabular-nums mt-1">{value}</dd>
    </div>
  )
}

function KindLink({ href, title, desc, note }: { href: string; title: string; desc: string; note: string }) {
  return (
    <Link href={href} className="group block bg-[hsl(var(--background))] p-6 sm:p-8 space-y-3 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed break-keep max-w-md">{desc}</p>
      {note && <p className="text-sm text-emerald-300">{note}</p>}
    </Link>
  )
}

function Connect({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed break-keep">{body}</p>
      {/* 앱에서는 DP 충전 링크를 숨김 (결제 화면에서 모자란 금액만 카드로) */}
      <Link href={href} className={`inline-block text-emerald-300 hover:text-emerald-200 underline underline-offset-4 ${href.startsWith("/mypage/charge") ? "app-hide" : ""}`}>
        {label}
      </Link>
    </div>
  )
}

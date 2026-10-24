"use client"

import * as React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  Flame, 
  Users, 
  Share2, 
  CheckCircle2, 
  ArrowRight, 
  Gift, 
  TrendingUp,
  Lock,
  Copy,
  Check,
  ShoppingBag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SampleBadge } from "@/components/ui/sample-badge"

interface FundingProject {
  id: string
  title: string
  series: string
  imageUrl: string
  targetUsers: number
  currentUsers: number
  rewardText: string
  tag: string
  desc: string
}

export function GroupFundingSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pledgedMap, setPledgedMap] = useState<Record<string, boolean>>({})

  const projects: FundingProject[] = [
    {
      id: "fund-demonslayer-diorama",
      title: "귀멸의 칼날 2026 무한성편 공식 오리지널 아크릴 디오라마 & 넘버링 액자",
      series: "귀멸의 칼날",
      imageUrl: "/images/events/demon-slayer.jpg",
      targetUsers: 5000,
      currentUsers: 3890,
      rewardText: "목표 달성 시 덕지가 해외 공식 라이선스 직수입 확정 & 참여자 전원 단독 최저가 구매 보장",
      tag: "달성률 78%",
      desc: "일본 현지에서도 품절 대란을 겪은 전설의 무한성 결전 디오라마를 한국 팬덤을 위해 덕지가 단독 수입 추진합니다."
    },
    {
      id: "fund-sololeveling-binder",
      title: "나 혼자만 레벨업 성진우 '그림자 군주' 홀로그램 가죽 컬렉션 카드 바인더",
      series: "나 혼자만 레벨업",
      imageUrl: "/images/events/demon-slayer.jpg",
      targetUsers: 3000,
      currentUsers: 2480,
      rewardText: "목표 달성 시 덕지 자체 단독 한정 수량 제작 & 강동아이파크 팝업 사전 수령 특전",
      tag: "달성률 83%",
      desc: "성진우의 그림자 추출 시그니처 엠보싱 각인과 최고급 벨벳 내지의 2026 한정판 카드 전용 수납 바인더."
    }
  ]

  const handleShare = (id: string) => {
    const url = `https://duckji.com/funding/${id}?ref=viral`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePledge = (id: string, title: string) => {
    setPledgedMap((prev) => ({ ...prev, [id]: true }))
    alert(`🎉 '${title}' 단독 공구/펀딩 알림 신청이 완료되었습니다! 목표 달성 시 카카오 알림톡이 전송됩니다.`)
  }

  return (
    <section id="section-funding" className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4 fill-amber-400" />
            <span>VIRAL COMMUNITY GROUP BUY &amp; FUNDING</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            수요집중형 단독 공구 &amp; 한정판 수입 펀딩
            <SampleBadge />
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            목표 인원 달성 시 덕지가 직접 수입·제작하여 단독 최저가로 오픈합니다! 친구들에게 공유하여 게이지를 채워보세요.
          </p>
        </div>

        <div className="text-xs font-semibold text-zinc-400 bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800">
          누적 펀딩 참여자: <strong className="text-amber-400 font-mono">6,370명</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projects.map((proj) => {
          const progressPct = Math.min(100, Math.round((proj.currentUsers / proj.targetUsers) * 100))
          const isPledged = !!pledgedMap[proj.id]

          return (
            <div
              key={proj.id}
              className="bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-5 transition-all shadow-xl backdrop-blur-md"
            >
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800">
                    <img
                      src={proj.imageUrl}
                      alt={proj.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[9px] font-black bg-red-600 text-white">
                      공구 펀딩
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-amber-400">{proj.series}</div>
                    <h3 className="font-black text-sm sm:text-base text-white line-clamp-2 leading-snug">
                      {proj.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {proj.desc}
                    </p>
                  </div>
                </div>

                {/* Progress Box */}
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white">
                        {proj.currentUsers.toLocaleString()}명 / 목표 {proj.targetUsers.toLocaleString()}명
                      </span>
                    </div>
                    <span className="font-black text-amber-400 text-sm">{progressPct}%</span>
                  </div>

                  <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="text-[10px] text-zinc-400 leading-snug flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>{proj.rewardText}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <Button
                  onClick={() => handlePledge(proj.id, proj.title)}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                    isPledged
                      ? "bg-emerald-500 text-black shadow-lg"
                      : "bg-amber-500 hover:bg-amber-400 text-black shadow-lg"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 mr-1" />
                  <span>{isPledged ? "✓ 펀딩 참여완료 (오픈 알림 예약)" : "공구 펀딩 참여하기 (무료 알림)"}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleShare(proj.id)}
                  className="rounded-xl border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs font-bold px-4"
                  title="친구들에게 공유해서 게이지 채우기"
                >
                  {copiedId === proj.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  <span className="ml-1.5 hidden sm:inline">{copiedId === proj.id ? "복사됨!" : "공유"}</span>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

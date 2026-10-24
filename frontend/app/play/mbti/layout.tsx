"use client"

import * as React from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { Award } from "lucide-react"
import { TarotStampModal } from "@/components/tarot/tarot-stamp-modal"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { DISCLAIMER_TEXT } from "@/lib/tarot-utils"

// 주소 → lib/site-menu.ts 운세·놀이 소분류 id
const TAROT_MENU_IDS: Record<string, string> = {
  "/play/mbti": "tarot",
  "/play/mbti/draw": "tarot-draw",
  "/play/mbti/cards": "tarot-cards",
  "/play/mbti/dice": "tarot-dice",
  "/play/mbti/code": "tarot-code",
}

export default function TarotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isStampModalOpen, setIsStampModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
        {/* 사이트 상단 메뉴 + 위치 (팝업 지도 등 새 페이지와 같은 머리). MBTI 하위 화면은 위치 칩으로 이동 */}
        <SubPageHeader
          groupId="play"
          itemId={TAROT_MENU_IDS[pathname.replace(/\/$/, "")] || "tarot"}
          actions={
            <button
              onClick={() => setIsStampModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-sm"
              title="30칸 도장판 열기"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>도장판</span>
            </button>
          }
        />

        {/* Main Page Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {children}
        </main>

        {/* Persistent Disclaimer Footer */}
        <footer className="border-t border-zinc-900 bg-zinc-950 py-8 px-4 text-center text-xs text-zinc-500">
          <div className="max-w-4xl mx-auto space-y-2">
            <p className="font-semibold text-zinc-400">
              {DISCLAIMER_TEXT}
            </p>
            <p className="text-[11px] text-zinc-400">
              © 2026 DUCKJI 덕지덕순 물상 카드 (천문물상 MBTI). 오리 덕지·덕순 캐릭터 및 22가지 성향 텍스트 콘텐츠의 모든 권리는 주식회사 시야(SIAA)에 있습니다.
            </p>
          </div>
        </footer>

        <Footer />

        {/* Global Stamp Modal */}
        <TarotStampModal
          isOpen={isStampModalOpen}
          onClose={() => setIsStampModalOpen(false)}
        />
      </div>
  )
}

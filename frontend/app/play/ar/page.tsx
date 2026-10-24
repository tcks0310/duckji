"use client"

import * as React from "react"
import { ARCardExperience } from "@/components/ar/ar-card-experience"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"

export default function ARPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-amber-400 selection:text-black">
      {/* 사이트 상단 메뉴 + 위치 (팝업 지도 등 새 페이지와 같은 머리) */}
      <SubPageHeader
        groupId="play"
        itemId="ar"
        actions={
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            WebAR ENGINE 2.0
          </span>
        }
      />

      {/* Main AR Card Experience */}
      <ARCardExperience />

      <Footer />
    </div>
  )
}

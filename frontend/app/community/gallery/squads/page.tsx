"use client"

import * as React from "react"
import { GalleryLayout, type GalleryNav } from "@/components/gallery/gallery-layout"
import { SquadHub } from "@/components/community/squad/squad-hub"

// 덕지 갤러리 안의 스쿼드: 내 스쿼드·만들기·둘러보기. 초대 링크는 ?join=<코드>
// 위쪽 탭: 둘러보기는 '스쿼드', 내 스쿼드·만들기는 오른쪽 '내 스쿼드'
export default function GallerySquadsPage() {
  const [nav, setNav] = React.useState<GalleryNav>("squads")
  return (
    <GalleryLayout nav={nav}>
      <SquadHub onTabChange={(t) => setNav(t === "mine" ? "mysquad" : "squads")} />
    </GalleryLayout>
  )
}

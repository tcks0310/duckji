"use client"

import * as React from "react"
import { Suspense } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { SearchResultsView } from "@/components/search/search-results-view"

// 통합 검색 결과 (/search/?q=검색어): 덕지 안 결과(팝업·펀딩·파티·게시글·갤러리) → 네이버 → 구글 바로가기
export default function SearchPage() {
  const shortcuts = useMyPageShortcuts()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar activeTab="" setActiveTab={() => {}} {...shortcuts} searchQuery="" setSearchQuery={() => {}} />
      <main className="flex-1 pt-24 sm:pt-28 pb-20 app-nav-offset">
        <Suspense fallback={null}>
          <SearchResultsView />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

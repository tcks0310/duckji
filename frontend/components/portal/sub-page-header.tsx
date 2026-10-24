"use client"

import * as React from "react"
import { Navbar } from "@/components/navbar"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { CategoryBreadcrumb } from "@/components/portal/category-tiles"

// 소분류 페이지 공통 머리: 사이트 상단 메뉴 + 대분류 › 소분류 위치 + 같은 대분류 소분류 칩
// (팝업 지도·캘린더 같은 새 페이지와 같은 모양). actions 는 오른쪽 버튼, children 은 그 페이지 안의 탭 등
export function SubPageHeader({
  groupId,
  itemId,
  actions,
  children,
}: {
  groupId: string
  itemId?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const shortcuts = useMyPageShortcuts()
  return (
    <>
      <Navbar
        activeTab=""
        setActiveTab={() => {}}
        {...shortcuts}
        searchQuery=""
        setSearchQuery={() => {}}
      />
      <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-28 space-y-4 app-nav-offset">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0">
            <CategoryBreadcrumb groupId={groupId} itemId={itemId} />
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {children}
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  Flame, 
  Coffee, 
  Palette, 
  ShoppingBag, 
  MapPin, 
  SlidersHorizontal,
  Layers,
  Crown
} from "lucide-react"

interface EventFilterProps {
  selectedCategory: string
  setSelectedCategory: (cat: string) => void
  selectedRegion: string
  setSelectedRegion: (region: string) => void
  selectedStatus: string
  setSelectedStatus: (status: string) => void
  sortBy: string
  setSortBy: (sort: string) => void
  totalCount: number
}

export function EventFilter({
  selectedCategory,
  setSelectedCategory,
  selectedRegion,
  setSelectedRegion,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  totalCount,
}: EventFilterProps) {
  const categories = [
    { id: "all", label: "전체 카테고리", icon: Layers },
    { id: "flagship", label: "DUCKJI 플래그십", icon: Crown, isHighlight: true },
    { id: "anime", label: "애니 팝업스토어", icon: Flame },
    { id: "cafe", label: "콜라보 카페 & 생카", icon: Coffee },
    { id: "exhibition", label: "전시회 & 미디어아트", icon: Palette },
    { id: "goods", label: "상설 굿즈샵 & 성지", icon: ShoppingBag },
  ]

  const regions = [
    { id: "all", label: "전체 지역" },
    { id: "강동", label: "강동/고덕" },
    { id: "성수", label: "성수/서울숲" },
    { id: "홍대", label: "홍대/합정" },
    { id: "강남", label: "강남/삼성" },
    { id: "잠실", label: "잠실/송파" },
    { id: "용산", label: "용산/한남" },
    { id: "중구", label: "청계천/명동" },
  ]

  const statuses = [
    { id: "all", label: "전체 상태" },
    { id: "ongoing", label: "진행중" },
    { id: "upcoming", label: "오픈예정" },
    { id: "closing_soon", label: "마감임박" },
  ]

  return (
    <div className="space-y-4 bg-zinc-900/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const Icon = cat.icon
          const isSelected = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isSelected
                  ? cat.isHighlight
                    ? "bg-red-600 text-black shadow-lg font-black"
                    : "bg-zinc-100 text-black shadow-md font-black"
                  : cat.isHighlight
                    ? "bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25"
                    : "bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sub Filter Row: Region, Status, Sorting & Result Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/60">
        {/* Region Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <div className="flex items-center gap-1 text-xs text-zinc-400 mr-1 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>지역:</span>
          </div>
          {regions.map((reg) => (
            <button
              key={reg.id}
              onClick={() => setSelectedRegion(reg.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedRegion === reg.id
                  ? "bg-emerald-500 text-black font-bold"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
              }`}
            >
              {reg.label}
            </button>
          ))}
        </div>

        {/* Status & Sort */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Status filter */}
          <div className="flex items-center gap-1">
            {statuses.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedStatus === st.id
                    ? "bg-zinc-700 text-white font-bold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="정렬 기준"
              className="bg-zinc-950 text-zinc-300 text-xs rounded-lg px-2.5 py-1 border border-zinc-800 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              <option value="popular">🔥 인기순</option>
              <option value="latest">최신 등록순</option>
              <option value="closing">마감 임박순</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

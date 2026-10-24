"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Calendar, 
  MapPin, 
  Heart, 
  Eye, 
  Sparkles, 
  ExternalLink, 
  Ticket, 
  Clock, 
  Flame,
  ChevronRight
} from "lucide-react"
import { PopupEvent } from "@/data/popup-data"
import { LocationMap } from "@/components/ui/expand-map"

interface PopupCardProps {
  event: PopupEvent
  isLiked: boolean
  onToggleLike: (e: React.MouseEvent) => void
  onSelect: () => void
  onOpenAlertModal?: (e: React.MouseEvent) => void
}

export function PopupCard({
  event,
  isLiked,
  onToggleLike,
  onSelect,
  onOpenAlertModal,
}: PopupCardProps) {
  const [showMapHover, setShowMapHover] = useState(false)
  const [isImgHovered, setIsImgHovered] = useState(false)

  // Status badge styling
  const getStatusBadge = () => {
    switch (event.status) {
      case "ongoing":
        return {
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          dot: "bg-emerald-400",
          text: "진행중",
        }
      case "upcoming":
        return {
          bg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          dot: "bg-purple-400",
          text: event.dDay > 0 ? `D-${event.dDay}` : "오픈예정",
        }
      case "closing_soon":
        return {
          bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          dot: "bg-rose-400",
          text: "마감임박",
        }
      case "ended":
      default:
        return {
          bg: "bg-zinc-700/30 text-zinc-400 border-zinc-700/50",
          dot: "bg-zinc-500",
          text: "종료",
        }
    }
  }

  const badge = getStatusBadge()

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      style={{ zIndex: showMapHover ? 50 : undefined }}
      className={`group relative flex flex-col bg-zinc-900/70 rounded-2xl border border-zinc-800/80 overflow-visible shadow-lg hover:shadow-2xl hover:border-zinc-700 transition-all duration-300 backdrop-blur-md ${
        showMapHover ? "!z-50" : "hover:!z-40 z-10"
      }`}
      onClick={onSelect}
    >
      {/* Poster Image Container */}
      <div 
        className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-zinc-950 cursor-pointer"
        onMouseEnter={() => {
          setIsImgHovered(true)
          setShowMapHover(true)
        }}
        onMouseLeave={() => {
          setIsImgHovered(false)
          setShowMapHover(false)
        }}
      >
        <motion.img
          src={event.posterUrl}
          alt={event.title}
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${badge.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} `} />
              {badge.text}
            </span>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-zinc-300 border border-white/10 backdrop-blur-md">
              {event.categoryLabel}
            </span>
          </div>

          {/* Like Button */}
          <button
            onClick={onToggleLike}
            className={`pointer-events-auto p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
              isLiked
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg"
                : "bg-black/50 text-zinc-400 hover:text-white border border-white/10 hover:bg-black/80"
            }`}
            aria-label="관심 팝업 찜하기"
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500" : ""}`} />
          </button>
        </div>

        {/* Hover Hint Overlay on Image */}
        <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-zinc-950/90 px-2 py-1 rounded-md border border-emerald-500/30 backdrop-blur-sm shadow-md">
            <MapPin className="w-3 h-3 text-emerald-400" />
            위치 맵 보기
          </span>
        </div>
      </div>

      {/* Card Info Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Title and Subtitle */}
        <div
          onMouseEnter={() => setShowMapHover(true)}
          onMouseLeave={() => setShowMapHover(false)}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{event.venueName}</span>
          </div>
          <h3 className="font-bold text-base text-zinc-100 leading-snug group-hover:text-emerald-400 transition-colors line-clamp-1">
            {event.title}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
            {event.subTitle}
          </p>
        </div>

        {/* Schedule & Location Details */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span>{event.startDate} ~ {event.endDate}</span>
          </div>
          <div 
            className="flex items-center gap-2 text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer group/loc"
            onMouseEnter={() => setShowMapHover(true)}
            onMouseLeave={() => setShowMapHover(false)}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 transition-transform" />
            <span className="line-clamp-1 underline-offset-2 group-hover/loc:underline">{event.location}</span>
          </div>
        </div>

        {/* Footer info: views, reservation label, CTA button */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {event.viewCount.toLocaleString()}
            </span>
            <span>•</span>
            <span className="text-zinc-400 font-medium">
              {event.reservationLabel}
            </span>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 hover:underline"
          >
            <span>상세보기</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Interactive 3D LocationMap Hover Popover (Prompts requirement) */}
      <AnimatePresence>
        {showMapHover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-auto hidden md:block drop-shadow-2xl"
            onMouseEnter={() => setShowMapHover(true)}
            onMouseLeave={() => setShowMapHover(false)}
          >
            <LocationMap
              location={event.location}
              coordinates={event.coordinates}
              venueName={event.venueName}
              compact={false}
            />
            {/* Popover Arrow */}
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-zinc-800 mx-auto -mt-[1px]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

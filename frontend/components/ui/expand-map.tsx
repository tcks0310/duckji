"use client"

import type React from "react"
import { useState, useRef } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion"
import { ExternalLink, Navigation, MapPin } from "lucide-react"

interface LocationMapProps {
  location?: string
  coordinates?: string
  venueName?: string
  className?: string
  width?: number | string
  height?: number | string
  compact?: boolean
  onClickMap?: () => void
}

export function LocationMap({
  location = "서울특별시 성동구 연무장길 35",
  coordinates = "37.5445° N, 127.0560° E",
  venueName = "성수 팝업스토어 성지",
  className = "",
  compact = false,
  onClickMap,
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8])
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8])

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mouseX.set(e.clientX - centerX)
    mouseY.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
    if (onClickMap) onClickMap()
  }

  const openMapExternal = (e: React.MouseEvent) => {
    e.stopPropagation()
    const encoded = encodeURIComponent(location)
    window.open(`https://map.naver.com/p/search/${encoded}`, "_blank")
  }

  return (
    <motion.div
      ref={containerRef}
      className={`relative cursor-pointer select-none ${className}`}
      style={{
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-zinc-900/90 border border-zinc-700/60 shadow-2xl backdrop-blur-md"
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          width: isExpanded ? 340 : compact ? 220 : 260,
          height: isExpanded ? 260 : compact ? 120 : 140,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 35,
        }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/10" />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0 bg-zinc-950/80" />

              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                {/* Main roads */}
                <motion.line
                  x1="0%"
                  y1="35%"
                  x2="100%"
                  y2="35%"
                  className="stroke-emerald-400/40"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.line
                  x1="0%"
                  y1="65%"
                  x2="100%"
                  y2="65%"
                  className="stroke-emerald-400/40"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />

                {/* Vertical main roads */}
                <motion.line
                  x1="30%"
                  y1="0%"
                  x2="30%"
                  y2="100%"
                  className="stroke-emerald-400/30"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
                <motion.line
                  x1="70%"
                  y1="0%"
                  x2="70%"
                  y2="100%"
                  className="stroke-emerald-400/30"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />

                {/* Secondary streets */}
                {[20, 50, 80].map((y, i) => (
                  <motion.line
                    key={`h-${i}`}
                    x1="0%"
                    y1={`${y}%`}
                    x2="100%"
                    y2={`${y}%`}
                    className="stroke-zinc-500/30"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  />
                ))}
                {[15, 45, 55, 85].map((x, i) => (
                  <motion.line
                    key={`v-${i}`}
                    x1={`${x}%`}
                    y1="0%"
                    x2={`${x}%`}
                    y2="100%"
                    className="stroke-zinc-500/30"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                  />
                ))}
              </svg>

              {/* Buildings */}
              <motion.div
                className="absolute top-[38%] left-[10%] w-[16%] h-[20%] rounded-sm bg-emerald-500/20 border border-emerald-400/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              />
              <motion.div
                className="absolute top-[15%] left-[36%] w-[12%] h-[16%] rounded-sm bg-purple-500/20 border border-purple-400/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              />
              <motion.div
                className="absolute top-[68%] left-[74%] w-[18%] h-[18%] rounded-sm bg-zinc-600/30 border border-zinc-500/20"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              />

              {/* Central Map Pin */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
              >
                <div className="relative">
                  <div className="absolute -inset-2 bg-emerald-500/40 rounded-full blur-md animate-pulse" />
                  <MapPin className="w-8 h-8 text-emerald-400 fill-emerald-500/30 relative z-10" />
                </div>
                <span className="mt-1 text-[10px] font-bold text-white bg-zinc-900/90 px-2 py-0.5 rounded-full border border-emerald-500/40 whitespace-nowrap shadow-lg">
                  {venueName}
                </span>
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-70" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid pattern - only show when collapsed */}
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{ opacity: isExpanded ? 0 : 0.1 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </motion.div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          {/* Top section */}
          <div className="flex items-start justify-between">
            <div className="relative flex items-center gap-2">
              <motion.div
                className="relative p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                animate={{
                  scale: isHovered ? 1.1 : 1,
                  boxShadow: isHovered
                    ? "0 0 16px rgba(52, 211, 153, 0.4)"
                    : "0 0 4px rgba(52, 211, 153, 0.1)",
                }}
                transition={{ duration: 0.3 }}
              >
                <Navigation className="w-3.5 h-3.5" />
              </motion.div>
              <span className="text-[11px] font-bold tracking-wide text-zinc-300">
                {venueName}
              </span>
            </div>

            {/* Status indicator */}
            <motion.div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30"
              animate={{
                scale: isHovered ? 1.05 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400 tracking-wider uppercase">MAP</span>
            </motion.div>
          </div>

          {/* Bottom section */}
          <div className="space-y-1 mt-auto">
            <motion.h4
              className="text-white font-medium text-xs tracking-tight line-clamp-1"
              animate={{
                x: isHovered ? 2 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.h4>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className="space-y-2 pt-1"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-zinc-400 text-[10px] font-mono">
                    {coordinates}
                  </p>
                  <button
                    onClick={openMapExternal}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/30 transition-colors w-full justify-center"
                  >
                    <span>네이버 지도 길찾기</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animated underline */}
            <motion.div
              className="h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent rounded-full"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{
                scaleX: isHovered || isExpanded ? 1 : 0.4,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Click hint */}
      <motion.p
        className="absolute -bottom-5 left-1/2 text-[10px] font-medium text-zinc-400 whitespace-nowrap bg-zinc-900/90 px-2 py-0.5 rounded-full border border-zinc-800"
        style={{ x: "-50%" }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: isHovered && !isExpanded ? 1 : 0,
          y: isHovered ? 0 : 3,
        }}
        transition={{ duration: 0.2 }}
      >
        🗺️ 클릭하여 지도 3D 확장
      </motion.p>
    </motion.div>
  )
}

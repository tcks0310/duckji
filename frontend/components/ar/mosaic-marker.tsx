"use client"

import React from "react"
import { ARCard } from "./ar-card-data"
import { ShieldCheck, Sparkles, QrCode, Cpu, Lock } from "lucide-react"

interface MosaicMarkerProps {
  card: ARCard
  size?: number // size in px
  showDetails?: boolean
  className?: string
}

export function MosaicMarker({
  card,
  size = 240,
  showDetails = true,
  className = "",
}: MosaicMarkerProps) {
  const grid = card.mosaicGrid
  const cellSize = size / 10

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-5 rounded-3xl bg-zinc-950 border-2 border-zinc-800 select-none overflow-hidden ${className}`}
      style={{ width: size + 40 }}
    >
      {/* Background Holographic Texture */}
      <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

      {/* Top Security Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3 text-[10px] text-zinc-400 font-mono">
        <div className="flex items-center gap-1 text-amber-400 font-bold">
          <Cpu className="w-3.5 h-3.5" />
          <span>DUCKJI AR MARKER</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          <Lock className="w-3 h-3" />
          <span>1-TIME BIND</span>
        </div>
      </div>

      {/* Main 8x8 Mosaic Matrix with AR Calibration Frame */}
      <div
        className="relative bg-black p-3 rounded-2xl border-2 border-zinc-700 shadow-inner"
        style={{ width: size, height: size }}
      >
        {/* 4 Corner Calibration Finder Blocks */}
        <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
        <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
        <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
        <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

        {/* Center Target Aim */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-12 h-12 rounded-full border border-dashed border-amber-400" />
        </div>

        {/* 8x8 Matrix Grid */}
        <div
          className="grid gap-[2px] w-full h-full p-1"
          style={{
            gridTemplateColumns: `repeat(8, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(8, minmax(0, 1fr))`,
          }}
        >
          {grid.map((row, rIdx) =>
            row.map((val, cIdx) => {
              const isDark = val === 1
              // Unique accent coloring for corners and special center keys
              const isCorner =
                (rIdx <= 1 && cIdx <= 1) ||
                (rIdx <= 1 && cIdx >= 6) ||
                (rIdx >= 6 && cIdx <= 1) ||
                (rIdx >= 6 && cIdx >= 6)

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`rounded-[2px] transition-all duration-300 ${
                    isDark
                      ? isCorner
                        ? "bg-amber-400"
                        : "bg-zinc-100"
                      : "bg-zinc-900/60"
                  }`}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Security Serial & Token Info */}
      {showDetails && (
        <div className="w-full mt-3 pt-2.5 border-t border-zinc-800/80 text-center space-y-1">
          <div className="text-[11px] font-mono font-black text-amber-300 tracking-wider">
            {card.code}
          </div>
          <div className="text-[9px] text-zinc-500 font-mono flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>HASH: {card.id.toUpperCase()}-VERIFIED</span>
          </div>
        </div>
      )}
    </div>
  )
}

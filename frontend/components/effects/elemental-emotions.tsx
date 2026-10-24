"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Flame, Droplets, Sparkles, Waves } from "lucide-react"

// ==========================================
// 1. 🔥 Fire / Flame Emotion Component
// ==========================================
export function FireEmotionEffect({ isActive }: { isActive: boolean }) {
  // 12 Ember & Flame Particles
  const fireParticles = [
    { id: 1, left: "15%", bottom: "0%", size: 16, delay: 0, duration: 1.2, xOffset: -12, emoji: "🔥" },
    { id: 2, left: "30%", bottom: "5%", size: 20, delay: 0.2, duration: 1.5, xOffset: 15, emoji: "🔥" },
    { id: 3, left: "50%", bottom: "0%", size: 24, delay: 0.1, duration: 1.3, xOffset: -8, emoji: "💥" },
    { id: 4, left: "70%", bottom: "8%", size: 18, delay: 0.3, duration: 1.4, xOffset: 18, emoji: "🔥" },
    { id: 5, left: "85%", bottom: "2%", size: 15, delay: 0.15, duration: 1.1, xOffset: -10, emoji: "✨" },
    { id: 6, left: "22%", bottom: "10%", size: 12, delay: 0.4, duration: 1.6, xOffset: 8, isDot: true, color: "#f97316" },
    { id: 7, left: "42%", bottom: "15%", size: 14, delay: 0.25, duration: 1.3, xOffset: -15, isDot: true, color: "#ef4444" },
    { id: 8, left: "62%", bottom: "5%", size: 10, delay: 0.35, duration: 1.7, xOffset: 12, isDot: true, color: "#eab308" },
    { id: 9, left: "78%", bottom: "12%", size: 13, delay: 0.05, duration: 1.4, xOffset: -6, isDot: true, color: "#f97316" },
    { id: 10, left: "10%", bottom: "18%", size: 9, delay: 0.5, duration: 1.5, xOffset: 14, isDot: true, color: "#ef4444" },
    { id: 11, left: "58%", bottom: "10%", size: 18, delay: 0.18, duration: 1.25, xOffset: 20, emoji: "🔥" },
    { id: 12, left: "90%", bottom: "5%", size: 14, delay: 0.28, duration: 1.35, xOffset: -12, emoji: "🔥" },
  ]

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30"
        >
          {/* Pulsating Fiery Aura Glow */}
          <motion.div
            animate={{
              opacity: [0.6, 0.95, 0.6],
              scale: [1, 1.03, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-t from-red-600/40 via-orange-500/20 to-transparent border-2 border-red-500/80 rounded-2xl shadow-[inset_0_0_35px_rgba(239,68,68,0.6)]"
          />

          {/* Bottom Rising Fire Flame Waves */}
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-red-600/60 via-orange-500/30 to-transparent backdrop-blur-[1px]" />

          {/* Floating Fire Particles & Emojis */}
          {fireParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [-10, -90, -170],
                x: [0, p.xOffset, p.xOffset * 1.5],
                scale: [0.6, 1.2, 0.4],
                rotate: [0, p.xOffset > 0 ? 25 : -25, p.xOffset > 0 ? 45 : -45],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeOut",
              }}
              style={{
                position: "absolute",
                left: p.left,
                bottom: p.bottom,
                fontSize: p.size,
                zIndex: 40,
              }}
            >
              {p.isDot ? (
                <div
                  className="rounded-full blur-[0.5px]"
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                  }}
                />
              ) : (
                <span className="filter select-none">
                  {p.emoji}
                </span>
              )}
            </motion.div>
          ))}

          {/* Top Fire Emotion Badge */}
          <motion.div
            initial={{ y: -15, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.8 }}
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-[10px] shadow-lg flex items-center gap-1 border border-amber-300/40 z-50"
          >
            <Flame className="w-3 h-3 fill-amber-300 text-amber-300" />
            <span className="tracking-tight">불의 호흡 (FIRE EMOTION)</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ==========================================
// 2. 💧 Water / Wave Emotion Component
// ==========================================
export function WaterEmotionEffect({ isActive }: { isActive: boolean }) {
  // 12 Water, Bubble & Splash Particles
  const waterParticles = [
    { id: 1, left: "12%", bottom: "0%", size: 16, delay: 0, duration: 1.4, xOffset: 12, emoji: "💧" },
    { id: 2, left: "28%", bottom: "6%", size: 20, delay: 0.25, duration: 1.6, xOffset: -14, emoji: "🌊" },
    { id: 3, left: "48%", bottom: "2%", size: 22, delay: 0.1, duration: 1.5, xOffset: 10, emoji: "🫧" },
    { id: 4, left: "68%", bottom: "10%", size: 18, delay: 0.35, duration: 1.45, xOffset: -16, emoji: "💧" },
    { id: 5, left: "84%", bottom: "4%", size: 16, delay: 0.15, duration: 1.3, xOffset: 8, emoji: "🌀" },
    { id: 6, left: "20%", bottom: "14%", size: 12, delay: 0.4, duration: 1.7, xOffset: -8, isDot: true, color: "#38bdf8" },
    { id: 7, left: "38%", bottom: "18%", size: 15, delay: 0.2, duration: 1.35, xOffset: 18, isDot: true, color: "#06b6d4" },
    { id: 8, left: "60%", bottom: "8%", size: 11, delay: 0.3, duration: 1.6, xOffset: -12, isDot: true, color: "#60a5fa" },
    { id: 9, left: "76%", bottom: "15%", size: 13, delay: 0.08, duration: 1.5, xOffset: 10, isDot: true, color: "#38bdf8" },
    { id: 10, left: "92%", bottom: "20%", size: 10, delay: 0.45, duration: 1.4, xOffset: -15, isDot: true, color: "#22d3ee" },
    { id: 11, left: "54%", bottom: "12%", size: 18, delay: 0.18, duration: 1.3, xOffset: -18, emoji: "💧" },
    { id: 12, left: "88%", bottom: "8%", size: 15, delay: 0.28, duration: 1.4, xOffset: 12, emoji: "🌊" },
  ]

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30"
        >
          {/* Pulsating Water Wave Aura Glow */}
          <motion.div
            animate={{
              opacity: [0.6, 0.95, 0.6],
              scale: [1, 1.03, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-t from-cyan-600/40 via-blue-500/20 to-transparent border-2 border-cyan-400/80 rounded-2xl shadow-[inset_0_0_35px_rgba(34,211,238,0.6)]"
          />

          {/* Bottom Swirling Water Wave Surge */}
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-cyan-600/60 via-blue-500/30 to-transparent backdrop-blur-[1px]" />

          {/* Floating Water Droplets & Emojis */}
          {waterParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [-10, -90, -170],
                x: [0, p.xOffset, p.xOffset * 1.5],
                scale: [0.6, 1.2, 0.4],
                rotate: [0, p.xOffset > 0 ? -20 : 20, p.xOffset > 0 ? -40 : 40],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeOut",
              }}
              style={{
                position: "absolute",
                left: p.left,
                bottom: p.bottom,
                fontSize: p.size,
                zIndex: 40,
              }}
            >
              {p.isDot ? (
                <div
                  className="rounded-full blur-[0.5px]"
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                  }}
                />
              ) : (
                <span className="filter select-none">
                  {p.emoji}
                </span>
              )}
            </motion.div>
          ))}

          {/* Top Water Emotion Badge */}
          <motion.div
            initial={{ y: -15, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.8 }}
            className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-cyan-500 text-white font-black text-[10px] shadow-lg flex items-center gap-1 border border-cyan-200/40 z-50"
          >
            <Droplets className="w-3 h-3 fill-cyan-200 text-cyan-200" />
            <span className="tracking-tight">물의 호흡 (WATER EMOTION)</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

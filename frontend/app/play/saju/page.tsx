"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  ArrowLeft, 
  ShoppingBag, 
  Heart, 
  Users, 
  Layers, 
  Award,
  Zap,
  Volume2,
  VolumeX,
  Compass,
  BookOpen,
  Film,
  RotateCcw,
  CheckCircle2
} from "lucide-react"

import { SajuInput, IsekaiProfile, calculateSajuProfile } from "@/lib/saju-engine"
import { SajuInputForm } from "@/components/saju/saju-input-form"
import { SajuModeSelector, SajuExperienceMode } from "@/components/saju/saju-mode-selector"
import { SajuWebtoonStory } from "@/components/saju/saju-webtoon-story"
import { SajuAnimeRecommender } from "@/components/saju/saju-anime-recommender"
import { SajuCardResult } from "@/components/saju/saju-card-result"
import { SajuGoodsMaker } from "@/components/saju/saju-goods-maker"
import { SajuGuildBoard } from "@/components/saju/saju-guild-board"
import { CartDrawer } from "@/components/shop/cart-drawer"
import { Button } from "@/components/ui/button"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { addToCart, clearCart, removeCartItem, updateCartQuantity, useSavedItems, type SaveResult } from "@/lib/saved-items"

export default function SajuPage() {
  const [activeTab, setActiveTab] = useState<"saju" | "goods" | "guild">("saju")
  const [sajuView, setSajuView] = useState<"input" | "mode_select" | "webtoon_story" | "anime_recommendation" | "card_result">("input")
  const [profile, setProfile] = useState<IsekaiProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Event modal for popups clicked in Mode 2

  // 찜·장바구니: 로그인한 회원 계정에 저장 (lib/saved-items)
  const saved = useSavedItems()
  const [isCartOpen, setIsCartOpen] = useState(false)
  const cart = saved.cart

  const handleSaveResult = (result: SaveResult) => {
    if (result === "login") {
      if (window.confirm("로그인하면 찜·장바구니를 쓸 수 있어요. 로그인할까요?")) window.location.href = "/login"
    } else if (result === "error") {
      window.alert("저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
    }
    return result === "ok"
  }

  // Load saved saju profile if existing with strict schema validation
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dukji_saju_profile")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (
          parsed &&
          parsed.dayMaster &&
          parsed.fourPillars &&
          parsed.sajuReasoning &&
          Array.isArray(parsed.favoriteAnimeList) &&
          parsed.primaryElement
        ) {
          setProfile(parsed)
          setSajuView("mode_select")
        } else {
          // Discard incompatible legacy profile from previous version
          localStorage.removeItem("dukji_saju_profile")
          setProfile(null)
          setSajuView("input")
        }
      }
    } catch (e) {
      try {
        localStorage.removeItem("dukji_saju_profile")
      } catch (err) {}
      setProfile(null)
      setSajuView("input")
    }
  }, [])

  const handleFormSubmit = (input: SajuInput) => {
    setIsLoading(true)
    setTimeout(() => {
      const calculated = calculateSajuProfile(input)
      setProfile(calculated)
      try {
        localStorage.setItem("dukji_saju_profile", JSON.stringify(calculated))
      } catch (e) {}
      setIsLoading(false)
      setSajuView("mode_select")
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 600)
  }

  const handleSelectMode = (mode: SajuExperienceMode) => {
    setSajuView(mode)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleReset = () => {
    localStorage.removeItem("dukji_saju_profile")
    setProfile(null)
    setSajuView("input")
    setActiveTab("saju")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Cart handlers
  const handleAddToCart = async (item: any) => {
    if (handleSaveResult(await addToCart(item))) setIsCartOpen(true)
  }

  const handleUpdateCartQuantity = (goodsId: string, delta: number) => {
    updateCartQuantity(goodsId, delta)
  }

  const handleRemoveCartItem = (goodsId: string) => {
    removeCartItem(goodsId)
  }

  const handleClearCart = () => {
    clearCart()
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500 selection:text-black relative overflow-x-hidden">
      {/* Mystical Starry Ambient Glow */}

      {/* 사이트 상단 메뉴 + 위치 (팝업 지도 등 새 페이지와 같은 머리) + 사주 화면 탭 */}
      <SubPageHeader groupId="play" itemId="saju" actions={
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setIsCartOpen(true)}
              className="relative rounded-full text-zinc-300 hover:text-emerald-400 transition-colors"
              title="굿즈 장바구니"
            >
              <ShoppingBag className="w-4 h-4" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 text-black text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </Button>
      }>
          <nav className="inline-flex items-center gap-1 bg-zinc-900/90 p-1 rounded-full border border-zinc-800 backdrop-blur-md">
            <button
              onClick={() => setActiveTab("saju")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "saju"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🔮 사주풀이
            </button>
            <button
              onClick={() => {
                if (!profile) {
                  alert("먼저 사주를 풀고 나만의 캐릭터를 각성해주세요!")
                  return
                }
                setActiveTab("goods")
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "goods"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🎨 굿즈 공방
            </button>
            <button
              onClick={() => setActiveTab("guild")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "guild"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ⚔️ 길드 광장
            </button>
          </nav>
      </SubPageHeader>

      {/* Sub-Navigation for Saju Modes (Visible when Profile is ready in Saju Tab) */}
      {activeTab === "saju" && profile && sajuView !== "input" && (
        <div className="relative z-20 mt-4 bg-zinc-900/80 border-y border-zinc-800/80 px-4 py-2 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500 font-bold hidden sm:inline">체험 모드:</span>
              <button
                onClick={() => setSajuView("mode_select")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  sajuView === "mode_select"
                    ? "bg-zinc-800 text-amber-300 border border-amber-500/40"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                모드 선택
              </button>
              <button
                onClick={() => setSajuView("webtoon_story")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  sajuView === "webtoon_story"
                    ? "bg-amber-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>1. 웹툰 스토리 사주</span>
              </button>
              <button
                onClick={() => setSajuView("anime_recommendation")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  sajuView === "anime_recommendation"
                    ? "bg-emerald-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>2. 애니 & 팝업 추천관</span>
              </button>
              <button
                onClick={() => setSajuView("card_result")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  sajuView === "card_result"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>3D 사주 카드</span>
              </button>
            </div>

            <button
              onClick={handleReset}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>새로 풀기</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 w-full">
        {/* Tab 1: Saju Journey */}
        {activeTab === "saju" && (
          <div>
            {sajuView === "input" && (
              <SajuInputForm onSubmit={handleFormSubmit} isLoading={isLoading} />
            )}

            {sajuView === "mode_select" && profile && (
              <SajuModeSelector onSelectMode={handleSelectMode} />
            )}

            {sajuView === "webtoon_story" && profile && (
              <SajuWebtoonStory
                profile={profile}
                onCompleteToResult={() => {
                  setSajuView("card_result")
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                onReset={handleReset}
                onGoToGoodsMaker={() => setActiveTab("goods")}
              />
            )}

            {sajuView === "anime_recommendation" && profile && (
              <SajuAnimeRecommender
                profile={profile}
                onSwitchToWebtoonMode={() => {
                  setSajuView("webtoon_story")
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                onReset={handleReset}
              />
            )}

            {sajuView === "card_result" && profile && (
              <SajuCardResult
                profile={profile}
                onGoToGoodsMaker={() => setActiveTab("goods")}
                onGoToGuildBoard={() => setActiveTab("guild")}
                onReset={handleReset}
              />
            )}
          </div>
        )}

        {/* Tab 2: Custom Goods Maker */}
        {activeTab === "goods" && profile && (
          <SajuGoodsMaker
            profile={profile}
            onAddToCart={handleAddToCart}
            onBackToResult={() => setActiveTab("saju")}
          />
        )}

        {/* Tab 3: Guild Board */}
        {activeTab === "guild" && (
          <SajuGuildBoard
            currentProfile={profile}
            onStartMySaju={() => {
              setActiveTab("saju")
              setSajuView("input")
            }}
          />
        )}
      </main>

      {/* Saju Bottom Footer */}
      <footer className="mt-auto border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 relative z-10 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>© 2026 DUKJI (덕후들의 성지, 덕지). All rights reserved.</span>
            <span className="hidden sm:inline text-zinc-700">|</span>
            <span className="text-zinc-300 font-semibold tracking-wide">디자인 by sohwakgge</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <span>Designed with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>for All Deokhus</span>
          </div>
        </div>
      </footer>

      <Footer />

      {/* Global Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
      />
    </div>
  )
}

"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ShoppingBag, 
  Sparkles, 
  Box, 
  Layers, 
  Check, 
  Star, 
  Flame, 
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Tag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IsekaiProfile } from "@/lib/saju-engine"
import { CUSTOM_GOODS_TEMPLATES, CustomGoodsTemplate } from "@/data/saju-data"

interface SajuGoodsMakerProps {
  profile: IsekaiProfile
  onAddToCart: (item: any) => void
  onBackToResult: () => void
}

export function SajuGoodsMaker({ profile, onAddToCart, onBackToResult }: SajuGoodsMakerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CustomGoodsTemplate>(CUSTOM_GOODS_TEMPLATES[0])
  const [selectedBaseOption, setSelectedBaseOption] = useState<string>(CUSTOM_GOODS_TEMPLATES[0].options[0])
  const [addedSuccess, setAddedSuccess] = useState(false)

  const handleAddToCart = () => {
    const customGoodsItem = {
      id: `custom-saju-${selectedTemplate.id}-${Date.now()}`,
      name: `[맞춤제작] ${profile.heroNickname} ${selectedTemplate.name}`,
      series: "덕지 사주 아바타 컬렉션",
      popupEventId: "custom-saju",
      popupTitle: `사주 ${profile.primaryElement.korean} 속성 커스텀`,
      price: selectedTemplate.basePrice,
      badge: "한정판" as const,
      category: selectedTemplate.category === "acrylic" ? "acrylic" : selectedTemplate.category === "figure3d" ? "figure" : "stationery",
      categoryLabel: "맞춤 커스텀",
      imageUrl: profile.avatarImage,
      inStock: true,
      stockCount: 99,
      description: `${profile.characterTitle} [${profile.heroNickname}] 전용 각인이 적용된 맞춤 ${selectedTemplate.name}. 옵션: ${selectedBaseOption}`,
      specs: selectedTemplate.specs
    }

    onAddToCart(customGoodsItem)
    setAddedSuccess(true)
    setTimeout(() => {
      setAddedSuccess(false)
    }, 2500)
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToResult}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>사주 감정서로 돌아가기</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            나만의 사주 아바타 굿즈 공방
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            방금 각성한 {profile.heroNickname} 님의 캐릭터로 실물 굿즈를 주문 제작해보세요!
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5" />
          <span>1:1 프리미엄 커스텀 각인</span>
        </div>
      </div>

      {/* Goods Category Select & Live Custom Mockup Preview inside a locked relative container */}
      <div className="relative rounded-3xl overflow-hidden p-1">
        {/* Background Blurred Maker Content */}
        <div className="space-y-8 filter blur-[6px] opacity-30 pointer-events-none select-none">
          {/* Goods Category Select */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CUSTOM_GOODS_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplate.id === tmpl.id
              return (
                <div
                  key={tmpl.id}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-zinc-800 border-amber-400/80 shadow-xl"
                      : "bg-zinc-900/80 border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-zinc-950 text-emerald-400 border border-zinc-800">
                      {tmpl.category === "acrylic" ? "아크릴 스탠드" : tmpl.category === "figure3d" ? "3D 피규어" : "홀로그램 포토카드"}
                    </span>
                    <span className="text-xs font-black text-white">
                      {tmpl.basePrice.toLocaleString()}원
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white line-clamp-1">{tmpl.name}</h4>
                </div>
              )
            })}
          </div>

          {/* Live Custom Mockup Preview & Options */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Mockup Preview Visual (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-zinc-950 rounded-2xl border border-zinc-800/80 relative overflow-hidden">
              <div className="relative w-48 h-64 flex flex-col items-center justify-end">
                <div className="relative w-40 h-52 rounded-2xl overflow-hidden border-2 border-emerald-400/60 shadow-2xl bg-zinc-900">
                  <img
                    src={profile.avatarImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-center">
                    <span className="text-[10px] font-black text-amber-300">
                      {profile.heroNickname}
                    </span>
                  </div>
                </div>

                <div className="w-48 h-6 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded-full border border-zinc-600 shadow-xl mt-[-8px] flex items-center justify-center text-[9px] font-bold text-emerald-400">
                  {selectedBaseOption}
                </div>
              </div>
            </div>

            {/* Customization Options (7 cols) */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-amber-400">CUSTOM PRODUCTION</span>
                  <h3 className="text-xl font-black text-white mt-0.5">{selectedTemplate.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{selectedTemplate.description}</p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2 text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>기본 각인 정보:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-zinc-300 text-[11px]">
                    <div><strong>칭호:</strong> {profile.characterTitle}</div>
                    <div><strong>닉네임:</strong> {profile.heroNickname}</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-4">
                <div className="text-xl font-black text-emerald-400">
                  {selectedTemplate.basePrice.toLocaleString()}원
                </div>
                <Button className="bg-emerald-500 text-black font-black px-6 py-3.5 rounded-2xl text-xs">
                  커스텀 굿즈 주문하기
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Lock Overlay Card */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/40 backdrop-blur-[4px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-md w-full bg-zinc-900/95 border border-zinc-700/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/90 flex flex-col items-center space-y-4 backdrop-blur-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl mb-1">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black tracking-widest uppercase">
              3D GOODS LAB
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              덕지몰 COMING SOON
            </h3>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-sm">
              나만의 사주 아바타 3D 피규어 &amp; 아크릴 스탠드 1:1 맞춤 제작 결제 시스템 준비 중입니다. 더 정교한 퀄리티로 곧 찾아뵙겠습니다!
            </p>

            <div className="pt-2 w-full flex flex-col gap-2">
              <button
                onClick={() => alert("사주 커스텀 굿즈 공방 오픈 알림 신청이 완료되었습니다!")}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>굿즈 공방 오픈 알림 받기</span>
              </button>

              <button
                onClick={onBackToResult}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                사주 감정서로 돌아가기
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

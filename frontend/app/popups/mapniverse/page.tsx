"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  ArrowLeft, 
  ExternalLink, 
  ShieldCheck, 
  Package, 
  Coins, 
  Zap, 
  Layers, 
  Award, 
  Flame, 
  TrendingUp, 
  Repeat, 
  Gavel, 
  Download, 
  Smartphone, 
  CheckCircle2, 
  Building2, 
  Mail, 
  MapPin, 
  ChevronRight,
  Gift,
  RefreshCw,
  Eye,
  Star
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { SampleBadge } from "@/components/ui/sample-badge"

// 가챠 카드 샘플 데이터
interface GachaCard {
  id: string
  name: string
  series: string
  grade: "SSR" | "UR" | "SECRET"
  gradeColor: string
  image: string
  desc: string
  marketEstimate: string
  holoEffect: string
}

const GACHA_POOL: GachaCard[] = [
  {
    id: "solo-leveling-sung",
    name: "성진우 [그림자 군주 - 각성]",
    series: "나 혼자만 레벨업 오피셜 라이선스",
    grade: "SECRET",
    gradeColor: "from-amber-400 via-rose-500 to-purple-600",
    image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
    desc: "맵니버스 독점 기획! 특수 홀로그램 에칭 공법과 시크릿 넘버링이 각인된 최고 등급 콜렉트 카드",
    marketEstimate: "TIF 볼트 보관 중 (PSA 10급)",
    holoEffect: "border-amber-400 "
  },
  {
    id: "demon-slayer-rengoku",
    name: "렌고쿠 쿄쥬로 [무한열차 염화]",
    series: "귀멸의 칼날 극장판 컬렉션",
    grade: "UR",
    gradeColor: "from-red-500 via-orange-500 to-amber-400",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
    desc: "화염의 호흡 이펙트 금박 코팅 및 실물 실크스크린 한정판 카드",
    marketEstimate: "TIF 볼트 보관 중",
    holoEffect: "border-rose-500 "
  },
  {
    id: "one-piece-luffy-gear5",
    name: "몽키 D. 루피 [기어 5 태양의 신]",
    series: "원피스 하이퍼 레어 에디션",
    grade: "SSR",
    gradeColor: "from-purple-500 via-indigo-400 to-emerald-400",
    image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    desc: "무지갯빛 오로라 리플렉트 포일 가공 처리된 수집가들의 필수 컬렉션",
    marketEstimate: "실물 배송 즉시 가능",
    holoEffect: "border-purple-400 "
  },
  {
    id: "dragon-ball-goku",
    name: "손오공 [무의식의 극의 완성]",
    series: "드래곤볼 슈퍼 프리미엄",
    grade: "UR",
    gradeColor: "from-cyan-400 via-blue-500 to-indigo-600",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    desc: "은빛 오라 홀로그램과 양각 엠보싱이 들어간 리미티드 카드",
    marketEstimate: "TIF 볼트 보관 중",
    holoEffect: "border-cyan-400 "
  }
]

export default function MapniversePage() {
  // Gacha Demo State
  const [isDrawing, setIsDrawing] = useState(false)
  const [pulledCard, setPulledCard] = useState<GachaCard | null>(GACHA_POOL[0])
  const [drawCount, setDrawCount] = useState(1)
  const [isCardFlipped, setIsCardFlipped] = useState(false)

  const handleDrawGacha = () => {
    if (isDrawing) return
    setIsDrawing(true)
    setIsCardFlipped(false)

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * GACHA_POOL.length)
      setPulledCard(GACHA_POOL[randomIndex])
      setDrawCount((prev) => prev + 1)
      setIsDrawing(false)
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white pb-24">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      </div>

      {/* 사이트 상단 메뉴 + 위치 (팝업 지도 등 새 페이지와 같은 머리) */}
      <SubPageHeader groupId="popup" itemId="mapniverse" actions={(
          <>
            <a
              href="https://takeitfirst.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <span>티프(TIF) 바로가기</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://mapniverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <span>맵니버스 공식몰</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>
          </>
        )} />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 space-y-20 sm:space-y-28">
        
        {/* 1. HERO SECTION */}
        <section className="text-center space-y-6 sm:space-y-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs sm:text-sm font-bold shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>차세대 컬렉팅 & 가챠 플랫폼의 혁신</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight sm:leading-tight"
          >
            뽑고, 보관하고, 거래하라! <br />
            손끝에서 펼쳐지는{" "}
            <span className="text-purple-400">
              컬렉팅 유니버스
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base lg:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto"
          >
            <strong className="text-zinc-200">주식회사 맵니버스(Mapniverse)</strong>는 글로벌 메가히트 IP '나 혼자만 레벨업' 오피셜 라이선스 카드 제작부터 
            온라인 가챠, 안전한 실물 보관 수장고(VAULT), C2C 유저 마켓플레이스인 <strong className="text-purple-400">티프(TIF, Take It First)</strong>를 서비스하는 수집 문화 테크 기업입니다.
          </motion.p>

          {/* Action Button Group */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2"
          >
            <a
              href="https://takeitfirst.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm shadow-xl flex items-center gap-2 transform hover:-translate-y-0.5 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>TIF 웹에서 바로 가챠하기</span>
            </a>
            <a
              href="#interactive-gacha"
              className="px-6 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-sm flex items-center gap-2 transition-all"
            >
              <Gift className="w-4 h-4 text-pink-400" />
              <span>무료 가챠 시뮬레이터 체험</span>
            </a>
          </motion.div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-8 border-t border-zinc-800/80 text-left">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-zinc-500 font-bold uppercase">Official IP</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">나혼렙 독점</div>
              <div className="text-[11px] text-purple-400 mt-0.5">정식 라이선스 콜렉트 카드</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-zinc-500 font-bold uppercase">Core System</div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">TIF VAULT</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">디지털 보관 & 실물 즉시 배송</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-zinc-500 font-bold uppercase">C2C Economy</div>
              <div className="text-xl sm:text-2xl font-black text-pink-400 mt-1">T PLAY</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">유저 직접 가챠 제작 & 경매</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-xs text-zinc-500 font-bold uppercase">Location</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">서울 강동구</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">덕지 플래그십과 인접 거점</div>
            </div>
          </div>
        </section>


        {/* 2. 4대 핵심 서비스 (4 CORE PILLARS) */}
        <section className="space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>CORE INNOVATIONS</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              티프(TIF)가 바꾸는 4가지 컬렉팅 경험
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              단순한 뽑기를 넘어, 실물 자산 보관부터 유저 간 자유로운 거래까지 하나의 앱에서 완성됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Pillar 1: 컬렉션 가챠 */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-7 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-purple-500/50 shadow-xl space-y-4 relative overflow-hidden group"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 transition-transform">
                <Flame className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-purple-400 tracking-wider">01. COLLECTION GACHA</span>
                <h3 className="text-xl font-bold text-white">손끝에서 터지는 짜릿한 랜덤 가챠</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  포켓몬 카드, 나 혼자만 레벨업 공식 카드, 원피스, 드래곤볼, 한정판 레고 및 프리미엄 피규어를 온라인에서 실시간으로 뽑을 수 있습니다. 투명한 확률 공개와 화려한 연출로 손맛을 극대화합니다.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-300">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#실시간_가챠</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#홀로그램_연출</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#확률형_검증</span>
              </div>
            </motion.div>

            {/* Pillar 2: TIF 볼트 (VAULT) */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-7 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-amber-500/50 shadow-xl space-y-4 relative overflow-hidden group"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-400 tracking-wider">02. TIF VAULT</span>
                <h3 className="text-xl font-bold text-white">안전한 실물 수장고 & 즉시 배송 시스템</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  뽑은 실물 카드를 집으로 즉시 배송받거나, 맵니버스의 항온·항습 프리미엄 볼트(VAULT)에 안전하게 보관할 수 있습니다. 보관 중인 카드는 디지털 자산처럼 언제든 앱 내에서 교환/판매가 가능합니다.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-300">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#원클릭_배송</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#항온항습_수장고</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#PSA_등급연계</span>
              </div>
            </motion.div>

            {/* Pillar 3: T PLAY & 유저 가챠 */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-7 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-pink-500/50 shadow-xl space-y-4 relative overflow-hidden group"
            >
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 transition-transform">
                <Gavel className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-pink-400 tracking-wider">03. T PLAY & C2C GACHA</span>
                <h3 className="text-xl font-bold text-white">내가 직접 만드는 가챠 & 실시간 경매</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  유저가 볼트에 보유한 컬렉션을 조합하여 직접 '나만의 가챠' 룸을 열고 다른 유저에게 판매하여 수익을 낼 수 있습니다. 또한 희귀 카드를 실시간 옥션(경매)이나 1:1 안전 교환으로 거래할 수 있습니다.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-300">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#유저_가챠_크리에이터</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#실시간_경매</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#안전_1:1교환</span>
              </div>
            </motion.div>

            {/* Pillar 4: 오피셜 IP 제작 */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-7 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-emerald-500/50 shadow-xl space-y-4 relative overflow-hidden group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-400 tracking-wider">04. OFFICIAL IP LICENSING</span>
                <h3 className="text-xl font-bold text-white">글로벌 IP 오피셜 라이선스 콜렉트 카드 기획</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  (주)맵니버스는 국내외 유명 애니메이션, 웹툰 IP 홀더와의 공식 라이선스 계약을 통해 고품질의 피지컬 콜렉트 카드 및 한정판 머천다이즈를 직접 기획·제작·유통합니다.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-300">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#나혼렙_공식카드</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#하이엔드_특수가공</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700">#정품_시리얼각인</span>
              </div>
            </motion.div>

          </div>
        </section>


        {/* 3. INTERACTIVE MINI GACHA SIMULATOR */}
        <section id="interactive-gacha" className="scroll-mt-24">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-purple-950/40 via-zinc-900 to-zinc-950 border-2 border-purple-500/40 shadow-2xl relative overflow-hidden">
            
            {/* Background sparkle accents */}
            <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
              <Sparkles className="w-48 h-48 text-purple-400" />
            </div>

            <div className="max-w-3xl mx-auto text-center space-y-8 relative z-10">
              
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black">
                  <Star className="w-3.5 h-3.5" />
                  <span>INTERACTIVE TIF SIMULATOR</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white">
                  지금 바로 티프(TIF) 무료 가챠를 체험해보세요!
                  <SampleBadge />
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  버튼을 누르면 화려한 이펙트와 함께 나혼렙/귀칼/원피스 최고 등급 카드가 소환됩니다.
                </p>
              </div>

              {/* Gacha Card Display Arena */}
              <div className="flex flex-col items-center justify-center py-4">
                <AnimatePresence mode="wait">
                  {isDrawing ? (
                    <motion.div
                      key="drawing"
                      initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                      animate={{ scale: [0.8, 1.1, 0.95, 1], opacity: 1, rotate: [0, 10, -10, 0] }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-64 sm:w-72 h-96 rounded-2xl bg-purple-600 p-1 flex items-center justify-center shadow-2xl"
                    >
                      <div className="w-full h-full rounded-2xl bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <RefreshCw className="w-12 h-12 text-amber-400 animate-spin" />
                        <div className="text-base font-black text-white animate-pulse">
                          차원의 문이 열리는 중...
                        </div>
                        <div className="text-xs text-purple-400 font-bold">
                          홀로그램 에디션 로딩 중
                        </div>
                      </div>
                    </motion.div>
                  ) : pulledCard ? (
                    <motion.div
                      key={pulledCard.id + drawCount}
                      initial={{ scale: 0.7, opacity: 0, y: 30 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className={`w-72 sm:w-80 rounded-3xl p-1.5 bg-gradient-to-br ${pulledCard.gradeColor} shadow-2xl ${pulledCard.holoEffect} transition-all duration-300`}
                    >
                      <div className="w-full bg-zinc-950 rounded-[22px] p-5 space-y-4 text-left border border-white/10 relative overflow-hidden">
                        
                        {/* Grade Ribbon & Series */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                            {pulledCard.series}
                          </span>
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-md bg-gradient-to-r ${pulledCard.gradeColor} text-white shadow-md`}>
                            {pulledCard.grade}
                          </span>
                        </div>

                        {/* Card Image Thumbnail with Holographic Sheen */}
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-zinc-800 group">
                          <img
                            src={pulledCard.image}
                            alt={pulledCard.name}
                            className="w-full h-full object-cover transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-transparent to-amber-400/20 mix-blend-overlay" />
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-amber-300 font-bold border border-amber-500/30">
                            ★ HOLOGRAM SPECIAL
                          </div>
                        </div>

                        {/* Card Title & Desc */}
                        <div className="space-y-1">
                          <h4 className="text-base font-black text-white">
                            {pulledCard.name}
                          </h4>
                          <p className="text-[11px] text-zinc-400 leading-snug">
                            {pulledCard.desc}
                          </p>
                        </div>

                        {/* Status Tag */}
                        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500 font-semibold">TIF 보관 상태</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {pulledCard.marketEstimate}
                          </span>
                        </div>

                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  onClick={handleDrawGacha}
                  disabled={isDrawing}
                  className="w-full sm:w-auto px-8 py-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-base shadow-xl"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isDrawing ? "뽑는 중..." : "🔥 무료 가챠 1회 다시 뽑기"}
                </Button>
                <a
                  href="https://takeitfirst.co.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-purple-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>티프(TIF) 앱에서 실물 뽑기</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="text-[11px] text-zinc-500">
                * 위 시뮬레이터는 티프(TIF)의 가챠 연출을 체험해볼 수 있는 무료 인터랙션 데모입니다.
              </div>

            </div>

          </div>
        </section>


        {/* 4. WHY TIF? (기존 수집 vs TIF 비교) */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              왜 수집가들은 티프(TIF)를 선택할까요?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              기존 오프라인 굿즈 구매 및 중고거래의 불편함을 맵니버스의 IT 기술로 완전히 해결했습니다.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                  <th className="py-3 px-4 font-bold">비교 항목</th>
                  <th className="py-3 px-4 font-bold text-zinc-500">기존 수집 및 중고거래</th>
                  <th className="py-3 px-4 font-bold text-purple-400 bg-purple-500/10 rounded-t-xl">티프 (TIF & VAULT)</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-800/60">
                <tr>
                  <td className="py-4 px-4 font-bold text-white">보관 및 관리</td>
                  <td className="py-4 px-4 text-zinc-400">집안 공간 차지, 습기 및 변색 훼손 위험</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold bg-purple-500/5">
                    전용 수장고(VAULT) 항온항습 무결점 보관
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-bold text-white">거래 및 환금성</td>
                  <td className="py-4 px-4 text-zinc-400">택배 발송 번거로움, 사기 위험, 직거래 피로도</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold bg-purple-500/5">
                    앱 내에서 즉시 1초 거래 및 경매/교환 지원
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-bold text-white">가챠/수집 경험</td>
                  <td className="py-4 px-4 text-zinc-400">오프라인 매장 방문 대기 및 품절 허탈감</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold bg-purple-500/5">
                    24시간 언제 어디서나 모바일 원터치 가챠
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-bold text-white">수익 창출 (C2C)</td>
                  <td className="py-4 px-4 text-zinc-400">단순 판매만 가능, 수수료 부담</td>
                  <td className="py-4 px-4 text-emerald-400 font-bold bg-purple-500/5">
                    내 카드로 직접 '유저 가챠'를 제작하여 추가 수익화
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>


        {/* 5. COMPANY & ECOSYSTEM (주식회사 맵니버스 기업 정보) */}
        <section className="p-8 sm:p-10 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400">
                <Building2 className="w-4 h-4" />
                <span>ABOUT MAPNIVERSE INC.</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                주식회사 맵니버스 기업 개요
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="mailto:mapniverse@gmail.com"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white border border-zinc-700 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-purple-400" />
                <span>제휴 및 비즈니스 문의</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-400">
            <div className="space-y-2">
              <div className="text-zinc-500 font-bold uppercase">회사명 / 대표자</div>
              <div className="text-sm font-bold text-white">주식회사 맵니버스 (Mapniverse Inc.)</div>
              <div>대표이사: 권미선</div>
            </div>
            <div className="space-y-2">
              <div className="text-zinc-500 font-bold uppercase">본사 소재지</div>
              <div className="text-sm font-bold text-white flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>서울특별시 강동구 올림픽로48길 20, 2층</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                * 덕지(DUKJI) 강동 플래그십과 인접하여 강력한 오프라인·온라인 시너지 추진
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-zinc-500 font-bold uppercase">주요 사업 영역</div>
              <div className="text-sm font-bold text-white">수집형 콘텐츠 플랫폼 개발 & IP 라이선스 카드 제작</div>
              <div className="text-[11px] text-zinc-500">
                TIF(Take It First) 운영, 나혼렙 콜렉트 카드 유통, 항온항습 볼트(Vault) 운영
              </div>
            </div>
          </div>

          {/* Official Channel Links */}
          <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-zinc-500">공식 채널:</span>
            <a
              href="https://takeitfirst.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 hover:underline"
            >
              <span>티프(TIF) 공식 사이트</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://mapniverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 hover:underline"
            >
              <span>맵니버스 공식 스토어</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://play.google.com/store/apps/details?id=com.mapniverse.tif"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              <span>Google Play 앱 다운로드</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="https://apps.apple.com/kr/app/tif/id6470404285"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              <span>App Store 앱 다운로드</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>


        {/* 6. BOTTOM CTA */}
        <section className="text-center p-10 sm:p-14 rounded-3xl bg-gradient-to-r from-purple-900/60 via-indigo-950 to-zinc-950 border border-purple-500/40 shadow-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              지금 바로 티프(TIF)에서 첫 번째 카드를 획득하세요!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
              온라인 가챠로 뽑고, TIF 볼트에 보관하고, 실물로 소장하는 세상에 없던 컬렉팅 라이프가 시작됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://takeitfirst.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl bg-purple-500 hover:bg-purple-400 text-black font-black text-sm shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              티프(TIF) 공식 웹 시작하기
            </a>
            <Link
              href="/"
              className="px-6 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-sm transition-colors"
            >
              덕지 팝업스토어 둘러보기
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}

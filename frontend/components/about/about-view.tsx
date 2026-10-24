"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  MapPin,
  Compass,
  Trophy,
  Crown,
  Globe2,
  Gamepad2,
  Scroll,
  Flame,
  Shield,
  Heart,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Share2,
  Building2,
  Mail,
  Users,
  Layers,
  Award,
  Gem,
  CheckCircle2,
  Zap,
  Camera,
  ShoppingBag,
  Store,
  Phone,
  Copy,
  Check,
  Eye,
  Star,
  Smartphone,
  LayoutGrid
} from "lucide-react"
import { Navbar } from "@/components/navbar"
import { useMyPageShortcuts } from "@/lib/saved-items"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

type TabKey = "overview" | "characters" | "trails" | "pillars" | "business" | "company"

export function AboutView() {
  const shortcuts = useMyPageShortcuts()
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>("duckji")
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText("inc.siaa@gmail.com")
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const characters = [
    {
      id: "duckji",
      name: "덕지",
      englishName: "DUCKJI",
      chineseName: "大吉 (대길)",
      title: "프로게이머 & 덕질에 미친 열정의 오리 주인공",
      role: "모험의 추진력이자 무한 열정의 소유자",
      image: "/images/characters/duckji.png",
      color: "from-red-500/20 to-amber-500/20",
      borderColor: "border-red-500/40",
      accentColor: "text-red-400",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
      keywords: ["덕질에 미친 오리", "프로게이머", "똥손/허당미", "순수한 집념", "충동적 낙천가"],
      appearance: [
        "선명한 노란색 몸체 & 시그니처 레드 캡과 후드티",
        "황금 '8' 목걸이 (8개의 황금알을 상징하는 시그니처)",
        "작은 금색 왕관 심볼과 역동적인 SD 비율",
        "기쁠 때 크게 벌어지는 입과 풍부한 희로애락 표정",
      ],
      description:
        "덕지는 좋아하는 것에 자신의 모든 에너지를 쏟아붓는 열정적인 오리입니다. 본업은 프로게이머이지만, 중요한 순간에는 운과 손재주가 따라주지 않는 유쾌한 '똥손'이자 허당형 주인공입니다. 하지만 '하나만 산다'고 다짐하고 열일곱 개를 모으는 광기 어린 집념과 순수한 열정은 위기의 순간마다 기적을 만들어냅니다. 실패해도 결코 꺾이지 않는 덕지의 열정은 동료들을 이끌고 8개의 황금알을 되찾는 모험의 가장 강력한 원동력입니다.",
      quote: "좋아하는 마음 하나면 충분해! 황금알이 어디에 숨어있든 덕후의 집념으로 반드시 찾아낸다!",
    },
    {
      id: "ducksoon",
      name: "덕순",
      englishName: "DUCKSOON",
      chineseName: "大利 (대리)",
      title: "전략가 & 마이더스의 손을 가진 숨겨진 덕후 고수",
      role: "모험의 지휘자이자 가치를 꿰뚫어보는 통찰의 안내자",
      image: "/images/characters/ducksoon.png",
      color: "from-amber-500/20 to-emerald-500/20",
      borderColor: "border-amber-500/40",
      accentColor: "text-amber-400",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      keywords: ["마이더스의 손", "타로·명리 마스터", "통찰력과 지혜", "숨겨진 덕후", "차분한 현실주의자"],
      appearance: [
        "우아한 크림빛 노란 몸체 & 레드 포인트 드레스",
        "용의 비늘을 형상화한 신비로운 티아라",
        "비밀스러운 단서를 짚어내는 황금 부채",
        "미소 하나로 상대를 꿰뚫어보는 침착하고 날카로운 눈빛",
      ],
      description:
        "덕지는 덕순의 남편이자 운명의 동반자입니다. 덕순은 타로, 명리, 관상, 수상을 마스터하여 세상의 기운과 인간의 운을 읽어내는 신비로운 능력을 갖추었습니다. 하지만 덕순의 진짜 힘은 남들이 알아보지 못하는 평범한 것 속에서 보석 같은 가치를 발견하고 이를 황금으로 바꾸는 '마이더스의 손'입니다. 충동적인 덕지의 실수를 수습하고 위험을 헤쳐 나가는 최고의 전략가이자 조력자입니다.",
      quote: "운명의 흐름은 읽는 자의 것. 진짜 귀한 가치는 가장 평범해 보이는 곳에 숨어있지.",
    },
    {
      id: "clow",
      name: "클로우",
      englishName: "CLOW",
      chineseName: "클로우",
      title: "질투와 짝사랑의 라이벌 & 8개 황금알 도난 사건의 주범",
      role: "순례길 각 거점의 트릭과 미션을 설계한 매력적인 적대자",
      image: "/images/characters/clow.png",
      color: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/40",
      accentColor: "text-purple-400",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      keywords: ["덕순 짝사랑", "괴도 라이벌", "수수께끼 설계자", "코믹한 악당", "미워할 수 없는 존재"],
      appearance: [
        "검은 까마귀 라이벌의 실루엣 & 금빛 왕관",
        "해골 펜던트와 품격 있는 다크 코트",
        "황금알을 은밀히 낚아채는 트릭스터의 위트",
        "언제나 한 발 앞서 수수께끼 쪽지를 남기는 괴도 매력",
      ],
      description:
        "클로우는 덕순을 오랫동안 짝사랑해 온 인물입니다. 덕지와 덕순의 행복과 황금알의 광채에 질투심을 느껴 8개의 황금알을 훔쳐 세상 곳곳의 비밀스러운 장소에 숨겨버렸습니다. 그러나 단순한 악당이 아니라 덕순에게 인정받고 싶은 마음에 정교한 퍼즐과 AR 미션을 남기는 입체적이고 위트 있는 라이벌입니다. 순례자들에게 지속적인 도전 의식을 불어넣습니다.",
      quote: "덕순아, 나를 봐줘! 이 8개의 황금알을 모두 찾기 전까지 너희의 여정은 끝나지 않아!",
    },
    {
      id: "dragon",
      name: "황금용",
      englishName: "GOLDEN DRAGON",
      chineseName: "金龍 (황금용)",
      title: "궁극의 초월적 존재 & 8개 황금알의 수호신",
      role: "순례길 완주자에게 궁극의 보상과 영예를 선사하는 최종 상징",
      image: "/images/characters/dragon.jpg",
      color: "from-amber-400/25 to-yellow-500/25",
      borderColor: "border-amber-400/60",
      accentColor: "text-amber-300",
      badgeColor: "bg-amber-400/20 text-amber-200 border-amber-400/40",
      keywords: ["세계관 최종 상징", "동서양 문화 융합", "마스터 인증", "희귀 보상", "신성한 각성"],
      appearance: [
        "영롱한 순백의 신수 자태와 웅장한 황금 뿔",
        "붉은 망토와 위엄 있는 황금 비늘",
        "8개의 황금알이 모일 때 뿜어내는 기적의 금빛 후광",
        "순례자에게 궁극의 영예와 마스터 리워드를 내리는 존재",
      ],
      description:
        "세계의 깊은 곳에 잠들어 있던 전설의 신수입니다. 8개의 황금알이 모두 하나로 모이는 순간 세상에 모습을 드러냅니다. 황금용은 단순한 보스가 아니라, 온갖 시련을 이겨내고 8개의 길을 완주한 순례자의 '열정과 집념, 지혜와 사랑'을 인정하고 세계관에서 가장 고귀한 특별 디지털 칭호와 실물 마스터 리워드를 부여하는 초월적 존재입니다.",
      quote: "8개의 황금알을 모두 모은 순례자여, 그대의 순수한 집념이 잠들어 있던 기적을 깨웠도다.",
    },
  ]

  const trails = [
    {
      step: 1,
      title: "1길: 모험의 시작",
      subtitle: "첫 번째 단서와 입문 AR 카드 획득",
      desc: "클로우가 남긴 최초의 수수께끼를 해독하고, 순례길의 첫 발을 내딛는 거점. 초보 순례자를 위한 첫 번째 황금알 조각과 AR 인터랙티브 카드 획득.",
      eggTheme: "행운과 기회 (Fortune & Opportunity)",
      color: "border-red-500/30 bg-red-500/5 text-red-400",
    },
    {
      step: 2,
      title: "2길: 추적의 시작",
      subtitle: "클로우의 발자국과 도심 속 성지 탐색",
      desc: "본격적인 추적이 시작되는 거리. 번화가와 팝업 핫플레이스 속에 은밀히 숨겨진 클로우의 표식을 스마트폰 WebAR로 감지하여 돌파.",
      eggTheme: "부와 번영 (Wealth & Prosperity)",
      color: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    },
    {
      step: 3,
      title: "3길: 덕지의 시련",
      subtitle: "똥손 주인공의 유쾌한 위기 탈출 미션",
      desc: "게임에서는 실수를 연발하지만 꺾이지 않는 덕지의 열정으로 돌파하는 코믹한 미션. 랜덤 뽑기와 돌발 퀴즈를 순수한 뚝심으로 풀어내는 스테이지.",
      eggTheme: "열정과 집념 (Passion & Persistence)",
      color: "border-rose-500/30 bg-rose-500/5 text-rose-400",
    },
    {
      step: 4,
      title: "4길: 덕순의 통찰",
      subtitle: "타로와 명리를 응용한 전략적 암호 해독",
      desc: "덕순의 지혜가 빛을 발하는 코스. 동양 명리학의 음양오행과 서양 타로의 22가지 상징을 결합하여 복잡하게 꼬인 클로우의 트릭을 추리.",
      eggTheme: "지혜와 통찰 (Wisdom & Insight)",
      color: "border-purple-500/30 bg-purple-500/5 text-purple-400",
    },
    {
      step: 5,
      title: "5길: 숨겨진 가치",
      subtitle: "마이더스의 손으로 숨은 보물 발굴",
      desc: "남들이 지나친 허름한 골목이나 낡은 상점 속에서 진정한 가치를 찾아내는 여정. 덕순의 마이더스의 손 능력이 깃든 히든 카드 획득.",
      eggTheme: "숨겨진 능력 (Hidden Potential)",
      color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    },
    {
      step: 6,
      title: "6길: 관계의 시험",
      subtitle: "덕지와 덕순, 동료들과의 신뢰 증명",
      desc: "혼자서는 갈 수 없는 험난한 코스. 3인 스쿼드 결성 및 동료들과의 협동 인증을 통해 진정한 인연의 소중함을 깨닫는 감동의 스테이지.",
      eggTheme: "관계와 인연 (Bond & Destiny)",
      color: "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
    },
    {
      step: 7,
      title: "7길: 황금용의 단서",
      subtitle: "최종 보물을 향한 핵심 퍼즐 해독",
      desc: "세계의 깊은 곳으로 향하는 마지막 관문. 7개의 알이 공명하며 전설 속 황금용의 둥지 위치를 가리키는 고대 천문 좌표를 개방.",
      eggTheme: "성장과 극복 (Growth & Resilience)",
      color: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    },
    {
      step: 8,
      title: "8길: 최종 완주",
      subtitle: "8개 황금알 완성 & 황금용의 영광스러운 강림",
      desc: "모든 시련을 마친 마스터 순례자에게 열리는 대망의 피날레. 앱 화면 가득 황금용이 승천하고, 전 세계 하나뿐인 마스터 디지털 인증서와 한정 리워드 획득.",
      eggTheme: "궁극적인 변화 (Ultimate Evolution)",
      color: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300 font-bold",
    },
  ]

  const pillars = [
    {
      icon: Compass,
      title: "01. 덕지순례길 (Pilgrimage Trail)",
      badge: "오프라인 관광 연계",
      desc: "가상의 모험 서사를 현실 도시와 관광 명소에 입힌 국내외 최초의 순례형 관광 모델입니다. 팝업스토어, 직영 스토어, 문화 공간 등 지정 거점을 방문하여 이야기를 실시간으로 진행시킵니다.",
      features: [
        "1길부터 8길까지 이어지는 단계별 스토리라인",
        "지하철·도보 연계 최적화된 테마별 원데이 코스",
        "현장 체크인 및 모바일 도장 스탬프 투어",
        "지역 상권 및 팝업 주최사와의 상생 제휴",
      ],
      color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    },
    {
      icon: Camera,
      title: "02. AR 수집 카드 (Augmented Collectibles)",
      badge: "WebAR 증강현실 기술",
      desc: "현장 방문자에게만 한정 제공되는 실물 카드로, 모바일 앱이나 웹 카메라를 통해 비추면 카드가 열리며 3D 덕지와 덕순의 역동적인 액션과 황금알 스토리가 펼쳐집니다.",
      features: [
        "별도 무거운 앱 설치 없는 즉각적 WebAR 렌더링",
        "고유 일련번호 기반 위변조 방지 & 컬렉션 등록",
        "카드 위에서 부화하듯 빛나는 황금알 3D 애니메이션",
        "희귀도에 따른 홀로그램 및 특수 사운드 이펙트",
      ],
      color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5",
    },
    {
      icon: LayoutGrid,
      title: "03. 덕룸 (DUCKROOM — Digital Showcase)",
      badge: "소셜 아카이빙 플랫폼",
      desc: "싸이월드의 미니홈피 문화를 현대적 감성으로 재해석한 참여자 개인의 디지털 전시장입니다. 순례길에서 획득한 카드, 황금알, 가구, 배지를 배치하고 전 세계 팬들에게 나만의 덕력을 자랑합니다.",
      features: [
        "취향대로 방을 커스텀하는 미니룸 인테리어",
        "수집한 8개 황금알과 한정 카드의 3D 진열대",
        "순례길 완주 뱃지 및 프로필 마스터 칭호 표기",
        "친구 미니룸 파도타기 방문 및 일촌 방명록 교류",
      ],
      color: "text-amber-400 border-amber-500/30 bg-amber-500/5",
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-red-500 selection:text-white">
      {/* Top Main Navigation */}
      <Navbar
        activeTab=""
        setActiveTab={() => {}}
        {...shortcuts}
        searchQuery=""
        setSearchQuery={() => {}}
      />

      <main className="flex-1 pt-24 pb-20 app-nav-offset">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 border-b border-zinc-800/80">
          {/* Ambient Cosmic Radial Gradients */}

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
            {/* Top Brand Tag */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-black tracking-wide shadow-lg">
              <span>DUCKJI & DUCKSOON · 大吉 & 大利</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-zinc-400">GLOBAL CHARACTER IP</span>
            </div>

            {/* Main Slogan & Title */}
            <div className="space-y-3">
              <p className="text-sm sm:text-base md:text-lg font-bold tracking-widest text-amber-300/90 uppercase font-mono">
                &ldquo;Where Passion Turns to Dreams&rdquo;
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
                취미가 깊어질 때, <br className="hidden sm:inline" />
                <span className="text-red-400">
                  꿈이 시작되는 곳 — DUCKJI
                </span>
              </h1>
            </div>

            {/* Core Narrative Summary */}
            <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-zinc-300 leading-relaxed font-normal">
              8개의 황금알을 찾아 떠나는 현실과 판타지의 연결형 모험. <br />
              <strong className="text-white font-bold">DUCKJI</strong>는 단순한 캐릭터 소비를 넘어,
              사람들이 실제로 찾아가고 탐험하며, 수집하고 자랑하는{" "}
              <span className="text-emerald-400 font-bold underline decoration-emerald-500/50 underline-offset-4">
                글로벌 순례형 체험 엔터테인먼트 IP
              </span>
              입니다.
            </p>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" /> 덕지순례길 1~8길
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" /> 한정판 AR 카드 수집
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-amber-400" /> 디지털 자랑 공간 덕룸(DUCKROOM)
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-red-400" /> 중화권·서양권 글로벌 확장
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => (window.location.href = "/partners/apply/")}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-xl cursor-pointer flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span>주최사 입점 및 제휴 신청</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleShareLink}
                className="border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 font-semibold px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? "링크 복사됨!" : "페이지 공유"}</span>
              </Button>
            </div>
          </div>
        </section>

        {/* TAB NAVIGATION */}
        <section className="sticky top-16 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar text-xs sm:text-sm font-bold">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "overview"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>세계관 & 비전</span>
              </button>

              <button
                onClick={() => setActiveTab("characters")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "characters"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>캐릭터 도감 (덕지·덕순)</span>
              </button>

              <button
                onClick={() => setActiveTab("trails")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "trails"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>덕지순례길 8코스</span>
              </button>

              <button
                onClick={() => setActiveTab("pillars")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "pillars"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>3대 핵심 프로젝트</span>
              </button>

              <button
                onClick={() => setActiveTab("business")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "business"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Globe2 className="w-4 h-4" />
                <span>글로벌 사업 전략</span>
              </button>

              <button
                onClick={() => setActiveTab("company")}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "company"
                    ? "bg-red-500 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>회사 정보 & 제휴</span>
              </button>
            </div>
          </div>
        </section>

        {/* TAB CONTENTS */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
          {/* TAB 1: OVERVIEW & WORLD LORE */}
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-16"
            >
              {/* Mission Statement */}
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-850 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
                <div className="flex items-center gap-2.5 text-xs font-bold text-red-400 uppercase tracking-widest">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span>PROJECT VISION & PHILOSOPHY</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug">
                  &ldquo;캐릭터를 만나러 떠나고, 모험을 완성하기 위해 다시 찾아오는 글로벌 순례형 IP&rdquo;
                </h2>
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                  덕지와 덕순을 단순히 굿즈 상품에 인쇄되는 캐릭터에 머무르게 하지 않습니다.
                  사람들이 실제로 찾아가고, 함께 사진을 찍고, AR 카드를 모으며, 자신의 컬렉션을 자랑하는
                  살아 숨 쉬는 존재로 성장시킵니다. 특히 대한민국을 전 세계 글로벌 캐릭터 IP와 사업체, 팬덤을
                  한곳에 끌어모으는 중심 매개체(Global Nexus)로 삼아, 동양의 길상(吉祥) 문화와 서양의 판타지·게임 문화를 결합하여
                  전 세계 누구나 공감할 수 있는 새로운 순례형 엔터테인먼트의 지평을 엽니다.
                </p>

                {/* 6-Step Cycle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  {[
                    { step: "01", title: "캐릭터 입문", desc: "귀엽고 위트 넘치는 덕지와 덕순의 이야기에 매료됩니다." },
                    { step: "02", title: "현실 장소 방문", desc: "도난당한 황금알을 찾기 위해 실제 성지·팝업을 찾아갑니다." },
                    { step: "03", title: "한정 AR 카드 획득", desc: "현장 거점에서만 얻을 수 있는 고유 넘버링 카드를 얻습니다." },
                    { step: "04", title: "순례길 이어가기", desc: "카드를 앱에 등록하고 다음 황금알 거점으로 모험을 확장합니다." },
                    { step: "05", title: "8개 황금알 완성", desc: "완주 시 전설의 황금용이 강림하며 궁극의 희귀 보상을 얻습니다." },
                    { step: "06", title: "덕룸(DUCKROOM) 자랑", desc: "자신만의 디지털 미니룸에 컬렉션을 전시하고 팬덤과 공유합니다." },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 hover:border-red-500/40 transition-colors space-y-2"
                    >
                      <div className="text-xl font-black font-mono text-red-400">{item.step}</div>
                      <h4 className="font-bold text-white text-base">{item.title}</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* The World Origin Lore */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold">
                    <Crown className="w-3.5 h-3.5" />
                    <span>세계관의 기원: 8개의 황금알 전설</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    평범하지 않았던 두 오리의 만남, <br />
                    그리고 도난당한 8개의 기적
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    덕지는 좋아하는 것에 모든 에너지를 쏟아붓는 열정의 오리이며,
                    덕순은 세상의 흐름과 사람의 운을 꿰뚫어보는 신비로운 통찰의 소유자입니다.
                    두 특별한 존재가 만나 탄생한 것은 평범한 알이 아닌, 세상의 부와 행운, 인연과 잠재력을 담은{" "}
                    <strong className="text-amber-300 font-bold">8개의 황금알</strong>이었습니다.
                  </p>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    황금알이 모두 모이면 깊은 잠에 빠져 있던 <strong className="text-amber-200">황금용(Golden Dragon)</strong>이
                    깨어난다는 고대 전설이 전해집니다. 그러나 덕순을 오랫동안 짝사랑해 온 라이벌 <strong>클로우(Clow)</strong>가
                    질투와 욕망에 눈이 멀어 8개의 황금알을 훔쳐 세상 곳곳에 숨기며, 전 세계를 누비는 장대한
                    &lsquo;덕지순례길&rsquo; 모험이 시작됩니다.
                  </p>
                </div>

                {/* 8 Golden Eggs Meaning Table */}
                <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Gem className="w-4 h-4 text-amber-400" />
                    <span>8개 황금알이 품고 있는 상징적 가치</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    {[
                      { num: "01", title: "행운과 기회", en: "Fortune" },
                      { num: "02", title: "부와 번영", en: "Prosperity" },
                      { num: "03", title: "지혜와 통찰", en: "Insight" },
                      { num: "04", title: "열정과 집념", en: "Persistence" },
                      { num: "05", title: "관계와 인연", en: "Destiny" },
                      { num: "06", title: "성장과 극복", en: "Resilience" },
                      { num: "07", title: "숨겨진 능력", en: "Potential" },
                      { num: "08", title: "궁극의 변화", en: "Evolution" },
                    ].map((egg) => (
                      <div
                        key={egg.num}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-amber-400/80 font-bold mr-1.5">{egg.num}.</span>
                          <span className="text-zinc-200 font-semibold">{egg.title}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{egg.en}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* The Infinite Value Loop */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                  <Zap className="w-3.5 h-3.5" />
                  <span>핵심 사업 공식: 무한 선순환 루프 (The Infinite Loop)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  캐릭터 IP ➔ 오프라인 여행 ➔ 실물 수집 ➔ 글로벌 팬덤
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold text-zinc-300">
                  <span className="px-4 py-2 rounded-xl bg-zinc-950 border border-red-500/40 text-red-300">
                    ① 캐릭터 IP 매력
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-600 hidden sm:inline" />
                  <span className="px-4 py-2 rounded-xl bg-zinc-950 border border-amber-500/40 text-amber-300">
                    ② 순례길 현장 방문
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-600 hidden sm:inline" />
                  <span className="px-4 py-2 rounded-xl bg-zinc-950 border border-emerald-500/40 text-emerald-300">
                    ③ AR 카드 & 알 수집
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-600 hidden sm:inline" />
                  <span className="px-4 py-2 rounded-xl bg-zinc-950 border border-cyan-500/40 text-cyan-300">
                    ④ 덕룸 공유 & 지속 팬덤
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto">
                  이 순환 구조를 통해 캐릭터 상품 매출에만 의존하지 않고, 실제 지역 관광과 지속적인 방문,
                  디지털 수집과 소셜 커뮤니티가 상호 작용하는 자생적 생태계를 완성합니다.
                </p>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CHARACTERS */}
          {activeTab === "characters" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-red-400 tracking-widest uppercase">
                  DUCKJI UNIVERSE CHARACTER ROSTER
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">세계관의 주역들</h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  각기 다른 매력과 스토리를 품고 있는 주인공들을 만나보세요. 카드를 클릭하면 상세 프로필을 확인할 수 있습니다.
                </p>
              </div>

              {/* Character Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacter(char.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      selectedCharacter === char.id
                        ? `bg-zinc-900 ${char.borderColor} shadow-xl ring-1 ring-white/10`
                        : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${char.badgeColor}`}>
                        {char.chineseName}
                      </span>
                      <h4 className="font-black text-lg text-white mt-1.5">{char.name}</h4>
                      <p className="text-[11px] text-zinc-400 font-mono">{char.englishName}</p>
                    </div>
                    <span className="text-[11px] text-zinc-500 line-clamp-1">{char.title}</span>
                  </button>
                ))}
              </div>

              {/* Detailed Active Character Card */}
              {(() => {
                const char = characters.find((c) => c.id === selectedCharacter) || characters[0]
                return (
                  <div className={`p-6 sm:p-10 rounded-3xl bg-gradient-to-br ${char.color} via-zinc-900 to-zinc-950 border ${char.borderColor} shadow-2xl space-y-8`}>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      {/* Character Avatar Box */}
                      <div className="w-full md:w-64 shrink-0 flex flex-col items-center gap-3">
                        <div className="relative w-48 h-64 sm:w-56 sm:h-72 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-950">
                          <img
                            src={char.image}
                            alt={char.name}
                            className="w-full h-full object-contain p-2 select-none drop-shadow-xl"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-3 left-3 right-3 text-center">
                            <span className="text-xs font-mono font-bold text-amber-300 drop-shadow-md">
                              {char.englishName}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${char.badgeColor}`}>
                          {char.chineseName}
                        </span>
                      </div>

                      {/* Character Lore Details */}
                      <div className="space-y-6 flex-1">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                              CHARACTER DOSSIER
                            </span>
                            <span className="text-zinc-600">/</span>
                            <span className={`text-xs font-bold ${char.accentColor}`}>{char.role}</span>
                          </div>
                          <h3 className="text-2xl sm:text-4xl font-black text-white">{char.name} ({char.englishName})</h3>
                          <p className="text-sm font-semibold text-zinc-300 mt-1">{char.title}</p>
                        </div>

                        {/* Quote Box */}
                        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs sm:text-sm italic text-zinc-300 border-l-4 border-l-amber-400">
                          &ldquo;{char.quote}&rdquo;
                        </div>

                        {/* Personality Keywords */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">성격 및 정체성 키워드</h5>
                          <div className="flex flex-wrap gap-2">
                            {char.keywords.map((kw, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-200"
                              >
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">상세 설정 및 서사</h5>
                          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{char.description}</p>
                        </div>

                        {/* Appearance Points */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">외형 및 디자인 상징</h5>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
                            {char.appearance.map((item, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}

          {/* TAB 3: THE 8 TRAILS */}
          {activeTab === "trails" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">
                  THE 8 PILGRIMAGE TRAILS
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">덕지순례길: 1길부터 8길까지</h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  도난당한 황금알을 되찾는 서사는 현실의 관광 코스로 구현됩니다.
                  각 길마다 지정된 오프라인 거점을 방문하여 실물 AR 카드를 수집하고 미션을 해결하세요.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trails.map((trail) => (
                  <div
                    key={trail.step}
                    className={`p-6 rounded-2xl border ${trail.color} transition-all space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-md bg-zinc-950 font-mono text-xs font-black">
                        PATH #{trail.step}
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded">
                        알의 상징: {trail.eggTheme}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white">{trail.title}</h4>
                    <p className="text-xs text-amber-300 font-medium">{trail.subtitle}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{trail.desc}</p>
                  </div>
                ))}
              </div>

              {/* Pilgrimage CTA */}
              <div className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                    <Compass className="w-5 h-5 text-emerald-400" />
                    <span>지금 바로 덕지순례길 코스를 둘러보세요</span>
                  </h4>
                  <p className="text-xs text-zinc-400">
                    전국 핫플레이스 팝업스토어 및 성지 코스를 지도와 함께 확인하고 나만의 순례를 시작하세요.
                  </p>
                </div>
                <a
                  href="/popups/pilgrimage"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg whitespace-nowrap transition-all"
                >
                  순례길 코스 지도 열기
                </a>
              </div>
            </motion.div>
          )}

          {/* TAB 4: 3 CORE PILLARS */}
          {activeTab === "pillars" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">
                  THREE CORE PILLARS & TECH
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">프로젝트의 3대 핵심 기둥</h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  DUCKJI & DUCKSOON 프로젝트를 현실에서 작동하게 만드는 세 가지 핵심 축입니다.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {pillars.map((pillar, i) => {
                  const Icon = pillar.icon
                  return (
                    <div
                      key={i}
                      className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between gap-6 hover:border-zinc-700 transition-all shadow-xl"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className={`p-3 rounded-2xl border ${pillar.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <span className="text-[11px] font-bold text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800">
                            {pillar.badge}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-white">{pillar.title}</h3>
                        <p className="text-xs text-zinc-300 leading-relaxed">{pillar.desc}</p>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">주요 기능</span>
                        <ul className="space-y-1.5 text-xs text-zinc-400">
                          {pillar.features.map((feat, fIdx) => (
                            <li key={fIdx} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* DUCKROOM Special Focus Card */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-900 border border-purple-500/30 space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest">
                  <LayoutGrid className="w-4 h-4" />
                  <span>CYWORLD HOMAGE: DUCKROOM (덕룸) 디지털 자랑 공간</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="md:col-span-2 space-y-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      순례길의 여정이 끝난 후에도 팬덤이 살아 숨 쉬는 나만의 미니룸
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      덕룸은 단순한 아이템 인벤토리가 아닙니다. 싸이월드의 미니룸 꾸미기 문화를 현대적인 웹3 &
                      메타버스 감성으로 재해석하여, 참여자가 발로 뛰며 모은 한정 AR 카드와 황금알, 완주 배지를
                      전시하는 디지털 전시장입니다. 여행이 끝난 후에도 다른 팬들의 미니룸을 방문하고 자신의 업적을
                      공유하며 지속적인 유대감을 형성합니다.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-zinc-950/80 border border-purple-500/20 text-center space-y-2">
                    <div className="text-2xl font-black text-purple-300 font-mono">100% 디지털 아카이빙</div>
                    <p className="text-xs text-zinc-400">
                      카드 도감 · 황금알 컬렉션 · 미니룸 인테리어 · 일촌 파도타기
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: GLOBAL & BUSINESS STRATEGY */}
          {activeTab === "business" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-red-400 tracking-widest uppercase font-mono">
                  GLOBAL IP EXPANSION & NEXUS PLATFORM
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">글로벌 시장 전략 & 비즈니스 허브</h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  대한민국을 전 세계 글로벌 사업체와 팬덤을 결집시키는 핵심 매개체로 삼아, 중화권과 서양권 시장을 잇는 글로벌 엔터테인먼트 플랫폼으로 도약합니다.
                </p>
              </div>

              {/* Korea: Central Global Medium & Business Hub Banner */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-900 border-2 border-red-500/40 shadow-2xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🇰🇷</span>
                    <span className="text-xs font-bold text-red-400 font-mono tracking-wider uppercase">
                      KOREA: THE GLOBAL NEXUS & CONNECTOR
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black shadow-md">
                    글로벌 비즈니스 집결 매개체
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl sm:text-3xl font-black text-white leading-snug">
                    한국은 전 세계 글로벌 사업체를 <br className="hidden sm:inline" />
                    한 곳에 끌어모으는 <span className="text-red-400">‘핵심 매개체’</span>의 역할을 합니다
                  </h3>
                  <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                    대한민국은 K-컬처, 최신 트렌드 팝업스토어, 서브컬처 팬덤이 전 세계에서 가장 역동적으로 교차하는 문화의 중심지입니다.
                    <strong> DUCKJI</strong>는 한국의 오프라인 핫플레이스(성수, 홍대, 강남, 여의도 등)와 독보적인 팝업 아카이브 인프라를 바탕으로,
                    <strong> 중화권·일본·북미·유럽 등 전 세계 유수의 캐릭터 IP와 글로벌 사업체들을 한국이라는 무대에 한곳으로 끌어모으는 중심 매개체(Global Medium Hub)</strong>로 기능합니다.
                  </p>
                </div>

                {/* 3 Core Roles as a Business Medium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5" />
                      <span>01. 글로벌 기업 유치 & 입점 창구</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      해외 캐릭터 IP 및 브랜드가 한국 시장에 원스톱으로 팝업스토어와 전시를 열 수 있도록 B2B 플랫폼과 오프라인 인프라를 연결합니다.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>02. 온·오프라인 순례길 연계 허브</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      한국을 찾은 수많은 외국인 관광객들이 DUCKJI 순례길을 따라 글로벌 브랜드의 거점 부스를 직접 탐방하고 수집하도록 동선을 설계합니다.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>03. IP 시너지 & 멀티 비즈니스 창출</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      국내외 제작사, 라이선서, 유통사가 한국이라는 매개체 안에서 상호 교류하며 협업 굿즈와 신규 부가가치를 창출하는 비즈니스 생태계를 완성합니다.
                    </p>
                  </div>
                </div>

                {/* Flow Diagram */}
                <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/90 flex flex-wrap items-center justify-around gap-3 text-xs font-bold text-center">
                  <div className="space-y-1">
                    <span className="text-red-400">중화권 IP & 사업체</span>
                    <p className="text-[10px] text-zinc-500 font-normal">大吉大利 길상·재물 IP</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 hidden sm:inline" />
                  <div className="px-5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-white shadow-md">
                    <span className="text-amber-300 font-black">🇰🇷 한국 DUCKJI 플랫폼</span>
                    <p className="text-[10px] text-red-300 font-normal">글로벌 사업체 집결 & 매개체</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 hidden sm:inline" />
                  <div className="space-y-1">
                    <span className="text-cyan-400">서양권 IP & 사업체</span>
                    <p className="text-[10px] text-zinc-500 font-normal">판타지 퀘스트 & 게이밍</p>
                  </div>
                </div>
              </div>

              {/* Markets Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Greater China */}
                <div className="p-8 rounded-3xl bg-zinc-900 border border-red-500/30 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 font-mono">GREATER CHINA MARKET</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold">
                      大吉(덕지) & 大利(덕순)
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">중화권 시장: 길상(吉祥)과 복(福)의 상징</h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    큰 길운을 뜻하는 <strong>大吉</strong>과 큰 이익을 뜻하는 <strong>大利</strong>라는 네이밍을 통해
                    행운과 번영의 아이콘으로 다가섭니다. 붉은색과 금색의 시각적 조합, 숫자 8의 길운, 그리고
                    황금알과 황금용(金龍)의 강림 서사는 중화권 팬들에게 깊은 문화적 공감과 소장 가치를 선사합니다.
                  </p>
                  <ul className="space-y-2 text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>대길대리(大吉大利) 한자 낙관 및 한정 옥새 굿즈 기획</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>중국어 간체/번체 전용 모바일 순례길 가이드 및 위챗 연동</span>
                    </li>
                  </ul>
                </div>

                {/* Western Markets */}
                <div className="p-8 rounded-3xl bg-zinc-900 border border-cyan-500/30 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 font-mono">WESTERN & GLOBAL MARKETS</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                      Lucky Duck & Dragon Quest
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">서양권 시장: 판타지 퀘스트 & 게임 문화</h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    한자의 의미를 몰라도 직관적으로 이해할 수 있는 <strong>Lucky Duck</strong> 캐릭터의 슬랩스틱 코미디와
                    프로게이머 덕후 문화로 언어 장벽을 허뭅니다. 8개의 황금알을 찾는 어드벤처 스캐빈저 헌트와
                    신화적 드래곤의 강림, 카드 덱 빌딩의 수집 재미로 서양권 게이머와 서브컬처 팬을 사로잡습니다.
                  </p>
                  <ul className="space-y-2 text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>직관적인 영문 네이밍 & SD 애니메이션 중심의 밈(Meme) 마케팅</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>글로벌 게이밍 커뮤니티 및 한정 피규어 킥스타터 펀딩 연계</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Business Model Grid */}
              <div className="p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
                  <Store className="w-4 h-4" />
                  <span>DIVERSIFIED REVENUE STREAMS (8대 다각화 수익 모델)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { title: "캐릭터 굿즈", desc: "피규어, 봉제인형, 의류, 한정판 액세서리" },
                    { title: "수집용 AR 카드", desc: "실물 카드팩, 한정판 홀로그램 박스" },
                    { title: "관광 체험 패키지", desc: "유료 특별 순례 투어 & 원데이 가이드" },
                    { title: "직영·제휴 스토어", desc: "팝업스토어 F&B 및 공식 매장 매출" },
                    { title: "IP 라이선싱", desc: "글로벌 패션, 식음료, 게임 콜라보" },
                    { title: "덕룸 디지털 아이템", desc: "미니룸 가구, 프로필 스킨, 특수 이펙트" },
                    { title: "시즌 이벤트", desc: "한정 팝업, 축제, 캐릭터 전시회" },
                    { title: "B2B 제휴 입점", desc: "팝업 주최사 플랫폼 등록 및 집기 비품 대행" },
                  ].map((bm, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <h4 className="font-bold text-white text-xs">{bm.title}</h4>
                      <p className="text-[11px] text-zinc-400 leading-tight">{bm.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 6: COMPANY & CONTACT */}
          {activeTab === "company" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-bold text-red-400 tracking-widest uppercase">
                  CORPORATE INFORMATION & PARTNERSHIP
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">주식회사 시아아 (SIAA Inc.)</h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  DUCKJI & DUCKSOON 브랜드를 총괄 기획·운영하는 공식 법인 정보 및 비즈니스 제휴 안내입니다.
                </p>
              </div>

              {/* Corporate Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Company Details */}
                <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
                  <div className="flex items-center gap-3">
                    <img
                      src="/images/logo-gold.png"
                      alt="DUCKJI 로고"
                      className="h-12 w-auto object-contain drop-shadow-md"
                    />
                    <div>
                      <h3 className="text-lg font-black text-white">주식회사 시아아 (SIAA Inc.)</h3>
                      <p className="text-xs text-zinc-400">글로벌 서브컬처 IP & 팝업 아카이브 플랫폼</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-zinc-300 divide-y divide-zinc-800/80">
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">대표자</span>
                      <span className="font-bold text-white">이예인</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">사업자등록번호</span>
                      <span className="font-mono font-bold text-white">873-81-03909</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">통신판매업신고</span>
                      <span className="font-medium text-white">제 2026-서울송파-0321호</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">본사 소재지</span>
                      <span className="font-medium text-white text-right max-w-xs">
                        서울특별시 송파구 올림픽로 300, 롯데월드타워 26층
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">고객센터 / 대표전화</span>
                      <span className="font-mono font-bold text-emerald-400">02-415-0922</span>
                    </div>
                    <div className="flex justify-between py-2 items-center">
                      <span className="text-zinc-500 font-medium">제휴 및 입점 문의</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-400">inc.siaa@gmail.com</span>
                        <button
                          onClick={handleCopyEmail}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                          title="이메일 복사"
                        >
                          {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500 font-medium">운영 시간</span>
                      <span className="font-medium text-zinc-400">평일 10:00 - 18:00 (주말/공휴일 휴무)</span>
                    </div>
                  </div>
                </div>

                {/* Partnership Proposals */}
                <div className="p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-850 border border-amber-500/30 flex flex-col justify-between gap-6 shadow-xl">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>B2B PARTNERSHIP & SPONSORSHIP</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                      팝업스토어 주최사 및 <br />
                      글로벌 브랜드 제휴를 환영합니다
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      덕지 플랫폼은 수많은 서브컬처 팬덤과 실시간 팝업 탐방객이 모이는 대한민국 최고의 허브입니다.
                      팝업 등록, 배너 광고, 순례길 거점 지정, 한정 굿즈 제작 및 집기 대행까지 원스톱으로 지원합니다.
                    </p>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>팝업스토어 & 전시 행사 무료·유료 등록 신청</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>덕지순례길 공식 거점 협약 및 AR 카드 배포 제휴</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>팝업 집기·디스플레이 비품·한정 굿즈 1:1 견적 대행</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => (window.location.href = "/partners/apply/")}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-bold h-11 px-6 rounded-xl flex-1 cursor-pointer shadow-lg"
                    >
                      👑 주최사 입점/광고 신청하기
                    </Button>
                    <a
                      href="mailto:inc.siaa@gmail.com"
                      className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
                    >
                      <Mail className="w-4 h-4 text-emerald-400" />
                      <span>이메일 문의</span>
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  )
}

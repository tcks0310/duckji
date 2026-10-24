"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  User, 
  Flame, 
  Compass, 
  ArrowRight,
  ArrowLeft,
  Zap,
  Star,
  Layers,
  Heart,
  BrainCircuit,
  Film,
  CheckCircle2,
  Sword,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  Volume2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SajuInput } from "@/lib/saju-engine"
import { DatePicker, todayYmd } from "@/components/ui/date-picker"

interface SajuInputFormProps {
  onSubmit: (input: SajuInput) => void
  isLoading?: boolean
}

export function SajuInputForm({ onSubmit, isLoading }: SajuInputFormProps) {
  // Step state (1: Name & Gender, 2: Birth Date & Hour, 3: MBTI, 4: 3 Favorite Anime, 5: Genre & Awakening)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [viewMode, setViewMode] = useState<"step" | "all">("step")

  // Form Fields
  const [name, setName] = useState("")
  const [birthYear, setBirthYear] = useState("2000")
  const [birthMonth, setBirthMonth] = useState("05")
  const [birthDay, setBirthDay] = useState("15")
  const [birthHour, setBirthHour] = useState("unknown")
  const birthDateValue = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
  const setBirthDateValue = (v: string) => {
    const [y, m, d] = v.split("-")
    if (!d) return
    setBirthYear(y)
    setBirthMonth(m)
    setBirthDay(d)
  }
  const [gender, setGender] = useState<"male" | "female" | "other">("male")
  
  // MBTI State
  const [mbti, setMbti] = useState<string>("INFP")

  // Top 3 Favorite Anime
  const [favoriteAnime1, setFavoriteAnime1] = useState("귀멸의 칼날")
  const [favoriteAnime2, setFavoriteAnime2] = useState("주술회전")
  const [favoriteAnime3, setFavoriteAnime3] = useState("장송의 프리렌")
  const [favoriteGenre, setFavoriteGenre] = useState<string>("소년만화/열혈액션")

  const mbtiList = [
    { code: "INTJ", name: "전략가", color: "from-purple-500 to-indigo-600" },
    { code: "INTP", name: "논리학자", color: "from-indigo-500 to-blue-600" },
    { code: "ENTJ", name: "통솔자", color: "from-rose-500 to-red-600" },
    { code: "ENTP", name: "변론가", color: "from-amber-500 to-orange-600" },
    { code: "INFJ", name: "옹호자", color: "from-emerald-500 to-teal-600" },
    { code: "INFP", name: "중재자", color: "from-purple-400 to-pink-500" },
    { code: "ENFJ", name: "선도자", color: "from-emerald-400 to-green-600" },
    { code: "ENFP", name: "활동가", color: "from-amber-400 to-yellow-500" },
    { code: "ISTJ", name: "현실주의자", color: "from-blue-500 to-slate-600" },
    { code: "ISFJ", name: "수호자", color: "from-cyan-500 to-blue-600" },
    { code: "ESTJ", name: "경영자", color: "from-red-500 to-rose-700" },
    { code: "ESFJ", name: "집정관", color: "from-teal-500 to-cyan-600" },
    { code: "ISTP", name: "장인", color: "from-yellow-500 to-amber-600" },
    { code: "ISFP", name: "모험가", color: "from-pink-500 to-rose-500" },
    { code: "ESTP", name: "사업가", color: "from-orange-500 to-red-600" },
    { code: "ESFP", name: "연예인", color: "from-fuchsia-500 to-pink-600" }
  ]

  const hoursOptions = [
    { value: "unknown", label: "시간 모름 / 미입력" },
    { value: "23-01", label: "자시 (23:30 ~ 01:29) • 수(水)기운" },
    { value: "01-03", label: "축시 (01:30 ~ 03:29) • 토(土)기운" },
    { value: "03-05", label: "인시 (03:30 ~ 05:29) • 목(木)기운" },
    { value: "05-07", label: "묘시 (05:30 ~ 07:29) • 목(木)기운" },
    { value: "07-09", label: "진시 (07:30 ~ 09:29) • 토(土)기운" },
    { value: "09-11", label: "사시 (09:30 ~ 11:29) • 화(火)기운" },
    { value: "11-13", label: "오시 (11:30 ~ 13:29) • 화(火)기운" },
    { value: "13-15", label: "미시 (13:30 ~ 15:29) • 토(土)기운" },
    { value: "15-17", label: "신시 (15:30 ~ 17:29) • 금(金)기운" },
    { value: "17-19", label: "유시 (17:30 ~ 19:29) • 금(金)기운" },
    { value: "19-21", label: "술시 (19:30 ~ 21:29) • 토(土)기운" },
    { value: "21-23", label: "해시 (21:30 ~ 23:29) • 수(水)기운" },
  ]

  const genres = [
    "소년만화/열혈액션",
    "다크판타지/주술",
    "이세계/환생/치트",
    "일상/치유/청춘",
    "SF/사이버펑크",
    "추리/두뇌서스펜스"
  ]

  // Step Meta Information for Character Synchronization
  const stepMetas = [
    {
      step: 1,
      title: "제1단계: 영혼의 명명 & 성별 각인",
      sub: "이세계로 전송될 영혼의 이름과 신체 성별을 부여합니다.",
      npcName: "차원 점술사 루나",
      npcAvatar: "/images/npc/luna.jpg",
      npcQuote: "새로운 차원의 문이 열렸습니다. 당신의 영혼을 부를 진정한 이름과 성별을 알려주세요.",
      syncPercent: 20,
      syncLabel: "영혼 윤곽 생성 중",
      glowColor: "from-purple-500/20 to-indigo-500/20"
    },
    {
      step: 2,
      title: "제2단계: 사주 원국 & 탄생의 천체 관측",
      sub: "생년월일시 만세력 좌표에서 오행(화·수·목·금·토)의 기운을 추출합니다.",
      npcName: "전생 기록관 아카샤",
      npcAvatar: "/images/npc/akasha.jpg",
      npcQuote: "만세력 천체 룬 문자를 회전시킵니다. 당신이 태어난 날의 자연 에너지를 캐릭터에 불어넣을게요.",
      syncPercent: 40,
      syncLabel: "오행 원소 융합 중",
      glowColor: "from-emerald-500/20 to-teal-500/20"
    },
    {
      step: 3,
      title: "제3단계: 내면의 영혼 파동 & MBTI 기질",
      sub: "MBTI 16유형의 고유 젬스톤을 심장에 장착하여 내면 심리와 기질을 일치시킵니다.",
      npcName: "이세계 여신 아쿠아리아",
      npcAvatar: "/images/npc/aquaria.jpg",
      npcQuote: "용사님의 심리 주파수(MBTI)를 공명시켜 고유한 아우라와 아바타 성향을 확정합니다.",
      syncPercent: 65,
      syncLabel: "정신 파동 공명 완료",
      glowColor: "from-cyan-500/20 to-blue-500/20"
    },
    {
      step: 4,
      title: "제4단계: 3대 최애작 각인 & 전설 무기 주조",
      sub: "가장 사랑하는 3대 애니메이션의 기억과 세계관을 전용 무기와 필살기로 연성합니다.",
      npcName: "전설의 대장장이 헤파이",
      npcAvatar: "/images/npc/hepai.jpg",
      npcQuote: "자네가 가장 사랑하는 3대 명작을 알려주게! 그 작품들의 정수를 녹여 전용 전설 무기를 벼려내겠네!",
      syncPercent: 85,
      syncLabel: "전설 무기 주조 중",
      glowColor: "from-amber-500/20 to-orange-500/20"
    },
    {
      step: 5,
      title: "제5단계: 운명의 차원 장르 & 최종 영혼 동기화",
      sub: "선호하는 덕질 세계관을 선택하여 나와 캐릭터의 영혼을 99.9% 완벽 동기화합니다.",
      npcName: "게이트 마스터 루나 & 아카샤",
      npcAvatar: "/images/npc/luna.jpg",
      npcQuote: "모든 차원 조건이 갖춰졌습니다! 영혼 동기화율 99.9%! 지금 사주 세계관으로 전송합니다!",
      syncPercent: 99.9,
      syncLabel: "영혼 합일 (Sync 99.9%) READY",
      glowColor: "from-rose-500/20 to-emerald-500/20"
    }
  ]

  const currentMeta = stepMetas[step - 1]

  const handleNextStep = () => {
    if (step === 1 && !name.trim()) {
      alert("이름 또는 닉네임을 입력해주세요!")
      return
    }
    if (step === 4 && (!favoriteAnime1.trim() || !favoriteAnime2.trim() || !favoriteAnime3.trim())) {
      alert("최애 애니메이션 3편을 모두 입력해주세요!")
      return
    }
    if (step < 5) {
      setStep((prev) => (prev + 1) as any)
      window.scrollTo({ top: 120, behavior: "smooth" })
    } else {
      executeSubmit()
    }
  }

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as any)
      window.scrollTo({ top: 120, behavior: "smooth" })
    }
  }

  const executeSubmit = () => {
    const formattedMonth = birthMonth.padStart(2, "0")
    const formattedDay = birthDay.padStart(2, "0")
    const birthDate = `${birthYear}-${formattedMonth}-${formattedDay}`

    onSubmit({
      name: name.trim() || "성지탐험가",
      birthDate,
      birthHour,
      gender,
      mbti,
      favoriteAnime1: favoriteAnime1.trim() || "귀멸의 칼날",
      favoriteAnime2: favoriteAnime2.trim() || "주술회전",
      favoriteAnime3: favoriteAnime3.trim() || "장송의 프리렌",
      favoriteGenre
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeSubmit()
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 p-4 sm:p-5 rounded-3xl border border-zinc-800 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <span>DUKJI 만세력 X 캐릭터 동기화 챔버</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            나와 캐릭터의 영혼 동기화 의식 (5단계)
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("step")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "step"
                ? "bg-emerald-500 text-black shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>단계별 동기화</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === "all"
                ? "bg-zinc-800 text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>전체 한눈에 보기</span>
          </button>
        </div>
      </div>

      {/* ===================== VIEW 1: STEP-BY-STEP SYNCHRONIZATION (DEFAULT) ===================== */}
      {viewMode === "step" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Question Card (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Step Progress Tabs Bar */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-2xl flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
              {stepMetas.map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setStep(s.step as any)}
                  className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-[11px] font-black transition-all flex flex-col items-center gap-0.5 ${
                    step === s.step
                      ? "bg-amber-500 text-black shadow-lg scale-102"
                      : step > s.step
                      ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span className="text-[10px] opacity-80">STEP {s.step}</span>
                  <span className="truncate max-w-[70px]">
                    {s.step === 1 ? "이름/성별" : s.step === 2 ? "생년월일시" : s.step === 3 ? "MBTI" : s.step === 4 ? "최애애니" : "세계관"}
                  </span>
                </button>
              ))}
            </div>

            {/* Question Box with NPC Dialogue */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-zinc-900/95 border-2 border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
              >
                {/* Ambient Glow */}
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${currentMeta.glowColor} rounded-full blur-3xl pointer-events-none`} />

                {/* NPC Guidance Dialogue Box */}
                <div className="flex items-center gap-3.5 bg-zinc-950/90 p-3.5 rounded-2xl border border-zinc-800 relative z-10">
                  <img
                    src={currentMeta.npcAvatar}
                    alt={currentMeta.npcName}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400/80 shadow-md flex-shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{currentMeta.npcName}</span>
                    </div>
                    <p className="text-xs text-zinc-200 font-medium italic leading-snug">
                      "{currentMeta.npcQuote}"
                    </p>
                  </div>
                </div>

                {/* Step Title Header */}
                <div className="space-y-1 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      STEP {step} / 5
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Sync Rate: {currentMeta.syncPercent}%
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {currentMeta.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {currentMeta.sub}
                  </p>
                </div>

                {/* ================= STEP 1: Name & Gender ================= */}
                {step === 1 && (
                  <div className="space-y-4 relative z-10 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>이름 또는 닉네임 (캐릭터명)</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        placeholder="예: 탄지로, 덕지순례자, 고죠, 나루토"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-2 flex items-center justify-between">
                        <span>아바타 캐릭터 선택 (웹툰 주인공 스타일)</span>
                        <span className="text-[11px] text-amber-400 font-normal">✨ 고화질 웹툰 AI 스타일 적용</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { 
                            id: "female", 
                            label: "여성 주인공 ♀", 
                            sub: "로맨스 웹툰 여주",
                            image: "/images/avatar/female.jpg",
                            border: "hover:border-pink-500/60"
                          },
                          { 
                            id: "male", 
                            label: "남성 주인공 ♂", 
                            sub: "로맨스 웹툰 남주",
                            image: "/images/avatar/male.jpg",
                            border: "hover:border-blue-500/60"
                          },
                          { 
                            id: "other", 
                            label: "초월 / 정령 ✧", 
                            sub: "신비로운 판타지",
                            image: "/images/avatar/wood.jpg",
                            border: "hover:border-emerald-500/60"
                          },
                        ].map((g) => (
                          <button
                            type="button"
                            key={g.id}
                            onClick={() => setGender(g.id as any)}
                            className={`p-3 rounded-2xl text-left transition-all relative overflow-hidden flex items-center gap-3 border ${
                              gender === g.id
                                ? "bg-gradient-to-r from-amber-500/20 via-red-500/20 to-zinc-900 border-amber-400 shadow-lg scale-102"
                                : `bg-zinc-950/80 border-zinc-800 ${g.border} opacity-80 hover:opacity-100`
                            }`}
                          >
                            <img
                              src={g.image}
                              alt={g.label}
                              className="w-12 h-12 rounded-xl object-cover border border-white/20 shadow-md flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate flex items-center gap-1">
                                <span>{g.label}</span>
                                {gender === g.id && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {g.sub}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= STEP 2: Birth Date & Hour ================= */}
                {step === 2 && (
                  <div className="space-y-4 relative z-10 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>생년월일 (양력 기준)</span>
                      </label>
                      <DatePicker
                        value={birthDateValue}
                        min="1950-01-01"
                        max={todayYmd()}
                        clearable={false}
                        onChange={setBirthDateValue}
                        aria-label="생년월일"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-3 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>태어난 시간 (선택 - 시주 8자 완성)</span>
                      </label>
                      <select
                        value={birthHour}
                        onChange={(e) => setBirthHour(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                      >
                        {hoursOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        * 시간을 모르면 비워두셔도 생년월일(3주 6자)로 정확한 사주 오행이 연산됩니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* ================= STEP 3: MBTI Selection ================= */}
                {step === 3 && (
                  <div className="space-y-3 relative z-10 pt-2">
                    <label className="block text-xs font-bold text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                        <span>당신의 MBTI 성향을 선택하세요 (16가지 유형)</span>
                      </span>
                      <span className="text-purple-400 font-mono font-bold">선택: {mbti}</span>
                    </label>

                    <div className="grid grid-cols-4 gap-2">
                      {mbtiList.map((m) => (
                        <button
                          type="button"
                          key={m.code}
                          onClick={() => setMbti(m.code)}
                          className={`p-2.5 rounded-2xl text-xs font-bold transition-all text-center flex flex-col items-center gap-0.5 ${
                            mbti === m.code
                              ? "bg-purple-600 text-white shadow-lg scale-105 border border-purple-300/40"
                              : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          <span className="text-xs font-black tracking-wide">{m.code}</span>
                          <span className="text-[9px] opacity-75 font-normal">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ================= STEP 4: 3 Favorite Animes ================= */}
                {step === 4 && (
                  <div className="space-y-3.5 relative z-10 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        <span>인생 최애 애니 3편 직접 입력 (필수)</span>
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold">전설 무기 연성 재료</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-[11px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                          1순위
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="예: 귀멸의 칼날, 원피스, 나루토 등"
                          value={favoriteAnime1}
                          onChange={(e) => setFavoriteAnime1(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-20 pr-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-bold"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-[11px] font-black text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-md">
                          2순위
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="예: 주술회전, 헌터X헌터, 체인소맨 등"
                          value={favoriteAnime2}
                          onChange={(e) => setFavoriteAnime2(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-20 pr-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 font-bold"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-[11px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                          3순위
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="예: 장송의 프리렌, 봇치 더 록, 바이올렛 에버가든 등"
                          value={favoriteAnime3}
                          onChange={(e) => setFavoriteAnime3(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-20 pr-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= STEP 5: Genre & Final Awakening ================= */}
                {step === 5 && (
                  <div className="space-y-4 relative z-10 pt-2">
                    <label className="block text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>선호하는 덕질 세계관 장르</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      {genres.map((genre) => (
                        <button
                          type="button"
                          key={genre}
                          onClick={() => setFavoriteGenre(genre)}
                          className={`p-3 rounded-2xl text-xs font-bold transition-all text-left truncate flex items-center justify-between ${
                            favoriteGenre === genre
                              ? "bg-emerald-500 text-black shadow-lg font-black"
                              : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                          }`}
                        >
                          <span className="truncate">{genre}</span>
                          {favoriteGenre === genre && <CheckCircle2 className="w-4 h-4 text-black flex-shrink-0 ml-1" />}
                        </button>
                      ))}
                    </div>

                    <div className="bg-zinc-950 p-4 rounded-2xl border border-emerald-500/30 space-y-1 text-center">
                      <span className="text-xs font-black text-emerald-400 flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>영혼 동기화 준비율 99.9% 달성!</span>
                      </span>
                      <p className="text-[11px] text-zinc-400">
                        버튼을 누르면 아카식 서고의 만세력 연산이 시작되고 모드 선택 포털이 열립니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="pt-4 flex items-center justify-between gap-3 border-t border-zinc-800/80 relative z-10">
                  {step > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevStep}
                      className="rounded-2xl border-zinc-700 text-zinc-300 hover:text-white text-xs px-4"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      이전 질문
                    </Button>
                  ) : (
                    <div />
                  )}

                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={isLoading}
                    className={`rounded-2xl font-black text-xs sm:text-sm py-3 px-6 shadow-xl flex items-center gap-2 ${
                      step === 5
                        ? "bg-red-600 hover:bg-red-500 text-black animate-pulse"
                        : "bg-amber-500 hover:bg-amber-400 text-black"
                    }`}
                  >
                    {isLoading ? (
                      <span>차원 연산 중...</span>
                    ) : step === 5 ? (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>동기화 완료 • Lv.1 사주 포털 입장</span>
                      </>
                    ) : (
                      <>
                        <span>다음 단계로 동기화 ({step + 1}단계)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column: Real-Time Character Synchronization Hologram Chamber (5 cols) */}
          <div className="lg:col-span-5 bg-zinc-900/90 border-2 border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 sticky top-24 backdrop-blur-xl overflow-hidden">
            {/* Hologram Chamber Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-black text-white tracking-wide">
                  실시간 영혼 동기화 챔버
                </span>
              </div>
              <span className="text-xs font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                SYNC {currentMeta.syncPercent}%
              </span>
            </div>

            {/* Sync Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-bold">{currentMeta.syncLabel}</span>
                <span className="text-emerald-400 font-mono font-bold">{currentMeta.syncPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                <motion.div
                  initial={{ width: "20%" }}
                  animate={{ width: `${currentMeta.syncPercent}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-red-500 rounded-full"
                />
              </div>
            </div>

            {/* Live Character Silhouette / Hologram Showcase */}
            <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center p-4 group">
              {/* Background Aura */}
              <div className={`absolute inset-0 bg-gradient-to-t ${currentMeta.glowColor} opacity-50`} />
              <img
                src={
                  gender === "female" 
                    ? "/images/avatar/female.jpg" 
                    : gender === "male" 
                    ? "/images/avatar/male.jpg" 
                    : "/images/avatar/wood.jpg"
                }
                alt="동기화 아바타"
                className={`w-full h-full object-cover transition-all duration-700 ${
                  step === 1 ? "filter brightness-50 contrast-125 blur-[2px]" :
                  step === 2 ? "filter brightness-70 contrast-110 blur-[1px]" :
                  step === 3 ? "filter brightness-85 contrast-105" :
                  step === 4 ? "filter brightness-100 contrast-105" :
                  "filter brightness-110 contrast-110 "
                }`}
              />

              {/* Holographic Scanline Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-60" />

              {/* Live Character Tag Overlay */}
              <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md p-2.5 rounded-xl border border-zinc-700/80 space-y-1 text-center">
                <div className="text-xs font-black text-white truncate">
                  {name.trim() ? `"${name}"` : "「이름 미각인 상태」"}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] font-bold text-zinc-300">
                  <span className="text-amber-400">{gender === "male" ? "남성" : gender === "female" ? "여성" : "초월"}</span>
                  <span>•</span>
                  <span className="text-purple-300">{mbti}</span>
                  <span>•</span>
                  <span className="text-emerald-300">{birthYear}년생</span>
                </div>
              </div>
            </div>

            {/* Live Synchronized Components List */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-black text-zinc-400 flex items-center justify-between">
                <span>동기화 데이터 슬롯</span>
                <span className="text-emerald-400">5 / 5 활성화</span>
              </div>

              <div className="space-y-1.5 font-medium text-[11px]">
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400">1. 영혼 식별자:</span>
                  <span className="font-bold text-amber-300">{name.trim() || "입력 대기중"}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400">2. 천체 탄생일:</span>
                  <span className="font-bold text-emerald-300">{birthYear}.{birthMonth}.{birthDay}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400">3. 내면 성향:</span>
                  <span className="font-bold text-purple-300">MBTI [{mbti}]</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400">4. 전설 무기 핵:</span>
                  <span className="font-bold text-amber-400 truncate max-w-[140px]">{favoriteAnime1}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                  <span className="text-zinc-400">5. 선호 세계관:</span>
                  <span className="font-bold text-cyan-300">{favoriteGenre.split("/")[0]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: ALL-IN-ONE COMPACT VIEW ===================== */}
      {viewMode === "all" && (
        <form onSubmit={handleFormSubmit} className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>이름 또는 닉네임</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="탄지로, 덕지순례자 등"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">성별</label>
              <div className="grid grid-cols-3 gap-2">
                {["male", "female", "other"].map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGender(g as any)}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      gender === g ? "bg-amber-500 text-black" : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    {g === "male" ? "남성" : g === "female" ? "여성" : "기타"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">생년월일 (양력 기준)</label>
            <DatePicker
              value={birthDateValue}
              min="1950-01-01"
              max={todayYmd()}
              clearable={false}
              onChange={setBirthDateValue}
              aria-label="생년월일"
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">MBTI 유형 선택</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {mbtiList.map((m) => (
                <button
                  type="button"
                  key={m.code}
                  onClick={() => setMbti(m.code)}
                  className={`py-1.5 rounded-lg text-xs font-bold ${
                    mbti === m.code ? "bg-purple-600 text-white" : "bg-zinc-950 text-zinc-400 border border-zinc-800"
                  }`}
                >
                  {m.code}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <label className="block text-xs font-bold text-amber-400">인생 최애 애니메이션 3편 직접 입력</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={favoriteAnime1}
                onChange={(e) => setFavoriteAnime1(e.target.value)}
                placeholder="1순위: 귀멸의 칼날"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
              <input
                type="text"
                required
                value={favoriteAnime2}
                onChange={(e) => setFavoriteAnime2(e.target.value)}
                placeholder="2순위: 주술회전"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
              <input
                type="text"
                required
                value={favoriteAnime3}
                onChange={(e) => setFavoriteAnime3(e.target.value)}
                placeholder="3순위: 장송의 프리렌"
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 text-black font-black py-4 rounded-2xl text-sm"
          >
            {isLoading ? "만세력 연산 중..." : "Lv.1 모험가 각성 포털 입장하기"}
          </Button>
        </form>
      )}
    </div>
  )
}

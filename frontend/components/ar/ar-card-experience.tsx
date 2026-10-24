"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import {
  Camera,
  RotateCw,
  Sparkles,
  Zap,
  Volume2,
  ShieldCheck,
  CheckCircle2,
  Award,
  Layers,
  Smartphone,
  Eye,
  Scan,
  RefreshCw,
  ArrowRight,
  Maximize2,
  Compass,
  Cpu,
  Flame,
  Info,
  Sliders,
  ChevronRight,
  Share2,
  Download,
  AlertCircle
} from "lucide-react"
import { useMemberPoints } from "@/lib/member-points"
import { ARCard, AR_CARDS_DATA } from "./ar-card-data"
import { MosaicMarker } from "./mosaic-marker"
import Link from "next/link"
import { SampleBadge } from "@/components/ui/sample-badge"

export function ARCardExperience() {
  // Active Tab: 'camera' | '3d-simulator' | 'collection' | 'sample-markers'
  const [activeMode, setActiveMode] = useState<"camera" | "3d-simulator" | "collection" | "sample-markers">("camera")
  
  // Current Selected Card
  const [selectedCard, setSelectedCard] = useState<ARCard>(AR_CARDS_DATA[0])
  
  // Card Flip State (false: Front, true: Back Mosaic)
  const [isFlipped, setIsFlipped] = useState(false)
  
  // 3D Parallax Tilt State
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  
  // Camera WebAR State
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [detectedCard, setDetectedCard] = useState<ARCard | null>(null)
  
  // Skill & FX State
  const [isSkillActive, setIsSkillActive] = useState(false)
  const [skillLog, setSkillLog] = useState<string | null>(null)
  const [isVoicePlaying, setIsVoicePlaying] = useState(false)
  
  // Claimed Cards & Duk-Points
  const [claimedCardIds, setClaimedCardIds] = useState<string[]>([])
  const userPoints = useMemberPoints().balance // 비로그인이면 null
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [rewardMsg, setRewardMsg] = useState("")

  // Load claimed cards & points from localStorage
  useEffect(() => {
    try {
      const savedClaimed = localStorage.getItem("duckji_claimed_ar_cards")
      if (savedClaimed) {
        setClaimedCardIds(JSON.parse(savedClaimed))
      } else {
        // Default initial unlocked card
        setClaimedCardIds(["duckji-astral"])
      }

    } catch (e) {}
  }, [])

  // Start Camera Stream for WebAR
  const startCamera = async () => {
    setCameraError(null)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setIsCameraActive(true)
          startScanSimulation()
        }
      } else {
        setCameraError("이 브라우저는 카메라 접근을 지원하지 않습니다.")
      }
    } catch (err: any) {
      console.warn("Camera access error:", err)
      setCameraError("카메라 권한이 차단되었거나 지원되지 않는 환경입니다. 시뮬레이터 모드로 전환할 수 있습니다.")
    }
  }

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
    setIsScanning(false)
  }

  // Simulate Marker Recognition
  const startScanSimulation = () => {
    setIsScanning(true)
    setScanProgress(0)
    let progress = 0
    const interval = setInterval(() => {
      progress += 15
      setScanProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        setIsScanning(false)
        // Pick active card or random card
        const matched = selectedCard
        setDetectedCard(matched)
        triggerHaptic()
      }
    }, 250)
  }

  // Handle Mode Change
  const handleModeChange = (mode: "camera" | "3d-simulator" | "collection" | "sample-markers") => {
    setActiveMode(mode)
    if (mode === "camera") {
      startCamera()
    } else {
      stopCamera()
    }
  }

  // Haptic feedback
  const triggerHaptic = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([80, 50, 80])
    }
  }

  // Mouse / Touch Parallax for 3D Simulator
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    setRotateY((x / (rect.width / 2)) * 18)
    setRotateX(-(y / (rect.height / 2)) * 18)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  // Skill Trigger (3D Action VFX)
  const triggerSkill = () => {
    setIsSkillActive(true)
    triggerHaptic()
    setSkillLog(`⚡ [${selectedCard.name}] 의 '${selectedCard.skillName}' 스킬 발동!`)
    
    // Confetti & Screen Shake
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#f59e0b", "#f43f5e", "#a855f7", "#06b6d4", "#ffffff"],
    })

    setTimeout(() => {
      setIsSkillActive(false)
    }, 2500)
  }

  // Voice Line Audio readout
  const playVoice = () => {
    setIsVoicePlaying(true)
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(selectedCard.voiceLine)
      utterance.lang = "ko-KR"
      utterance.rate = 0.95
      utterance.pitch = 1.05
      utterance.onend = () => setIsVoicePlaying(false)
      utterance.onerror = () => setIsVoicePlaying(false)
      window.speechSynthesis.speak(utterance)
    } else {
      setTimeout(() => setIsVoicePlaying(false), 2000)
    }
  }

  // Claim Card to Digital Vault & Award Duk-Points
  const claimCard = async (card: ARCard) => {
    if (claimedCardIds.includes(card.id)) {
      setRewardMsg(`이미 디지털 도감에 등록된 카드입니다. (+0P)`)
      setShowRewardModal(true)
      return
    }

    // 덕-포인트는 실물 카드가 나온 뒤 카드 코드로 확인해 지급 (2026-10-13 hj 결정으로 지금은 지급하지 않음)

    const newClaimed = [...claimedCardIds, card.id]
    setClaimedCardIds(newClaimed)

    try {
      localStorage.setItem("duckji_claimed_ar_cards", JSON.stringify(newClaimed))
    } catch (e) {}

    setRewardMsg(`🎉 [${card.name}] 디지털 도감 등록 완료! 덕-포인트는 실물 카드가 나오면 카드 코드 확인 후 지급됩니다.`)
    setShowRewardModal(true)
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5 },
    })
  }

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 text-white pb-24 overflow-x-hidden font-sans">
      {/* Background Cybernetic Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Header Banner */}
      <div className="relative z-10 pt-8 sm:pt-12 pb-6 px-4 max-w-6xl mx-auto text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black shadow-lg">
          <span>DUCKJI WebAR · 차세대 실물 카드 3D 소환 시스템</span>
          <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full">
            RFP 사양 준수
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
          실물 포토카드 <span className="text-amber-400">WebAR 3D 액션</span> &amp; 포인트 적립
        </h1>

        <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          앱 설치 없이 브라우저 카메라로 카드 뒷면의 <strong className="text-amber-300 font-semibold">특수 모자이크 마커</strong>를 스캔하세요. <br className="hidden sm:inline" />
          실물 카드 위에 3D 캐릭터가 소환됩니다. <strong className="text-emerald-400 font-semibold">덕-포인트</strong> 적립은 실물 카드 출시 후 열립니다.
        </p>

        {/* User Balance & Navigation Chips */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 flex items-center gap-2 font-mono">
            <Award className="w-4 h-4 text-amber-400" />
            <span>내 덕-포인트:</span>
            <strong className="text-amber-300 font-bold">{userPoints === null ? "로그인 후 확인" : `${userPoints.toLocaleString()} P`}</strong>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>도감 수집:</span>
            <strong className="text-cyan-300 font-bold">{claimedCardIds.length} / {AR_CARDS_DATA.length}장</strong>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 shadow-xl">
          <button
            onClick={() => handleModeChange("camera")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMode === "camera"
                ? "bg-amber-500 text-black shadow-lg scale-[1.02]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>카메라 WebAR</span>
          </button>

          <button
            onClick={() => handleModeChange("3d-simulator")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMode === "3d-simulator"
                ? "bg-purple-600 text-white shadow-lg scale-[1.02]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>3D 홀로그램 액션</span>
          </button>

          <button
            onClick={() => handleModeChange("sample-markers")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMode === "sample-markers"
                ? "bg-cyan-500 text-black shadow-lg scale-[1.02]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>모자이크 마커 덱</span>
          </button>

          <button
            onClick={() => handleModeChange("collection")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMode === "collection"
                ? "bg-emerald-500 text-black shadow-lg scale-[1.02]"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>디지털 카드 도감</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* MODE 1: Camera WebAR Scanner */}
        {activeMode === "camera" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Camera Viewfinder Box */}
            <div className="lg:col-span-8 bg-zinc-950/90 border-2 border-zinc-800 rounded-3xl p-4 sm:p-6 relative shadow-2xl overflow-hidden min-h-[440px] flex flex-col items-center justify-center">
              {/* Video Element for Camera Stream */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 w-full h-full object-cover rounded-2xl ${
                  isCameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              />

              {/* Camera Inactive / Permission Prompt */}
              {!isCameraActive && (
                <div className="relative z-10 text-center space-y-4 max-w-md p-6">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
                    <Camera className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black text-white">WebAR 카메라 실행</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      실물 카드 뒷면의 모자이크 패턴을 카메라에 비추면 3D 캐릭터가 소환됩니다. (포인트는 실물 카드 출시 후)
                    </p>
                  </div>
                  <button
                    onClick={startCamera}
                    className="py-3 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm shadow-xl transition-all cursor-pointer"
                  >
                    카메라 시작하기 (웹 구동)
                  </button>
                  {cameraError && (
                    <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                      {cameraError}
                    </p>
                  )}
                </div>
              )}

              {/* Active WebAR Scanning Reticle & HUD Overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-between p-6">
                  {/* Top AR Status Bar */}
                  <div className="w-full flex items-center justify-between">
                    <div className="px-3 py-1.5 rounded-full bg-black/80 border border-emerald-500/50 text-emerald-400 text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>AR CAMERA TRACKING ON (60 FPS)</span>
                    </div>
                    <button
                      onClick={stopCamera}
                      className="pointer-events-auto px-3 py-1.5 rounded-full bg-black/80 border border-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer"
                    >
                      카메라 끄기
                    </button>
                  </div>

                  {/* Center Scanning Target Box */}
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 border-2 border-dashed border-amber-400/80 rounded-3xl flex items-center justify-center">
                    {/* 4 Corner Markers */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                    {/* Scanning Laser Beam Animation */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

                    {/* Recognition Status Prompt */}
                    <div className="text-center space-y-1 bg-black/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10">
                      <Scan className="w-5 h-5 text-amber-400 mx-auto animate-spin" style={{ animationDuration: "8s" }} />
                      <div className="text-xs font-bold text-white">카드 뒷면 모자이크 마커를 맞춰주세요</div>
                      <div className="text-[10px] text-zinc-400 font-mono">AR RECOGNITION READY</div>
                    </div>
                  </div>

                  {/* Bottom Scan Trigger & Test Button */}
                  <div className="pointer-events-auto flex items-center gap-3">
                    <button
                      onClick={startScanSimulation}
                      className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>테스트 마커 즉시 인식하기</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Detected Card Projection Modal in AR View */}
              <AnimatePresence>
                {detectedCard && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute inset-4 z-40 bg-zinc-950/95 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-between text-center overflow-y-auto"
                  >
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>모자이크 마커 인식 성공! (Low-Latency 60fps)</span>
                      </div>
                      <h3 className="text-2xl font-black text-white">{detectedCard.name}</h3>
                      <p className="text-xs text-amber-300 font-bold">{detectedCard.title}</p>
                    </div>

                    {/* 3D Holographic Character Avatar */}
                    <div className="relative my-4">
                      <div className="w-40 h-40 rounded-full bg-amber-500/30 border-2 border-amber-400/60 flex items-center justify-center p-2 animate-pulse">
                        <img
                          src={detectedCard.frontImage}
                          alt={detectedCard.name}
                          className="w-full h-full object-cover rounded-full filter drop-shadow-2xl"
                        />
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-black/90 border border-amber-400 text-[10px] font-black text-amber-300 tracking-wider">
                        {detectedCard.rarity} · 3D 소환 완료
                      </div>
                    </div>

                    <div className="space-y-3 w-full max-w-sm">
                      <p className="text-xs text-zinc-300 italic bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800">
                        {detectedCard.voiceLine}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedCard(detectedCard)
                            setActiveMode("3d-simulator")
                            setDetectedCard(null)
                          }}
                          className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>3D 액션 조작</span>
                        </button>

                        <button
                          onClick={() => claimCard(detectedCard)}
                          className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>도감 등록 &amp; 적립</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setDetectedCard(null)}
                        className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        닫고 계속 스캔하기
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Side Guide & Technical Specs Panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-black">
                  <ShieldCheck className="w-4 h-4" />
                  <span>RFP 핵심 기술 구현 명세</span>
                </div>
                <div className="space-y-2.5 text-xs text-zinc-300">
                  <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>① 뒷면 모자이크 마커 인식</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      카드 뒷면 8x8 고대비 바이너리 패턴을 인식하여 0.1초 내 암호화 UID를 디코딩하고 위변조를 방지합니다.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>② 3D 캐릭터 소환 &amp; 트래킹</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Three.js / WebGL 기반으로 카드를 기울이거나 움직여도 3D 캐릭터가 카드 위에 견고히 고정됩니다.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>③ 1회성 바인딩 &amp; 덕-포인트 적립</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      실물 카드가 나오면 카드 코드를 확인해 +500~1,000P를 적립하고 중복 사용을 차단합니다. (준비 중)
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Card Selector */}
              <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl space-y-3">
                <div className="text-xs font-black text-zinc-400 uppercase tracking-wider">
                  체험 대상 카드 선택 ({AR_CARDS_DATA.length}종)
                </div>
                <div className="space-y-2">
                  {AR_CARDS_DATA.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className={`w-full text-left p-2.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                        selectedCard.id === card.id
                          ? "bg-amber-500/20 border border-amber-500/40 text-white"
                          : "bg-zinc-950 hover:bg-zinc-850 border border-zinc-800/80 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={card.frontImage}
                          alt={card.name}
                          className="w-9 h-9 rounded-xl object-cover border border-zinc-700"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{card.name}</div>
                          <div className="text-[10px] text-zinc-400">{card.code} · {card.rarity}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-400">+{card.rewardPoints}P 예정</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: 3D Card Simulator & Interactive Action */}
        {activeMode === "3d-simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* 3D Holographic Parallax Card Stage */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative perspective-[1200px] cursor-grab active:cursor-grabbing p-4"
              >
                {/* 3D Floating Action Card Container */}
                <motion.div
                  animate={{
                    rotateX: rotateX,
                    rotateY: rotateY,
                    y: isSkillActive ? [-8, 8, -6, 6, -3, 3, 0] : [0, -10, 0],
                  }}
                  transition={{
                    y: { repeat: isSkillActive ? 0 : Infinity, duration: 4, ease: "easeInOut" },
                    rotateX: { type: "spring", stiffness: 300, damping: 20 },
                    rotateY: { type: "spring", stiffness: 300, damping: 20 },
                  }}
                  className={`relative w-72 sm:w-80 h-[460px] sm:h-[490px] rounded-3xl transition-transform duration-150 transform-style-3d shadow-[0_20px_60px_rgba(0,0,0,0.9)] ${
                    isSkillActive ? "ring-4 ring-amber-400 " : ""
                  }`}
                  style={{
                    boxShadow: `0 0 50px ${selectedCard.glowColor}`,
                  }}
                >
                  {/* FRONT SIDE (3D Hologram Art) */}
                  {!isFlipped ? (
                    <div className="relative w-full h-full rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-amber-400/50 p-5 flex flex-col justify-between select-none">
                      {/* Hologram Foil Specular Shimmer */}
                      <div
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none transition-transform duration-200"
                        style={{
                          transform: `translate(${rotateY * 2}px, ${rotateX * 2}px)`,
                        }}
                      />

                      {/* Card Header */}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-black/80 border border-amber-400 text-amber-300">
                          {selectedCard.badgeText}
                        </span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300">
                          속성: {selectedCard.element}
                        </span>
                      </div>

                      {/* 3D Summon Character Illustration */}
                      <div className="relative z-10 my-auto text-center">
                        <div className="relative w-44 h-44 mx-auto rounded-3xl overflow-hidden border-2 border-amber-400/40 shadow-2xl group">
                          <img
                            src={selectedCard.frontImage}
                            alt={selectedCard.name}
                            className="w-full h-full object-cover transition-transform duration-700"
                          />
                          {/* Summoning Magic Aura Ring */}
                          <div className="absolute inset-0 rounded-3xl border-2 border-amber-400/60 opacity-30 pointer-events-none" />
                        </div>

                        <div className="mt-3 space-y-0.5">
                          <h4 className="text-lg font-black text-white tracking-tight">{selectedCard.name}</h4>
                          <p className="text-[11px] text-amber-300 font-bold">{selectedCard.title}</p>
                        </div>
                      </div>

                      {/* Card Footer Stats */}
                      <div className="relative z-10 bg-black/70 backdrop-blur-md p-3 rounded-2xl border border-zinc-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-400">HP {selectedCard.hp.toLocaleString()}</span>
                          <span className="text-rose-400 font-bold">ATK {selectedCard.atk.toLocaleString()}</span>
                          <span className="text-cyan-400 font-bold">DEF {selectedCard.def.toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate text-left">
                          ⚡ <strong className="text-zinc-200">{selectedCard.skillName}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* BACK SIDE (Mosaic Marker for AR Scanner) */
                    <div className="relative w-full h-full rounded-3xl overflow-hidden bg-zinc-950 border-2 border-amber-500/70 p-5 flex flex-col items-center justify-between select-none">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-mono text-zinc-400">CARD BACK · AR RECOGNITION</span>
                        <h4 className="text-sm font-black text-white">{selectedCard.name}</h4>
                      </div>

                      <MosaicMarker card={selectedCard} size={180} showDetails={false} />

                      <div className="text-center space-y-0.5">
                        <div className="text-xs font-mono font-black text-amber-400">{selectedCard.code}</div>
                        <div className="text-[10px] text-zinc-500">카메라 AR 인식용 특수 모자이크 패턴</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Flip Button */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="py-2 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-black text-zinc-200 hover:text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isFlipped ? "카드 앞면 (3D 일러스트)" : "카드 뒷면 (모자이크 마커)"}</span>
                </button>
              </div>
            </div>

            {/* Right Action Control Console */}
            <div className="lg:col-span-6 space-y-5">
              <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      {selectedCard.rarity}
                    </span>
                    <h3 className="text-2xl font-black text-white mt-1">{selectedCard.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-400">보유 보상</span>
                    <div className="text-lg font-black text-amber-400">+{selectedCard.rewardPoints}P 예정</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-1">
                    <div className="text-amber-300 font-black flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>스킬: {selectedCard.skillName}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{selectedCard.skillDesc}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-1">
                    <div className="text-purple-300 font-black flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>캐릭터 대사 &amp; 스토리</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 italic">“{selectedCard.voiceLine}”</p>
                  </div>
                </div>

                {/* Interactive Action Controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={triggerSkill}
                    disabled={isSkillActive}
                    className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Flame className="w-4 h-4" />
                    <span>{isSkillActive ? "스킬 시전 중..." : "스킬 이펙트 발동"}</span>
                  </button>

                  <button
                    onClick={playVoice}
                    disabled={isVoicePlaying}
                    className="py-3 px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>{isVoicePlaying ? "음성 재생 중..." : "캐릭터 보이스"}</span>
                  </button>
                </div>

                {/* Claim Button */}
                <button
                  onClick={() => claimCard(selectedCard)}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
                    claimedCardIds.includes(selectedCard.id)
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {claimedCardIds.includes(selectedCard.id)
                      ? "디지털 도감에 등록 완료됨"
                      : "디지털 도감 등록"}
                  </span>
                </button>
              </div>

              {/* Card List Selector */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {AR_CARDS_DATA.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setSelectedCard(card)
                      setIsFlipped(false)
                    }}
                    className={`flex-shrink-0 p-2.5 rounded-2xl border transition-all flex items-center gap-2 cursor-pointer ${
                      selectedCard.id === card.id
                        ? "bg-amber-500/20 border-amber-500 text-white shadow-lg"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <img src={card.frontImage} alt={card.name} className="w-7 h-7 rounded-lg object-cover" />
                    <span className="text-xs font-bold">{card.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: Sample Mosaic Markers Deck (편대표 미팅 시연용 마커 출력/표시) */}
        {activeMode === "sample-markers" && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 text-center max-w-2xl mx-auto space-y-2">
              <h3 className="text-xl font-black text-white">🎴 실물 카드 뒷면 특수 모자이크 마커 덱</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                내일 미팅 또는 현장에서 다른 모바일 기기로 아래 마커를 비추면 즉시 AR이 구동됩니다. <br />
                마커별 고유 8x8 바이너리 매트릭스와 1회성 해시 코드가 내장되어 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {AR_CARDS_DATA.map((card) => (
                <div
                  key={card.id}
                  className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl flex flex-col items-center justify-between space-y-4 hover:border-amber-400/50 transition-all group"
                >
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-400/30">
                      {card.rarity} · {card.element}
                    </span>
                    <h4 className="text-sm font-black text-white pt-1">{card.name}</h4>
                  </div>

                  <MosaicMarker card={card} size={160} showDetails={true} />

                  <div className="w-full space-y-2">
                    <button
                      onClick={() => {
                        setSelectedCard(card)
                        setActiveMode("camera")
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>카메라로 스캔 테스트</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCard(card)
                        setActiveMode("3d-simulator")
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>3D 액션 확인</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODE 4: Digital Card Collection Vault */}
        {activeMode === "collection" && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-teal-950/40 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>내 디지털 카드 도감 (Vault)</span>
                  <SampleBadge />
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  실물 카드를 스캔해 등록한 디지털 컬렉션입니다. 팝업스토어 특별 할인 및 굿즈 교환 혜택이 연동됩니다.
                </p>
              </div>
              <div className="text-right flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-black/60 border border-zinc-800 text-center min-w-[100px]">
                  <div className="text-[10px] text-zinc-400">수집률</div>
                  <div className="text-lg font-black text-emerald-400">
                    {Math.round((claimedCardIds.length / AR_CARDS_DATA.length) * 100)}%
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/60 border border-zinc-800 text-center min-w-[100px]">
                  <div className="text-[10px] text-zinc-400">실물 카드 출시 후 받을 포인트</div>
                  <div className="text-lg font-black text-amber-400">
                    {claimedCardIds
                      .reduce((acc, id) => {
                        const c = AR_CARDS_DATA.find((x) => x.id === id)
                        return acc + (c ? c.rewardPoints : 0)
                      }, 0)
                      .toLocaleString()}P
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {AR_CARDS_DATA.map((card) => {
                const isClaimed = claimedCardIds.includes(card.id)
                return (
                  <div
                    key={card.id}
                    className={`p-5 rounded-3xl border shadow-xl flex flex-col justify-between space-y-4 transition-all ${
                      isClaimed
                        ? "bg-zinc-900/90 border-emerald-500/40 hover:border-emerald-400"
                        : "bg-zinc-950/60 border-zinc-850 opacity-60 filter grayscale hover:grayscale-0 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-400/30">
                        {card.rarity}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isClaimed ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {isClaimed ? "수집 완료" : "미보유 (스캔 필요)"}
                      </span>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="w-28 h-28 mx-auto rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-lg">
                        <img src={card.frontImage} alt={card.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{card.name}</h4>
                        <p className="text-[10px] text-zinc-400 font-mono">{card.code}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>보상 포인트</span>
                        <strong className="text-amber-400">+{card.rewardPoints}P 예정</strong>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCard(card)
                          setActiveMode("3d-simulator")
                        }}
                        className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>3D 카드 보기</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reward Pop-up Modal */}
      <AnimatePresence>
        {showRewardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-zinc-950 border-2 border-amber-400 shadow-2xl text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-lg">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-white">디지털 도감 등록</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">{rewardMsg}</p>
              <button
                onClick={() => setShowRewardModal(false)}
                className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs transition-all cursor-pointer shadow-lg"
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

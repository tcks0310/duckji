"use client"

import * as React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Sparkles, 
  Film, 
  Heart, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  ExternalLink, 
  RotateCcw, 
  BookOpen, 
  Compass, 
  Star,
  CheckCircle2,
  Bookmark,
  Layers
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IsekaiProfile } from "@/lib/saju-engine"
import { goToPopupDetail, usePopupEvents } from "@/lib/popup-service"
import { toggleLike, useSavedItems } from "@/lib/saved-items"

interface SajuAnimeRecommenderProps {
  profile: IsekaiProfile
  onSwitchToWebtoonMode: () => void
  onReset: () => void
}

export function SajuAnimeRecommender({
  profile,
  onSwitchToWebtoonMode,
  onReset,
}: SajuAnimeRecommenderProps) {
  // 팝업 찜은 회원 계정에 저장 (lib/saved-items)
  const likedIds = useSavedItems().likes.popup

  const handleToggleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const r = await toggleLike("popup", id)
    if (r === "login" && window.confirm("로그인한 회원만 찜할 수 있어요. 로그인할까요?")) window.location.assign("/login/")
  }

  // 지금 열려 있거나 열릴 팝업 (서버 목록). 누르면 팝업 상세 페이지로
  const matchedEvents = usePopupEvents()
    .filter((p) => p.status !== "ended")
    .slice(0, 4)
    .map((p) => ({ ...p, matchReason: `${profile.primaryElement?.korean ?? ""} 속성 맞춤 팝업스토어` }))

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-2">
      {/* 1. Header Profile Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-cyan-950/40 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
              <span>사주 X MBTI 큐레이션관</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {profile.heroNickname} 님의 취향 저격 컬렉션
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300">
              사주 일간 <strong className="text-amber-400">{profile.dayMaster?.name}</strong>과 MBTI <strong className="text-purple-400">[{profile.mbti}]</strong>의 파동을 분석하여 엄선한 애니메이션 & 실시간 팝업스토어입니다.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onSwitchToWebtoonMode}
            className="rounded-2xl border-amber-500/50 bg-zinc-950 hover:bg-zinc-800 text-amber-300 text-xs font-bold py-3 flex items-center gap-1.5 self-start sm:self-auto shadow-md"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>웹툰 스토리 사주 보러가기</span>
          </Button>
        </div>

        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80 text-xs font-bold">
          <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
            MBTI: {profile.mbti}
          </span>
          <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
            일간: {profile.dayMaster?.name} ({profile.dayMaster?.nature})
          </span>
          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            주도 오행: {profile.primaryElement?.korean}
          </span>
          <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            행운 성지: {profile.primaryElement?.luckyPlace}
          </span>
        </div>
      </div>

      {/* 2. SECTION 1: Saju Matching Masterpiece Anime TOP 3 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <h3 className="text-xl font-black text-white">
              사주 & MBTI 맞춤 인생 애니메이션 TOP 3
            </h3>
          </div>
          <span className="text-xs text-zinc-400">매칭률 95% 이상 엄선</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(profile.recommendedAnime || []).map((anime, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -4 }}
              className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-xl flex gap-4 items-center group hover:border-purple-500/50 transition-all"
            >
              <img
                src={anime.poster || "/images/avatar/fire.jpg"}
                alt={anime.title}
                className="w-24 h-32 object-cover rounded-2xl border border-zinc-800 shadow-md transition-transform flex-shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {anime.genre}
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    매칭률 {anime.matchRate}%
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-black text-white truncate">
                  {anime.title}
                </h4>
                <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed">
                  {anime.reason}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3. SECTION 2: Soulmate Partner Character */}
      {profile.soulmateCharacter && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <h3 className="text-xl font-black text-white">
              영혼의 소울메이트 파트너 캐릭터
            </h3>
          </div>

          <div className="bg-gradient-to-r from-rose-950/30 via-zinc-950 to-purple-950/30 border-2 border-rose-500/40 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center gap-6">
            <img
              src={profile.soulmateCharacter.image || "/images/npc/luna.jpg"}
              alt={profile.soulmateCharacter.name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-2 border-rose-400 shadow-2xl flex-shrink-0"
            />
            <div className="space-y-2 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-rose-400 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
                <span>영혼 케미 지수 99.9%</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-white">
                {profile.soulmateCharacter.name} <span className="text-sm font-normal text-zinc-400">({profile.soulmateCharacter.anime})</span>
              </h4>
              <p className="text-xs text-zinc-400 font-bold">
                {profile.soulmateCharacter.role}
              </p>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
                "{profile.soulmateCharacter.compatibilityReason}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECTION 3: Real-time DUKJI Pop-up Store Matcher */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-black text-white">
              🎪 지금 DUKJI에서 열리는 맞춤 팝업스토어 & 행사
            </h3>
          </div>
          <span className="text-xs text-zinc-400">클릭 시 상세 정보 확인</span>
        </div>

        {matchedEvents.length === 0 && (
          <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
            지금 열려 있는 팝업이 없습니다.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matchedEvents.map((popup) => {
            const isLiked = likedIds.includes(popup.id)
            return (
              <motion.div
                key={popup.id}
                whileHover={{ y: -4 }}
                onClick={() => goToPopupDetail(popup.id)}
                className="bg-zinc-900/90 border border-zinc-800 hover:border-emerald-400/80 rounded-3xl overflow-hidden shadow-xl cursor-pointer group transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950">
                    <img
                      src={popup.posterUrl}
                      alt={popup.title}
                      className="w-full h-full object-cover transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Status & D-Day Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500 text-black shadow-md">
                        {popup.statusLabel}
                      </span>
                      <button
                        onClick={(e) => handleToggleLike(popup.id, e)}
                        className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-colors"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-black/80 text-amber-300 border border-zinc-700">
                        {popup.matchReason}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 space-y-2">
                    <h4 className="text-sm sm:text-base font-black text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                      {popup.title}
                    </h4>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {popup.subTitle}
                    </p>

                    <div className="pt-2 border-t border-zinc-800/80 space-y-1 text-xs text-zinc-400 font-medium">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="truncate">{popup.venueName || popup.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>{popup.startDate} ~ {popup.endDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Button */}
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <Button
                    size="sm"
                    className="w-full bg-zinc-950 hover:bg-emerald-500 hover:text-black text-zinc-300 font-bold rounded-xl text-xs py-2.5 border border-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>팝업 행사 상세 & 예약 정보 보기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 5. Bottom Reset & Action Bar */}
      <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
        <Button
          variant="outline"
          onClick={onReset}
          className="rounded-2xl border-zinc-800 text-zinc-400 hover:text-white text-xs px-4"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          다른 정보로 다시 분석하기
        </Button>

        <Button
          onClick={onSwitchToWebtoonMode}
          className="bg-amber-500 hover:bg-amber-400 text-black font-black py-3 px-6 rounded-2xl text-xs sm:text-sm shadow-xl flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          <span>내 전설 무기 & 아바타 각성 웹툰 보기</span>
        </Button>
      </div>
    </div>
  )
}

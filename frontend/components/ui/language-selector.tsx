"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { changeLanguage } from "./google-translator"

export interface LanguageOption {
  code: string
  name: string
  nativeName: string
  flag: string
  // 윈도우 PC 는 국기 이모지를 그리지 못해 "KR" 같은 두 글자로 보이므로 그림 파일(public/flags)을 씀
  flagSrc: string
  badge: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "ko", name: "한국어", nativeName: "한국어", flag: "🇰🇷", flagSrc: "/flags/kr.svg", badge: "KR" },
  { code: "en", name: "영어", nativeName: "English", flag: "🇺🇸", flagSrc: "/flags/us.svg", badge: "EN" },
  { code: "ja", name: "일본어", nativeName: "日本語", flag: "🇯🇵", flagSrc: "/flags/jp.svg", badge: "JA" },
  { code: "zh-CN", name: "중국어", nativeName: "中文", flag: "🇨🇳", flagSrc: "/flags/cn.svg", badge: "CN" },
]

export function LanguageSelector({ isMobile = false }: { isMobile?: boolean }) {
  const [currentLang, setCurrentLang] = useState("ko")

  // Read current language from cookie or localStorage
  useEffect(() => {
    try {
      const match = document.cookie.match(/googtrans=\/ko\/([^;]+)/)
      if (match && match[1]) {
        setCurrentLang(match[1])
      } else {
        const stored = localStorage.getItem("dukji_preferred_lang")
        if (stored) setCurrentLang(stored)
      }
    } catch (e) {}
  }, [])

  const handleSelectLanguage = (code: string) => {
    if (code === currentLang) return
    setCurrentLang(code)
    changeLanguage(code)
  }

  if (isMobile) {
    return (
      <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-300">
            🌐 언어 선택 (Language / 語言)
          </span>
          <span className="text-[10px] font-bold text-amber-400">
            {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.nativeName || "한국어"}
          </span>
        </div>

        {/* 4 Flag Direct Buttons Row */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                  isSelected
                    ? "bg-zinc-800 border border-zinc-500 text-white"
                    : "bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
                title={`${lang.name} (${lang.nativeName})`}
              >
                <img src={lang.flagSrc} alt="" aria-hidden="true" className="w-7 h-[18px] rounded-[3px] object-cover ring-1 ring-white/20 select-none" />
                <span className="text-[10px] font-extrabold mt-1 truncate">{lang.nativeName}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center bg-zinc-900/90 border border-zinc-800/90 p-0.5 sm:p-1 rounded-full shadow-inner select-none gap-0.5 sm:gap-1">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isSelected = currentLang === lang.code
        return (
          <button
            key={lang.code}
            onClick={() => handleSelectLanguage(lang.code)}
            className={`relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all cursor-pointer ${
              isSelected
                ? "bg-zinc-800 border border-zinc-500 text-white"
                : "border border-transparent hover:bg-zinc-800/80 hover:border-zinc-700 opacity-75 hover:opacity-100"
            }`}
            title={`${lang.name} (${lang.nativeName})`}
            aria-label={`${lang.name} 번역`}
          >
            <img
              src={lang.flagSrc}
              alt=""
              aria-hidden="true"
              className="w-[18px] h-3 sm:w-5 sm:h-[13px] rounded-[2px] object-cover ring-1 ring-white/20 select-none"
            />

            {/* Subtle Active Indicator Dot */}
            {isSelected && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-amber-400" />
            )}
          </button>
        )
      })}
    </div>
  )
}

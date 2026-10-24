"use client"

import * as React from "react"
import { useEffect } from "react"
import Script from "next/script"

export function GoogleTranslator() {
  useEffect(() => {
    // Define the initialization function for Google Translate
    (window as any).googleTranslateElementInit = () => {
      const g = (window as any).google
      if (g?.translate?.TranslateElement) {
        new g.translate.TranslateElement(
          {
            pageLanguage: "ko",
            includedLanguages: "ko,en,ja,zh-CN",
            autoDisplay: false,
            layout: g.translate.TranslateElement.InlineLayout?.SIMPLE || 0,
          },
          "google_translate_element"
        )
      }
    }
  }, [])

  return (
    <>
      {/* Hidden container for Google Translate widget */}
      <div id="google_translate_element" style={{ display: "none" }} />

      {/* Global CSS to suppress default Google Translate banners, tooltips, and layout jumps */}
      <style jsx global>{`
        /* Hide Google Translate top banner frame */
        .goog-te-banner-frame.skiptranslate,
        .goog-te-banner-frame,
        iframe.goog-te-banner-frame,
        .VIpgJd-ZVi9od-ORHb-OEVmcd,
        .VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
        .VIpgJd-ZVi9od-vLmrdf,
        #goog-gt-tt,
        .goog-te-balloon-frame {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          pointer-events: none !important;
        }

        /* Prevent body shift when translate bar tries to appear */
        body {
          top: 0px !important;
          position: static !important;
        }

        /* Remove text highlight styling applied by Google Translate */
        .goog-text-highlight {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }

        /* Hide Google Translate attribution elements in hidden element */
        .goog-logo-link,
        .goog-te-gadget {
          display: none !important;
        }
      `}</style>

      {/* Load Google Translate Script after interactive */}
      <Script
        id="google-translate-script"
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  )
}

/**
 * Utility function to programmatically trigger language translation
 */
export function changeLanguage(langCode: string) {
  if (typeof window === "undefined") return

  // 구글 번역 스크립트는 googtrans 쿠키를 상위 도메인(.duckji.com)에도 남긴다.
  // www.duckji.com 에서는 그 쿠키를 지우지 못해 한국어로 돌아가도 영어가 유지됐으므로
  // 현재 호스트와 모든 상위 도메인의 쿠키를 지운다.
  const expired = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  document.cookie = `googtrans=; ${expired}`
  const parts = window.location.hostname.split(".")
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join(".")
    document.cookie = `googtrans=; ${expired} domain=${domain};`
    document.cookie = `googtrans=; ${expired} domain=.${domain};`
  }

  // 한국어(원문)는 쿠키 없이 두고, 다른 언어만 쿠키를 설정한다
  if (langCode !== "ko") {
    document.cookie = `googtrans=/ko/${langCode}; path=/;`
  }

  // Save in localStorage for UI state
  try {
    localStorage.setItem("dukji_preferred_lang", langCode)
  } catch (e) {}

  // Reload page to apply translation cleanly
  window.location.reload()
}

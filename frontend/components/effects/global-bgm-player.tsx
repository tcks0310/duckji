"use client";

import { useEffect, useRef } from "react";

// 사이트 배경음. 화면에 보이는 버튼은 없고, 상단 노래·마우스 효과 버튼(EffectsToggle)이 켜고 끔
const BGM_VOLUME = 0.35;
const PAUSED_KEY = "duckji_bgm_paused_by_user";

export function GlobalBgmPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = BGM_VOLUME;
  }, []);

  // 첫 클릭·키 입력·터치 때 재생 (브라우저 자동 재생 정책). 사용자가 끈 상태면 재생하지 않음
  useEffect(() => {
    const events = ["click", "keydown", "touchstart"] as const;
    const handleFirstInteraction = () => {
      events.forEach((name) => window.removeEventListener(name, handleFirstInteraction));
      const audio = audioRef.current;
      let pausedByUser = false;
      try {
        pausedByUser = localStorage.getItem(PAUSED_KEY) === "true";
      } catch {}
      if (audio && audio.paused && !pausedByUser) audio.play().catch(() => {});
    };
    events.forEach((name) => window.addEventListener(name, handleFirstInteraction, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, handleFirstInteraction));
  }, []);

  // 상단 버튼에서 보내는 켜기·끄기
  useEffect(() => {
    const handle = (e: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      if ((e as CustomEvent<{ playing?: boolean }>).detail?.playing) audio.play().catch(() => {});
      else audio.pause();
    };
    window.addEventListener("toggle-duckji-bgm", handle);
    return () => window.removeEventListener("toggle-duckji-bgm", handle);
  }, []);

  return (
    <audio ref={audioRef} loop preload="auto">
      <source src="/audio/duckji-theme.mp3" type="audio/mpeg" />
    </audio>
  );
}

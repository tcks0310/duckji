"use client";

import { useEffect, useRef, useState } from "react";

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

interface ClickPopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  text: string;
  size: number;
}

export function MouseDuckjiFollower() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const duckjiCursorRef = useRef<HTMLDivElement | null>(null);   // 마우스 포인터 덕지
  const ducksoonChaserRef = useRef<HTMLDivElement | null>(null); // 마우스 쫓아가는 덕순이

  const [enabled, setEnabled] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // 로컬스토리지 및 토글 이벤트 리스너
  useEffect(() => {
    try {
      const saved = localStorage.getItem("duckji_follower_enabled");
      if (saved !== null) {
        setEnabled(saved === "true");
      }
    } catch {}

    const handleToggle = (e: Event) => {
      const custom = e as CustomEvent<{ enabled?: boolean }>;
      if (custom.detail?.enabled !== undefined) {
        setEnabled(custom.detail.enabled);
      } else {
        setEnabled((prev) => {
          const next = !prev;
          try {
            localStorage.setItem("duckji_follower_enabled", String(next));
          } catch {}
          return next;
        });
      }
    };

    window.addEventListener("toggle-duckji-follower", handleToggle);
    return () => window.removeEventListener("toggle-duckji-follower", handleToggle);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 터치 전용(마우스가 없는) 모바일 환경 감지
    const isTouchOnly = 
      typeof window !== "undefined" && 
      (window.matchMedia("(pointer: coarse) and (hover: none)").matches || window.innerWidth < 768);
    if (isTouchOnly) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      if (window.innerWidth < 768) {
        setIsVisible(false);
      }
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // 마우스(덕지 커서) 위치
    let mouseX = width / 2;
    let mouseY = height / 2;
    let cursorFacingRight = true;
    let isClicking = false;

    // 덕순이(마우스 쫓아오는 체이서) 위치 & 상태
    let ducksoonX = width / 2;
    let ducksoonY = height / 2 + 80;
    let ducksoonFacingRight = true;
    let isDucksoonMoving = false;
    let step = 0;
    let idleStep = 0;
    let jumpOffset = 0;
    let hasMovedOnce = false;

    // 먼지 파티클 리스트 & 클릭 팝 파티클 리스트
    const dustParticles: DustParticle[] = [];
    const popParticles: ClickPopParticle[] = [];

    const dustColors = [
      "rgba(251, 191, 36, 0.45)",  // 따뜻한 골드 앰버
      "rgba(245, 230, 211, 0.65)", // 부드러운 뽀짝 크림
      "rgba(244, 114, 182, 0.40)", // 덕순이의 연분홍빛 먼지
      "rgba(254, 243, 199, 0.70)", // 화사한 옐로우 더스트
    ];

    const popEmojis = ["💖", "🌸", "🎀", "✨", "💛", "🐾"];

    const handlePointerMove = (e: PointerEvent) => {
      // 터치스크린 터치 제스처는 마우스 커서 발동 차단
      if (e.pointerType === "touch") return;

      const prevX = mouseX;
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (Math.abs(mouseX - prevX) > 2) {
        cursorFacingRight = mouseX >= prevX;
      }

      if (!hasMovedOnce) {
        hasMovedOnce = true;
        setIsVisible(true);
        ducksoonX = mouseX + 70;
        ducksoonY = mouseY + 70;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      isClicking = true;
      jumpOffset = 18; // 클릭 시 덕순이 폴짝 점프
      for (let i = 0; i < 3; i++) {
        popParticles.push({
          x: ducksoonX + (Math.random() - 0.5) * 30,
          y: ducksoonY - 25 + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 3 - 2,
          alpha: 1,
          text: popEmojis[Math.floor(Math.random() * popEmojis.length)],
          size: Math.floor(Math.random() * 8 + 14),
        });
      }
    };

    const handlePointerUp = () => {
      isClicking = false;
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      if (hasMovedOnce) setIsVisible(true);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    // 메인 애니메이션 루프 (60fps)
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. 마우스 포인터 덕지(Duckji) 위치 업데이트 (1:1 실시간)
      if (duckjiCursorRef.current) {
        const clickScale = isClicking ? 0.88 : 1;
        const flip = cursorFacingRight ? 1 : -1;
        // 커서 핫스팟: 덕지의 손/머리 쪽을 마우스 끝에 맞춤
        duckjiCursorRef.current.style.transform = `translate3d(${mouseX - 14}px, ${mouseY - 14}px, 0) scaleX(${flip}) scale(${clickScale})`;
      }

      // 2. 덕순이(Ducksoon)의 덕지(마우스) 추적 연산
      const targetX = mouseX + (ducksoonFacingRight ? -24 : 24);
      const targetY = mouseY + 12;

      const dx = targetX - ducksoonX;
      const dy = targetY - ducksoonY;
      const dist = Math.hypot(dx, dy);

      // Lerp 추적
      const lerpSpeed = dist > 320 ? 0.12 : dist > 90 ? 0.085 : 0.06;
      ducksoonX += dx * lerpSpeed;
      ducksoonY += dy * lerpSpeed;

      if (Math.abs(dx) > 3) {
        ducksoonFacingRight = dx > 0;
      }

      const speed = Math.min(dist * 0.15, 24);
      isDucksoonMoving = dist > 18;

      if (isDucksoonMoving) {
        step += speed * 0.045;
      } else {
        idleStep += 0.06;
      }

      if (jumpOffset > 0) {
        jumpOffset = Math.max(0, jumpOffset - 1.2);
      }

      // 덕순이가 달릴 때 발밑에서 뽀짝 먼지(Dust) 생성!
      if (isDucksoonMoving && speed > 2.8) {
        const footOffsetX = ducksoonFacingRight ? -10 : 10;
        const footY = ducksoonY + 16;

        const dustCount = speed > 10 ? 2 : 1;
        for (let i = 0; i < dustCount; i++) {
          dustParticles.push({
            x: ducksoonX + footOffsetX + (Math.random() - 0.5) * 12,
            y: footY + (Math.random() - 0.5) * 6,
            vx: (ducksoonFacingRight ? -1 : 1) * (Math.random() * 2.5 + 0.8),
            vy: -Math.random() * 1.4 - 0.2,
            radius: Math.random() * 4 + 4,
            maxRadius: Math.random() * 10 + 12,
            alpha: 0.75,
            color: dustColors[Math.floor(Math.random() * dustColors.length)],
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
          });
        }
      }

      // 먼지 파티클 렌더링 & 수명 업데이트
      for (let i = dustParticles.length - 1; i >= 0; i--) {
        const p = dustParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.radius += (p.maxRadius - p.radius) * 0.08;
        p.alpha -= 0.026;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          dustParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);

        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.arc(-p.radius * 0.45, -p.radius * 0.2, p.radius * 0.65, 0, Math.PI * 2);
        ctx.arc(p.radius * 0.4, -p.radius * 0.15, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 팝업 이모지 렌더링 & 업데이트
      for (let i = popParticles.length - 1; i >= 0; i--) {
        const pop = popParticles[i];
        pop.x += pop.vx;
        pop.y += pop.vy;
        pop.vy += 0.08;
        pop.alpha -= 0.024;

        if (pop.alpha <= 0) {
          popParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.alpha);
        ctx.font = `${pop.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      // 덕순이 DOM 위치 및 애니메이션 업데이트
      if (ducksoonChaserRef.current) {
        const bounce = isDucksoonMoving
          ? Math.abs(Math.sin(step)) * 7
          : Math.sin(idleStep) * 1.5;

        const tilt = isDucksoonMoving
          ? (ducksoonFacingRight ? 1 : -1) * Math.min(speed * 0.45, 14)
          : 0;

        const flip = ducksoonFacingRight ? 1 : -1;
        const totalY = ducksoonY - bounce - jumpOffset;

        ducksoonChaserRef.current.style.transform = `translate3d(${ducksoonX - 19}px, ${totalY - 26}px, 0) scaleX(${flip}) rotate(${tilt}deg)`;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* 1. 뽀짝 먼지 캔버스 (전체 화면 투과) */}
      <canvas
        ref={canvasRef}
        className="hidden md:block fixed inset-0 pointer-events-none z-[9998]"
        style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.25s ease" }}
      />

      {/* 2. 마우스 포인터 그 자체: 귀여운 덕지(Duckji) 캐릭터 */}
      <div
        ref={duckjiCursorRef}
        className="hidden md:block fixed top-0 left-0 pointer-events-none z-[10000] will-change-transform select-none"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s ease",
          width: 38,
          height: 42,
        }}
      >
        {/* 마우스 포인터 핀포인트 (반짝이는 작은 골드 포인트 점) */}
        <div className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-md animate-pulse" />

        {/* 공식 덕지 캐릭터 일러스트 (마우스 포인터) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/characters/duckji.png"
          alt="마우스 포인터 덕지"
          className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          draggable={false}
        />
      </div>

      {/* 3. 마우스(덕지)를 먼지 내며 쫓아가는 귀여운 덕순이(Ducksoon) 체이서 (덕지와 동일한 38x42 크기) */}
      <div
        ref={ducksoonChaserRef}
        className="hidden md:block fixed top-0 left-0 pointer-events-none z-[9999] will-change-transform select-none"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.25s ease",
          width: 38,
          height: 42,
        }}
      >
        {/* 덕순이 발밑 타원형 그림자 */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full bg-black/25 blur-[1px]"
          style={{ transform: "scale(1, 0.6)" }}
        />

        {/* 공식 덕순이 캐릭터 일러스트 (마우스 체이서) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/characters/ducksoon.png"
          alt="덕지를 쫓아가는 덕순이"
          className="w-full h-full object-contain filter drop-shadow-md"
          draggable={false}
        />
      </div>
    </>
  );
}

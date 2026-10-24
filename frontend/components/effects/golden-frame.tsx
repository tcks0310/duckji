"use client"

export function GoldenFrame() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[9990] border-[3px] sm:border-[4px] md:border-[5px] border-amber-400/90 shadow-[inset_0_0_20px_rgba(251,191,36,0.22)]"
    >
      {/* 안쪽 얇은 골드 헤어라인 (명품 프레임 듀얼 라인) */}
      <div className="absolute inset-[3px] sm:inset-[4px] md:inset-[5px] border border-amber-300/35" />

      {/* 네 모서리 클래식 골드 엣지 악센트 */}
      <div className="absolute top-1 left-1 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 border-t-2 border-l-2 border-amber-300" />
      <div className="absolute top-1 right-1 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 border-t-2 border-r-2 border-amber-300" />
      <div className="absolute bottom-1 left-1 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 border-b-2 border-l-2 border-amber-300" />
      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 border-b-2 border-r-2 border-amber-300" />
    </div>
  )
}

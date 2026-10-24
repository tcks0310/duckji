// 로고 그림 아래 '덕후들의 성지': 글자를 로고의 DUCKJI 글씨 폭에 맞춰 고르게 벌려 로고와 한 덩어리로 보이게 함
// (상단 메뉴 로고와 푸터 로고가 같이 씀. 부모를 로고 그림 폭에 맞추면 그 폭을 그대로 채움)
const TAGLINE = "덕후들의 성지"

export function BrandTagline({ className = "" }: { className?: string }) {
  return (
    <span aria-label={TAGLINE} className={`flex w-0 min-w-full justify-between px-[16%] font-bold leading-none text-[#e9bd6a] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] ${className}`}>
      {Array.from(TAGLINE).map((ch, i) => (
        <span key={i} aria-hidden className={ch === " " ? "w-[0.3em]" : ""}>
          {ch === " " ? "" : ch}
        </span>
      ))}
    </span>
  )
}

// 덕지순례 장소 도장 모양: 붉은 인주로 찍은 둥근 도장 (번호 + 덕지순례 + STAMP)
// pressed 가 true 면 방금 찍은 것처럼 꾹 눌리는 움직임 (app/globals.css .duckji-stamp-press)
import { useId } from "react"

export function StampMark({
  number,
  size = 84,
  pressed,
  rotate = -12,
  className = "",
}: {
  number: number
  size?: number
  pressed?: boolean
  rotate?: number
  className?: string
}) {
  const id = `stamp${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <span
      aria-hidden
      className={`duckji-stamp ${pressed ? "duckji-stamp-press" : ""} inline-block shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, ["--stamp-rotate" as string]: `${rotate}deg` }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="text-rose-500 opacity-90">
        <defs>
          <path id={`${id}-top`} d="M 22 50 A 28 28 0 0 1 78 50" />
          <path id={`${id}-bottom`} d="M 20 52 A 30 30 0 0 0 80 52" />
        </defs>
        <circle cx="50" cy="50" r="46" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="4" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text fill="currentColor" fontSize="11" fontWeight="800" letterSpacing="2">
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            덕지순례
          </textPath>
        </text>
        <text x="50" y="61" textAnchor="middle" fill="currentColor" fontSize="26" fontWeight="900" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {String(number).padStart(2, "0")}
        </text>
        <text fill="currentColor" fontSize="9" fontWeight="800" letterSpacing="3">
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
            STAMP
          </textPath>
        </text>
      </svg>
    </span>
  )
}

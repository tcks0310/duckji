// 예시 데이터 표시 (hj, 2026-10-06): 서버 기능이 아직 없어 화면에 박힌 예시 콘텐츠·숫자를 보여 주는 곳에 붙입니다.
// 그 기능을 실제로 구현하면 해당 화면의 SampleBadge·SampleNotice 를 지웁니다. (관리자 화면도 같은 모양)

export function SampleBadge() {
  return (
    <span className="ml-2 align-middle px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
      예시
    </span>
  )
}

export function SampleNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
      {children || "예시 데이터입니다. 아직 서버 기능이 연결되지 않아 화면의 목록과 숫자는 실제 운영 데이터가 아닙니다."}
    </div>
  )
}

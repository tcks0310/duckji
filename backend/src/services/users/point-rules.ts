// 덕지 포인트(DP) 지급·사용 규칙. 화면은 사유(reason)와 대상(refId)만 보내고, 금액·한도는 여기서 정합니다.
// 금액이 범위(min~max)인 규칙은 화면이 금액을 보내고 서버가 범위 안인지만 확인합니다 (퀴즈 점수, 코스별 보상 등).
//
// verified: false 인 규칙은 아직 서버가 실제로 했는지 확인할 방법이 없는 기능(스탬프 스캔 등)이라
// 한도로만 막고 있습니다. 기능을 실제로 만들면 그 서비스에서 확인 후 지급하도록 바꿔야 합니다.

export interface PointRule {
  label: string // 내역에 보이는 이름
  min: number
  max: number
  once?: boolean // 같은 refId 로는 한 번만 (refId 필수)
  dailyLimit?: number // 하루(한국 시간) 최대 횟수
  totalLimit?: number // 회원당 전체 최대 횟수 (대상 id 를 지어내 반복 지급받지 못하게)
  verified: boolean
}

export const EARN_RULES: Record<string, PointRule> = {
  signup_bonus: { label: "신규 가입 축하", min: 350, max: 350, once: true, verified: true },
}

// 화면이 직접 쓰는 사용 규칙 (지금은 없음)
export const SPEND_RULES: Record<string, PointRule> = {}

// 다른 서비스가 원장에 직접 쓰는 사유의 이름 (내역 표시용)
export const LEDGER_LABELS: Record<string, string> = {
  // 친구 추천 (users/referral.ts)
  referral_reward: "친구 추천 (내 추천 ID 로 가입)",
  referral_signup: "추천인 ID 입력 가입",
  // rewards 서비스가 확인 후 직접 기록 (backend/src/services/rewards)
  quiz_reward: "덕력 퀴즈",
  stamp_tour_spot: "스탬프 투어 스팟 인증",
  stamp_tour_master: "스탬프 투어 완주",
  creator_code: "크리에이터 코드 등록",
  squad_complete: "3인 스쿼드 완성",
  pilgrimage_spot: "덕지순례 성지 스탬프",
  pilgrimage_course: "덕지순례 코스 완주",
  tarot_code: "현장 시리얼 코드 등록",
  promo_code: "프로모션 코드 등록",
  tarot_daily: "오늘의 타로 스탬프",
  // funding 서비스가 개설·참여 저장과 함께 기록 (backend/src/services/funding/shared-tables.ts)
  funding_open: "덕질펀딩 프로젝트 개설",
  funding_join: "덕질펀딩 참여 신청",
  // DP 결제 (DB 함수 dp_spend·dp_refund)
  dp_charge: "DP 충전",
  funding_pay: "덕질펀딩 참여 결제",
  funding_refund: "덕질펀딩 결제 환불",
  store_order: "스토어 굿즈 주문",
  store_refund: "스토어 주문 취소 환불",
  // 다른 서비스가 users /service/dp 로 차감·환불
  saju_ask: "AI 사주 질문",
  saju_refund: "AI 사주 질문 환불",
}

export const ADMIN_REASON = "admin_adjust"
export const ADMIN_LABEL = "관리자 조정"

export const labelFor = (reason: string) =>
  reason === ADMIN_REASON ? ADMIN_LABEL : EARN_RULES[reason]?.label || SPEND_RULES[reason]?.label || LEDGER_LABELS[reason] || reason

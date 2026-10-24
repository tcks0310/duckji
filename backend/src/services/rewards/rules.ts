// 서버가 확인한 뒤 주는 덕지 포인트(DP) 금액·한도. 원장 사유 코드의 이름은 users/point-rules.ts LEDGER_LABELS 에 있습니다.

// 덕력 퀴즈 보상은 버전마다 관리자가 정함 (rewards.quiz_versions.base_dp·per_correct_dp), 회원마다 버전 하나에 한 번
export const QUIZ_MAX_ITEMS = 30 // 버전 하나의 문제 수 상한
export const QUIZ_MAX_OPTIONS = 6 // 문제 하나의 보기 수 상한

export const CREATOR_CODE_LIMIT = 1 // 회원마다 크리에이터 코드는 하나만

export const PILGRIMAGE_SPOT_DP = 100 // 덕지순례 스팟 도장 (완주 보상은 코스마다 DB 에)
export const PILGRIMAGE_MAX_ACCURACY_M = 500 // 휴대폰 위치 오차가 이보다 크면 받지 않음

export const SQUAD_SIZE = 3 // 이 인원이 처음 모이면 스쿼드 완성 → 보상 (스쿼드마다 한 번)
export const SQUAD_COMPLETE_DP = 300 // 스쿼드가 완성되면 그때 팀원 전원에게 (회원마다 평생 한 번)
export const SQUAD_MAX_MEMBERS = 20 // 스쿼드 정원 (길드처럼 키울 수 있게)
export const SQUAD_NAME_MIN = 2
export const SQUAD_NAME_MAX = 16
export const SQUAD_INTRO_MAX = 100
export const SQUAD_MESSAGE_MAX = 500
export const SQUAD_NOTICE_MAX = 500 // 스쿼드 홈 공지
export const SQUAD_LINKS_MAX = 5 // 스쿼드 홈 SNS 링크
// 스쿼드 기본 아이콘·색 (화면 쪽 목록은 frontend/lib/squad-style.ts, 이름을 맞춰 둘 것)
export const SQUAD_ICONS = ["star", "shield", "flame", "crown", "heart", "swords", "music", "gamepad", "camera", "sparkles", "moon", "zap", "rocket", "ghost", "cat", "leaf"] as const
export const SQUAD_COLORS = ["amber", "red", "rose", "violet", "sky", "emerald", "teal", "orange", "zinc"] as const

// 오늘의 타로 도장: 종류마다 하루 한 번 (화면 안내 문구는 frontend/data/tarot-config.json, 같은 금액으로 맞춰 둘 것)
export const TAROT_DAILY_DP = { single: 20, draw: 50, dice: 20 } as const
export type TarotDailyType = keyof typeof TAROT_DAILY_DP

// 원장 사유 코드 (예전 화면 지급과 같은 코드를 써서 내역이 이어지게)
export const REASONS = {
  creator: "creator_code",
  promo: "promo_code", // 팝업·굿즈·일반 배포 코드 (예전 현장 시리얼 코드는 tarot_code 로 남아 있음)
  // stamp_tour_spot / stamp_tour_master: 예전 스탬프 투어(덕지순례로 합침) 내역에만 남아 있음
  quiz: "quiz_reward",
  squad: "squad_complete",
  pilgrimageSpot: "pilgrimage_spot",
  pilgrimageCourse: "pilgrimage_course",
  tarotDaily: "tarot_daily",
} as const

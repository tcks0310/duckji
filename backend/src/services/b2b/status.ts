// 신청 상태 (docs/planning/관리자센터-기능정의서.md 2.2 공통 상태)
export const APPLICATION_STATUSES = [
  "submitted", // 접수
  "reviewing", // 검토중
  "needs_info", // 보완요청 (사유 필수)
  "approved", // 승인 (노출 위치·기간 확정 전)
  "published", // 게시
  "rejected", // 반려 (사유 필수)
  "ended", // 종료
  "archived", // 보관
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "접수",
  reviewing: "검토중",
  needs_info: "보완요청",
  approved: "승인",
  published: "게시",
  rejected: "반려",
  ended: "종료",
  archived: "보관",
}

// 관리자가 바꿀 수 있는 다음 상태
export const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["reviewing", "needs_info", "approved", "published", "rejected"],
  reviewing: ["needs_info", "approved", "published", "rejected"],
  needs_info: ["submitted", "reviewing", "rejected"],
  approved: ["published", "rejected", "reviewing"],
  published: ["ended"],
  rejected: ["reviewing", "archived"],
  ended: ["published", "archived"],
  archived: [],
}

export const REASON_REQUIRED: ApplicationStatus[] = ["needs_info", "rejected"]

// 신청자에게 상태 변경 메일을 보내는 상태
export const NOTIFY_APPLICANT: ApplicationStatus[] = ["needs_info", "approved", "published", "rejected"]

export const isApplicationStatus = (v: unknown): v is ApplicationStatus =>
  typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v)

import {
  AD_PLACEMENTS,
  NOTICE_AUDIENCES,
  NOTICE_DEVICES,
  NOTICE_DISMISS,
  NOTICE_PAGES,
  NOTICE_PLACEMENTS,
  NOTICE_STATUSES,
  NOTICE_TEMPLATES,
  type SiteNotice,
  type SiteNoticeInput,
} from "./types"

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const oneOf = <T extends readonly string[]>(list: T, v: string, fallback: T[number]) =>
  (v || fallback) as T[number]
// 날짜는 ISO 문자열(시간대 포함)로 받음. 비우면 null
const date = (v: unknown): string | null | "invalid" => {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString()
}
// https 주소 또는 사이트 안 경로(/...). 로컬 개발 업로드는 http://localhost
const URL_RE = /^(https:\/\/|\/(?!\/)|http:\/\/localhost[:/])/

export type ValidationResult = { ok: true; value: SiteNoticeInput } | { ok: false; errors: string[] }

// 수정 때는 기존 값에 보낸 필드만 덮어씀
export function validateSiteNoticeInput(body: Record<string, unknown>, existing?: SiteNotice): ValidationResult {
  const merged = { ...(existing || {}), ...body } as Record<string, unknown>
  const errors: string[] = []
  const startsAt = date(merged.startsAt)
  const endsAt = date(merged.endsAt)
  const priority = Number(merged.priority ?? 0)

  const value: SiteNoticeInput = {
    name: str(merged.name),
    placement: oneOf(NOTICE_PLACEMENTS, str(merged.placement), "modal"),
    template: oneOf(NOTICE_TEMPLATES, str(merged.template), "image"),
    title: str(merged.title),
    body: str(merged.body),
    imageUrl: str(merged.imageUrl) || null,
    mobileImageUrl: str(merged.mobileImageUrl) || null,
    linkUrl: str(merged.linkUrl) || null,
    linkLabel: str(merged.linkLabel),
    linkNewTab: merged.linkNewTab === true,
    pages: oneOf(NOTICE_PAGES, str(merged.pages), "home"),
    audience: oneOf(NOTICE_AUDIENCES, str(merged.audience), "all"),
    device: oneOf(NOTICE_DEVICES, str(merged.device), "all"),
    dismiss: oneOf(NOTICE_DISMISS, str(merged.dismiss), "today"),
    priority: Number.isInteger(priority) ? priority : 0,
    startsAt: startsAt === "invalid" ? null : startsAt,
    endsAt: endsAt === "invalid" ? null : endsAt,
    status: oneOf(NOTICE_STATUSES, str(merged.status), "draft"),
    contractId: Number.isSafeInteger(Number(merged.contractId)) && Number(merged.contractId) > 0 ? Number(merged.contractId) : null,
  }
  // 홈 광고 자리는 디자이너 이미지만 올리고, 홈에서 누구에게나 보임 (닫기 없음)
  const isAd = (AD_PLACEMENTS as readonly string[]).includes(value.placement)
  if (isAd) Object.assign(value, { template: "image", pages: "home", audience: "all", device: "all", dismiss: "none" })

  const check = <T extends readonly string[]>(list: T, v: string, label: string) => {
    if (!list.includes(v)) errors.push(`${label}는 ${list.join(", ")} 중 하나여야 합니다.`)
  }
  check(NOTICE_PLACEMENTS, value.placement, "노출 위치(placement)")
  check(NOTICE_TEMPLATES, value.template, "디자인(template)")
  check(NOTICE_PAGES, value.pages, "노출 화면(pages)")
  check(NOTICE_AUDIENCES, value.audience, "대상(audience)")
  check(NOTICE_DEVICES, value.device, "기기(device)")
  check(NOTICE_DISMISS, value.dismiss, "보지 않기(dismiss)")
  check(NOTICE_STATUSES, value.status, "상태(status)")

  if (!value.name || value.name.length > 120) errors.push("관리용 이름은 1~120자여야 합니다.")
  if (value.title.length > 120) errors.push("제목은 120자 이하여야 합니다.")
  if (value.body.length > 2000) errors.push("본문은 2,000자 이하여야 합니다.")
  if (value.linkLabel.length > 40) errors.push("버튼 문구는 40자 이하여야 합니다.")
  if (value.template === "image" && !value.imageUrl) errors.push(isAd ? "광고 이미지(PC)를 올려야 합니다." : "이미지형은 PC 이미지를 올려야 합니다.")
  if (value.template === "basic" && !value.title && !value.imageUrl) errors.push("텍스트형은 제목이나 이미지 중 하나는 있어야 합니다.")
  if (value.template === "basic" && value.placement === "bar" && !value.title) errors.push("텍스트형 띠 배너는 배너 문구가 필요합니다.")
  if (value.imageUrl && !URL_RE.test(value.imageUrl)) errors.push("PC 이미지 주소는 https:// 또는 / 로 시작해야 합니다.")
  if (value.mobileImageUrl && !URL_RE.test(value.mobileImageUrl)) errors.push("모바일 이미지 주소는 https:// 또는 / 로 시작해야 합니다.")
  if (value.linkUrl && !URL_RE.test(value.linkUrl)) errors.push("이동 주소는 https:// 또는 / 로 시작해야 합니다.")
  if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) errors.push("우선순위는 -1000~1000 사이 정수여야 합니다.")
  if (startsAt === "invalid") errors.push("시작 일시가 올바르지 않습니다.")
  if (endsAt === "invalid") errors.push("종료 일시가 올바르지 않습니다.")
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) errors.push("종료 일시는 시작 일시보다 뒤여야 합니다.")

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

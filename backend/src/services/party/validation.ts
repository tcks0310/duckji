import { PARTY_EVENT_KINDS, PARTY_EVENT_STATUSES, type PartyEvent, type PartyEventInput } from "./types"

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/
const GALLERY_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const int = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number.isInteger(Number(v)) ? Number(v) : NaN)

export type ValidationResult = { ok: true; value: PartyEventInput } | { ok: false; errors: string[] }

// 수정 때는 기존 값에 보낸 필드만 덮어씀
export function validatePartyEventInput(body: Record<string, unknown>, existing?: PartyEvent): ValidationResult {
  const merged = { ...(existing || {}), ...body } as Record<string, unknown>
  const errors: string[] = []
  const year = int(merged.year)

  const value: PartyEventInput = {
    slug: str(merged.slug).toLowerCase(),
    title: str(merged.title),
    kind: (str(merged.kind) || "birthday") as PartyEventInput["kind"],
    workTitle: str(merged.workTitle),
    characterName: str(merged.characterName) || null,
    month: int(merged.month),
    day: int(merged.day),
    year: Number.isNaN(year) ? null : year,
    description: str(merged.description),
    imageUrl: str(merged.imageUrl) || null,
    source: str(merged.source),
    gallerySlug: str(merged.gallerySlug).toLowerCase() || null,
    status: (str(merged.status) || "published") as PartyEventInput["status"],
  }

  if (!SLUG_RE.test(value.slug)) errors.push("slug 는 영문 소문자·숫자·하이픈 2~80자여야 합니다.")
  if (!value.title || value.title.length > 120) errors.push("이벤트 이름은 1~120자여야 합니다.")
  if (!value.workTitle || value.workTitle.length > 120) errors.push("작품명은 1~120자여야 합니다.")
  if (value.characterName && value.characterName.length > 120) errors.push("캐릭터 이름은 120자 이하여야 합니다.")
  if (!PARTY_EVENT_KINDS.includes(value.kind)) errors.push(`종류(kind)는 ${PARTY_EVENT_KINDS.join(", ")} 중 하나여야 합니다.`)
  if (!PARTY_EVENT_STATUSES.includes(value.status)) errors.push(`상태(status)는 ${PARTY_EVENT_STATUSES.join(", ")} 중 하나여야 합니다.`)
  const maxDay = MONTH_DAYS[value.month - 1]
  if (!maxDay) errors.push("월은 1~12 사이여야 합니다.")
  else if (!(value.day >= 1 && value.day <= maxDay)) errors.push(`${value.month}월의 날짜는 1~${maxDay} 사이여야 합니다.`)
  if (value.year !== null && (value.year < 1900 || value.year > 2100)) errors.push("연도는 1900~2100 사이이거나 비워 두어야 합니다(매년 반복).")
  if (value.description.length > 2000) errors.push("설명은 2,000자 이하여야 합니다.")
  if (value.source.length > 300) errors.push("출처는 300자 이하여야 합니다.")
  // http://localhost 는 개발용 업로드 주소
  if (value.imageUrl && !/^(https:\/\/|\/|http:\/\/localhost[:/])/.test(value.imageUrl)) errors.push("이미지 주소는 https:// 또는 / 로 시작해야 합니다.")
  if (value.gallerySlug && !GALLERY_SLUG_RE.test(value.gallerySlug)) errors.push("연결 갤러리 slug 가 올바르지 않습니다.")

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

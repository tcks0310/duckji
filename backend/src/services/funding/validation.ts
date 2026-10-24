import { config } from "../../shared/config"
import { PARTNERS, type VenueSpaceInput } from "./types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_IMAGES = 5
const MAX_LINKS = 5

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0)
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : []
const isHttpUrl = (v: string) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol)
  } catch {
    return false
  }
}
// 사용자가 올리는 이미지는 덕지 업로드 주소(gallery 서비스가 발급하는 회원 이미지)만 허용
const isUploadUrl = (v: string) => v.startsWith(`${config.uploadPublicBaseUrl}/`)

// ---- 대관 공간 (관리자 등록·수정). existing 이 있으면 보낸 필드만 바뀜 ----
export function validateVenueSpace(body: Record<string, unknown>, existing?: VenueSpaceInput): Result<VenueSpaceInput> {
  const m = { ...(existing || {}), ...body } as Record<string, unknown>
  const value: VenueSpaceInput = {
    name: str(m.name, 100),
    location: str(m.location, 50),
    address: str(m.address, 200),
    capacity: int(m.capacity),
    area: str(m.area, 50),
    imageUrls: strList(m.imageUrls).slice(0, 10),
    availablePeriod: str(m.availablePeriod, 200),
    priceGuide: str(m.priceGuide, 200),
    description: str(m.description, 5000),
    partner: str(m.partner, 50) || PARTNERS.venue,
    isPublished: m.isPublished === undefined ? true : m.isPublished === true,
    sortOrder: Number.isFinite(Number(m.sortOrder)) ? Math.trunc(Number(m.sortOrder)) : 0,
  }
  const errors: string[] = []
  if (!value.name) errors.push("공간명을 입력해 주세요.")
  if (value.imageUrls.some((u) => !isHttpUrl(u))) errors.push("사진 주소는 http(s) 주소여야 합니다.")
  return errors.length ? { ok: false, errors } : { ok: true, value }
}


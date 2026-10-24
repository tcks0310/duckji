import {
  DELIVERY_METHODS,
  GOAL_TYPES,
  PROJECT_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
  ROLE_TYPES,
  hasGoods,
  hasVenue,
  type EditInput,
  type GoodsForm,
  type GoodsItem,
  type ParticipateInput,
  type ProjectDetails,
  type ProjectInput,
  type ProjectType,
  type QuoteInput,
  type QuoteLine,
  type ReportInput,
  type ReportStatus,
  type RewardInput,
  type SetupInput,
} from "./project-types"

type Body = Record<string, unknown>
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/
const MAX_REWARDS = 10
const MAX_IMAGES = 10
const MAX_PRICE = 100_000_000 // 1억
const MAX_DAYS = 180

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const optStr = (v: unknown, max: number) => str(v, max) || undefined
const int = (v: unknown, max = MAX_PRICE) =>
  Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.trunc(Number(v)))) : 0
const optInt = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : int(v))
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []
// 이미지는 http(s) 주소나 사이트 안 경로(/images/...)만
const isImageUrl = (v: string) => {
  if (v.startsWith("/") && !v.startsWith("//")) return true
  try {
    return ["http:", "https:"].includes(new URL(v).protocol)
  } catch {
    return false
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_GOODS = 30
const MAX_ATTACHMENTS = 10
const MAX_VIDEOS = 3

const optDate = (v: unknown) => {
  const d = str(v, 10)
  return DATE_RE.test(d) ? d : undefined
}

function goodsItems(v: unknown): GoodsItem[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, MAX_GOODS)
    .map((g: any) => ({
      id: int(g?.id, 1_000_000_000),
      name: str(g?.name, 100),
      categoryName: str(g?.categoryName, 50),
      imageUrl: str(g?.imageUrl, 1000),
      quantity: Math.max(1, int(g?.quantity, 99_999)),
      serviceType: str(g?.serviceType, 20) || "맞춤제작",
    }))
    .filter((g) => g.name && (!g.imageUrl || isImageUrl(g.imageUrl)))
}

function goodsForm(v: unknown, errors: string[]): GoodsForm {
  const f = (v && typeof v === "object" ? v : {}) as Body
  const attachments = strList(f.attachments, MAX_ATTACHMENTS, 1000)
  if (!attachments.every(isImageUrl)) errors.push("첨부 사진 주소가 올바르지 않습니다.")
  return {
    eventLocation: optStr(f.eventLocation, 200),
    needInstallService: f.needInstallService === true,
    installDate: optDate(f.installDate),
    attachments,
    notes: optStr(f.notes, 3000),
  }
}

// 개설 신청·관리자 수정 공통 (일정·장소·소개 사진·굿즈)
function details(body: Body, type: ProjectType | null, errors: string[]): ProjectDetails {
  const images = strList(body.images, MAX_IMAGES, 1000)
  const videos = strList(body.videos, MAX_VIDEOS, 1000)
  const thumbnailUrl = str(body.thumbnailUrl, 1000) || images[0] || ""
  if (![...images, ...videos, ...(thumbnailUrl ? [thumbnailUrl] : [])].every(isImageUrl))
    errors.push("사진·동영상 주소가 올바르지 않습니다.")
  const eventStart = optDate(body.eventStart)
  const eventEnd = optDate(body.eventEnd) || eventStart
  if (eventStart && eventEnd && eventEnd < eventStart) errors.push("일정 종료일이 시작일보다 빠릅니다.")
  const items = type && hasGoods(type) ? goodsItems(body.goodsItems) : []
  const venueId = optInt(body.venueId)
  return {
    eventStart,
    eventEnd,
    eventTime: optStr(body.eventTime, 50),
    eventDate: eventStart ? (eventEnd && eventEnd !== eventStart ? `${eventStart} ~ ${eventEnd}` : eventStart) : undefined,
    venueId: venueId && venueId > 0 ? venueId : undefined,
    region: optStr(body.region, 30),
    venueName: optStr(body.venueName, 100),
    venueAddress: optStr(body.venueAddress, 200),
    maxCapacity: optInt(body.maxCapacity),
    workTag: optStr(body.workTag, 100),
    goalType: oneOf(body.goalType, GOAL_TYPES, "amount"),
    desiredPrice: optInt(body.desiredPrice),
    images,
    videos,
    thumbnailUrl,
    goodsItems: items,
    goodsForm: type && hasGoods(type) ? goodsForm(body.goodsForm, errors) : undefined,
    deliveryMethod: oneOf(body.deliveryMethod, DELIVERY_METHODS, type === "group_buy" ? "shipping" : "pickup"),
    copyrightConfirmed: body.copyrightConfirmed === true,
    termsAgreedAt: typeof body.termsAgreedAt === "string" ? str(body.termsAgreedAt, 40) : undefined,
  }
}

export function rewards(v: unknown, errors: string[]): RewardInput[] {
  const list = Array.isArray(v) ? v.slice(0, MAX_REWARDS) : []
  return list
    .map((r: any) => {
      const maxQuantity = optInt(r?.maxQuantity)
      return {
        title: str(r?.title, 100),
        description: str(r?.description, 1000),
        price: int(r?.price),
        roleType: oneOf(r?.roleType, ROLE_TYPES, "standard"),
        maxQuantity: maxQuantity && maxQuantity > 0 ? maxQuantity : undefined,
        itemsIncluded: strList(r?.itemsIncluded, 20, 100),
      }
    })
    .filter((r) => {
      if (!r.title) errors.push("참여 옵션 이름을 입력해 주세요.")
      return Boolean(r.title)
    })
}

function endDate(v: unknown, errors: string[], now: number) {
  const end = new Date(typeof v === "string" ? v : "")
  if (Number.isNaN(end.getTime())) errors.push("모집 마감일이 올바르지 않습니다.")
  else if (end.getTime() <= now) errors.push("모집 마감일은 오늘 이후여야 합니다.")
  else if (end.getTime() > now + MAX_DAYS * 86_400_000) errors.push(`모집 마감일은 ${MAX_DAYS}일 안으로 정해 주세요.`)
  return end
}

// 펀딩 개설 신청 (회원). 참여 옵션·가격은 관리자가 견적과 함께 정함
export function validateProject(body: Body, now = Date.now()): Result<ProjectInput> {
  const errors: string[] = []
  const type = PROJECT_TYPES.includes(body.type as any) ? (body.type as ProjectType) : null
  if (!type) errors.push("펀딩 종류를 골라 주세요.")
  const title = str(body.title, 120)
  if (!title) errors.push("펀딩 제목을 입력해 주세요.")
  const summary = str(body.summary, 300)
  if (!summary) errors.push("한 줄 소개를 입력해 주세요.")
  const description = str(body.description, 20_000)
  if (!description) errors.push("상세 소개를 입력해 주세요.")
  const end = endDate(body.endDate, errors, now)
  const targetAmount = int(body.targetAmount)
  const targetCount = int(body.targetCount, 100_000)
  if (targetAmount === 0 && targetCount === 0) errors.push("목표 금액이나 목표 인원을 입력해 주세요.")
  const partyEventId = str(body.partyEventId, 100)
  if (partyEventId && !SLUG_RE.test(partyEventId)) errors.push("파티 이벤트 정보가 올바르지 않습니다.")
  const d = details(body, type, errors)
  if (!d.eventStart) errors.push(type === "group_buy" ? "판매·수령 일정을 골라 주세요." : "행사 일정을 골라 주세요.")
  if (type && hasVenue(type) && !d.venueName && !d.region) errors.push("장소를 고르거나 희망 지역을 적어 주세요.")
  if (type && hasGoods(type)) {
    const hasAnyGoods =
      Boolean(d.goodsItems?.length) ||
      Boolean(d.goodsForm?.attachments?.length) ||
      Boolean(d.goodsForm?.notes?.trim())
    if (!hasAnyGoods) {
      errors.push("만들 굿즈 품목을 고르거나, 시안 사진 또는 요청 사항을 1개 이상 입력해 주세요.")
    }
  }
  if (type && hasGoods(type) && !d.copyrightConfirmed) errors.push("저작권·상표권 확인에 동의해 주세요.")
  if (body.termsAgreed !== true) errors.push("펀딩 개설 약관에 동의해 주세요.")
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      type: type!,
      title,
      summary,
      description,
      targetAmount: d.goalType === "count" ? 0 : targetAmount,
      targetCount: d.goalType === "count" ? targetCount : 0,
      endDate: end.toISOString(),
      ageRestriction: body.ageRestriction === "adult_only" ? "adult_only" : "all",
      partyEventId: partyEventId || undefined,
      details: { ...d, termsAgreedAt: new Date(now).toISOString() },
    },
  }
}

// 관리자 내용 수정 (종류는 그대로)
export function validateEdit(body: Body, type: ProjectType): Result<EditInput> {
  const errors: string[] = []
  const title = str(body.title, 120)
  if (!title) errors.push("펀딩 제목을 입력해 주세요.")
  const d = details(body, type, errors)
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title,
      summary: str(body.summary, 300),
      description: str(body.description, 20_000),
      ageRestriction: body.ageRestriction === "adult_only" ? "adult_only" : "all",
      details: d,
    },
  }
}

// 관리자: 공개 전 설정 (목표·마감·참여 옵션·담당자·주제)
export function validateSetup(body: Body, now = Date.now()): Result<SetupInput> {
  const errors: string[] = []
  const end = endDate(body.endDate, errors, now)
  const targetAmount = int(body.targetAmount)
  const targetCount = int(body.targetCount, 100_000)
  if (targetAmount === 0 && targetCount === 0) errors.push("목표 금액이나 목표 인원을 입력해 주세요.")
  const topicId = optInt(body.topicId)
  const r = body.rewards === undefined ? undefined : rewards(body.rewards, errors)
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      targetAmount,
      targetCount,
      endDate: end.toISOString(),
      managerName: str(body.managerName, 50),
      topicId: topicId && topicId > 0 ? topicId : null,
      rewards: r,
    },
  }
}

export function validateQuote(body: Body): Result<QuoteInput> {
  const lines: QuoteLine[] = Array.isArray(body.lines)
    ? body.lines
        .slice(0, 30)
        .map((l: any) => ({ label: str(l?.label, 100), amount: int(l?.amount) }))
        .filter((l) => l.label)
    : []
  if (lines.length === 0) return { ok: false, errors: ["견적 항목을 1개 이상 입력해 주세요."] }
  const fileUrl = str(body.fileUrl, 1000)
  if (fileUrl && !isImageUrl(fileUrl)) return { ok: false, errors: ["견적서 파일 주소가 올바르지 않습니다."] }
  return { ok: true, value: { lines, memo: str(body.memo, 3000), fileUrl } }
}

export function validateMessage(body: Body): Result<{ content: string }> {
  const content = str(body.content, 2000)
  if (!content) return { ok: false, errors: ["메시지를 입력해 주세요."] }
  return { ok: true, value: { content } }
}

export function validateTopic(body: Body): Result<{ name: string; sortOrder: number }> {
  const name = str(body.name, 40)
  if (!name) return { ok: false, errors: ["주제 이름을 입력해 주세요."] }
  return { ok: true, value: { name, sortOrder: int(body.sortOrder, 10_000) } }
}

export function validateParticipation(body: Body): Result<ParticipateInput> {
  const errors: string[] = []
  const quantity = int(body.quantity, 100)
  if (quantity < 1) errors.push("수량은 1개 이상이어야 합니다.")
  const userName = str(body.userName, 50)
  if (!userName) errors.push("참여자 이름을 입력해 주세요.")
  const userEmail = str(body.userEmail, 200)
  if (userEmail && !EMAIL_RE.test(userEmail)) errors.push("이메일 형식이 올바르지 않습니다.")
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      rewardId: str(body.rewardId, 120),
      quantity,
      userName,
      userPhone: str(body.userPhone, 30),
      userEmail,
      deliveryAddress: str(body.deliveryAddress, 300),
      notes: str(body.notes, 1000),
      isAdultConfirmed: body.isAdultConfirmed === true,
    },
  }
}

export function validateComment(body: Body): Result<{ content: string; userLevel: string }> {
  const content = str(body.content, 1000)
  if (!content) return { ok: false, errors: ["댓글 내용을 입력해 주세요."] }
  return { ok: true, value: { content, userLevel: str(body.userLevel, 30) } }
}

export function validateNotice(body: Body): Result<{ title: string; content: string }> {
  const title = str(body.title, 200)
  const content = str(body.content, 5000)
  if (!title || !content) return { ok: false, errors: ["공지 제목과 내용을 입력해 주세요."] }
  return { ok: true, value: { title, content } }
}

export function validateReport(body: Body): Result<ReportInput> {
  const errors: string[] = []
  const projectId = str(body.projectId, 80)
  if (!projectId) errors.push("신고할 프로젝트가 없습니다.")
  const details = str(body.details, 2000)
  if (!details) errors.push("신고 내용을 입력해 주세요.")
  const reporterEmail = str(body.reporterEmail, 200)
  if (reporterEmail && !EMAIL_RE.test(reporterEmail)) errors.push("이메일 형식이 올바르지 않습니다.")
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: { projectId, details, reporterEmail, reason: oneOf(body.reason, REPORT_REASONS, "other") } }
}

export function validateReportPatch(body: Body): Result<{ status: ReportStatus; adminNote?: string }> {
  if (!REPORT_STATUSES.includes(body.status as ReportStatus)) return { ok: false, errors: ["처리 상태가 올바르지 않습니다."] }
  return { ok: true, value: { status: body.status as ReportStatus, adminNote: optStr(body.adminNote, 1000) } }
}

import type {
  FundingComment,
  FundingMessage,
  FundingNotice,
  FundingParticipant,
  FundingProject,
  FundingQuote,
  FundingReport,
  FundingStats,
  FundingStatus,
  FundingSupporter,
  FundingTopic,
  FundingType,
} from "@/types/funding"
import { apiFetch } from "@/lib/api"
import { loadPoints } from "@/lib/member-points"
import { ApiError } from "@/lib/community-api"

// 덕지 펀딩 API (backend funding 서비스, /api/funding/...)
// 흐름: 개설 신청(견적 전) → 담당자와 대화·견적 → 오픈 준비 → 공개(펀딩 받는 중) → 목표 달성
// - 개설 신청·참여·댓글·좋아요는 회원 로그인 필요 (서버가 쿠키의 회원 정보를 씀)
// - 개설자 이름·사진은 커뮤니티(덕지 갤러리) 프로필과 같음

export const FUNDING_TYPES: { id: FundingType; label: string; desc: string }[] = [
  { id: "venue", label: "장소 대관", desc: "카페·스튜디오를 빌려 생일카페, 상영회, 파티를 열어요." },
  { id: "venue_goods", label: "장소 대관 + 굿즈 제작", desc: "대관한 행사에서 함께 나눌 굿즈까지 만들어요." },
  { id: "group_buy", label: "굿즈 제작·공동구매", desc: "장소 없이 원하는 굿즈를 함께 만들고 나눠 받아요." },
]

export const fundingTypeLabel = (t: FundingType | string) => FUNDING_TYPES.find((x) => x.id === t)?.label || "펀딩"
export const hasVenue = (t: FundingType | string) => t === "venue" || t === "venue_goods"
export const hasGoods = (t: FundingType | string) => t === "venue_goods" || t === "group_buy"

// 둘러보기 분류 (1. 대관 펀딩 · 2. 굿즈 공동구매)
export const BROWSE_GROUPS = [
  { id: "venue", label: "대관 펀딩", types: ["venue", "venue_goods"] as FundingType[] },
  { id: "group_buy", label: "굿즈 공동구매", types: ["group_buy"] as FundingType[] },
] as const

export const STATUS_LABELS: Record<FundingStatus, string> = {
  draft: "작성 중",
  pending: "견적 전",
  preparing: "오픈 준비",
  live: "펀딩 받는 중",
  success: "목표 달성",
  failed: "무산",
  canceled: "중단",
  rejected: "반려",
}

// 모집 마감일이 지났는지 (관리자가 연장·마감을 정하기 전까지 '마감'으로 보여 줌)
export const isPastDeadline = (p: Pick<FundingProject, "endDate">) => new Date(p.endDate).getTime() <= Date.now()

// 화면에 보여 줄 단계 이름
export function displayStatus(p: Pick<FundingProject, "status" | "endDate">): string {
  if ((p.status === "live" || p.status === "success") && isPastDeadline(p)) return p.status === "success" ? "목표 달성 · 마감" : "마감"
  return STATUS_LABELS[p.status] || p.status
}

// 진행률 (목표 금액 우선, 없으면 인원)
export function progressOf(p: Pick<FundingProject, "targetAmount" | "currentAmount" | "targetCount" | "currentCount">) {
  if (p.targetAmount > 0) return Math.round((p.currentAmount / p.targetAmount) * 100)
  if (p.targetCount > 0) return Math.round((p.currentCount / p.targetCount) * 100)
  return 0
}

export function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

// 일정 표시 (2026.11.03 ~ 11.05)
export function scheduleText(p: Pick<FundingProject, "eventStart" | "eventEnd" | "eventDate" | "eventTime">) {
  const f = (d: string) => d.replace(/-/g, ".")
  if (!p.eventStart) return p.eventDate || ""
  const range = p.eventEnd && p.eventEnd !== p.eventStart ? `${f(p.eventStart)} ~ ${f(p.eventEnd).slice(p.eventEnd.slice(0, 4) === p.eventStart.slice(0, 4) ? 5 : 0)}` : f(p.eventStart)
  return p.eventTime ? `${range} · ${p.eventTime}` : range
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  let res: Response
  try {
    res = await apiFetch(`/api/funding${path}`, {
      cache: "no-store",
      ...rest,
      headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    })
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new ApiError(data.error || data.errors?.[0] || "요청을 처리하지 못했습니다.", res.status)
  }
  return data as T
}

const enc = encodeURIComponent
const isQuiet = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 0 || e.status >= 500)

export type AdminProjectList = {
  projects: FundingProject[]
  lastMessages: Record<string, { sender: "creator" | "admin"; at: string }>
  contacts: Record<string, { email: string }>
}

export type SetupInput = {
  targetAmount: number
  targetCount: number
  endDate: string
  managerName: string
  topicId: number | null
  rewards?: { title: string; description: string; price: number; maxQuantity?: number }[]
}

class FundingService {
  private likedIds = new Set<string>()

  // 공개 펀딩 (펀딩 받는 중·목표 달성·종료)
  async getAllProjects(): Promise<FundingProject[]> {
    const data = await request<{ projects: FundingProject[]; likedIds: string[] }>("/projects")
    this.likedIds = new Set(data.likedIds)
    return data.projects
  }

  async getStats(): Promise<FundingStats> {
    return (await request<{ stats: FundingStats }>("/projects/stats")).stats
  }

  async getTopics(): Promise<FundingTopic[]> {
    return (await request<{ topics: FundingTopic[] }>("/topics")).topics
  }

  // 파티 이벤트에서 열린 펀딩
  async getProjectsByPartyEvent(slug: string): Promise<FundingProject[]> {
    try {
      return (await request<{ projects: FundingProject[] }>(`/projects?partyEventId=${enc(slug)}`)).projects
    } catch {
      return []
    }
  }

  // 견적 전·오픈 준비·반려 펀딩은 개설자와 관리자에게만 보임
  async getProjectById(id: string): Promise<FundingProject | null> {
    try {
      const data = await request<{ project: FundingProject; liked: boolean }>(`/projects/${enc(id)}`)
      if (data.liked) this.likedIds.add(id)
      else this.likedIds.delete(id)
      return data.project
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }

  // 개설 신청. 개설자 id·이름은 서버가 로그인 정보로 채움
  async createProject(data: Record<string, unknown>): Promise<FundingProject> {
    const { project, rewardDp } = await request<{ project: FundingProject; rewardDp?: number }>("/projects", { method: "POST", json: data })
    if (rewardDp) loadPoints()
    return project
  }

  async participate(data: {
    projectId: string
    rewardId: string
    userName: string
    userPhone: string
    userEmail: string
    quantity: number
    deliveryAddress?: string
    notes?: string
    isAdultConfirmed?: boolean
  }) {
    const { projectId, ...body } = data
    const result = await request<{ participant: FundingParticipant; goalReached: boolean; paidDp: number; dpBalance: number | null }>(
      `/projects/${enc(projectId)}/participate`,
      { method: "POST", json: body }
    )
    loadPoints()
    return result
  }

  async cancelParticipation(participantId: string) {
    await request(`/participations/${enc(participantId)}/cancel`, { method: "POST" })
    loadPoints()
  }

  async getMyParticipations(): Promise<FundingParticipant[]> {
    try {
      return (await request<{ participations: FundingParticipant[] }>("/participations/mine")).participations
    } catch (e) {
      if (isQuiet(e)) return []
      throw e
    }
  }

  // 내가 연 펀딩 (모든 단계)
  async getMyProjects(): Promise<FundingProject[]> {
    try {
      return (await request<{ projects: FundingProject[] }>("/projects/mine")).projects
    } catch (e) {
      if (isQuiet(e)) return []
      throw e
    }
  }

  // 참여자 명단·연락처 (개설자·관리자)
  async getParticipantsByProject(projectId: string): Promise<FundingParticipant[]> {
    return (await request<{ participants: FundingParticipant[] }>(`/projects/${enc(projectId)}/participants`)).participants
  }

  // 참여자 프로필 (누구나, 이름·사진만)
  async getSupporters(projectId: string): Promise<FundingSupporter[]> {
    try {
      return (await request<{ supporters: FundingSupporter[] }>(`/projects/${enc(projectId)}/supporters`)).supporters
    } catch {
      return []
    }
  }

  async getComments(projectId: string): Promise<FundingComment[]> {
    try {
      return (await request<{ comments: FundingComment[] }>(`/projects/${enc(projectId)}/comments`)).comments
    } catch {
      return []
    }
  }

  async addComment(projectId: string, content: string): Promise<FundingComment> {
    return (await request<{ comment: FundingComment }>(`/projects/${enc(projectId)}/comments`, { method: "POST", json: { content } })).comment
  }

  async deleteComment(projectId: string, commentId: string) {
    await request(`/projects/${enc(projectId)}/comments/${enc(commentId)}`, { method: "DELETE" })
  }

  async getNotices(projectId: string): Promise<FundingNotice[]> {
    try {
      return (await request<{ notices: FundingNotice[] }>(`/projects/${enc(projectId)}/notices`)).notices
    } catch {
      return []
    }
  }

  // 개설자·관리자 (관리자 화면에서 쓰면 '덕지 공지')
  async addNotice(projectId: string, title: string, content: string): Promise<FundingNotice> {
    return (await request<{ notice: FundingNotice }>(`/projects/${enc(projectId)}/notices`, { method: "POST", json: { title, content } })).notice
  }

  async deleteNotice(projectId: string, noticeId: string) {
    await request(`/projects/${enc(projectId)}/notices/${enc(noticeId)}`, { method: "DELETE" })
  }

  // 견적서 (개설자·관리자)
  async getQuotes(projectId: string): Promise<FundingQuote[]> {
    return (await request<{ quotes: FundingQuote[] }>(`/projects/${enc(projectId)}/quotes`)).quotes
  }

  async acceptQuote(projectId: string, quoteId: string) {
    await request(`/projects/${enc(projectId)}/quotes/${enc(quoteId)}/accept`, { method: "POST" })
  }

  // 담당자와 대화 (개설자)
  async getMessages(projectId: string): Promise<FundingMessage[]> {
    return (await request<{ messages: FundingMessage[] }>(`/projects/${enc(projectId)}/messages`)).messages
  }

  async sendMessage(projectId: string, content: string): Promise<FundingMessage> {
    return (await request<{ message: FundingMessage }>(`/projects/${enc(projectId)}/messages`, { method: "POST", json: { content } })).message
  }

  async addReport(report: Partial<FundingReport>): Promise<void> {
    await request("/reports", {
      method: "POST",
      json: { projectId: report.projectId, reporterEmail: report.reporterEmail, reason: report.reason, details: report.details },
    })
  }

  async toggleLike(projectId: string): Promise<boolean> {
    const { liked } = await request<{ liked: boolean }>(`/projects/${enc(projectId)}/like`, { method: "POST" })
    if (liked) this.likedIds.add(projectId)
    else this.likedIds.delete(projectId)
    return liked
  }

  isLiked(projectId: string): boolean {
    return this.likedIds.has(projectId)
  }

  // ================================================================ 관리자 (관리자 로그인 필요)
  async adminList(): Promise<AdminProjectList> {
    return request<AdminProjectList>("/admin/projects")
  }

  async adminSetStatus(projectId: string, status: FundingStatus, reason = "") {
    await request(`/admin/projects/${enc(projectId)}/status`, { method: "POST", json: { status, reason } })
  }

  async adminSetup(projectId: string, input: SetupInput): Promise<FundingProject> {
    return (await request<{ project: FundingProject }>(`/admin/projects/${enc(projectId)}/setup`, { method: "PUT", json: input })).project
  }

  async adminEdit(projectId: string, input: Record<string, unknown>): Promise<FundingProject> {
    return (await request<{ project: FundingProject }>(`/admin/projects/${enc(projectId)}`, { method: "PUT", json: input })).project
  }

  async adminSendQuote(projectId: string, input: { lines: { label: string; amount: number }[]; memo: string; fileUrl: string }) {
    return (await request<{ quote: FundingQuote }>(`/admin/projects/${enc(projectId)}/quotes`, { method: "POST", json: input })).quote
  }

  async adminGetMessages(projectId: string): Promise<FundingMessage[]> {
    return (await request<{ messages: FundingMessage[] }>(`/admin/projects/${enc(projectId)}/messages`)).messages
  }

  async adminSendMessage(projectId: string, content: string): Promise<FundingMessage> {
    return (await request<{ message: FundingMessage }>(`/admin/projects/${enc(projectId)}/messages`, { method: "POST", json: { content } })).message
  }

  async adminCreateTopic(name: string, sortOrder = 0) {
    await request("/admin/topics", { method: "POST", json: { name, sortOrder } })
  }

  async adminUpdateTopic(id: number, name: string, sortOrder: number) {
    await request(`/admin/topics/${id}`, { method: "PATCH", json: { name, sortOrder } })
  }

  async adminDeleteTopic(id: number) {
    await request(`/admin/topics/${id}`, { method: "DELETE" })
  }

  async getReports(): Promise<FundingReport[]> {
    return (await request<{ reports: FundingReport[] }>("/admin/reports")).reports
  }

  async updateReportStatus(reportId: string, status: FundingReport["status"], adminNote?: string) {
    await request(`/admin/reports/${enc(reportId)}`, { method: "PATCH", json: { status, adminNote } })
  }

  // 파티 이벤트(slug)별 펀딩 수
  async adminGetPartyEventCounts(): Promise<Record<string, number>> {
    return (await request<{ counts: Record<string, number> }>("/admin/party-event-counts")).counts
  }
}

export const fundingService = new FundingService()

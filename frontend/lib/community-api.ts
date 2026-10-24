import { apiFetch } from "@/lib/api"

// 덕지 갤러리 API (backend gallery 서비스 /api/galleries)
// 대분류 > 갤러리 > 글(사진·동영상 최대 10개, 해시태그, SNS 링크, 투표) · 댓글 · 덕업/덕다운 · 덕력 · 신고

export type AuthorSquad = { id: number; name: string; icon: string; color: string }

export interface GalleryGroup {
  id: number
  slug: string
  name: string
  kind: "normal" | "squad"
  sortOrder: number
  isActive: boolean
}

export interface Gallery {
  id: number
  slug: string
  name: string
  groupId: number | null
  description: string
  coverImageUrl: string | null
  heads: string[]
  aliases: string[]
  status: "active" | "dormant" | "closed"
  sortOrder: number
  writeRole: "member" | "admin"
  commentRole: "member" | "admin"
  layout: "grid" | "list"
  postAsSquad: boolean
  createdAt: string
  posts?: number
  today?: number
}

export type GroupWithGalleries = GalleryGroup & { galleries: Gallery[] }

export interface MediaItem {
  type: "image" | "video"
  url: string
}

export interface LinkItem {
  url: string
  label: string
}

export interface AuthorInfo {
  authorId: string
  authorName: string
  isStaff: boolean
  authorAvatarUrl?: string | null
  authorLevel?: { level: number; title: string } | null
  authorSquad?: AuthorSquad | null
}

export interface PostSummary extends AuthorInfo {
  id: number
  galleryId: number
  gallerySlug: string
  galleryName: string
  postedAsSquad: { id: number; name: string } | null
  head: string
  title: string
  excerpt: string
  cover: MediaItem | null
  mediaCount: number
  hashtags: string[]
  isNotice: boolean
  status: "published" | "hidden" | "deleted"
  hasPoll: boolean
  viewCount: number
  upCount: number
  downCount: number
  commentCount: number
  createdAt: string
  updatedAt: string
}

export interface PollOption {
  id: number
  label: string
  description: string
  imageUrl: string | null
  linkUrl: string | null
  voteCount: number | null // 투표한 뒤·마감 뒤에만 보임
}

export interface Poll {
  id: number
  question: string
  endsAt: string | null
  closed: boolean
  totalVotes: number | null
  myOptionId: number | null
  options: PollOption[]
}

export interface Post extends PostSummary {
  body: string
  media: MediaItem[]
  links: LinkItem[]
  poll: Poll | null
}

export interface Comment extends AuthorInfo {
  id: number
  postId: number
  parentId: number | null
  body: string
  status: "published" | "hidden" | "deleted"
  createdAt: string
}

export interface Permissions {
  canWrite: boolean
  writeBlockedReason: string | null
  canComment: boolean
  commentBlockedReason: string | null
}

export interface LevelInfo {
  level: number
  title: string
  min: number // 이번 레벨 시작 덕력
  duckryeok: number
  next: { level: number; min: number; remaining: number } | null
}

export interface Profile {
  id: string
  name: string
  avatarUrl: string | null
  joinedAt: string
  bio: string
  links: LinkItem[]
  level: LevelInfo
  squad: (AuthorSquad & { isLeader: boolean }) | null
  counts: { posts: number; comments: number; ups: number }
}

export interface RankingRow {
  memberId: string
  name: string
  avatarUrl: string | null
  duckryeok: number
  level: number
  title: string
  squad: AuthorSquad | null
}

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "스팸·도배" },
  { value: "abuse", label: "욕설·비방" },
  { value: "adult", label: "음란물" },
  { value: "copyright", label: "저작권 침해" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "impersonation", label: "사칭" },
  { value: "etc", label: "기타" },
]

export const MAX_MEDIA = 10

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {}
  let res: Response
  try {
    res = await apiFetch(path, {
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

const B = "/api/galleries"
const qs = (params: Record<string, string | number | null | undefined>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ""
}

// ---------- 갤러리 ----------
export const fetchTree = () => request<{ groups: GroupWithGalleries[]; galleries: Gallery[] }>(B)

export const fetchGalleryHome = () =>
  request<{ notices: PostSummary[]; hot: PostSummary[]; tags: { tag: string; count: number }[]; ranking: RankingRow[] }>(`${B}/home`)

export const fetchGallery = (slug: string) =>
  request<{ gallery: Gallery; notices: PostSummary[]; viewer: Permissions }>(`${B}/g/${encodeURIComponent(slug)}`)

// ---------- 갤러리 개설 요청 ----------
export const REQUEST_CATEGORIES: { value: string; label: string }[] = [
  { value: "anime", label: "애니메이션" },
  { value: "manga", label: "만화·웹툰" },
  { value: "game", label: "게임" },
  { value: "movie", label: "영화·드라마" },
  { value: "vtuber", label: "버튜버" },
  { value: "goods", label: "굿즈" },
  { value: "cosplay", label: "코스프레" },
  { value: "etc", label: "기타" },
]

export interface GalleryRequest {
  id: number
  name: string
  category: string
  reason: string
  requesterName: string
  supporterCount: number
  status: "pending" | "approved" | "rejected"
  adminNote: string
  galleryId: number | null
  createdAt: string
  handledAt: string | null
}

export const fetchGalleryRequests = () => request<{ requests: GalleryRequest[] }>(`${B}/requests`).then((r) => r.requests)

// 이미 있는 갤러리면 ApiError(409), 대기 중인 같은 이름이 있으면 joined: true (동의로 더해짐)
export const createGalleryRequest = (input: { name: string; category: string; reason: string }) =>
  request<{ joined: boolean; request: GalleryRequest }>(`${B}/requests`, { method: "POST", json: input })

// ---------- 글 ----------
export type FeedParams = { gallery?: string; tag?: string; author?: string; squad?: number; cursor?: string | null; limit?: number }
export const fetchFeed = (p: FeedParams) =>
  request<{ posts: PostSummary[]; nextCursor: string | null }>(`${B}/posts${qs({ ...p, cursor: p.cursor ?? undefined })}`)

export const searchPosts = (q: string, limit = 20) => request<{ posts: PostSummary[] }>(`${B}/posts${qs({ q, limit })}`).then((r) => r.posts)

export const fetchHot = (gallery?: string, limit = 10) => request<{ posts: PostSummary[] }>(`${B}/hot${qs({ gallery, limit })}`).then((r) => r.posts)

export const fetchPost = (id: number) =>
  request<{
    post: Post
    gallery: { id: number; slug: string; name: string; layout: "grid" | "list"; heads: string[] }
    viewer: Permissions & { loggedIn: boolean; memberId: string | null; isAuthor: boolean; isAdmin: boolean; reaction: -1 | 0 | 1 }
  }>(`${B}/posts/${id}`)

export interface PollInput {
  question: string
  endsAt: string | null
  options: { id?: number; label: string; description: string; imageUrl: string | null; linkUrl: string | null }[]
}

export interface PostInput {
  gallerySlug: string
  head?: string
  title: string
  body: string
  media: string[]
  links: LinkItem[]
  hashtags: string[]
  isNotice?: boolean
  asSquad?: boolean
  poll?: PollInput | null
}

export const createPost = (input: PostInput) =>
  request<{ post: { id: number }; earned: number }>(`${B}/posts`, { method: "POST", json: input })

export const updatePost = (id: number, input: PostInput) => request(`${B}/posts/${id}`, { method: "PATCH", json: input })

export const deletePost = (id: number) => request(`${B}/posts/${id}`, { method: "DELETE" })

export const reactToPost = (id: number, value: -1 | 0 | 1) =>
  request<{ reaction: -1 | 0 | 1; upCount: number; downCount: number }>(`${B}/posts/${id}/reaction`, { method: "POST", json: { value } })

export const votePoll = (postId: number, optionId: number) =>
  request<{ poll: Poll }>(`${B}/posts/${postId}/vote`, { method: "POST", json: { optionId } }).then((r) => r.poll)

// ---------- 댓글 ----------
export const fetchComments = (postId: number) => request<{ comments: Comment[] }>(`${B}/posts/${postId}/comments`).then((r) => r.comments)

export const createComment = (postId: number, body: string, parentId?: number | null) =>
  request<{ comment: Comment; earned: number }>(`${B}/posts/${postId}/comments`, { method: "POST", json: { body, parentId } })

export const deleteComment = (id: number) => request(`${B}/comments/${id}`, { method: "DELETE" })

// ---------- 신고 ----------
export const reportTarget = (input: { targetType: "post" | "comment" | "member"; targetId: string | number; reason: string; detail?: string }) =>
  request<{ alreadyReported: boolean }>(`${B}/reports`, { method: "POST", json: input })

// ---------- 회원 홈 ----------
export const fetchMe = () =>
  request<{
    profile: Profile
    today: { post: { count: number; limit: number; amount: number }; comment: { count: number; limit: number; amount: number } }
  }>(`${B}/me`)

export const updateMyProfile = (input: { bio?: string; links?: LinkItem[] }) =>
  request<{ profile: Profile }>(`${B}/me`, { method: "PATCH", json: input }).then((r) => r.profile)

export const fetchMyPosts = (cursor?: string | null) =>
  request<{ posts: PostSummary[]; nextCursor: string | null }>(`${B}/me/posts${qs({ cursor: cursor ?? undefined })}`)

export const fetchMyComments = () =>
  request<{ comments: (Comment & { postTitle: string })[] }>(`${B}/me/comments`).then((r) => r.comments)

export const fetchMyDuckryeok = () =>
  request<{ ledger: { id: number; amount: number; reason: string; label: string; refType: string | null; refId: number | null; createdAt: string }[] }>(
    `${B}/me/duckryeok`
  ).then((r) => r.ledger)

export const fetchProfile = (memberId: string) =>
  request<{ profile: Profile }>(`${B}/members/${encodeURIComponent(memberId)}`).then((r) => r.profile)

export const fetchRanking = (limit = 20) => request<{ ranking: RankingRow[] }>(`${B}/ranking${qs({ limit })}`).then((r) => r.ranking)

// ---------- 업로드 ----------
// 1) 서버에서 업로드 주소 발급 → 2) 브라우저가 S3(운영)·backend(로컬)에 직접 PUT → 3) 공개 주소를 글에 첨부
async function putFile(ticketPath: string, file: File): Promise<string> {
  const { upload } = await request<{
    upload: { uploadUrl: string; method: "PUT"; headers: Record<string, string>; publicUrl: string; withCredentials: boolean }
  }>(ticketPath, { method: "POST", json: { contentType: file.type, size: file.size } })
  const res = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file,
    credentials: upload.withCredentials ? "include" : "omit",
  })
  if (!res.ok) throw new ApiError("파일을 올리지 못했습니다.", res.status)
  return upload.publicUrl
}

// 갤러리 글 사진·동영상 (사진 15MB, 동영상 100MB)
export const uploadGalleryMedia = (file: File) => putFile(`${B}/uploads`, file)

// 회원 이미지 (펀딩 개설·굿즈 의뢰·프로필 사진)
export const uploadImage = (file: File) => putFile(`${B}/member-uploads`, file)

export const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url)

// ---------- 관리자 ----------
// 관리자 글 목록: 투표 마감 시각·직접 마감 시각도 같이
export interface AdminPostSummary extends PostSummary {
  pollEndsAt: string | null
  pollClosedAt: string | null
}

export interface AdminGallery extends Gallery {
  stats: { posts: number; todayPosts: number; comments: number; todayVisitors: number }
}

export interface ReportGroup {
  targetType: "post" | "comment" | "member"
  targetId: string
  postId: number | null
  reportCount: number
  reasons: string[]
  details: string[]
  preview: string
  authorId: string | null
  authorName: string | null
  targetStatus: string | null
  galleryName: string | null
  coverUrl: string | null
  firstReportedAt: string
  lastReportedAt: string
}

export interface GalleryStats {
  unit: "day" | "month"
  labels: string[]
  series: { visitors: number[]; views: number[]; posts: number[]; comments: number[]; ups: number[] }
  totals: { visitors: number; views: number; posts: number; comments: number; ups: number }
  galleries: { id: number; name: string; groupName: string; visitors: number; posts: number; comments: number }[]
}

export const adminGallery = {
  summary: () =>
    request<{
      summary: { todayPosts: number; todayComments: number; todayVisitors: number; totalPosts: number; pendingRequests: number; openReports: number }
    }>(`${B}/admin/summary`).then((r) => r.summary),
  tree: () => request<{ groups: GalleryGroup[]; galleries: AdminGallery[] }>(`${B}/admin/tree`),
  saveGroup: (input: Partial<GalleryGroup>, id?: number) =>
    request<{ group: GalleryGroup }>(id ? `${B}/admin/groups/${id}` : `${B}/admin/groups`, { method: id ? "PATCH" : "POST", json: input }).then(
      (r) => r.group
    ),
  deleteGroup: (id: number) => request(`${B}/admin/groups/${id}`, { method: "DELETE" }),
  saveGallery: (input: Partial<Gallery>, id?: number) =>
    request<{ gallery: Gallery }>(id ? `${B}/admin/galleries/${id}` : `${B}/admin/galleries`, { method: id ? "PATCH" : "POST", json: input }).then(
      (r) => r.gallery
    ),
  requests: (status: GalleryRequest["status"] = "pending") =>
    request<{ requests: GalleryRequest[] }>(`${B}/admin/requests?status=${status}`).then((r) => r.requests),
  handleRequest: (id: number, input: { status: "approved" | "rejected"; adminNote?: string; galleryId?: number }) =>
    request<{ request: GalleryRequest }>(`${B}/admin/requests/${id}`, { method: "PATCH", json: input }).then((r) => r.request),
  reports: (status: "open" | "actioned" | "dismissed" = "open") =>
    request<{ reports: ReportGroup[] }>(`${B}/admin/reports?status=${status}`).then((r) => r.reports),
  resolveReport: (targetType: ReportGroup["targetType"], targetId: string, action: "hide" | "dismiss", note = "") =>
    request(`${B}/admin/reports/resolve`, { method: "POST", json: { targetType, targetId, action, note } }),
  posts: (p: { galleryId?: number | null; groupId?: number | null; status?: string; q?: string; page?: number }) =>
    request<{ posts: AdminPostSummary[]; total: number; page: number; pageSize: number }>(
      `${B}/admin/posts${qs({ galleryId: p.galleryId ?? undefined, groupId: p.groupId ?? undefined, status: p.status, q: p.q, page: p.page })}`
    ),
  setPost: (id: number, input: { status?: "hidden" | "published"; isNotice?: boolean }) => request(`${B}/admin/posts/${id}`, { method: "PATCH", json: input }),
  closePoll: (postId: number) => request(`${B}/admin/posts/${postId}/poll/close`, { method: "POST" }),
  setComment: (id: number, status: "hidden" | "published") => request(`${B}/admin/comments/${id}`, { method: "PATCH", json: { status } }),
  stats: (p: { galleryId?: number | null; from: string; to: string }) =>
    request<{ stats: GalleryStats }>(`${B}/admin/stats${qs({ galleryId: p.galleryId ?? undefined, from: p.from, to: p.to })}`).then((r) => r.stats),
  adjustDuckryeok: (memberId: string, amount: number, note: string) =>
    request<{ profile: Profile }>(`${B}/admin/members/${encodeURIComponent(memberId)}/duckryeok`, { method: "POST", json: { amount, note } }),
}

// ---------- 화면 공통 ----------
// 날짜: 방금·n분 전·n시간 전, 오늘이 아니면 월.일
export function formatPostDate(iso: string) {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "방금"
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return `${Math.floor(diff / 3600)}시간 전`
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}.${md}`
}

export const galleryHref = (slug: string) => `/community/gallery/board/?slug=${encodeURIComponent(slug)}`
export const postHref = (id: number) => `/community/gallery/post/?id=${id}`
export const tagHref = (tag: string) => `/community/gallery/?tag=${encodeURIComponent(tag)}`
export const memberHref = (id: string) => `/community/gallery/user/?id=${encodeURIComponent(id)}`
export const squadHomeHref = (id: number | string) => `/community/gallery/squad/?id=${id}`

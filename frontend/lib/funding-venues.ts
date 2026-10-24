import { apiFetch } from "@/lib/api"
import { ApiError } from "@/lib/community-api"

// 대관 장소 (backend funding 서비스 /api/funding/venues). 아이노브코리아와 확보한 공간
// 펀딩 열기 2단계에서 장소로 고르고, 관리자 펀딩 관리 › 대관 장소에서 등록

export const VENUE_PARTNER = "아이노브코리아"

export interface VenueSpace {
  id: number
  name: string
  location: string
  address: string
  capacity: number
  area: string
  imageUrls: string[]
  availablePeriod: string
  priceGuide: string
  description: string
  partner: string
  isPublished: boolean
  sortOrder: number
}
export type VenueSpaceInput = Omit<VenueSpace, "id">

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
  if (!res.ok || data.success === false) throw new ApiError(data.errors?.join("\n") || data.error || "요청을 처리하지 못했습니다.", res.status)
  return data as T
}

export const fetchVenues = () => request<{ venues: VenueSpace[] }>("/api/funding/venues").then((r) => r.venues)

export const adminFetchVenues = () => request<{ venues: VenueSpace[] }>("/api/funding/admin/venues").then((r) => r.venues)

export const adminCreateVenue = (input: Partial<VenueSpaceInput>) =>
  request<{ venue: VenueSpace }>("/api/funding/admin/venues", { method: "POST", json: input }).then((r) => r.venue)

export const adminUpdateVenue = (id: number, input: Partial<VenueSpaceInput>) =>
  request<{ venue: VenueSpace }>(`/api/funding/admin/venues/${id}`, { method: "PATCH", json: input }).then((r) => r.venue)

export const adminDeleteVenue = (id: number) => request(`/api/funding/admin/venues/${id}`, { method: "DELETE" })

import { apiFetch } from "@/lib/api"

// 장소 검색 (backend web-search /api/web-search/places, 카카오 로컬 → 네이버 지역): 장소 이름이나 주소로 찾아 좌표까지 받음
// 관리자 팝업 등록·덕지순례 장소 등록에서 씀. 두 검색 키가 모두 안 되면 configured=false
export type PlaceResult = { name: string; category: string; address: string; jibunAddress: string; lat: number; lng: number }

export async function searchPlaces(query: string): Promise<{ configured: boolean; places: PlaceResult[] }> {
  const res = await apiFetch(`/api/web-search/places?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error || "장소를 찾지 못했어요. 잠시 후 다시 시도해주세요.")
  return { configured: Boolean(json.configured), places: json.places || [] }
}

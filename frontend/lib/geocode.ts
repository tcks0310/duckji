import { loadNaverMaps } from "@/components/map/naver-map"
import { loadScript } from "@/components/map/load-script"
import { searchPlaces } from "@/lib/place-search"

// 주소 → 좌표. 네이버 지도 Geocoder 로 먼저 찾고, 안 되면(NCP 앱에 Geocoding 이 꺼져 있는 등)
// 카카오 지도 주소 검색(카카오 앱에 카카오맵 사용 설정 필요) → 네이버 장소 검색 순으로 다시 찾음
// 관리자 팝업 등록·덕지순례 코스 편집에서 씀
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; road: string }> {
  // 카카오 주소 검색이 붙이는 "(건물 이름)" 은 빼고 찾음
  const query = address.replace(/\s*\([^)]*\)\s*$/, "").trim()
  try {
    return await geocodeWithMaps(query, address)
  } catch (e) {
    const kakao = await geocodeWithKakao(query).catch(() => null)
    if (kakao) return { ...kakao, road: kakao.road || address }
    const r = await searchPlaces(query).catch(() => null)
    const hit = r?.places[0]
    if (hit) return { lat: hit.lat, lng: hit.lng, road: hit.address || address }
    throw e
  }
}

async function geocodeWithMaps(query: string, address: string): Promise<{ lat: number; lng: number; road: string }> {
  const maps = await loadNaverMaps()
  if (!maps?.Service?.geocode) throw new Error("주소로 위치를 찾을 수 없어요. 지도를 눌러 위치를 직접 정해주세요.")
  return new Promise((resolve, reject) => {
    // Geocoding 이 꺼져 있으면 응답이 안 올 때도 있어 5초 뒤 포기
    const timer = setTimeout(() => reject(new Error("주소로 위치를 찾지 못했어요. 지도를 눌러 위치를 정해주세요.")), 5000)
    maps.Service.geocode({ query }, (status: unknown, response: any) => {
      clearTimeout(timer)
      const hit = status === maps.Service.Status.OK ? response?.v2?.addresses?.[0] : null
      if (!hit) return reject(new Error("주소로 위치를 찾지 못했어요. 도로명 주소로 다시 검색하거나 지도를 눌러 위치를 정해주세요."))
      resolve({ lat: Number(hit.y), lng: Number(hit.x), road: hit.roadAddress || hit.jibunAddress || address })
    })
  })
}

// 카카오 지도 SDK 의 주소 검색 (로그인용 JS 키를 같이 씀)
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ""
async function geocodeWithKakao(query: string): Promise<{ lat: number; lng: number; road: string }> {
  if (!KAKAO_JS_KEY) throw new Error("no kakao key")
  await loadScript("kakao-maps-sdk", `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&libraries=services&autoload=false`)
  const kakao = (window as any).kakao
  if (!kakao?.maps?.load) throw new Error("kakao maps unavailable")
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 5000)
    kakao.maps.load(() => {
      clearTimeout(timer)
      resolve()
    })
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 5000)
    new kakao.maps.services.Geocoder().addressSearch(query, (result: any[], status: string) => {
      clearTimeout(timer)
      const hit = status === kakao.maps.services.Status.OK ? result?.[0] : null
      if (!hit) return reject(new Error("not found"))
      resolve({ lat: Number(hit.y), lng: Number(hit.x), road: hit.road_address?.address_name || hit.address_name || "" })
    })
  })
}

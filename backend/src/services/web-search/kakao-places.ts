import type { PlaceItem } from "./naver"

// 카카오 로컬 검색 (REST API 키, 도보 경로와 같은 키·같은 '카카오맵 사용 설정')
// 장소 이름(키워드 검색)과 주소(주소 검색)를 함께 찾아 이름이 맞는 곳을 먼저 보여 줌. 하루 10만 건 무료
const BASE = "https://dapi.kakao.com/v2/local/search"

async function kakaoGet(restKey: string, path: string, params: Record<string, string>) {
  const res = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${restKey}` },
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`kakao ${path} ${res.status}`)
  return ((await res.json()) as { documents?: Record<string, any>[] }).documents || []
}

const valid = (p: PlaceItem) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > 30 && p.lat < 45 && p.lng > 120 && p.lng < 135

export async function kakaoPlaces(restKey: string, query: string): Promise<PlaceItem[]> {
  const [keyword, address] = await Promise.allSettled([
    kakaoGet(restKey, "keyword.json", { query, size: "7" }),
    kakaoGet(restKey, "address.json", { query, size: "3" }),
  ])
  if (keyword.status === "rejected" && address.status === "rejected") throw keyword.reason

  const places: PlaceItem[] = (keyword.status === "fulfilled" ? keyword.value : []).map((d) => ({
    name: String(d.place_name || ""),
    // "가정,생활 > 백화점 > AK플라자" 처럼 오므로 마지막 두 단계만
    category: String(d.category_name || "").split(" > ").slice(-2).join(" > "),
    address: String(d.road_address_name || d.address_name || ""),
    jibunAddress: String(d.address_name || ""),
    lat: Number(d.y),
    lng: Number(d.x),
  }))
  const addresses: PlaceItem[] = (address.status === "fulfilled" ? address.value : []).map((d) => {
    const road = d.road_address?.address_name || ""
    return {
      name: d.road_address?.building_name || road || d.address_name || "",
      category: "주소",
      address: road || d.address_name || "",
      jibunAddress: d.address?.address_name || d.address_name || "",
      lat: Number(d.y),
      lng: Number(d.x),
    }
  })
  // 주소로 친 경우엔 주소 결과를 맨 위에
  return [...addresses, ...places].filter(valid).slice(0, 8)
}

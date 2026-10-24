// 카카오맵 도보 경로 조회 (REST API 키, 카카오디벨로퍼스 앱 > 제품 설정 > 카카오맵 사용 설정 필요)
// 하루 1,000건 무료. 덕지순례 관리자가 코스를 저장할 때 장소 사이 구간마다 한 번씩만 부름
// 응답 모양이 문서마다 달라서 좌표 배열을 넓게 찾아 읽음: GeoJSON coordinates([[x,y]...]) · points · vertexes([x,y,x,y...])

export type LatLng = [number, number] // [위도, 경도]
export type WalkLeg = { path: LatLng[]; distanceM: number | null; durationS: number | null }

const ENDPOINTS = [
  (a: LatLng, b: LatLng) => `https://dapi.kakao.com/v2/routing/walk?start_x=${a[1]}&start_y=${a[0]}&end_x=${b[1]}&end_y=${b[0]}`,
  (a: LatLng, b: LatLng) => `https://dapi.kakao.com/v2/local/directions/walk.json?origin=${a[1]},${a[0]}&destination=${b[1]},${b[0]}`,
]

export class WalkRouteError extends Error {}

const inKorea = (lng: number, lat: number) => lng > 124 && lng < 132 && lat > 33 && lat < 39.5

// 응답 어디에 있든 경도·위도 쌍을 순서대로 모음
export function extractPath(body: unknown): LatLng[] {
  const out: LatLng[] = []
  const push = (x: unknown, y: unknown) => {
    const lng = Number(x)
    const lat = Number(y)
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !inKorea(lng, lat)) return
    const last = out[out.length - 1]
    if (last && last[0] === lat && last[1] === lng) return
    out.push([lat, lng])
  }
  const walk = (v: unknown, key = "") => {
    if (Array.isArray(v)) {
      // [x, y] 한 점
      if (v.length >= 2 && v.length <= 3 && v.every((n) => typeof n === "number")) return push(v[0], v[1])
      // vertexes: [x, y, x, y, ...]
      if (key === "vertexes" && v.every((n) => typeof n === "number")) {
        for (let i = 0; i + 1 < v.length; i += 2) push(v[i], v[i + 1])
        return
      }
      v.forEach((item) => walk(item, key))
      return
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>
      // { x, y } 점 (경로 점 배열 안에 있을 때만)
      if ((key === "points" || key === "path" || key === "coordinates") && "x" in o && "y" in o) return push(o.x, o.y)
      for (const [k, child] of Object.entries(o)) {
        // 출발·도착·경유지 설명이나 안내 문구 좌표는 경로가 아니라서 건너뜀
        if (/^(origin|destination|waypoints|start|end|bound|guides?)$/i.test(k)) continue
        walk(child, k)
      }
    }
  }
  walk(body)
  return out
}

function findNumber(body: unknown, names: string[]): number | null {
  let found: number | null = null
  const walk = (v: unknown) => {
    if (found !== null || !v || typeof v !== "object") return
    if (Array.isArray(v)) return v.forEach(walk)
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      if (names.includes(k) && typeof child === "number" && Number.isFinite(child)) {
        found = child
        return
      }
    }
    Object.values(v as Record<string, unknown>).forEach(walk)
  }
  walk(body)
  return found
}

export async function kakaoWalkLeg(restKey: string, a: LatLng, b: LatLng): Promise<WalkLeg> {
  let lastError = ""
  for (const url of ENDPOINTS) {
    const res = await fetch(url(a, b), { headers: { Authorization: `KakaoAK ${restKey}` }, signal: AbortSignal.timeout(8000) })
    const text = await res.text()
    if (!res.ok) {
      lastError = `${res.status} ${text.slice(0, 200)}`
      // 주소가 없는(404) 경우만 다음 주소로, 키·권한 오류는 바로 알림
      if (res.status === 404) continue
      throw new WalkRouteError(lastError)
    }
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      lastError = `JSON 아님: ${text.slice(0, 200)}`
      continue
    }
    const path = extractPath(body)
    if (path.length < 2) throw new WalkRouteError(`경로 좌표가 없어요: ${text.slice(0, 300)}`)
    return {
      path,
      distanceM: findNumber(body, ["distance", "totalDistance", "total_distance"]),
      durationS: findNumber(body, ["duration", "totalTime", "total_time", "time"]),
    }
  }
  throw new WalkRouteError(lastError || "도보 경로 API 를 찾지 못했어요")
}

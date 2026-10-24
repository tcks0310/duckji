import type { PopupEvent } from "@/data/popup-data"

export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  title: string
}

// 지도를 특정 위치로 옮길 때 씀. key 가 바뀔 때마다 한 번 이동 (같은 곳을 다시 눌러도 이동하도록)
export interface MapFocus {
  latitude: number
  longitude: number
  zoom?: number
  key: string
}

export interface MapProviderProps {
  markers: MapMarker[]
  language: string
  className?: string
  onSelectMarker?: (id: string) => void
  onClickMap?: () => void
  focus?: MapFocus | null
  selectedId?: string | null
}

// "37.5583° N, 127.1648° E" 형식의 좌표 문자열을 숫자로 변환 (API 응답이 없을 때 정적 데이터용)
function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const match = text.match(/(-?\d+(?:\.\d+)?)°?\s*([NS])[^\d-]*(-?\d+(?:\.\d+)?)°?\s*([EW])/i)
  if (!match) return null
  const latitude = Number(match[1]) * (match[2].toUpperCase() === "S" ? -1 : 1)
  const longitude = Number(match[3]) * (match[4].toUpperCase() === "W" ? -1 : 1)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export function popupToMarker(event: PopupEvent): MapMarker | null {
  const position =
    typeof event.latitude === "number" && typeof event.longitude === "number"
      ? { latitude: event.latitude, longitude: event.longitude }
      : parseCoordinates(event.coordinates || "")
  if (!position) return null
  return { id: event.id, title: event.venueName || event.title, ...position }
}

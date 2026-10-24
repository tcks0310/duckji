"use client"

import { useEffect, useRef } from "react"
import { loadNaverMaps } from "@/components/map/naver-map"

// 지도를 누르면 그 자리로 위치를 옮기는 작은 네이버 지도 (마커는 끌어서 옮길 수도 있음)
export function PointPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  // 지도를 불러오는 사이에 주소 검색으로 좌표가 먼저 정해져도 그 자리로 열리도록 최신 좌표를 기억
  const posRef = useRef({ lat, lng })
  posRef.current = { lat, lng }

  useEffect(() => {
    let cancelled = false
    loadNaverMaps()
      .then((maps) => {
        if (cancelled || !ref.current) return
        const { lat: la, lng: ln } = posRef.current
        const center = new maps.LatLng(la ?? 37.5665, ln ?? 126.978)
        const map = new maps.Map(ref.current, { center, zoom: la === null ? 11 : 17 })
        const marker = new maps.Marker({ map: la === null ? null : map, position: center, draggable: true })
        maps.Event.addListener(map, "click", (e: any) => pickRef.current(e.coord.lat(), e.coord.lng()))
        maps.Event.addListener(marker, "dragend", (e: any) => pickRef.current(e.coord.lat(), e.coord.lng()))
        mapRef.current = map
        markerRef.current = marker
      })
      .catch(() => {})
    return () => {
      cancelled = true
      mapRef.current?.destroy?.()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 좌표가 바뀌면 마커와 지도 가운데를 옮김
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || lat === null || lng === null) return
    const maps = window.naver.maps
    const pos = new maps.LatLng(lat, lng)
    marker.setPosition(pos)
    if (!marker.getMap()) marker.setMap(map)
    // 주소 검색 뒤 핀 자리가 바로 보이게 가운데로 옮기고 가까이 확대
    map.setCenter(pos)
    if (map.getZoom() < 17) map.setZoom(17)
  }, [lat, lng])

  return <div ref={ref} className="w-full h-64 rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900" />
}

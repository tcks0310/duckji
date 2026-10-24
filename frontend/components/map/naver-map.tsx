"use client"

import { useEffect, useRef, useState } from "react"
import { loadScript } from "./load-script"
import type { MapProviderProps } from "./types"

// 네이버 클라우드 플랫폼 > Maps > Application 의 Client ID (Dynamic Map 사용 체크, Web 서비스 URL 에 사이트 도메인 등록)
export const NAVER_MAP_KEY = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || ""

declare global {
  interface Window {
    naver: any
  }
}

// geocoder: 관리자 덕지순례 코스 편집에서 주소 → 좌표 찾기에 씀 (NCP 앱에 Geocoding 이 꺼져 있으면 그 기능만 실패)
export async function loadNaverMaps(): Promise<any> {
  await loadScript("naver-maps-sdk", `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(NAVER_MAP_KEY)}&submodules=geocoder`)
  return window.naver.maps
}

export function NaverMap({ markers, className, onSelectMarker, onClickMap, focus, selectedId }: MapProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRefs = useRef<Map<string, any>>(new Map())
  // 지도가 다 그려진 뒤에 이동·선택 표시를 적용하려고 그릴 때마다 값을 바꿈
  const [ready, setReady] = useState(0)

  useEffect(() => {
    let cancelled = false
    const created = new Map<string, any>()
    let map: any = null

    loadNaverMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(markers[0].latitude, markers[0].longitude),
          zoom: 16,
        })
        if (onClickMap) maps.Event.addListener(map, "click", onClickMap)
        const bounds = new maps.LatLngBounds()
        for (const item of markers) {
          const position = new maps.LatLng(item.latitude, item.longitude)
          const marker = new maps.Marker({ map, position, title: item.title })
          if (onSelectMarker) maps.Event.addListener(marker, "click", () => onSelectMarker(item.id))
          bounds.extend(position)
          created.set(item.id, marker)
        }
        if (markers.length > 1) map.fitBounds(bounds)
        mapRef.current = map
        markerRefs.current = created
        setReady((n) => n + 1)
      })
      .catch((error) => console.error(error))

    return () => {
      cancelled = true
      created.forEach((marker) => marker.setMap(null))
      mapRef.current = null
      markerRefs.current = new Map()
      map?.destroy?.()
    }
  }, [markers, onSelectMarker, onClickMap])

  // 목록에서 고른 팝업·지역으로 지도 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const maps = window.naver.maps
    map.morph(new maps.LatLng(focus.latitude, focus.longitude), focus.zoom ?? 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, ready])

  // 고른 팝업의 마커를 위로 올리고 튀게 표시
  useEffect(() => {
    if (!mapRef.current) return
    const maps = window.naver.maps
    markerRefs.current.forEach((marker, id) => {
      const active = id === selectedId
      marker.setZIndex(active ? 100 : 0)
      marker.setAnimation(active ? maps.Animation.BOUNCE : null)
    })
  }, [selectedId, ready])

  return <div ref={containerRef} className={className} />
}

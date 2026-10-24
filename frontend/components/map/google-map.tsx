"use client"

import { useEffect, useRef, useState } from "react"
import { loadScript } from "./load-script"
import type { MapProviderProps } from "./types"

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

export async function loadGoogleMaps(language: string): Promise<any> {
  const params = new URLSearchParams({ key: GOOGLE_MAPS_KEY, language, region: "KR", v: "weekly" })
  await loadScript("google-maps-sdk", `https://maps.googleapis.com/maps/api/js?${params}`)
  return (window as any).google.maps
}

export function GoogleMap({ markers, language, className, onSelectMarker, onClickMap, focus, selectedId }: MapProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRefs = useRef<Map<string, any>>(new Map())
  // 지도가 다 그려진 뒤에 이동·선택 표시를 적용하려고 그릴 때마다 값을 바꿈
  const [ready, setReady] = useState(0)

  useEffect(() => {
    let cancelled = false
    const created = new Map<string, any>()

    loadGoogleMaps(language)
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        const map = new maps.Map(containerRef.current, {
          center: { lat: markers[0].latitude, lng: markers[0].longitude },
          zoom: 16,
        })
        if (onClickMap) map.addListener("click", onClickMap)
        const bounds = new maps.LatLngBounds()
        for (const item of markers) {
          const position = { lat: item.latitude, lng: item.longitude }
          const marker = new maps.Marker({ map, position, title: item.title })
          if (onSelectMarker) marker.addListener("click", () => onSelectMarker(item.id))
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
    }
  }, [markers, language, onSelectMarker, onClickMap])

  // 목록에서 고른 팝업·지역으로 지도 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.panTo({ lat: focus.latitude, lng: focus.longitude })
    map.setZoom(focus.zoom ?? 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, ready])

  // 고른 팝업의 마커를 위로 올리고 튀게 표시
  useEffect(() => {
    if (!mapRef.current) return
    const maps = (window as any).google.maps
    markerRefs.current.forEach((marker, id) => {
      const active = id === selectedId
      marker.setZIndex(active ? 100 : 0)
      marker.setAnimation(active ? maps.Animation.BOUNCE : null)
    })
  }, [selectedId, ready])

  return <div ref={containerRef} className={className} />
}

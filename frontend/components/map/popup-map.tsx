"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PopupEvent } from "@/data/popup-data"
import { getSiteLanguage } from "@/lib/site-language"
import { trackMapClick } from "@/lib/map-stats"
import { GoogleMap, GOOGLE_MAPS_KEY } from "./google-map"
import { NaverMap, NAVER_MAP_KEY } from "./naver-map"
import { popupToMarker, type MapFocus } from "./types"

type Provider = "naver" | "google"

// 한국어는 네이버 지도, 그 외 언어는 구글맵. 한쪽 키만 있으면 그쪽을 씁니다.
function chooseProvider(language: string): Provider | null {
  const preferred: Provider = language === "ko" ? "naver" : "google"
  const available = { naver: Boolean(NAVER_MAP_KEY), google: Boolean(GOOGLE_MAPS_KEY) }
  if (available[preferred]) return preferred
  if (available.naver) return "naver"
  if (available.google) return "google"
  return null
}

interface PopupMapProps {
  events: PopupEvent[]
  className?: string
  onSelectEvent?: (event: PopupEvent) => void
  focus?: MapFocus | null
  selectedId?: string | null
}

// 팝업 위치를 실제 지도에 표시합니다. 지도 키가 없거나 좌표가 없으면 아무것도 그리지 않습니다.
export function PopupMap({ events, className, onSelectEvent, focus, selectedId }: PopupMapProps) {
  const [language, setLanguage] = useState<string | null>(null)

  useEffect(() => {
    setLanguage(getSiteLanguage())
  }, [])

  // events 배열이 매번 새로 만들어져도 좌표가 같으면 지도를 다시 그리지 않도록 문자열 키로 고정
  const computed = events.map(popupToMarker).filter((marker): marker is NonNullable<typeof marker> => marker !== null)
  const markerKey = JSON.stringify(computed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const markers = useMemo(() => computed, [markerKey])

  const eventsRef = useRef(events)
  eventsRef.current = events
  const onSelectRef = useRef(onSelectEvent)
  onSelectRef.current = onSelectEvent
  // 마커 클릭은 항상 집계(인기 순위용)하고, onSelectEvent 가 있으면 함께 호출
  const handleSelect = useMemo(
    () => (id: string) => {
      trackMapClick("marker", id)
      const event = eventsRef.current.find((item) => item.id === id)
      if (event) onSelectRef.current?.(event)
    },
    []
  )
  // 팝업 하나만 표시된 지도(상세 화면)는 지도 자체를 눌러도 그 팝업 클릭으로 집계
  const singleId = markers.length === 1 ? markers[0].id : null
  const handleClickMap = useMemo(() => (singleId ? () => trackMapClick("map", singleId) : undefined), [singleId])

  if (language === null || markers.length === 0) return null
  const provider = chooseProvider(language)
  if (!provider) return null

  // notranslate: 사이트 번역기(Google 번역)가 지도 안의 글자를 건드리지 않도록 함
  const props = {
    markers,
    language,
    className: `notranslate ${className || ""}`,
    onSelectMarker: handleSelect,
    onClickMap: handleClickMap,
    focus,
    selectedId,
  }
  return provider === "naver" ? <NaverMap {...props} /> : <GoogleMap {...props} />
}

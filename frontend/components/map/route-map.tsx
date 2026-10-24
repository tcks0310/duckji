"use client"

import { useEffect, useRef, useState } from "react"
import { legBetween, stepPalette, type RouteLeg } from "@/lib/pilgrimage"
import { getSiteLanguage } from "@/lib/site-language"
import { GOOGLE_MAPS_KEY, loadGoogleMaps } from "./google-map"
import { loadNaverMaps, NAVER_MAP_KEY } from "./naver-map"

// 순서가 있는 동선 지도 (덕지순례 코스): 1→N 번호 마커 + 순서대로 잇는 선
// legs(걷는 길)가 있는 구간은 실제 길을 따라, 없는 구간은 직선으로 이음. 구간 선 색은 출발 장소 번호 색
// 한국어는 네이버 지도, 그 외 언어는 구글맵. 지도 키가 없거나 불러오지 못하면 fallback 을 보여 줌

// stamped: 도장을 찍은 장소 (도장 색 마커)
export type RoutePoint = { lat: number; lng: number; title: string; stamped?: boolean }

// 마커는 1번부터 무지개 색(빨주노초파남보·흰·검). 도장 찍은 곳은 색은 그대로 두고 숫자 대신 ✓ + 두꺼운 테두리
const COLOR = { outline: "#18181b" }
const colorOf = (i: number) => stepPalette(i)

type Provider = "naver" | "google"
function chooseProvider(language: string): Provider | null {
  const preferred: Provider = language === "ko" ? "naver" : "google"
  const available = { naver: Boolean(NAVER_MAP_KEY), google: Boolean(GOOGLE_MAPS_KEY) }
  if (available[preferred]) return preferred
  if (available.naver) return "naver"
  if (available.google) return "google"
  return null
}

// 네이버 마커 모양 (HTML)
const naverPin = (n: number, color: { hex: string; text: string }, stamped?: boolean) =>
  stamped
    ? `<div style="width:28px;height:28px;border-radius:9999px;background:${color.hex};border:3px solid #fff;color:${color.text};font:900 15px/22px sans-serif;text-align:center;box-shadow:0 0 0 2px #18181b,0 1px 4px rgba(0,0,0,.5)">✓</div>`
    : `<div style="width:28px;height:28px;border-radius:9999px;background:${color.hex};border:2px solid ${color.hex === "#ffffff" ? "#18181b" : "#fff"};color:${color.text};font:700 13px/24px sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.4)">${n}</div>`

export function RouteMap({
  points,
  className,
  onSelect,
  fallback,
  legs,
}: {
  points: RoutePoint[]
  legs?: (RouteLeg | null)[]
  className?: string
  onSelect?: (index: number) => void
  fallback?: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [provider, setProvider] = useState<Provider | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [language, setLanguage] = useState("ko")
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const key = JSON.stringify(points.map((p) => [p.lat, p.lng, p.title, Boolean(p.stamped)]))
  const legsKey = JSON.stringify((legs || []).map((l) => (l ? [l.from, l.to, l.path.length] : null)))
  // 구간마다 [위도, 경도] 점 목록: 걷는 길이 있으면 그 길, 없으면 두 장소 직선
  const segments = () =>
    points.slice(0, -1).map((a, i) => {
      const b = points[i + 1]
      const leg = legBetween(legs, a, b)
      const path: [number, number][] = leg ? [[a.lat, a.lng], ...leg.path, [b.lat, b.lng]] : [[a.lat, a.lng], [b.lat, b.lng]]
      return { path, color: stepPalette(i).hex, walk: Boolean(leg) }
    })

  useEffect(() => {
    const lang = getSiteLanguage()
    setLanguage(lang)
    setProvider(chooseProvider(lang))
  }, [])

  useEffect(() => {
    if (!provider || !points.length) return
    let cancelled = false
    const cleanups: (() => void)[] = []
    setFailed(false)

    const draw = async () => {
      const el = containerRef.current
      if (!el) return
      if (provider === "naver") {
        const maps = await loadNaverMaps()
        if (cancelled) return
        const path = points.map((p) => new maps.LatLng(p.lat, p.lng))
        const map = new maps.Map(el, { center: path[0], zoom: 15 })
        // 흰색·노란색 구간도 보이도록 어두운 테두리 선을 먼저 깔고 그 위에 색 선
        const lines = segments().flatMap((seg) => {
          const segPath = seg.path.map(([la, ln]) => new maps.LatLng(la, ln))
          const opts = { map, path: segPath, strokeLineCap: "round", strokeLineJoin: "round", strokeStyle: seg.walk ? "solid" : "shortdash" }
          return [
            new maps.Polyline({ ...opts, strokeColor: COLOR.outline, strokeWeight: 8, strokeOpacity: 0.55 }),
            new maps.Polyline({ ...opts, strokeColor: seg.color, strokeWeight: 5, strokeOpacity: 0.95 }),
          ]
        })
        const markers = points.map((p, i) => {
          const marker = new maps.Marker({
            map,
            position: path[i],
            title: `${i + 1}. ${p.title}`,
            zIndex: 100 + points.length - i,
            icon: { content: naverPin(i + 1, colorOf(i), p.stamped), anchor: new maps.Point(14, 14) },
          })
          maps.Event.addListener(marker, "click", () => onSelectRef.current?.(i))
          return marker
        })
        if (path.length > 1) {
          const bounds = new maps.LatLngBounds(path[0], path[0])
          path.forEach((p: any) => bounds.extend(p))
          map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
        }
        cleanups.push(() => {
          markers.forEach((m) => m.setMap(null))
          lines.forEach((l: any) => l.setMap(null))
          map.destroy?.()
        })
      } else {
        const maps = await loadGoogleMaps(language)
        if (cancelled) return
        const path = points.map((p) => ({ lat: p.lat, lng: p.lng }))
        const map = new maps.Map(el, { center: path[0], zoom: 15, mapTypeControl: false, streetViewControl: false })
        const lines = segments().flatMap((seg) => {
          const segPath = seg.path.map(([la, ln]) => ({ lat: la, lng: ln }))
          return [
            new maps.Polyline({ map, path: segPath, strokeColor: COLOR.outline, strokeWeight: 8, strokeOpacity: 0.55 }),
            new maps.Polyline({ map, path: segPath, strokeColor: seg.color, strokeWeight: 5, strokeOpacity: 0.95 }),
          ]
        })
        const markers = points.map((p, i) => {
          const marker = new maps.Marker({
            map,
            position: path[i],
            title: `${i + 1}. ${p.title}`,
            zIndex: 100 + points.length - i,
            label: { text: p.stamped ? "✓" : String(i + 1), color: colorOf(i).text, fontWeight: "700", fontSize: "13px" },
            icon: { path: maps.SymbolPath.CIRCLE, scale: 13, fillColor: colorOf(i).hex, fillOpacity: 1, strokeColor: p.stamped ? "#18181b" : colorOf(i).hex === "#ffffff" ? "#18181b" : "#ffffff", strokeWeight: p.stamped ? 4 : 2 },
          })
          marker.addListener("click", () => onSelectRef.current?.(i))
          return marker
        })
        if (path.length > 1) {
          const bounds = new maps.LatLngBounds()
          path.forEach((p) => bounds.extend(p))
          map.fitBounds(bounds, 40)
        }
        cleanups.push(() => {
          markers.forEach((m) => m.setMap(null))
          lines.forEach((l: any) => l.setMap(null))
        })
      }
    }

    draw().catch((e) => {
      console.error(e)
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
      cleanups.forEach((fn) => fn())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, key, legsKey, language])

  if (provider === undefined) return null
  if (!provider || failed || !points.length) return <>{fallback ?? null}</>
  // notranslate: 사이트 번역기가 지도 안 글자를 건드리지 않도록
  return <div ref={containerRef} className={`notranslate ${className || ""}`} />
}

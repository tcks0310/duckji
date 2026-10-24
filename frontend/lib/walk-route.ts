import { apiFetch } from "@/lib/api"
import type { RouteLeg } from "@/lib/pilgrimage"

// 장소 순서대로 걷는 길 찾기 (backend web-search /api/web-search/walk-route, 관리자만, 카카오 도보 경로)
// 카카오 REST 키가 서버에 없으면 configured=false → 직선으로 보여 줌
export async function fetchWalkRoute(points: { lat: number; lng: number }[]): Promise<{ configured: boolean; legs: (RouteLeg | null)[]; error: string }> {
  const res = await apiFetch("/api/web-search/walk-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  })
  const json = await res.json().catch(() => null)
  // 서버 적용 전(관리자 확인 설정이 아직 없음)에는 401 → 키 없음과 같게 직선으로
  if (res.status === 401) return { configured: false, legs: [], error: "" }
  if (!res.ok || !json?.success) throw new Error(json?.error || "걷는 길을 찾지 못했어요.")
  return { configured: Boolean(json.configured), legs: json.legs || [], error: json.error || "" }
}

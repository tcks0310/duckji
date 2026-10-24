import type { Popup } from "../types"

// 기존 팝업과 겹치는지: 기간이 겹치고, 제목이나 장소가 비슷하면 중복 후보
// (같은 장소·기간의 기존 팝업이 있으면 중복 경고 — 관리자 센터 기능 정의서 4.3.2)

const normalize = (s: string) => s.toLowerCase().replace(/[\s()[\]{}&·,.\-_'"!?~:]/g, "")

// 글자 2개씩 묶은 조각의 겹침 비율 (0~1). 한글 제목처럼 띄어쓰기가 달라도 비교됨
export function similarity(a: string, b: string) {
  const x = normalize(a)
  const y = normalize(b)
  if (!x || !y) return 0
  if (x.includes(y) || y.includes(x)) return 1
  const grams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const gx = grams(x)
  const gy = grams(y)
  let common = 0
  for (const g of gx) if (gy.has(g)) common++
  return (2 * common) / (gx.size + gy.size || 1)
}

const overlaps = (aStart: string | null, aEnd: string | null, bStart: string, bEnd: string) =>
  !aStart || !aEnd ? true : aStart <= bEnd && bStart <= aEnd

export interface DuplicateMatch {
  popupId: string
  title: string
  reason: string
}

export function findDuplicates(
  target: { title: string; location: string; venueName: string; startDate: string | null; endDate: string | null },
  popups: Popup[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = []
  for (const p of popups) {
    if (!overlaps(target.startDate, target.endDate, p.startDate, p.endDate)) continue
    const titleScore = similarity(target.title, p.title)
    const placeScore = Math.max(
      target.location && p.location ? similarity(target.location, p.location) : 0,
      target.venueName && p.venueName ? similarity(target.venueName, p.venueName) : 0
    )
    if (titleScore >= 0.6) matches.push({ popupId: p.id, title: p.title, reason: `제목 유사도 ${Math.round(titleScore * 100)}%` })
    else if (placeScore >= 0.8 && titleScore >= 0.3) matches.push({ popupId: p.id, title: p.title, reason: "같은 장소·겹치는 기간" })
  }
  return matches
}

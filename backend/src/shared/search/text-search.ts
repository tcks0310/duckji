// 통합 검색용 SQL 조각 (팝업·펀딩·게시글 등 서비스마다 같은 기준으로 정확도 점수를 매김)
// 점수: 칸 값이 검색어와 같음 100 > 검색어로 시작 60 > 검색어 포함 40 (× 칸 가중치)
// 띄어쓰기를 지운 값끼리도 비교 (나혼자만레벨업 = 나 혼자만 레벨업)
// 여러 단어면 단어마다 어느 칸엔가 있어야 결과로 침

export interface SearchColumn {
  sql: string // 컬럼 또는 식 (예: "p.title")
  weight: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export function normalizeSearchQuery(raw: string | undefined | null) {
  return (raw || "").trim().replace(/\s+/g, " ").slice(0, 100)
}

/**
 * 검색 조건과 점수 식을 만듭니다. params 배열에 값을 넣고 $번호를 씁니다.
 * 반환: { where, score } — WHERE 절에 where 를 AND 로, SELECT 에 score AS search_score 로 넣으면 됨
 */
export function buildTextSearch(query: string, columns: SearchColumn[], params: unknown[]) {
  const q = normalizeSearchQuery(query).toLowerCase()
  const compact = q.replace(/\s+/g, "")
  const tokens = q.split(" ").filter(Boolean).slice(0, 5)

  const p = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  const exact = p(q)
  const exactCompact = p(compact)
  const prefix = p(`${escapeLike(q)}%`)
  const prefixCompact = p(`${escapeLike(compact)}%`)
  const contains = p(`%${escapeLike(q)}%`)
  const containsCompact = p(`%${escapeLike(compact)}%`)

  const lowered = (c: SearchColumn) => `lower(coalesce(${c.sql}, ''))`
  const squeezed = (c: SearchColumn) => `replace(${lowered(c)}, ' ', '')`

  const score = columns
    .map(
      (c) => `(CASE
        WHEN ${lowered(c)} = ${exact} OR ${squeezed(c)} = ${exactCompact} THEN ${100 * c.weight}
        WHEN ${lowered(c)} LIKE ${prefix} OR ${squeezed(c)} LIKE ${prefixCompact} THEN ${60 * c.weight}
        WHEN ${lowered(c)} LIKE ${contains} OR ${squeezed(c)} LIKE ${containsCompact} THEN ${40 * c.weight}
        ELSE 0 END)`
    )
    .join(" + ")

  const wholeMatch = columns.map((c) => `${squeezed(c)} LIKE ${containsCompact}`).join(" OR ")
  const tokenMatches = tokens.map((tok) => {
    const pat = p(`%${escapeLike(tok)}%`)
    return `(${columns.map((c) => `${lowered(c)} LIKE ${pat}`).join(" OR ")})`
  })
  const where = `((${wholeMatch}) OR (${tokenMatches.join(" AND ") || "false"}))`

  return { where, score: `(${score})` }
}

/** 메모리 저장소(로컬 개발)용: 같은 기준의 점수 */
export function textSearchScore(query: string, values: { text: string | null | undefined; weight: number }[]) {
  const q = normalizeSearchQuery(query).toLowerCase()
  if (!q) return 0
  const compact = q.replace(/\s+/g, "")
  const tokens = q.split(" ").filter(Boolean)
  const vals = values.map((v) => ({ t: (v.text || "").toLowerCase(), c: (v.text || "").toLowerCase().replace(/\s+/g, ""), w: v.weight }))
  const whole = vals.some((v) => v.c.includes(compact))
  const allTokens = tokens.every((tok) => vals.some((v) => v.t.includes(tok)))
  if (!whole && !allTokens) return 0
  let score = 0
  for (const v of vals) {
    if (v.t === q || v.c === compact) score += 100 * v.w
    else if (v.t.startsWith(q) || v.c.startsWith(compact)) score += 60 * v.w
    else if (v.t.includes(q) || v.c.includes(compact)) score += 40 * v.w
  }
  return score || 1
}

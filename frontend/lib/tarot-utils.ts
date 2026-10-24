import tarotCardsData from "@/data/tarot-cards.json"
import relationsData from "@/data/relations.json"
import tarotConfig from "@/data/tarot-config.json"
import { TarotCard, Season, DrawnCard, QuestionKey, QuestionOption, RelationType, RelationBadgeInfo, TarotHistoryRecord, TarotStampState } from "@/types/tarot"
import { claimTarotDaily } from "@/lib/rewards"

export const TAROT_CARDS: TarotCard[] = tarotCardsData as TarotCard[]

export const SEASONS: { key: Season; name: string; color: string; borderClass: string; bgClass: string }[] = [
  { key: "spring", name: "봄", color: "#FFB5D5", borderClass: "border-pink-400/80", bgClass: "from-pink-500/10 to-pink-900/20" },
  { key: "summer", name: "여름", color: "#FF6B6B", borderClass: "border-rose-500/80", bgClass: "from-rose-500/10 to-rose-900/20" },
  { key: "autumn", name: "가을", color: "#F5C451", borderClass: "border-amber-400/80", bgClass: "from-amber-500/10 to-amber-900/20" },
  { key: "winter", name: "겨울", color: "#67E8F9", borderClass: "border-cyan-400/80", bgClass: "from-cyan-500/10 to-cyan-900/20" }
]

export const QUESTIONS: QuestionOption[] = [
  { key: "love", label: "연애·속마음", emoji: "💘", description: "그 사람의 진짜 마음과 우리 사이의 기류" },
  { key: "fandom", label: "덕질·최애", emoji: "⭐", description: "최애와의 운명적 만남 & 굿즈 뽑기 운세" },
  { key: "money", label: "지름·재물", emoji: "💸", description: "오늘의 소비 밸런스와 지갑 지키기" },
  { key: "relation", label: "친구·관계", emoji: "🤝", description: "주변 사람들과의 케미와 원만한 소통 팁" },
  { key: "challenge", label: "티켓팅·도전", emoji: "🎫", description: "오픈런, 티켓팅, 새로운 시도의 성공 예감" }
]

export const RELATION_BADGE_INFO_MAP: Record<RelationType, RelationBadgeInfo> = {
  "합": {
    type: "합",
    emoji: "🧲",
    title: "자석처럼 딱 붙은 사이 (합)",
    description: "찰떡궁합, 서로에게 강하게 끌리는 중이에요.",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  },
  "충": {
    type: "충",
    emoji: "🚗",
    title: "범퍼카처럼 쾅! (충)",
    description: "자존심이 부딪히는 중이에요. 한 템포 쉬어가는 센스가 필요해요.",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40"
  },
  "형": {
    type: "형",
    emoji: "🔒",
    title: "서로 째려보는 창살 (형)",
    description: "서로를 고치려다 지칠 수 있어요. 있는 그대로를 인정해줘요.",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40"
  },
  "해": {
    type: "해",
    emoji: "🥢",
    title: "뒤에서 콕 찌르기 (해)",
    description: "웃고 있지만 서운한 게 쌓이는 중이에요. 솔직한 대화가 약이에요.",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40"
  },
  "파": {
    type: "파",
    emoji: "🥛",
    title: "금 간 유리잔 (파)",
    description: "약속이나 믿음에 살짝 금이 간 상태예요. 세심한 확인이 필요해요.",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  "원진": {
    type: "원진",
    emoji: "🙅",
    title: "등 돌리고 삐침 (원진)",
    description: "밉지만 자꾸 신경 쓰이는 사이! 적당한 거리 두기가 좋아요.",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
  },
  "역마": {
    type: "역마",
    emoji: "🧳",
    title: "캐리어 끌고 출발 (역마)",
    description: "이동과 원정 덕질, 새로운 장소로 떠나기 좋은 기운이에요!",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40"
  },
  "평온": {
    type: "평온",
    emoji: "🍃",
    title: "물 흐르듯 평온한 기운",
    description: "편안하고 무탈하게 흘러가는 안정적인 에너지예요.",
    badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700"
  }
}

export const DISCLAIMER_TEXT = "덕지 타로는 재미로 즐기는 캐릭터 콘텐츠예요. 중요한 결정은 스스로, 그리고 전문가와 함께 해주세요."

export const INTRO_THREE_LINES = [
  "한자 몰라도 괜찮아요.",
  "그림 속 덕지·덕순이가 알려줄게요.",
  "카드 4장이면 속마음과 겉모습이 보여요."
]

// 88-card Deck Generator (22 cards * 4 seasons)
export function create88Deck(): Array<{ card: TarotCard; season: Season }> {
  const deck: Array<{ card: TarotCard; season: Season }> = []
  const seasons: Season[] = ["spring", "summer", "autumn", "winter"]
  
  for (const season of seasons) {
    for (const card of TAROT_CARDS) {
      deck.push({ card, season })
    }
  }
  return deck
}

// 4-card drawing logic
export function draw4Cards(): DrawnCard[] {
  const deck = create88Deck()
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = deck[i]
    deck[i] = deck[j]
    deck[j] = temp
  }

  const selected = deck.slice(0, 4)
  return selected.map((item, idx) => ({
    ...item.card,
    season: item.season,
    position: (idx + 1) as 1 | 2 | 3 | 4
  }))
}

// Check combo type
export function checkComboType(cards: DrawnCard[]): "normal" | "double" | "triple" | "all_season" {
  const countMap: Record<number, number> = {}
  cards.forEach(c => {
    countMap[c.no] = (countMap[c.no] || 0) + 1
  })
  const maxCount = Math.max(...Object.values(countMap))
  if (maxCount >= 4) return "all_season"
  if (maxCount === 3) return "triple"
  if (maxCount === 2) return "double"
  return "normal"
}

// Check Hanja match for relations
function extractFirstHanjaChar(hanja: string): string {
  return hanja.charAt(0)
}

export function checkRelationBetweenCards(cardA: TarotCard, cardB: TarotCard): RelationBadgeInfo {
  const charA = extractFirstHanjaChar(cardA.hanja)
  const charB = extractFirstHanjaChar(cardB.hanja)

  // Check specific Travel (역마) combination (인, 신, 사, 해)
  const yeokmaChars = ["寅", "申", "巳", "亥"]
  if (yeokmaChars.includes(charA) && yeokmaChars.includes(charB)) {
    // If not matching higher priority conflict, it can be yeokma
  }

  // Priority: 충 > 형 > 합 > 원진 > 해 > 파
  const priorityList: Array<"충" | "형" | "합" | "원진" | "해" | "파"> = ["충", "형", "합", "원진", "해", "파"]
  const rels = relationsData as Record<string, string[][]>

  for (const relType of priorityList) {
    const pairs = rels[relType]
    if (pairs) {
      for (const pair of pairs) {
        if ((pair[0] === charA && pair[1] === charB) || (pair[0] === charB && pair[1] === charA)) {
          return RELATION_BADGE_INFO_MAP[relType]
        }
      }
    }
  }

  if (yeokmaChars.includes(charA) && yeokmaChars.includes(charB)) {
    return RELATION_BADGE_INFO_MAP["역마"]
  }

  return RELATION_BADGE_INFO_MAP["평온"]
}

// Generate Comic Rank Badge based on card combinations
export function getComicRankBadge(cards: DrawnCard[]): string {
  const combo = checkComboType(cards)
  if (combo === "all_season") return "👑 사계절 전설의 성골"
  if (combo === "triple") return "✨ 황금 럭키 스타"
  if (combo === "double") return "🍀 행운의 더블 득템"

  const hasFire = cards.some(c => c.element === "화(火)")
  const hasWater = cards.some(c => c.element === "수(水)")
  const hasMetal = cards.some(c => c.element === "금(金)")
  const hasWood = cards.some(c => c.element === "목(木)")
  const hasEarth = cards.some(c => c.element === "토(土)")

  if (hasFire && hasMetal) return "🔥 오늘도 존버 중"
  if (hasWater && hasWood) return "🌱 쑥쑥 자라는 덕력"
  if (hasFire && hasEarth) return "💖 포근한 힐링 덕후"
  if (hasMetal && hasWater) return "💎 깐깐한 레어템 수집가"
  return "⭐ 슬기로운 덕질러"
}

// Local Storage Helpers
const STAMP_STORAGE_KEY = "dukji_tarot_stamps"
const HISTORY_STORAGE_KEY = "dukji_tarot_history"

export function getStoredTarotStamps(): TarotStampState {
  if (typeof window === "undefined") {
    return { stamps: [], collectedCombos: { double: 0, triple: 0, allSeason: 0 } }
  }
  try {
    const raw = localStorage.getItem(STAMP_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return { stamps: [], collectedCombos: { double: 0, triple: 0, allSeason: 0 } }
}

export function saveTarotStamp(type: "single" | "draw" | "dice", combo: "normal" | "double" | "triple" | "all_season" = "normal"): { isNew: boolean; currentStamps: number; gainedDP: number } {
  if (typeof window === "undefined") return { isNew: false, currentStamps: 0, gainedDP: 0 }
  
  const today = new Date().toISOString().slice(0, 10)
  const current = getStoredTarotStamps()

  let isAlreadyDoneToday = false
  if (type === "single" && current.lastSingleDate === today) isAlreadyDoneToday = true
  if (type === "draw" && current.lastDrawDate === today) isAlreadyDoneToday = true
  if (type === "dice" && current.lastDiceDate === today) isAlreadyDoneToday = true

  let gainedDP = 0
  if (type === "draw") gainedDP = tarotConfig.dailyDrawDP
  if (type === "single") gainedDP = tarotConfig.dailySingleCardDP
  if (type === "dice") gainedDP = tarotConfig.dailyDiceDP

  if (!isAlreadyDoneToday) {
    current.stamps.push({ date: today, type, combo })
    if (type === "single") current.lastSingleDate = today
    if (type === "draw") current.lastDrawDate = today
    if (type === "dice") current.lastDiceDate = today

    if (combo === "double") current.collectedCombos.double += 1
    if (combo === "triple") current.collectedCombos.triple += 1
    if (combo === "all_season") current.collectedCombos.allSeason += 1

    try {
      localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify(current))

      // 덕지 포인트: 로그인한 회원 계정에 적립 (비로그인이면 적립되지 않음, 종류마다 하루 한 번·금액은 서버 규칙)
      if (gainedDP > 0) void claimTarotDaily(type)
    } catch (e) {
      console.error(e)
    }

    return { isNew: true, currentStamps: current.stamps.length, gainedDP }
  }

  return { isNew: false, currentStamps: current.stamps.length, gainedDP: 0 }
}

export function saveTarotHistory(record: TarotHistoryRecord) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    const list: TarotHistoryRecord[] = raw ? JSON.parse(raw) : []
    list.unshift(record)
    // Keep last 30
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 30)))
  } catch (e) {
    console.error(e)
  }
}

export function getTarotHistory(): TarotHistoryRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

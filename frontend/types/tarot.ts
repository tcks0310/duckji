export type Season = "spring" | "summer" | "autumn" | "winter"

export interface TarotCard {
  no: number
  id: string
  hanja: string
  name: string
  character: string
  element?: string
  keywords: string[]
  short: string
  inner: string
  outer: string
  q: {
    love: string
    fandom: string
    money: string
    relation: string
    challenge: string
  }
  tip: string
  image: string
  goodsUrl?: string
}

export type QuestionKey = "love" | "fandom" | "money" | "relation" | "challenge"

export interface QuestionOption {
  key: QuestionKey
  label: string
  emoji: string
  description: string
}

export interface DrawnCard extends TarotCard {
  season: Season
  position: 1 | 2 | 3 | 4 // 1: 나의 속마음, 2: 나의 겉모습, 3: 상대(상황)의 속마음, 4: 상대(상황)의 겉모습
}

export type RelationType = "합" | "충" | "형" | "해" | "파" | "원진" | "역마" | "평온"

export interface RelationBadgeInfo {
  type: RelationType
  emoji: string
  title: string
  description: string
  badgeColor: string
}

export interface TarotHistoryRecord {
  id: string
  timestamp: string
  questionKey: QuestionKey
  questionLabel: string
  cards: DrawnCard[]
  summary: string
  comicRank: string
  comboType: "normal" | "double" | "triple" | "all_season"
  relationBadge?: RelationBadgeInfo
}

export interface TarotStampState {
  stamps: Array<{
    date: string
    type: "single" | "draw" | "dice"
    combo?: "normal" | "double" | "triple" | "all_season"
  }>
  lastSingleDate?: string
  lastDrawDate?: string
  lastDiceDate?: string
  collectedCombos: {
    double: number
    triple: number
    allSeason: number
  }
}

export interface ARCard {
  id: string
  code: string // e.g. DUKJI-AR-SSR-001
  name: string
  title: string
  rarity: "SSR" | "SR" | "R" | "UR"
  element: "불" | "물" | "번개" | "바람" | "빛" | "어둠"
  elementColor: string
  bgGradient: string
  glowColor: string
  accentColor: string
  hp: number
  atk: number
  def: number
  speed: number
  skillName: string
  skillDesc: string
  voiceLine: string
  story: string
  rewardPoints: number
  frontImage: string
  badgeText: string
  stats: {
    power: number
    agility: number
    intelligence: number
    luck: number
  }
  mosaicGrid: number[][] // 8x8 binary pattern for distinct visual mosaic
}

export const AR_CARDS_DATA: ARCard[] = [
  {
    id: "duckji-astral",
    code: "DUKJI-AR-SSR-001",
    name: "대마법사 덕지 (Duckji)",
    title: "천문물상 시공간의 지배자",
    rarity: "SSR",
    element: "빛",
    elementColor: "from-amber-400 to-yellow-500",
    bgGradient: "from-amber-950 via-zinc-900 to-purple-950",
    glowColor: "rgba(251, 191, 36, 0.6)",
    accentColor: "#f59e0b",
    hp: 9400,
    atk: 3200,
    def: 2100,
    speed: 180,
    skillName: "천문 퀘이사 스트라이크 (Quasar Strike)",
    skillDesc: "우주 시공간의 에너지를 모아 전방에 강력한 별빛 폭풍을 소환하고 전 파티원에게 덕-포인트 보너스를 부여합니다.",
    voiceLine: "“별들이 가리키는 성지의 운명... 나와 함께 열어볼 텐가?”",
    story: "덕지의 첫 번째 오리지널 한정판 AR 포토카드. 전국 팝업스토어 성지를 순례하며 별자리의 기운을 흡수해 강력한 마법을 다룹니다.",
    rewardPoints: 1000,
    frontImage: "/images/events/demon-slayer-final.png",
    badgeText: "LIMITED EDITION · SSR",
    stats: {
      power: 96,
      agility: 88,
      intelligence: 99,
      luck: 94,
    },
    mosaicGrid: [
      [1, 1, 1, 0, 1, 1, 1, 1],
      [1, 0, 1, 1, 0, 0, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [0, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 0, 1, 1, 0],
      [1, 1, 0, 0, 1, 1, 0, 1],
      [0, 1, 1, 0, 1, 0, 1, 1],
      [1, 1, 1, 1, 0, 1, 1, 1],
    ],
  },
  {
    id: "ducksoon-valkyrie",
    code: "DUKJI-AR-SSR-002",
    name: "성기사 덕순 (Ducksoon)",
    title: "성지 수호의 발키리",
    rarity: "SSR",
    element: "불",
    elementColor: "from-rose-500 to-orange-500",
    bgGradient: "from-rose-950 via-zinc-900 to-amber-950",
    glowColor: "rgba(244, 63, 94, 0.6)",
    accentColor: "#f43f5e",
    hp: 11200,
    atk: 2900,
    def: 3400,
    speed: 155,
    skillName: "태양의 심판 블레이드 (Solar Judgment)",
    skillDesc: "타오르는 성검으로 적의 방어를 관통하고 팝업 현장 입장 대기열 우선권을 부여하는 보호막을 생성합니다.",
    voiceLine: "“덕후들의 성지는 내가 지킨다! 한 발자국도 물러서지 않아!”",
    story: "정의로운 성기사 덕순의 AR 카드. 실물 카드를 스캔하면 거대한 황금 날개와 불꽃 오라가 카드 위로 솟아오릅니다.",
    rewardPoints: 1000,
    frontImage: "/images/events/pokemon-festa.jpg",
    badgeText: "HOT EDITION · SSR",
    stats: {
      power: 94,
      agility: 91,
      intelligence: 82,
      luck: 89,
    },
    mosaicGrid: [
      [1, 1, 0, 1, 1, 1, 0, 1],
      [0, 1, 1, 0, 1, 0, 1, 1],
      [1, 0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 0, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0, 1, 0],
      [1, 1, 0, 1, 0, 1, 1, 1],
      [1, 0, 1, 0, 1, 1, 0, 1],
      [0, 1, 1, 1, 1, 0, 1, 1],
    ],
  },
  {
    id: "luna-shadow",
    code: "DUKJI-AR-SR-003",
    name: "괴도 루나 (Luna)",
    title: "팝업스토어의 그림자 추적자",
    rarity: "SR",
    element: "어둠",
    elementColor: "from-purple-500 to-indigo-600",
    bgGradient: "from-purple-950 via-zinc-900 to-slate-950",
    glowColor: "rgba(168, 85, 247, 0.6)",
    accentColor: "#a855f7",
    hp: 7800,
    atk: 3400,
    def: 1600,
    speed: 210,
    skillName: "섀도우 일루전 팬텀 (Phantom Mirage)",
    skillDesc: "순식간에 3개의 분신을 생성해 시선을 분산시키고 한정판 굿즈 구매 성공 확률을 2배로 증가시킵니다.",
    voiceLine: "“후후, 이번 한정판 굿즈는 이미 내 손안에 있어.”",
    story: "비밀스러운 그림자 괴도 루나. 한정판 굿즈 대기열에서 기척을 숨기고 순간 이동하는 능력의 소유자입니다.",
    rewardPoints: 600,
    frontImage: "/images/npc/luna.jpg",
    badgeText: "SPECIAL · SR",
    stats: {
      power: 82,
      agility: 98,
      intelligence: 91,
      luck: 85,
    },
    mosaicGrid: [
      [1, 0, 1, 1, 1, 0, 1, 1],
      [1, 1, 0, 1, 0, 1, 1, 0],
      [0, 1, 1, 0, 1, 1, 0, 1],
      [1, 1, 1, 1, 0, 0, 1, 1],
      [1, 0, 0, 1, 1, 1, 0, 1],
      [0, 1, 1, 0, 1, 0, 1, 0],
      [1, 1, 0, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 0, 1, 0, 1],
    ],
  },
  {
    id: "aquaria-ocean",
    code: "DUKJI-AR-SR-004",
    name: "정령사 아쿠아리아 (Aquaria)",
    title: "성수·홍대 성지의 물결",
    rarity: "SR",
    element: "물",
    elementColor: "from-cyan-400 to-blue-600",
    bgGradient: "from-cyan-950 via-zinc-900 to-blue-950",
    glowColor: "rgba(34, 211, 238, 0.6)",
    accentColor: "#06b6d4",
    hp: 8600,
    atk: 2500,
    def: 2800,
    speed: 170,
    skillName: "심해의 오아시스 힐링 (Deep Oasis)",
    skillDesc: "성지 순례 중 지친 덕후들의 피로도를 즉시 회복하고 온수/음료 교환 쿠폰을 드랍합니다.",
    voiceLine: "“맑고 푸른 물결이 당신의 성지 순례길을 비춰줄 거예요.”",
    story: "성수동과 홍대 성지의 정기를 머금은 아쿠아리아. 스캔 시 은은한 물방울 파티클과 청량한 음파가 연출됩니다.",
    rewardPoints: 600,
    frontImage: "/images/npc/aquaria.jpg",
    badgeText: "SPECIAL · SR",
    stats: {
      power: 78,
      agility: 84,
      intelligence: 94,
      luck: 90,
    },
    mosaicGrid: [
      [0, 1, 1, 1, 0, 1, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [1, 0, 1, 0, 1, 1, 0, 1],
      [1, 1, 1, 1, 1, 0, 1, 1],
      [0, 1, 0, 1, 0, 1, 1, 0],
      [1, 1, 1, 0, 1, 1, 0, 1],
      [0, 0, 1, 1, 0, 1, 1, 1],
      [1, 1, 0, 1, 1, 0, 1, 0],
    ],
  },
]

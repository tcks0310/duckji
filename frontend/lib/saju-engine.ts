// Saju (Four Pillars of Destiny) & Isekai RPG Destiny Engine

export interface SajuInput {
  name: string
  birthDate: string // YYYY-MM-DD
  birthHour: string // "unknown" or "00".."23" or branch index 0..11
  gender: "male" | "female" | "other"
  mbti: string      // e.g. "INTJ", "INFP", "ENFP"
  favoriteAnime1: string // 1st favorite anime
  favoriteAnime2: string // 2nd favorite anime
  favoriteAnime3: string // 3rd favorite anime
  favoriteGenre?: string
}

export type ElementType = "wood" | "fire" | "earth" | "metal" | "water"

export interface ElementInfo {
  type: ElementType
  korean: string
  hanja: string
  color: string
  textColor: string
  glowColor: string
  symbol: string
  archetype: string
  description: string
  traits: string[]
  luckyColor: string
  luckyItem: string
  luckyPlace: string
}

export interface DayMasterInfo {
  name: string
  hanja: string
  element: ElementType
  nature: string
  title: string
  description: string
  otakuStrength: string
  synergyAdvice: string
}

export interface FourPillars {
  yearPillar: { stem: string; branch: string }
  monthPillar: { stem: string; branch: string }
  dayPillar: { stem: string; branch: string }
  hourPillar: { stem: string; branch: string }
}

export interface WeaponInfo {
  name: string
  type: string
  rarity: "UR" | "SSR" | "Mythic"
  element: ElementType
  elementLabel: string
  attackPower: number
  signatureSkill: string
  lore: string
  image: string
}

export interface IsekaiProfile {
  characterTitle: string
  heroNickname: string
  avatarImage: string
  mbti: string
  favoriteAnimeList: string[]
  
  // Saju Four Pillars & Day Master
  fourPillars: FourPillars
  dayMaster: DayMasterInfo
  sajuReasoning: {
    originAnalysis: string      // 왜 이런 사주가 나왔는지 (명리학적 근거)
    elementDistributionAnalysis: string // 오행 분포 해설
    mbtiFusionAnalysis: string  // MBTI X 사주 융합 기질 분석
    deokhuSynergyAnalysis: string // 덕질 상생/상극 궁합
  }

  primaryElement: ElementInfo
  secondaryElement: ElementInfo
  elementRatio: {
    wood: number
    fire: number
    earth: number
    metal: number
    water: number
  }

  // Level & Rank
  level: number
  rankName: string
  
  // Hero's Destiny & User Favorite Anime Fusion
  protagonistType: string
  destinyStory: string
  crossoverIsekaiStory: string // 3개 최애 애니가 융합된 전생 스토리
  recommendedAnime: {
    title: string
    genre: string
    poster: string
    reason: string
    matchRate: number
  }[]
  soulmateCharacter: {
    name: string
    anime: string
    image: string
    role: string
    compatibilityReason: string
  }

  // Dedicated Legendary Weapon
  recommendedWeapon: WeaponInfo

  // Isekai Life & Method
  transferMethod: {
    title: string
    story: string
    icon: string
    funnyFactor: string
  }
  isekaiClass: {
    name: string
    role: string
    weapon: string
    passiveSkill: string
    ultimateSkill: string
    description: string
  }

  // Radar Stats (0 - 100)
  stats: {
    magicPower: number     // 마력
    deokPower: number      // 덕력
    gachaLuck: number      // 가챠 대박운
    intelligence: number   // 지능/지략
    agility: number        // 스피드/민첩
    mentalStrength: number // 멘탈 회복력
  }

  // 2026 Otaku Fortune
  fortune2026: {
    gachaFortune: string
    ticketingFortune: string
    holyGroundFortune: string
    overallSummary: string
  }
}

export const ELEMENTS_CONFIG: Record<ElementType, ElementInfo> = {
  wood: {
    type: "wood",
    korean: "목(木)",
    hanja: "木",
    color: "#10B981",
    textColor: "text-emerald-400",
    glowColor: "rgba(16, 185, 129, 0.4)",
    symbol: "🌲",
    archetype: "성장과 생명의 수호자",
    description: "새싹이 자라 거대한 고목이 되듯, 순수한 호기심과 끝없는 배움의 열정으로 덕질의 깊이를 파고드는 성장형 덕후입니다.",
    traits: ["끝없는 탐구욕", "성장 서사 매니아", "따뜻한 공감 능력", "아이템 수집벽"],
    luckyColor: "에메랄드 그린 / 민트",
    luckyItem: "식물 컨셉 캔뱃지, 원화집",
    luckyPlace: "서울숲 팝업스토어, 야외 페스티벌"
  },
  fire: {
    type: "fire",
    korean: "화(火)",
    hanja: "火",
    color: "#EF4444",
    textColor: "text-rose-500",
    glowColor: "rgba(239, 68, 68, 0.4)",
    symbol: "🔥",
    archetype: "불꽃의 열혈 주인공",
    description: "가슴 뜨거운 소년만화의 심장을 가진 직진형 리더! 좋아하는 작품을 위해서라면 밤샘 오픈런도 마다하지 않는 열정파입니다.",
    traits: ["강렬한 추진력", "오픈런 선봉장", "직관적인 판단", "화려한 액션 선호"],
    luckyColor: "크림슨 레드 / 루비",
    luckyItem: "1:1 레플리카 일륜도, LED 무드등",
    luckyPlace: "성수 에스팩토리, 홍대 애니메이트"
  },
  earth: {
    type: "earth",
    korean: "토(土)",
    hanja: "土",
    color: "#F59E0B",
    textColor: "text-amber-400",
    glowColor: "rgba(245, 158, 11, 0.4)",
    symbol: "⛰️",
    archetype: "중후한 대지의 아카이브 마스터",
    description: "넓고 포용력 있는 대지처럼 모든 장르를 포용하며, 굿즈의 보존 상태를 완벽하게 관리하는 베테랑 덕후입니다.",
    traits: ["철저한 굿즈 보관", "신뢰의 파티장", "안정적인 멘탈", "세계관 분석 장인"],
    luckyColor: "골드 / 카멜 옐로우",
    luckyItem: "미발매 한정 아크릴 디오라마, 바인더",
    luckyPlace: "더현대 서울, 용산 아이파크몰"
  },
  metal: {
    type: "metal",
    korean: "금(金)",
    hanja: "金",
    color: "#94A3B8",
    textColor: "text-slate-300",
    glowColor: "rgba(148, 163, 184, 0.4)",
    symbol: "⚔️",
    archetype: "냉철한 칼날의 전략가",
    description: "날카로운 통찰력과 확고한 신념으로 최애만을 일편단심 수호하는 다크 히어로이자 완벽주의 수집가입니다.",
    traits: ["일편단심 순애보", "가성비 극대화 전략", "치밀한 예약 플랜", "시크한 카리스마"],
    luckyColor: "플래티넘 실버 / 메탈 그레이",
    luckyItem: "메탈릭 헌터 라이센스, 황동 키링",
    luckyPlace: "강남 신세계 센트럴, 코엑스"
  },
  water: {
    type: "water",
    korean: "수(水)",
    hanja: "水",
    color: "#06B6D4",
    textColor: "text-cyan-400",
    glowColor: "rgba(6, 182, 212, 0.4)",
    symbol: "💧",
    archetype: "심연을 꿰뚫는 마도 현자",
    description: "깊은 바다처럼 풍부한 감수성과 천재적인 두뇌로 작품의 숨겨진 복선과 명대사를 씹어 삼키는 지성파 덕후입니다.",
    traits: ["심오한 세계관 이해", "가챠운 폭발", "감성 힐링물 선호", "유연한 사고방식"],
    luckyColor: "미드나잇 네이비 / 아쿠아 블루",
    luckyItem: "오리지널 사운드트랙 LP, 렌티큘러 포스터",
    luckyPlace: "잠실 롯데월드몰, 한강 야경 스팟"
  }
}

// 10 Day Masters (일간)
export const DAY_MASTERS: DayMasterInfo[] = [
  {
    name: "갑목(甲木)",
    hanja: "甲木",
    element: "wood",
    nature: "우뚝 솟은 거목",
    title: "성장을 주도하는 대마법사",
    description: "타협 없는 곧은 성품과 당당한 카리스마. 한 번 꽂힌 장르는 원작부터 외전까지 끝까지 파고드는 탐구형 덕후입니다.",
    otakuStrength: "세계관 설정집 10회독 & 원작 팬덤 형성 주도",
    synergyAdvice: "계수(癸水)나 정화(丁火)와 함께할 때 상상력이 극대화됩니다."
  },
  {
    name: "을목(乙木)",
    hanja: "乙木",
    element: "wood",
    nature: "유연한 덩굴과 화초",
    title: "생명력 넘치는 감성 수호자",
    description: "어떤 환경에서도 끈질기게 살아남아 꽃을 피우는 적응력! 굿즈 플리마켓과 콜라보 카페를 가장 발빠르게 섭렵합니다.",
    otakuStrength: "품절 대란 속에서도 대체 구매처를 찾아내는 정보력",
    synergyAdvice: "병화(丙火)의 따뜻한 에너지를 만났을 때 덕력이 만개합니다."
  },
  {
    name: "병화(丙火)",
    hanja: "丙火",
    element: "fire",
    nature: "하늘에 뜬 눈부신 태양",
    title: "빛을 뿜는 소년만화 주인공",
    description: "숨길 수 없는 열정과 솔직함! 좋아하는 캐릭터를 위해서라면 온 세상에 덕질을 당당히 전파하는 인싸형 덕후입니다.",
    otakuStrength: "오프라인 팝업스토어 오픈런 선봉장 & 친구 덕통사고 유발",
    synergyAdvice: "갑목(甲木)의 지지를 받을 때 꺼지지 않는 전설의 불꽃이 됩니다."
  },
  {
    name: "정화(丁火)",
    hanja: "丁火",
    element: "fire",
    nature: "어둠을 밝히는 은은한 등불",
    title: "내면의 열정을 품은 장인",
    description: "겉으로는 차분해 보이지만 가슴속에는 누구보다 뜨거운 팬심이 불타고 있는 2차 창작 및 컬렉팅 장인입니다.",
    otakuStrength: "섬세한 굿즈 큐레이션 및 나만의 커스텀 방 꾸미기",
    synergyAdvice: "을목(乙木)과 함께할 때 따스한 힐링 덕질이 지속됩니다."
  },
  {
    name: "무토(戊土)",
    hanja: "戊土",
    element: "earth",
    nature: "웅장하고 굳건한 태산",
    title: "세계관을 수호하는 아카이브 마스터",
    description: "무게감과 묵직한 신뢰감. 어떤 논란이나 장르의 유행 변화에도 흔들리지 않고 10년 이상 최애를 지키는 순정파입니다.",
    otakuStrength: "절판된 레어 한정판 굿즈를 완벽한 상태로 영구 소장",
    synergyAdvice: "병화(丙火)의 열정이나 신금(辛金)의 센스와 결합할 때 빛을 발합니다."
  },
  {
    name: "기토(己土)",
    hanja: "己土",
    element: "earth",
    nature: "만물을 품어 기르는 비옥한 옥토",
    title: "모든 장르를 포용하는 대지",
    description: "따뜻하고 자상하며 남의 최애도 존중해 주는 평화주의자. 덕질 모임에서 모두를 편안하게 해주는 파티의 든든한 서포터입니다.",
    otakuStrength: "친구 맞춤형 애니 찰떡 추천 & 나눔 문화 선도",
    synergyAdvice: "정화(丁火)와 계수(癸水)의 조화로 풍요로운 덕질 생태계를 만듭니다."
  },
  {
    name: "경금(庚金)",
    hanja: "庚金",
    element: "metal",
    nature: "강철과 원석, 날카로운 검",
    title: "승리를 쟁취하는 섀도우 블레이드",
    description: "의리와 결단력의 화신! 가차 없는 분석력과 호쾌한 배포로 원하는 굿즈와 티켓을 한 방에 낚아채는 승부사입니다.",
    otakuStrength: "0.1초 컷 티켓팅 광클릭 & 망설임 없는 올콜렉트",
    synergyAdvice: "임수(壬水)의 지혜를 빌려 날카로운 칼날을 다듬으면 무적이 됩니다."
  },
  {
    name: "신금(辛金)",
    hanja: "辛金",
    element: "metal",
    nature: "섬세하게 세공된 보석",
    title: "완벽을 추구하는 미적 감각가",
    description: "티끌 하나 없는 완벽주의와 뛰어난 심미안! 굿즈의 일러스트 퀄리티와 아크릴의 마감 처리를 꼼꼼하게 따지는 안목의 소유자입니다.",
    otakuStrength: "SNS 감성 굿즈 사진 촬영 및 고품격 전시 디스플레이",
    synergyAdvice: "임수(壬水)의 맑은 물에 씻길 때 보석의 광채가 극대화됩니다."
  },
  {
    name: "임수(壬水)",
    hanja: "壬水",
    element: "water",
    nature: "넓고 광활한 바다와 큰 강",
    title: "차원을 넘나드는 지혜의 현자",
    description: "막힘없이 흐르는 거대한 물결처럼 유연하고 영리합니다. 복잡한 다중 우주와 타임루프 세계관도 한 번에 꿰뚫어 봅니다.",
    otakuStrength: "애니 명장면 복선 완벽 해석 및 장르 불문 섭렵",
    synergyAdvice: "경금(庚金)의 맑은 수원지를 만날 때 지혜의 바다가 마르지 않습니다."
  },
  {
    name: "계수(癸水)",
    hanja: "癸水",
    element: "water",
    nature: "대지를 촉촉이 적시는 봄비와 샘물",
    title: "영혼을 울리는 감성 음유시인",
    description: "조용히 스며드는 섬세한 감수성과 뛰어난 직관. OST 한 소절, 대사 한 줄에도 눈물을 흘리며 작품의 감동을 온몸으로 체감합니다.",
    otakuStrength: "명대사 캘리그라피, OST 감상, 서사 깊은 감성작 완주",
    synergyAdvice: "신금(辛金)의 지원을 받을 때 감성의 깊이가 무한히 확장됩니다."
  }
]

// Deterministic hash based on all inputs
function pseudoHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

export function calculateSajuProfile(input: SajuInput): IsekaiProfile {
  const anime1 = input.favoriteAnime1?.trim() || "귀멸의 칼날"
  const anime2 = input.favoriteAnime2?.trim() || "주술회전"
  const anime3 = input.favoriteAnime3?.trim() || "장송의 프리렌"
  const favoriteAnimeList = [anime1, anime2, anime3]

  const seed = pseudoHash(
    `${input.name}-${input.birthDate}-${input.birthHour}-${input.gender}-${input.mbti}-${anime1}-${anime2}-${anime3}`
  )

  // 1. Day Master (일간) determination from seed and birthdate
  const dayMasterIndex = seed % 10
  const dayMaster = DAY_MASTERS[dayMasterIndex]
  const primaryElement = ELEMENTS_CONFIG[dayMaster.element]

  // Secondary element
  const elementsList: ElementType[] = ["wood", "fire", "earth", "metal", "water"]
  const secondaryIndex = (seed + 3) % 5
  const secondaryElement = ELEMENTS_CONFIG[elementsList[secondaryIndex]]

  // Four Pillars calculation
  const heavenlyStems = ["갑(甲)", "을(乙)", "병(丙)", "정(丁)", "무(戊)", "기(己)", "경(庚)", "신(辛)", "임(壬)", "계(癸)"]
  const earthlyBranches = ["자(子)", "축(丑)", "인(寅)", "묘(卯)", "진(辰)", "사(巳)", "오(午)", "미(未)", "신(申)", "유(酉)", "술(戌)", "해(亥)"]

  const yearStem = heavenlyStems[seed % 10]
  const yearBranch = earthlyBranches[seed % 12]
  const monthStem = heavenlyStems[(seed + 2) % 10]
  const monthBranch = earthlyBranches[(seed + 4) % 12]
  const dayStem = dayMaster.hanja
  const dayBranch = earthlyBranches[(seed + 6) % 12]
  const hourStem = heavenlyStems[(seed + 8) % 10]
  const hourBranch = earthlyBranches[(seed + 10) % 12]

  const fourPillars: FourPillars = {
    yearPillar: { stem: yearStem, branch: yearBranch },
    monthPillar: { stem: monthStem, branch: monthBranch },
    dayPillar: { stem: dayStem, branch: dayBranch },
    hourPillar: { stem: hourStem, branch: hourBranch }
  }

  // Element percentages
  const p1 = 38 + (seed % 15)
  const p2 = 24 + ((seed >> 2) % 12)
  const remaining = 100 - (p1 + p2)
  const p3 = Math.floor(remaining * 0.45)
  const p4 = Math.floor(remaining * 0.35)
  const p5 = remaining - p3 - p4

  const elementRatio = {
    [dayMaster.element]: p1,
    [elementsList[secondaryIndex]]: p2,
    [elementsList[(primaryElement.type === "wood" ? 1 : 0)]]: p3,
    [elementsList[(primaryElement.type === "fire" ? 2 : 1)]]: p4,
    [elementsList[(primaryElement.type === "water" ? 3 : 4)]]: p5,
  } as { wood: number; fire: number; earth: number; metal: number; water: number }

  // Radar Stats modified by MBTI
  const mbtiUpper = (input.mbti || "INFP").toUpperCase()
  const isIntrovert = mbtiUpper.startsWith("I")
  const isIntuitive = mbtiUpper.includes("N")
  const isThinking = mbtiUpper.includes("T")
  const isJudging = mbtiUpper.endsWith("J")

  const stats = {
    magicPower: isIntuitive ? 88 + (seed % 12) : 75 + (seed % 20),
    deokPower: 90 + ((seed >> 1) % 10),
    gachaLuck: 70 + ((seed >> 2) % 29),
    intelligence: isThinking ? 85 + ((seed >> 3) % 15) : 76 + ((seed >> 3) % 20),
    agility: !isJudging ? 82 + ((seed >> 4) % 16) : 72 + ((seed >> 4) % 22),
    mentalStrength: isIntrovert ? 86 + ((seed >> 5) % 14) : 80 + ((seed >> 5) % 18),
  }

  // Deep Saju Reasoning (Why this result came out)
  const sajuReasoning = {
    originAnalysis: `당신의 사주 명식은 일간(日干)에 '${dayMaster.name}'을 본원(本元)으로 품고 태어났습니다. 명리학에서 일간은 영혼의 정체성이자 본질을 상징합니다. ${dayMaster.nature}의 기운을 이어받아 ${dayMaster.description}`,
    elementDistributionAnalysis: `오행 배합 분석 결과, 주도 오행인 ${primaryElement.korean} 기운이 ${elementRatio[primaryElement.type]}%로 가장 왕성하며, 이를 보좌하는 ${secondaryElement.korean} 기운(${elementRatio[secondaryElement.type]}%)이 절묘하게 조화를 이루고 있습니다. 이는 한 번 목표를 정하면 끝까지 몰입하여 결실을 맺는 강력한 덕력의 원천입니다.`,
    mbtiFusionAnalysis: `[${mbtiUpper} X ${dayMaster.name}] 성향 융합 분석: ${
      isIntrovert ? "내면의 깊은 상상력과 세계관을 정밀하게 탐구하며" : "동료들과 함께 현장의 열기를 온몸으로 공유하는 행동파로서"
    }, ${
      isThinking ? "작품의 치밀한 복선과 설정의 개연성을 날카롭게 짚어내는 명석함" : "캐릭터들의 감정선과 감동적인 서사에 깊이 공명하는 따스한 감수성"
    }을 동시에 겸비하고 있습니다.`,
    deokhuSynergyAnalysis: `상생(相生) 궁합: ${dayMaster.synergyAdvice} 당신의 덕질 파트너로는 ${
      primaryElement.type === "wood" ? "화(火) 또는 수(水)" : primaryElement.type === "fire" ? "목(木) 또는 토(土)" : primaryElement.type === "earth" ? "화(火) 또는 금(金)" : primaryElement.type === "metal" ? "토(土) 또는 수(水)" : "금(金) 또는 목(木)"
    } 속성의 모험가와 함께할 때 시너지가 200% 폭발합니다.`
  }

  // Titles & Nicknames
  const prefixes = [
    "칠흑의", "심연을 꿰뚫는", "불꽃을 품은", "성수동의", "차원을 넘나드는",
    "절대무적의", "새벽녘의", "천재적", "황금빛", "신속의", "성좌의 지배자"
  ]
  const titles = [
    "마도공학자", "덕지순례자", "차원지배자", "흑염룡 마스터", "소드마스터",
    "대정령사", "연금술사", "그림자 암살자", "용사", "아카식 현자"
  ]
  const prefix = prefixes[seed % prefixes.length]
  const title = titles[(seed >> 3) % titles.length]
  const heroNickname = `${prefix} ${input.name || "덕후"}`
  const characterTitle = `Lv.999 VIP ${title}`

  // Crossover Isekai Story integrating user's 3 Favorite Anime
  const crossoverIsekaiStory = `당신이 가장 사랑하는 [${anime1}], [${anime2}], [${anime3}]의 세계관이 시공간 균열로 하나로 융합된 '대통합 이세계 판타지아' 대륙! 당신은 [${anime1}]의 불굴의 투지, [${anime2}]의 차원을 가르는 특급 주술, 그리고 [${anime3}]의 영원한 마법 서사를 온몸에 각성한 채 이세계의 구원자로서 소환되었습니다.`

  // Transfer Methods
  const transferMethods = [
    {
      title: `[${anime1}] 정주행 중 모니터 블랙홀 전이`,
      story: `심야에 방에서 [${anime1}]의 하이라이트 명장면을 보며 감동의 눈물을 흘리던 순간, 화면에서 찬란한 황금빛 마법진이 뿜어져 나오며 [${anime2}]와 [${anime3}]의 세계가 합쳐진 이세계 왕궁으로 전이되었습니다.`,
      icon: "💻",
      funnyFactor: `손에 쥐고 있던 무선 마우스가 이세계의 마력 증폭 아티팩트로 감정됨.`
    },
    {
      title: `성수동 팝업 한정 굿즈 개봉 중 차원 도약`,
      story: `성수 팝업스토어에서 구매한 [${anime1}] 시크릿 랜덤 캔뱃지를 개봉하는 순간, 뱃지 뒷면의 고대 룬 문자가 번쩍이며 차원의 문이 열렸습니다.`,
      icon: "✨",
      funnyFactor: `가방에 있던 [${anime2}] 아크릴 스탠드가 실물 크기 영웅으로 소환 가능.`
    },
    {
      title: `가챠 10연차 트리플 쓰리스타 각성 전생`,
      story: `[${anime3}] 테마 게임 가챠에서 기적 같은 확률로 픽업 영웅 3장을 동시에 뽑자 차원 관리국 여신 아쿠아리아가 직접 강림하여 특급 용사로 모셔갔습니다.`,
      icon: "📱",
      funnyFactor: `이세계 은행에 접속하자마자 1억 골드가 입금되어 자산가로 시작.`
    }
  ]
  const transferMethod = transferMethods[seed % transferMethods.length]

  // Isekai Classes tailored with favorite anime references
  const isekaiClass = {
    name: `S급 초월 마도사 (${dayMaster.name} 극의)`,
    role: "원거리 폭딜 & 차원 영역전개",
    weapon: `성좌의 마도검 & [${anime1}] 레플리카 엠블럼`,
    passiveSkill: `만상간파: [${anime2}]의 마안 (적의 약점 및 레어 굿즈 드랍율 100% 투시)`,
    ultimateSkill: `오의: [${anime3}] 시공간 붕괴 폭풍 (Dimensional Overload)`,
    description: `사주 일간 ${dayMaster.name}의 순수한 기운과 당신이 사랑하는 3대 명작([${anime1}], [${anime2}], [${anime3}])의 정수를 흡수하여 전장을 완벽하게 통제하는 최고위 영웅입니다.`
  }

  // Anime Recommendations & Soulmates
  const animeData = {
    wood: [
      {
        title: "장송의 프리렌 (Frieren: Beyond Journey's End)",
        genre: "판타지 / 힐링 / 성장",
        poster: "/images/npc/luna.jpg",
        reason: "목(木)의 영원한 생명력과 시간의 가치를 소중히 여기는 당신에게 완벽한 여운을 선사하는 힐링 대작.",
        matchRate: 99
      },
      {
        title: "명탐정 코난 (Detective Conan)",
        genre: "추리 / 서스펜스 / 어드벤처",
        poster: "/images/events/conan.jpg",
        reason: "예리한 관찰력과 진실을 밝혀내는 지혜로운 목(木) 기운에 부합하는 레전드 명작.",
        matchRate: 96
      }
    ],
    fire: [
      {
        title: "귀멸의 칼날: 무한성편",
        genre: "액션 / 다크판타지 / 열혈",
        poster: "/images/events/demon-slayer.jpg",
        reason: "화(火)의 불꽃 같은 열정과 동료애로 한계를 돌파하는 탄지로의 서사가 심장을 뛰게 만듭니다.",
        matchRate: 99
      },
      {
        title: "블루록 (BLUE LOCK)",
        genre: "스포츠 / 두뇌서바이벌 / 에고이즘",
        poster: "/images/events/bluelock.jpg",
        reason: "타협 없는 승부욕과 자신의 불꽃을 태워 정점에 오르는 폭발적인 도파민을 선사합니다.",
        matchRate: 95
      }
    ],
    earth: [
      {
        title: "헌터X헌터 (HUNTER×HUNTER)",
        genre: "모험 / 두뇌배틀 / 판타지",
        poster: "/images/events/hunter-hunter.jpg",
        reason: "토(土)의 견고하고 치밀한 세계관과 넨(念) 능력 체계의 깊이를 완벽하게 즐길 수 있는 걸작.",
        matchRate: 98
      },
      {
        title: "토이 스토리 & 픽사 어드벤처",
        genre: "우정 / 모험 / 감동",
        poster: "/images/events/toystory.jpg",
        reason: "대지처럼 변함없는 오랜 친구들과의 신뢰와 마음 따뜻한 모험의 정점.",
        matchRate: 97
      }
    ],
    metal: [
      {
        title: "주술회전: 시부야 사변",
        genre: "다크판타지 / 주술배틀 / 카리스마",
        poster: "/images/events/jujutsu-kaisen.jpg",
        reason: "금(金)의 칼날처럼 날카롭고 압도적인 영역전개와 고죠 사토루의 독보적인 카리스마가 완벽 매칭.",
        matchRate: 99
      },
      {
        title: "이토 준지 호러 컬렉션",
        genre: "미스터리 / 호러 / 서스펜스",
        poster: "/images/events/junji-ito.jpg",
        reason: "강철 같은 차가운 긴장감과 매혹적인 기괴함으로 독보적인 예술성을 자랑하는 걸작.",
        matchRate: 96
      }
    ],
    water: [
      {
        title: "포켓몬스터: 피카츄 어드벤처",
        genre: "모험 / 힐링 / 판타지",
        poster: "/images/events/pokemon-festa.jpg",
        reason: "수(水)의 유연함과 활발한 생명력으로 전 세계를 매료시킨 포켓몬의 순수한 모험.",
        matchRate: 99
      },
      {
        title: "스누피 & 피너츠 컬렉션",
        genre: "일상 / 치유 / 위트",
        poster: "/images/events/snoopy.jpg",
        reason: "잔잔한 물결처럼 삶의 철학과 따스한 위로를 건네는 클래식 명작.",
        matchRate: 97
      }
    ]
  }
  const recommendedAnime = animeData[primaryElement.type]

  // Soulmate Characters
  const soulmateData = {
    wood: {
      name: "프리렌 (Frieren)",
      anime: "장송의 프리렌",
      image: "/images/npc/luna.jpg",
      role: "천년의 엘프 대마법사",
      compatibilityReason: "시간의 흐름 속에서 조용히 당신의 성장을 묵묵히 지켜봐 주며 마법 책을 건네줄 최적의 스승이자 동반자입니다."
    },
    fire: {
      name: "카마도 탄지로 & 렌고쿠",
      anime: "귀멸의 칼날",
      image: "/images/events/demon-slayer.jpg",
      role: "불꽃의 호흡 검사",
      compatibilityReason: "당신의 가슴속 불꽃을 활활 타오르게 만들어 줄 든든한 멘토이자, 함께라면 어떤 역경도 뚫어낼 수 있습니다."
    },
    earth: {
      name: "키르아 & 곤",
      anime: "헌터X헌터",
      image: "/images/events/hunter-hunter.jpg",
      role: "번개의 헌터 & 모험가",
      compatibilityReason: "당신의 든든한 안정감을 믿고 마음의 문을 열며, 위기 상황마다 가장 신속하게 당신을 지켜줄 평생의 절친입니다."
    },
    metal: {
      name: "고죠 사토루 (Gojo Satoru)",
      anime: "주술회전",
      image: "/images/events/jujutsu-kaisen.jpg",
      role: "최강의 특급 주술사",
      compatibilityReason: "당신의 시크함과 당당한 신념을 가장 높이 평가하며, '괜찮아, 난 최강이니까'라며 언제든 든든한 방패가 되어줍니다."
    },
    water: {
      name: "괴도 키드 & 코난",
      anime: "명탐정 코난",
      image: "/images/events/conan.jpg",
      role: "달밤의 마술사 & 명탐정",
      compatibilityReason: "물 흐르듯 명석한 두뇌와 기지로 당신의 모든 난제를 함께 풀어내고 환상적인 트릭을 선사합니다."
    }
  }
  const soulmateCharacter = soulmateData[primaryElement.type]

  // 2026 Otaku Fortune
  const fortune2026 = {
    gachaFortune: "⭐⭐⭐⭐⭐ 천장 없는 단챠 대박운! 픽업 첫날 10연차에 SSR 3장 획득 가능성 농후.",
    ticketingFortune: "⚡ 0.1초 컷 마하의 광클릭! 성수/더현대 팝업스토어 1회차 명당 예약 확정.",
    holyGroundFortune: `🧭 ${primaryElement.luckyPlace} 방향에서 한정판 굿즈와 인생 애니를 만나게 될 대길(大吉) 운세.`,
    overallSummary: `2026년은 일간 ${dayMaster.name}의 기운과 MBTI [${mbtiUpper}]의 장점이 폭발하여 원하는 모든 굿즈와 감동을 손에 넣는 최고의 황금기입니다!`
  }

  // Dedicated Legendary Weapon for user's inner self
  const weaponsByElement: Record<ElementType, WeaponInfo> = {
    wood: {
      name: `세계수의 영혼 지팡이: [${anime3}]의 성목`,
      type: "신화급 마도 지팡이 (Staff)",
      rarity: "Mythic",
      element: "wood",
      elementLabel: "목(木) 생명의 기운",
      attackPower: 9450 + (seed % 500),
      signatureSkill: `오의: 만물소생 & [${anime3}] 마나 대폭풍`,
      lore: `천년 된 세계수의 심장목으로 벼려낸 최고위 마도 무기. 사주 일간 ${dayMaster.name}의 순수한 생명력과 결합하여 아군에게 절대 마나 보호막을 부여합니다.`,
      image: "/images/avatar/wood.jpg"
    },
    fire: {
      name: `홍련의 멸악 일륜도: [${anime1}]의 불꽃`,
      type: "전설급 태도 (Katana)",
      rarity: "UR",
      element: "fire",
      elementLabel: "화(火) 태양의 불꽃",
      attackPower: 9999 + (seed % 1000),
      signatureSkill: `비기: 태양의 호흡 제13형 & [${anime1}] 흑염참`,
      lore: `태양의 기운을 머금은 진홍빛 성철을 단조한 전설의 검. ${dayMaster.nature}의 기운을 불길로 전환하여 어떤 어둠도 한 칼에 베어냅니다.`,
      image: "/images/avatar/female.jpg"
    },
    earth: {
      name: `대지의 수호 방패검: [${anime2}]의 금강체`,
      type: "초중량 바스타드 소드 & 이지스",
      rarity: "SSR",
      element: "earth",
      elementLabel: "토(土) 견고한 대지",
      attackPower: 8900 + (seed % 600),
      signatureSkill: `결계: 대지룡의 영역 & 절대 방어 성벽`,
      lore: `웅장한 산맥의 정수를 압축하여 제작된 견고한 무기. 흔들리지 않는 멘탈과 아카이브 수집력으로 파티의 최전선을 굳건히 지킵니다.`,
      image: "/images/avatar/earth.jpg"
    },
    metal: {
      name: `차원절단 뇌광도: [${anime2}]의 무하한`,
      type: "신화급 주술 블레이드 (Magic Blade)",
      rarity: "Mythic",
      element: "metal",
      elementLabel: "금(金) 예리한 칼날",
      attackPower: 11500 + (seed % 800),
      signatureSkill: `영역전개: 무량공처 & 공간 절단 뇌격`,
      lore: `다이아몬드보다 단단한 메탈릭 영혼석으로 제련된 궁극의 칼날. ${dayMaster.name}의 날카로운 직관과 결합하여 0.01초 만에 적의 약점을 간파합니다.`,
      image: "/images/avatar/male.jpg"
    },
    water: {
      name: `심연의 아카식 그리모어: [${anime1}]의 기억`,
      type: "고대 유물 마도서 (Grimoire)",
      rarity: "UR",
      element: "water",
      elementLabel: "수(水) 심연의 바다",
      attackPower: 9200 + (seed % 700),
      signatureSkill: `비전: 시공간 타임루프 & 영혼의 레퀴엠`,
      lore: `깊은 바다와 시간의 흐름을 기록한 신비의 고서. 풍부한 감수성과 지혜를 통해 복잡한 세계관의 진실을 꿰뚫고 전황을 뒤바꿉니다.`,
      image: "/images/avatar/water.jpg"
    }
  }
  const recommendedWeapon = weaponsByElement[primaryElement.type]

  // Dynamic Webtoon Avatar Determination based on Gender & Elements
  let resolvedAvatar = "/images/avatar/female.jpg"
  if (input.gender === "female") {
    if (primaryElement.type === "wood") resolvedAvatar = "/images/avatar/wood.jpg"
    else if (primaryElement.type === "earth") resolvedAvatar = "/images/avatar/earth.jpg"
    else resolvedAvatar = "/images/avatar/female.jpg"
  } else if (input.gender === "male") {
    if (primaryElement.type === "water") resolvedAvatar = "/images/avatar/water.jpg"
    else resolvedAvatar = "/images/avatar/male.jpg"
  } else {
    if (primaryElement.type === "wood") resolvedAvatar = "/images/avatar/wood.jpg"
    else if (primaryElement.type === "water") resolvedAvatar = "/images/avatar/water.jpg"
    else if (primaryElement.type === "earth") resolvedAvatar = "/images/avatar/earth.jpg"
    else resolvedAvatar = "/images/avatar/female.jpg"
  }

  return {
    characterTitle,
    heroNickname,
    avatarImage: resolvedAvatar,
    mbti: mbtiUpper,
    favoriteAnimeList,
    fourPillars,
    dayMaster,
    sajuReasoning,
    primaryElement,
    secondaryElement,
    elementRatio,
    level: 999,
    rankName: `S-Rank VIP ${dayMaster.name} 차원지배자`,
    protagonistType: `[${mbtiUpper}] ${dayMaster.title}`,
    destinyStory: `${dayMaster.description} 특히 당신이 손꼽은 최애 명작 [${anime1}], [${anime2}], [${anime3}]의 철학과 당신의 영혼이 하나로 결합되어 전설적인 여정을 시작합니다.`,
    crossoverIsekaiStory,
    recommendedAnime,
    soulmateCharacter,
    recommendedWeapon,
    transferMethod,
    isekaiClass,
    stats,
    fortune2026
  }
}

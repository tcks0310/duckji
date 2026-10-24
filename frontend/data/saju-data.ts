// Saju NPCs, Quests, Guild Posts & Custom Goods Definitions

export interface SajuNPC {
  id: string
  name: string
  title: string
  avatar: string
  role: string
  quote: string
  color: string
}

export const SAJU_NPCS: Record<string, SajuNPC> = {
  luna: {
    id: "luna",
    name: "차원 점술사 루나 (Luna)",
    title: "성좌의 대점성술사",
    avatar: "/images/npc/luna.jpg",
    role: "오행 및 사주 원국 심층 감정",
    quote: "별들의 궤적과 사주 4주 8자의 천간지지가 당신의 타고난 영혼의 불꽃을 선명히 비추고 있어요...",
    color: "#10B981"
  },
  akasha: {
    id: "akasha",
    name: "전생 기록관 아카샤 (Akasha)",
    title: "아카식 레코드의 수호자",
    avatar: "/images/npc/akasha.jpg",
    role: "MBTI 융합 & 주인공 서사 큐레이션",
    quote: "당신의 MBTI와 최애 애니메이션 3편의 파동이 아카식 서고에서 완벽하게 공명하여 전설의 서사를 펼쳤습니다.",
    color: "#8B5CF6"
  },
  aquaria: {
    id: "aquaria",
    name: "이세계 여신 아쿠아리아 (Aquaria)",
    title: "차원 전이 관리국 1급 여신",
    avatar: "/images/npc/aquaria.jpg",
    role: "이세계 전생 & 치트 클래스 부여",
    quote: "축하해요 용사님! 당신이 사랑하는 애니 세계관들이 융합된 이세계로 소환될 준비가 끝났습니다!",
    color: "#06B6D4"
  },
  hepai: {
    id: "hepai",
    name: "전설의 대장장이 헤파이 (Hepai)",
    title: "신화급 아티팩트 마스터",
    avatar: "/images/npc/hepai.jpg",
    role: "VIP 칭호 부여 & 실물 굿즈 연성",
    quote: "자네의 영혼석과 사주 에너지를 벼려내어 세상에 단 하나뿐인 홀로그램 아크릴과 3D 피규어로 구현해주겠네!",
    color: "#F59E0B"
  }
}

export interface GuildPost {
  id: string
  userName: string
  userTitle: string
  userElement: "wood" | "fire" | "earth" | "metal" | "water"
  elementLabel: string
  mbti: string
  favoriteAnimeTags: string[]
  avatarUrl: string
  content: string
  bestMatchElement: string
  likeCount: number
  commentCount: number
  createdAt: string
  comments: {
    id: string
    author: string
    avatar: string
    text: string
    time: string
  }[]
}

export const INITIAL_GUILD_POSTS: GuildPost[] = [
  {
    id: "post-1",
    userName: "폭염의 흑염룡 탄지로",
    userTitle: "Lv.999 VIP 칠흑의 섀도우 블레이드",
    userElement: "fire",
    elementLabel: "병화(丙火) 태양의 불꽃",
    mbti: "ENFP",
    favoriteAnimeTags: ["귀멸의 칼날", "주술회전", "체인소맨"],
    avatarUrl: "/images/avatar/fire.jpg",
    content: "사주 돌렸더니 병화(丙火) 일간 + ENFP 조합으로 나왔네요! 최애 애니로 귀멸/주술/체인소맨 넣었더니 호흡과 영역전개가 합쳐진 전용 스킬 '흑염 주술참' 해금됐습니다 ㅋㅋㅋ 이번 주말 성수 팝업 같이 갈 목(木) 속성 파티원 구합니다! 🔥",
    bestMatchElement: "목(木) 속성 모험가 (갑목/을목)",
    likeCount: 58,
    commentCount: 6,
    createdAt: "8분 전",
    comments: [
      {
        id: "c-1",
        author: "성수동 프리렌",
        avatar: "/images/npc/luna.jpg",
        text: "저 갑목(甲木) INTP 대마법사입니다! 목생화(木生火) 시너지로 화력 200% 올려드릴게요!",
        time: "5분 전"
      },
      {
        id: "c-2",
        author: "강남 점프마스터",
        avatar: "/images/npc/akasha.jpg",
        text: "스킬명 찰떡이네요 ㄷㄷ 아크릴 스탠드에 각인 넣어서 주문 완료했습니다",
        time: "2분 전"
      }
    ]
  },
  {
    id: "post-2",
    userName: "심연의 시공간 마도사 바이올렛",
    userTitle: "Lv.999 VIP S급 크로노 위저드",
    userElement: "water",
    elementLabel: "계수(癸水) 맑은 옹달샘",
    mbti: "INFJ",
    favoriteAnimeTags: ["바이올렛 에버가든", "장송의 프리렌", "최애의 아이"],
    avatarUrl: "/images/npc/aquaria.jpg",
    content: "계수(癸水)와 INFJ 조합 사주 풀이 읽고 소름 돋았어요... '타인의 감정을 깊이 읽고 세계관의 복선을 감상하는 지성파'라니 완전 제 덕질 스타일 ㅠㅠ 이세계 전생 클래스도 대마법사 나와서 만족도 1000%입니다 💧",
    bestMatchElement: "금(金) 속성 모험가 (경금/신금)",
    likeCount: 84,
    commentCount: 4,
    createdAt: "22분 전",
    comments: [
      {
        id: "c-3",
        author: "무한성 고죠",
        avatar: "/images/avatar/metal.jpg",
        text: "금생수(金生水)로 서포트해드릴 특급 주술사 대기 중입니다 ✨",
        time: "12분 전"
      }
    ]
  },
  {
    id: "post-3",
    userName: "성수동의 뇌광 키르아",
    userTitle: "Lv.999 VIP 천재 연금술 장인",
    userElement: "metal",
    elementLabel: "신금(辛金) 정밀한 보석",
    mbti: "ISTP",
    favoriteAnimeTags: ["헌터X헌터", "블루록", "사이버펑크"],
    avatarUrl: "/images/avatar/metal.jpg",
    content: "사주 아바타로 3D 풀컬러 피규어랑 메탈릭 포토카드 주문해봤습니다. 네임택에 칭호랑 MBTI 각인 깔끔하게 들어가서 퀄리티 대박이네요 ⚔️",
    bestMatchElement: "토(土) 속성 모험가 (무토/기토)",
    likeCount: 112,
    commentCount: 9,
    createdAt: "45분 전",
    comments: [
      {
        id: "c-4",
        author: "포코피아 마스터",
        avatar: "/images/npc/hepai.jpg",
        text: "대장장이 헤파이 굿즈 퀄리티 미쳤습니다 ㅋㅋㅋ 저도 아크릴 바로 결제했어요",
        time: "30분 전"
      }
    ]
  }
]

export interface CustomGoodsTemplate {
  id: string
  name: string
  category: "acrylic" | "figure3d" | "photocard"
  basePrice: number
  description: string
  imageMockup: string
  options: string[]
  specs: string[]
}

export const CUSTOM_GOODS_TEMPLATES: CustomGoodsTemplate[] = [
  {
    id: "saju-custom-acrylic",
    name: "[사주 아바타] 1:1 맞춤 홀로그램 아크릴 디오라마 스탠드",
    category: "acrylic",
    basePrice: 28000,
    description: "당신의 사주 일간 오행 속성, MBTI, 최애 애니 3편, 칭호 닉네임, 이세계 전용 스탯 레이더가 각인된 특수 홀로그램 샌드 가공 아크릴 스탠드입니다.",
    imageMockup: "/images/avatar/fire.jpg",
    options: ["오행 속성 엠블럼 베이스", "칭호 & MBTI 골드 각인", "양면 고투명 아크릴"],
    specs: ["크기: 150 x 200mm", "두께: 5mm 프리미엄 아크릴", "전용 받침대 포함"]
  },
  {
    id: "saju-custom-3d-figure",
    name: "[이세계 클래스] 나만의 3D 풀컬러 프린팅 미니 피규어 베이스",
    category: "figure3d",
    basePrice: 58000,
    description: "이세계 전생 클래스와 전용 무기를 장착한 당신만의 캐릭터를 초정밀 풀컬러 레진 3D 프린팅으로 입체 구현합니다.",
    imageMockup: "/images/avatar/metal.jpg",
    options: ["풀컬러 고정밀 레진", "클래스 전용 무기 파츠", "마법진 LED 베이스"],
    specs: ["크기: 높이 120mm", "무게: 약 180g", "전용 아크릴 쇼케이스 포함"]
  },
  {
    id: "saju-custom-photocard",
    name: "[VIP 한정판] 메탈릭 골드 홀로그램 사주 포토카드 3종 세트",
    category: "photocard",
    basePrice: 15000,
    description: "사주 일간, MBTI X 애니 융합 스킬, 2026 가챠 대박 부적이 금박/은박 홀로그램으로 인쇄된 소장용 포토카드 세트.",
    imageMockup: "/images/npc/aquaria.jpg",
    options: ["홀로그램 스타박 가공", "마그네틱 슬리브 탑로더", "VIP 넘버링 각인"],
    specs: ["크기: 55 x 85mm", "350gsm 특수 하드보드지", "3종 1세트 + 탑로더"]
  }
]

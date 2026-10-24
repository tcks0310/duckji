import { apiFetch } from "@/lib/api"

// 덕지몰 품목 (backend b2b 서비스 /api/b2b/mall/items)
// 품목은 관리자 센터 '덕지몰 관리' 탭에서 올림. 견적 요청은 /store/mall/quote 에서 접수

// 분류는 고정 (backend b2b/mall-items.ts 와 같게)
export const MALL_CATEGORIES = [
  { id: "acrylic_display", label: "아크릴·진열장" },
  { id: "photozone_sign", label: "포토존·사인·조명" },
  { id: "operation_queue", label: "현장 운영·차단봉" },
  { id: "shop_fixtures", label: "굿즈 매대·행거·가챠" },
  { id: "packaging", label: "포장재·쇼핑백" },
  { id: "etc", label: "기타" },
] as const

export const SUPPLY_TYPES = ["렌탈", "구매", "맞춤제작"] as const
export type SupplyType = (typeof SUPPLY_TYPES)[number]

export const categoryLabel = (id: string) => MALL_CATEGORIES.find((c) => c.id === id)?.label || id

export type MallItem = {
  id: number
  category: string
  categoryName: string
  name: string
  description: string
  spec: string
  supplyTypes: SupplyType[]
  imageUrls: string[]
  sortOrder: number
  isActive: boolean
}

export async function fetchMallItems(): Promise<{ ok: true; items: MallItem[] } | { ok: false; error: string }> {
  try {
    const res = await apiFetch("/api/b2b/mall/items", { cache: "no-store" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) return { ok: false, error: body.error || "품목을 불러오지 못했습니다." }
    return { ok: true, items: body.items }
  } catch {
    return { ok: false, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." }
  }
}

// ---- 견적함 (덕지몰에서 담고 견적 신청 페이지로 넘어가도 유지) ----

export type QuoteCartItem = {
  id: number
  name: string
  categoryName: string
  imageUrl: string
  quantity: number
  serviceType: SupplyType
}

const CART_KEY = "duckji-mall-quote-cart"
export const CART_EVENT = "duckji-mall-quote-cart"

export function loadQuoteCart(): QuoteCartItem[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]")
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === "number" && typeof i.name === "string") : []
  } catch {
    return []
  }
}

export function saveQuoteCart(items: QuoteCartItem[]) {
  try {
    if (items.length) sessionStorage.setItem(CART_KEY, JSON.stringify(items))
    else sessionStorage.removeItem(CART_KEY)
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)는 이 페이지 안에서만 유지
  }
}

// ---- 이메일 입력 (아이디 @ 도메인 고르기) ----

export const EMAIL_DOMAINS = [
  "naver.com",
  "gmail.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  "nate.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
] as const

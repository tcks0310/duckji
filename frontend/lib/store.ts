"use client"

import { useEffect, useSyncExternalStore } from "react"
import { apiFetch } from "@/lib/api"

// 덕지 스토어 (굿즈샵): backend store 서비스 /api/store
// 상품은 관리자가 등록하고, 주문은 덕지 포인트(DP, 1 DP = 1원)로 결제합니다. 결제사(PG)는 DP 충전에만 붙습니다.

// 분류는 관리자가 굿즈샵 관리에서 정함 (서버 store.categories). 굿즈샵 위 탭: 랭킹 → 분류 순서대로
export interface StoreCategory {
  code: string
  name: string
  sortOrder: number
}
export const STORE_BADGES = ["한정판", "BEST", "HOT", "NEW", "사전예약", "품절임박"] as const

export interface StoreProduct {
  id: number
  category: string
  categoryName: string
  name: string
  series: string
  description: string
  specs: string[]
  imageUrls: string[] // 상품 사진 (첫 장이 대표)
  detailImageUrls: string[] // 상세 설명 이미지 (상세 페이지 '상품 정보'에 위에서 아래로)
  priceDp: number | null // null = 가격 공개 예정 (찜만, 구매 불가)
  stock: number | null // null = 수량 제한 없음
  soldOut: boolean // 품절 처리했거나 재고 0
  manualSoldOut: boolean // 관리자가 품절 처리
  sales: { d1: number; d7: number; d30: number; all: number } // 팔린 수량 (취소 제외, 최근 1·7·30일·전체)
  rating: number | null // 후기 평균 별점 (후기 없으면 null)
  reviewCount: number
  createdAt: string
  maxPerOrder: number
  badge: string
  sortOrder: number
  isActive: boolean
  wishCount: number
}

// 장바구니에 담는 상품 정보 (회원 계정에 저장되는 화면 표시용 스냅샷, 가격은 DP)
// 실제 결제 금액은 주문할 때 서버가 상품 가격으로 다시 계산
export interface GoodsItem {
  id: string
  name: string
  series?: string
  popupEventId?: string
  popupTitle?: string
  price: number // DP
  priceDisplay?: string // 가격 공개 전 문구
  badge?: string
  category?: string
  categoryLabel?: string
  imageUrl: string
  description?: string
  specs?: string[]
}

export const productToGoods = (p: StoreProduct): GoodsItem => ({
  id: String(p.id),
  name: p.name,
  series: p.series,
  price: p.priceDp ?? 0,
  priceDisplay: p.priceDp === null ? "가격 공개 예정" : undefined,
  badge: p.badge || undefined,
  category: p.category,
  categoryLabel: p.categoryName,
  imageUrl: p.imageUrls[0] || "",
  description: p.description,
  specs: p.specs,
})

// 주문할 수 있는 장바구니 항목인지 (스토어 상품 id 는 숫자. 사주 맞춤 굿즈처럼 판매 목록 밖이면 주문 불가)
export const isStoreProductId = (id: string) => /^\d+$/.test(id)

export const dp = (n: number) => `${n.toLocaleString()} DP`

// ---- 판매 중인 상품 목록 (여러 화면이 같이 씀, 한 번 불러와 기억)

type ProductsState = { status: "idle" | "loading" | "ready" | "error"; products: StoreProduct[]; categories: StoreCategory[] }
let productsState: ProductsState = { status: "idle", products: [], categories: [] }
const listeners = new Set<() => void>()
const setProducts = (next: ProductsState) => {
  productsState = next
  listeners.forEach((l) => l())
}

export async function loadStoreProducts() {
  if (productsState.status === "loading") return
  setProducts({ ...productsState, status: "loading" })
  try {
    const res = await apiFetch("/api/store/products", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error)
    setProducts({ status: "ready", products: json.products, categories: json.categories || [] })
  } catch {
    setProducts({ ...productsState, status: "error" })
  }
}

export function useStoreProducts() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => productsState,
    () => productsState
  )
  useEffect(() => {
    if (productsState.status === "idle") loadStoreProducts()
  }, [])
  return s
}

// ---- 주문

export type OrderStatus = "paid" | "shipped" | "delivered" | "canceled"
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { paid: "결제 완료", shipped: "발송", delivered: "배송 완료", canceled: "취소·환불" }

export interface Recipient {
  name: string
  phone: string
  postcode: string
  address: string
  addressDetail: string
}

export interface StoreOrder {
  id: number
  orderNo: string
  status: OrderStatus
  totalDp: number
  recipient: Recipient
  requestNote: string
  trackingNo: string
  items: { productId: number | null; name: string; imageUrl: string; priceDp: number; quantity: number }[]
  createdAt: string
  canceledAt: string | null
  // 관리자 화면만
  memberId?: string
  memberName?: string
  adminMemo?: string
}

export type StoreResult<T> = { status: "ok"; data: T } | { status: "login" } | { status: "error"; error: string }

async function call<T>(path: string, method = "GET", body?: unknown): Promise<StoreResult<T>> {
  try {
    const res = await apiFetch(`/api/store${path}`, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 401) return { status: "login" }
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) return { status: "error", error: json.error || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }
    return { status: "ok", data: json as T }
  } catch {
    return { status: "error", error: "서버에 연결할 수 없습니다." }
  }
}

export const placeOrder = (input: { items: { productId: number; quantity: number }[]; recipient: Recipient; requestNote: string; fromCart: boolean }) =>
  call<{ order: StoreOrder; dpBalance: number }>("/orders", "POST", input)
export const fetchProduct = (id: number) => call<{ product: StoreProduct }>(`/products/${id}`)

// ---- 후기 (그 상품을 주문한 회원만, 상품당 하나)
export interface StoreReview {
  id: number
  productId: number
  rating: number
  content: string
  author: string // 가운데 가린 이름
  mine: boolean
  createdAt: string
}
export const fetchReviews = (productId: number) =>
  call<{ reviews: StoreReview[]; canWrite: boolean; loggedIn: boolean }>(`/products/${productId}/reviews`)
export const saveReview = (productId: number, rating: number, content: string) =>
  call<{ review: StoreReview }>(`/reviews/${productId}`, "PUT", { rating, content })
export const deleteReview = (productId: number) => call<{}>(`/reviews/${productId}`, "DELETE")

export const fetchMyOrders = () => call<{ orders: StoreOrder[] }>("/orders")
export const cancelMyOrder = (orderNo: string) => call<{ order: StoreOrder; dpBalance: number | null }>(`/orders/${encodeURIComponent(orderNo)}/cancel`, "POST")

// ---- 관리자

export type AdminProduct = StoreProduct & { sold: number; cartQty: number; cartMembers: number }
export const adminFetchProducts = () => call<{ products: AdminProduct[]; categories: StoreCategory[]; badges: string[] }>("/admin/products")
export const adminSaveProduct = (id: number | null, body: Record<string, unknown>) =>
  call<{ product: StoreProduct }>(id ? `/admin/products/${id}` : "/admin/products", id ? "PATCH" : "POST", body)
export const adminDeleteProduct = (id: number) => call<{}>(`/admin/products/${id}`, "DELETE")

export type AdminCategory = StoreCategory & { productCount: number }
export const adminFetchCategories = () => call<{ categories: AdminCategory[] }>("/admin/categories")
export const adminAddCategory = (name: string) => call<{ category: StoreCategory }>("/admin/categories", "POST", { name })
export const adminUpdateCategory = (code: string, body: { name?: string; sortOrder?: number }) =>
  call<{ category: StoreCategory }>(`/admin/categories/${encodeURIComponent(code)}`, "PATCH", body)
export const adminDeleteCategory = (code: string) => call<{}>(`/admin/categories/${encodeURIComponent(code)}`, "DELETE")

// 주문 내역 관리: 상태·기간(한국 날짜 YYYY-MM-DD)·검색어(주문 번호·받는 분·회원 이름·연락처)·정렬
export type AdminOrderQuery = { status?: OrderStatus; sort?: "new" | "old"; from?: string; to?: string; q?: string }
export const adminFetchOrders = (query: AdminOrderQuery = {}) => {
  const p = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
  return call<{ orders: StoreOrder[]; counts: Partial<Record<OrderStatus, number>>; totalDp: number }>(`/admin/orders${p.size ? `?${p}` : ""}`)
}
export const adminUpdateOrder = (id: number, body: { status?: "shipped" | "delivered"; trackingNo?: string; adminMemo?: string }) =>
  call<{ order: StoreOrder }>(`/admin/orders/${id}`, "PATCH", body)
export const adminCancelOrder = (id: number) => call<{ order: StoreOrder }>(`/admin/orders/${id}/cancel`, "POST")

export type AdminReview = StoreReview & { productName: string; memberId: string; memberName: string; hidden: boolean }
export const adminFetchReviews = () => call<{ reviews: AdminReview[] }>("/admin/reviews")
export const adminHideReview = (id: number, hidden: boolean) => call<{}>(`/admin/reviews/${id}`, "PATCH", { hidden })

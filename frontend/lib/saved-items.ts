"use client"

import { useEffect, useSyncExternalStore } from "react"
import { apiFetch } from "@/lib/api"
import type { GoodsItem } from "@/lib/store"
import type { CartItem } from "@/components/shop/cart-drawer"

// 회원별 찜·장바구니·팝업 알림 신청 (backend users 서비스 /api/users/me/saved)
// 로그인한 회원만 쓸 수 있고, 회원 계정에 저장됩니다. 비로그인이면 빈 목록이고 담기·찜은 "login" 을 돌려줘 화면이 로그인을 안내합니다.
// 여러 화면이 같은 목록을 보도록 한 곳(이 모듈)에 상태를 둡니다.

export type LikeKind = "popup" | "goods" | "course"
// ok: 저장됨, login: 로그인 필요, error: 서버 오류(잠시 후 다시)
export type SaveResult = "ok" | "login" | "error"
// 팝업 오픈·티켓팅 알림 신청. 연락처는 회원 정보(가입 이메일·휴대폰)를 씀
export type AlertChannel = "email" | "kakao"
export type PopupAlert = { popupId: string; channel: AlertChannel; createdAt: string }

type SavedState = {
  status: "unknown" | "loading" | "guest" | "member"
  likes: Record<LikeKind, string[]>
  cart: CartItem[]
  alerts: PopupAlert[]
}

const EMPTY: SavedState = { status: "unknown", likes: { popup: [], goods: [], course: [] }, cart: [], alerts: [] }

let state: SavedState = EMPTY
const listeners = new Set<() => void>()
const setState = (next: SavedState) => {
  state = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const MAX_QUANTITY = 99

// 서버에 저장된 장바구니 → 화면용 (담을 때 상품 정보). 주문할 때 서버가 상품 가격·재고를 다시 확인
const toCartItem = (r: { goodsId: string; quantity: number; snapshot: Record<string, any> }): CartItem => ({
  goods: { price: 0, imageUrl: "", name: "", ...r.snapshot, id: r.goodsId } as GoodsItem,
  quantity: r.quantity,
})

const snapshotOf = (g: GoodsItem) => ({
  name: g.name,
  series: g.series,
  popupEventId: g.popupEventId,
  popupTitle: g.popupTitle,
  price: g.price,
  priceDisplay: g.priceDisplay,
  badge: g.badge,
  category: g.category,
  categoryLabel: g.categoryLabel,
  imageUrl: g.imageUrl,
  description: g.description,
})

let loadSeq = 0

// 서버에서 내 찜·장바구니 불러오기 (로그인 쿠키 기준). 로그인 직후에도 부릅니다.
export async function loadSavedItems() {
  const seq = ++loadSeq
  if (state.status === "unknown") setState({ ...state, status: "loading" })
  try {
    const res = await apiFetch("/api/users/me/saved", { cache: "no-store" })
    if (seq !== loadSeq) return
    if (res.status === 401) return setState({ ...EMPTY, status: "guest" })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error)
    setState({
      status: "member",
      likes: { popup: json.likes.popup || [], goods: json.likes.goods || [], course: json.likes.course || [] },
      cart: (json.cart || []).map(toCartItem),
      alerts: json.alerts || [],
    })
  } catch {
    // 서버 오류: 로그인 여부를 모르므로 빈 목록으로 두고, 담기·찜을 하면 다시 시도
    if (seq === loadSeq) setState({ ...EMPTY, status: "unknown" })
  }
}

// 로그아웃: 화면의 찜·장바구니 비우기
export function clearSavedItems() {
  loadSeq++
  setState({ ...EMPTY, status: "guest" })
}

// 저장 실패 후: 세션이 끝났으면 로그인 안내, 아니면 오류
const failureResult = (): SaveResult => (state.status === "guest" ? "login" : "error")

// 아직 로그인 여부를 모르면 서버에 확인
async function ensureMember(): Promise<SaveResult> {
  if (state.status !== "member") await loadSavedItems()
  return state.status === "member" ? "ok" : state.status === "guest" ? "login" : "error"
}

async function request(path: string, method: "PUT" | "DELETE", body?: unknown): Promise<{ ok: boolean; json: any }> {
  try {
    const res = await apiFetch(`/api/users/me/saved${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 401) clearSavedItems()
    return { ok: res.ok, json: await res.json().catch(() => ({})) }
  } catch {
    return { ok: false, json: {} }
  }
}

const send = async (path: string, method: "PUT" | "DELETE", body?: unknown) => (await request(path, method, body)).ok

// 찜 토글
export async function toggleLike(kind: LikeKind, itemId: string): Promise<SaveResult> {
  const check = await ensureMember()
  if (check !== "ok") return check
  const before = state.likes[kind]
  const liked = before.includes(itemId)
  setState({ ...state, likes: { ...state.likes, [kind]: liked ? before.filter((id) => id !== itemId) : [...before, itemId] } })
  const ok = await send(`/likes/${kind}/${encodeURIComponent(itemId)}`, liked ? "DELETE" : "PUT")
  if (!ok && state.status === "member") {
    // 저장 실패: 원래대로 되돌림
    setState({ ...state, likes: { ...state.likes, [kind]: before } })
    await loadSavedItems()
    return failureResult()
  }
  return "ok"
}

async function saveQuantity(goods: GoodsItem, quantity: number): Promise<SaveResult> {
  const before = state.cart
  const exists = before.some((i) => i.goods.id === goods.id)
  const cart =
    quantity <= 0
      ? before.filter((i) => i.goods.id !== goods.id)
      : exists
        ? before.map((i) => (i.goods.id === goods.id ? { ...i, quantity } : i))
        : [...before, { goods, quantity }]
  setState({ ...state, cart })
  const ok =
    quantity <= 0
      ? await send(`/cart/${encodeURIComponent(goods.id)}`, "DELETE")
      : await send(`/cart/${encodeURIComponent(goods.id)}`, "PUT", { quantity, snapshot: snapshotOf(goods) })
  if (ok) return "ok"
  if (state.status === "member") await loadSavedItems()
  return failureResult()
}

// 장바구니 담기 (이미 있으면 count 개 더함, 기본 1개)
export async function addToCart(goods: GoodsItem, count = 1): Promise<SaveResult> {
  const check = await ensureMember()
  if (check !== "ok") return check
  const current = state.cart.find((i) => i.goods.id === goods.id)?.quantity || 0
  return saveQuantity(goods, Math.min(MAX_QUANTITY, current + Math.max(1, Math.floor(count))))
}

export async function updateCartQuantity(goodsId: string, delta: number) {
  const item = state.cart.find((i) => i.goods.id === goodsId)
  if (!item || state.status !== "member") return
  await saveQuantity(item.goods, Math.min(MAX_QUANTITY, item.quantity + delta))
}

export async function removeCartItem(goodsId: string) {
  const item = state.cart.find((i) => i.goods.id === goodsId)
  if (!item || state.status !== "member") return
  await saveQuantity(item.goods, 0)
}

export async function clearCart() {
  if (state.status !== "member") return
  setState({ ...state, cart: [] })
  if (!(await send("/cart", "DELETE"))) await loadSavedItems()
}

// 팝업 알림 신청 (이미 신청했으면 채널만 바꿈)
export async function setPopupAlert(popupId: string, channel: AlertChannel): Promise<{ status: SaveResult; error?: string }> {
  const check = await ensureMember()
  if (check !== "ok") return { status: check }
  const r = await request(`/alerts/${encodeURIComponent(popupId)}`, "PUT", { channel })
  if (r.ok && state.status === "member") {
    setState({ ...state, alerts: r.json.alerts || [] })
    return { status: "ok" }
  }
  return { status: failureResult(), error: r.json.error }
}

// 팝업 알림 취소
export async function removePopupAlert(popupId: string): Promise<SaveResult> {
  if (state.status !== "member") return "login"
  const before = state.alerts
  setState({ ...state, alerts: before.filter((a) => a.popupId !== popupId) })
  const r = await request(`/alerts/${encodeURIComponent(popupId)}`, "DELETE")
  if (r.ok) return "ok"
  if (state.status === "member") setState({ ...state, alerts: before })
  return failureResult()
}

let autoLoaded = false

// 화면에서 쓰기: const saved = useSavedItems(). 처음 쓰일 때 서버에서 한 번 불러옴
export function useSavedItems() {
  useEffect(() => {
    if (autoLoaded) return
    autoLoaded = true
    loadSavedItems()
  }, [])
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

// 예전 상단 하트·가방 버튼용 (지금 상단 메뉴는 수를 직접 읽고 찜·장바구니 페이지로 이동)
// 사용: <Navbar {...useMyPageShortcuts()} ... />
export function useMyPageShortcuts() {
  const saved = useSavedItems()
  return {
    cartCount: saved.cart.reduce((sum, i) => sum + i.quantity, 0),
    likedCount: saved.likes.popup.length + saved.likes.goods.length + saved.likes.course.length,
    onOpenCart: () => window.location.assign("/store/goods/cart/"),
    onOpenLiked: () => window.location.assign("/mypage/liked/"),
  }
}

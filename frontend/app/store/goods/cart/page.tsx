"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Footer } from "@/components/footer"
import type { CartItem } from "@/components/shop/cart-drawer"
import { GoodsShopHeader, goodsTabHref } from "@/components/shop/goods-shop-header"
import { DIVIDE, ghostButton, LINE, maxQty, PANEL, productHref, QtyStepper, ShopNotice } from "@/components/shop/shop-ui"
import { goToLogin } from "@/lib/member-auth"
import { removeCartItem, updateCartQuantity, useSavedItems } from "@/lib/saved-items"
import { dp, isStoreProductId, useStoreProducts, type StoreProduct } from "@/lib/store"

// 장바구니 (/store/goods/cart): 회원 계정에 담긴 굿즈를 담은 곳(굿즈샵 / 사주 맞춤 굿즈)별로 묶어서 보여줌
// 항목마다 체크 → '선택 상품 주문하기'로 주문 페이지(/store/goods/checkout/?from=cart&ids=1,2,3)에서 DP 로 결제
// 가격·품절은 지금 판매 중인 상품 정보로 다시 보여 주고, 주문할 때 서버가 한 번 더 확인
// 사주 맞춤 굿즈와 가격 공개 전·품절 상품은 아직 주문할 수 없어 주문에서 빠짐

type CartGroup = { id: string; label: string; desc: string; href: string; items: CartItem[] }

// 담은 곳 구분: 사주 맞춤 굿즈(id custom-saju-..., 사주 화면에서 담음) / 나머지는 굿즈샵
const GROUPS: Omit<CartGroup, "items">[] = [
  { id: "goods", label: "굿즈샵", desc: "덕지 굿즈샵 상품", href: "/store/goods/" },
  { id: "saju", label: "사주 맞춤 굿즈", desc: "덕지 사주 캐릭터로 만드는 맞춤 제작 굿즈", href: "/play/saju/" },
]
const groupOf = (item: CartItem) =>
  item.goods.id.startsWith("custom-saju") || item.goods.popupEventId === "custom-saju" ? "saju" : "goods"

export default function CartPage() {
  const saved = useSavedItems()
  const { products, status } = useStoreProducts()
  const byId = new Map(products.map((p) => [String(p.id), p]))
  // 체크를 끈 항목만 기억 (새로 담은 상품은 처음부터 선택됨)
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())

  // 지금 판매 정보 (목록을 아직 못 받았으면 담을 때 정보로)
  const live = (item: CartItem): StoreProduct | undefined => byId.get(item.goods.id)
  const unitPrice = (item: CartItem): number | null => {
    const p = live(item)
    if (p) return p.priceDp
    if (status === "ready") return null
    return item.goods.priceDisplay || !(item.goods.price > 0) ? null : item.goods.price
  }
  const orderable = (item: CartItem) => {
    if (groupOf(item) !== "goods" || !isStoreProductId(item.goods.id)) return false
    const p = live(item)
    return p ? p.priceDp !== null && !p.soldOut : false
  }

  const groups: CartGroup[] = GROUPS.map((g) => ({ ...g, items: saved.cart.filter((i) => groupOf(i) === g.id) })).filter((g) => g.items.length > 0)
  const isChecked = (item: CartItem) => !unchecked.has(item.goods.id)
  const checked = saved.cart.filter(isChecked)
  const allChecked = saved.cart.length > 0 && checked.length === saved.cart.length
  const toOrder = checked.filter(orderable)
  const total = toOrder.reduce((sum, i) => sum + (unitPrice(i) ?? 0) * i.quantity, 0)
  const qtyOf = (items: CartItem[]) => items.reduce((sum, i) => sum + i.quantity, 0)
  const skipped = checked.length - toOrder.length

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setUnchecked(allChecked ? new Set(saved.cart.map((i) => i.goods.id)) : new Set())
  const removeChecked = async () => {
    if (!checked.length) return
    if (!window.confirm(`선택한 상품 ${checked.length}개를 장바구니에서 뺄까요?`)) return
    for (const i of checked) await removeCartItem(i.goods.id)
  }

  const orderHref = `/store/goods/checkout/?from=cart&ids=${toOrder.map((i) => i.goods.id).join(",")}`
  const loading = saved.status === "unknown" || saved.status === "loading" || (saved.cart.length > 0 && (status === "idle" || status === "loading"))

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <GoodsShopHeader active="cart" />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        <div className={`pb-3 mb-6 border-b ${LINE}`}>
          <h1 className="text-2xl font-black text-white">장바구니</h1>
          {saved.status === "member" && (
            <p className="mt-1 text-sm text-zinc-400">
              담은 상품 <span className="font-bold text-zinc-200">{qtyOf(saved.cart)}</span>개
            </p>
          )}
        </div>

        {loading ? (
          <p className="py-24 text-center text-sm text-zinc-400">불러오는 중...</p>
        ) : saved.status === "guest" ? (
          <ShopNotice
            action={
              <button type="button" onClick={() => goToLogin()} className="h-10 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
                로그인하기
              </button>
            }
          >
            로그인하면 담아 둔 상품을 어느 기기에서든 볼 수 있어요.
          </ShopNotice>
        ) : saved.cart.length === 0 ? (
          <ShopNotice
            action={
              <Link href={goodsTabHref("ranking")} className={ghostButton}>
                굿즈 둘러보기
              </Link>
            }
          >
            장바구니가 비어 있어요.
          </ShopNotice>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
            <div className="space-y-4">
              <div className={`${PANEL} px-4 sm:px-5 h-14 flex items-center justify-between gap-3`}>
                <label className="flex items-center gap-3 text-sm font-bold text-white cursor-pointer">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-5 h-5 accent-red-600" />
                  전체 선택 ({checked.length}/{saved.cart.length})
                </label>
                <button type="button" onClick={removeChecked} disabled={!checked.length} className="text-sm text-zinc-400 hover:text-white disabled:text-zinc-600">
                  선택 삭제
                </button>
              </div>

              {groups.map((g) => (
                <section key={g.id} className={PANEL}>
                  <div className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b ${LINE}`}>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white">
                        {g.label} <span className="text-zinc-500 font-normal">{g.items.length}</span>
                      </h2>
                      <p className="text-xs text-zinc-500">{g.desc}</p>
                    </div>
                    <Link href={g.href} className="text-sm text-zinc-400 hover:text-white shrink-0">
                      더 담으러 가기
                    </Link>
                  </div>
                  <ul className={`divide-y ${DIVIDE}`}>
                    {g.items.map((item) => (
                      <CartRow
                        key={item.goods.id}
                        item={item}
                        product={live(item)}
                        price={unitPrice(item)}
                        orderable={orderable(item)}
                        checked={isChecked(item)}
                        onCheck={() => toggle(item.goods.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <aside className={`lg:sticky lg:top-28 ${PANEL} p-5 space-y-4`}>
              <h2 className="text-base font-bold text-white">주문 예상 금액</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-400">선택 상품 ({qtyOf(toOrder)}개)</dt>
                  <dd className="text-zinc-200 tabular-nums">{dp(total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-400">배송비</dt>
                  <dd className="text-zinc-200 tabular-nums">0 DP</dd>
                </div>
              </dl>
              <div className={`pt-4 border-t ${LINE} flex justify-between items-baseline`}>
                <span className="text-sm font-bold text-zinc-200">결제 예정 금액</span>
                <span className="text-2xl font-black text-amber-300 tabular-nums">{dp(total)}</span>
              </div>
              {skipped > 0 && <p className="text-xs text-zinc-500">선택한 상품 중 품절·가격 공개 전 상품과 사주 맞춤 굿즈 {skipped}개는 아직 주문할 수 없어 빠져요.</p>}
              {toOrder.length > 0 ? (
                <Link href={orderHref} className="w-full h-14 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-base flex items-center justify-center">
                  선택 상품 주문하기 ({toOrder.length})
                </Link>
              ) : (
                <div className="w-full h-14 rounded-xl bg-zinc-800 text-zinc-400 font-bold text-base flex items-center justify-center">주문할 상품을 선택해 주세요</div>
              )}
              <p className="text-xs text-zinc-500 text-center">덕지 포인트(DP)로 결제해요. 1 DP = 1원</p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

function CartRow({
  item,
  product,
  price,
  orderable,
  checked,
  onCheck,
}: {
  item: CartItem
  product?: StoreProduct
  price: number | null
  orderable: boolean
  checked: boolean
  onCheck: () => void
}) {
  const g = item.goods
  const href = product ? productHref(product.id) : undefined
  const max = product ? maxQty(product) : 99
  const note = product?.soldOut ? "품절" : price === null ? g.priceDisplay || "가격 공개 전" : !orderable ? "주문 준비 중" : ""
  const thumb = (
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
      {(product?.imageUrls[0] || g.imageUrl) && <img src={product?.imageUrls[0] || g.imageUrl} alt="" className="w-full h-full object-cover" />}
    </div>
  )
  const name = <span className="text-sm font-bold text-white leading-snug line-clamp-2">{product?.name || g.name}</span>
  return (
    <li className="p-4 sm:p-5 flex gap-3 sm:gap-4">
      <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`${g.name} 선택`} className="mt-1 w-5 h-5 accent-red-600 shrink-0" />
      {href ? <Link href={href}>{thumb}</Link> : thumb}
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            {(product?.series || g.series) && <div className="text-xs text-zinc-500 truncate">{product?.series || g.series}</div>}
            {href ? (
              <Link href={href} className="hover:underline underline-offset-2">
                {name}
              </Link>
            ) : (
              name
            )}
            {price !== null && <div className="text-xs text-zinc-400 tabular-nums">{dp(price)} / 1개</div>}
            {note && <div className="text-xs font-bold text-amber-400">{note}</div>}
          </div>
          <button type="button" onClick={() => removeCartItem(g.id)} className="p-1 text-zinc-500 hover:text-white shrink-0" aria-label="장바구니에서 빼기" title="빼기">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          <QtyStepper value={item.quantity} max={Math.max(max, 1)} onChange={(n) => updateCartQuantity(g.id, n - item.quantity)} small />
          <div className="text-right">
            {price !== null ? (
              <div className="text-base font-black text-white tabular-nums">{dp(price * item.quantity)}</div>
            ) : (
              <div className="text-sm text-zinc-400">{g.priceDisplay || "가격 미정"}</div>
            )}
          </div>
        </div>
        {product && item.quantity > max && <p className="text-xs text-amber-400">한 번에 {max}개까지 주문할 수 있어요. 주문할 때 {max}개로 맞춰져요.</p>}
      </div>
    </li>
  )
}

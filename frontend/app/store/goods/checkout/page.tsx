"use client"

import * as React from "react"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { Footer } from "@/components/footer"
import { GoodsShopHeader, goodsTabHref } from "@/components/shop/goods-shop-header"
import { DIVIDE, FIELD, ghostButton, LINE, maxQty, PANEL, productHref, QtyStepper, ShopNotice } from "@/components/shop/shop-ui"
import { addMyAddress, getMyInfo, goToLogin, type MyAddress } from "@/lib/member-auth"
import { loadPoints, useMemberPoints } from "@/lib/member-points"
import { loadSavedItems, useSavedItems } from "@/lib/saved-items"
import { searchAddress } from "@/lib/postcode"
import { useIsApp } from "@/lib/app-mode"
import { cardAmountFor, payShortByCard, takeCardReturn } from "@/lib/card-pay"
import { dp, isStoreProductId, loadStoreProducts, placeOrder, useStoreProducts, type Recipient, type StoreOrder, type StoreProduct } from "@/lib/store"

// 주문·결제 (/store/goods/checkout): 굿즈샵 상품을 덕지 포인트(DP)로 결제
//   ?product=<상품 id>&qty=<수량>   상품 상세에서 바로 구매
//   ?from=cart&ids=1,2,3            장바구니에서 고른 상품 (ids 가 없으면 주문 가능한 상품 전부. 주문한 상품만 장바구니에서 빠짐)
// 배송지: 저장한 배송지(마이페이지 배송지 관리) 중 고르거나 새로 입력. 처음 주문이면 입력한 주소를 기본 배송지로 저장
// 금액·재고는 서버가 주문할 때 상품 값으로 다시 확인하고, 화면은 미리 보여 주기만 함 (배송비 없음)
// 앱에서는 DP 충전 버튼 대신, 모자란 금액만 카드로 내고 바로 주문 (lib/card-pay.ts)

type Line = { product: StoreProduct; quantity: number }
// 카드 결제창에 다녀오는 동안 기억해 둘 입력
type Draft = { choice: number | "new"; form: Recipient; saveAddress: boolean; noteChoice: string; noteText: string; quantities: Record<number, number> }

const EMPTY_RECIPIENT: Recipient = { name: "", phone: "", postcode: "", address: "", addressDetail: "" }
const NOTE_PRESETS = ["문 앞에 놓아 주세요", "경비실에 맡겨 주세요", "배송 전 연락 주세요"]
const NOTE_CUSTOM = "__custom"

const fromAddress = (a: MyAddress): Recipient => ({
  name: a.recipient || "",
  phone: a.phone || "",
  postcode: a.zipCode,
  address: a.address1 || "",
  addressDetail: a.address2 || "",
})

const sectionTitle = "text-lg font-bold text-white"

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <Checkout />
    </Suspense>
  )
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["장바구니", "주문·결제", "주문 완료"]
  return (
    <ol className="flex items-center gap-1.5 text-sm" aria-label="주문 단계">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
          <span className={i + 1 === step ? "font-bold text-white" : "text-zinc-500"}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Checkout() {
  const params = useSearchParams()
  const fromCart = params.get("from") === "cart"
  const productId = Number(params.get("product"))
  const qty = Math.min(Math.max(Math.floor(Number(params.get("qty"))) || 1, 1), 99)
  // 장바구니에서 고른 상품 id (없으면 전부)
  const pickedIds = (params.get("ids") || "").split(",").filter(isStoreProductId)
  const pickedKey = pickedIds.join(",")

  const { products, status } = useStoreProducts()
  const saved = useSavedItems()
  const points = useMemberPoints()
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ order: StoreOrder; balance: number } | null>(null)

  // 배송지: 저장한 배송지 중 하나(id) 또는 새로 입력("new")
  const [addresses, setAddresses] = useState<MyAddress[]>([])
  const [addrReady, setAddrReady] = useState(false)
  const [choice, setChoice] = useState<number | "new">("new")
  const [picking, setPicking] = useState(false)
  const [form, setForm] = useState<Recipient>(EMPTY_RECIPIENT)
  const [saveAddress, setSaveAddress] = useState(true)
  const [noteChoice, setNoteChoice] = useState("")
  const [noteText, setNoteText] = useState("")
  const isApp = useIsApp()
  // 카드 결제를 마치고 돌아오면 true → 화면 준비가 끝나면 바로 주문
  const [autoOrder, setAutoOrder] = useState(false)
  const autoOrderRef = React.useRef(false)

  useEffect(() => {
    takeCardReturn<Draft>().then((back) => {
      if (!back) return
      const d = back.draft
      if (d) {
        autoOrderRef.current = true
        setChoice(d.choice)
        setForm(d.form)
        setSaveAddress(d.saveAddress)
        setNoteChoice(d.noteChoice)
        setNoteText(d.noteText)
        setQuantities(d.quantities)
        setAgreed(true)
      }
      loadPoints()
      if (back.result.status === "ok") setAutoOrder(!!d)
      else setError(back.result.status === "canceled" ? back.result.message : back.result.status === "pending" ? "카드 결제 확인이 아직 안 됐어요. 잠시 뒤 다시 시도해 주세요." : back.result.error)
    })
  }, [])

  // 기본 배송지를 먼저 고르고, 새 배송지 입력칸에는 회원 정보의 이름·휴대폰을 미리 채움
  useEffect(() => {
    getMyInfo().then((r) => {
      setAddrReady(true)
      if (!r.success) return
      const list = r.info.addresses || []
      setAddresses(list)
      const def = list.find((a) => a.isDefault) || list[0]
      if (def && !autoOrderRef.current) {
        setChoice(def.id)
        setSaveAddress(false)
      }
      setForm((p) => ({ ...p, name: p.name || r.info.profile.realName || "", phone: p.phone || r.info.profile.phone || "" }))
    })
  }, [])

  const lines: Line[] = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const picked = new Set(pickedKey ? pickedKey.split(",") : [])
    const raw = fromCart
      ? saved.cart
          .filter((i) => isStoreProductId(i.goods.id) && (!picked.size || picked.has(i.goods.id)))
          .map((i) => ({ id: Number(i.goods.id), quantity: i.quantity }))
      : productId > 0
        ? [{ id: productId, quantity: qty }]
        : []
    return raw
      .map((r) => {
        const product = byId.get(r.id)!
        return { product, quantity: product ? Math.min(quantities[r.id] ?? r.quantity, maxQty(product)) : r.quantity }
      })
      .filter((l) => l.product && l.product.priceDp !== null && !l.product.soldOut)
  }, [products, saved.cart, fromCart, pickedKey, productId, qty, quantities])

  const selected = typeof choice === "number" ? addresses.find((a) => a.id === choice) : undefined
  const recipient: Recipient = selected ? fromAddress(selected) : form
  const requestNote = noteChoice === NOTE_CUSTOM ? noteText.trim() : noteChoice

  const total = lines.reduce((sum, l) => sum + (l.product.priceDp ?? 0) * l.quantity, 0)
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
  const balance = points.balance
  const short = balance !== null && balance < total
  const here = `/store/goods/checkout/?${params.toString()}`
  const chargeHref = `/mypage/charge/?next=${encodeURIComponent(here)}`

  const setQty = (id: number, q: number) => setQuantities((p) => ({ ...p, [id]: q }))
  const set = (k: keyof Recipient, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const findAddress = async () => {
    try {
      const r = await searchAddress()
      if (r) setForm((p) => ({ ...p, postcode: r.zonecode, address: r.address, addressDetail: "" }))
    } catch (e: any) {
      alert(e?.message || "주소 검색을 열지 못했어요.")
    }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || !lines.length) return
    if (!recipient.name.trim() || !recipient.phone.trim())
      return setError(selected ? "고른 배송지에 받는 분 이름이나 연락처가 없어요. 새 배송지로 입력해 주세요." : "받는 분 이름과 연락처를 적어 주세요.")
    if (!recipient.address.trim()) return setError("주소 검색으로 배송 주소를 찾아 주세요.")
    if (!agreed) return setError(isApp ? "주문 내용과 결제에 동의해 주세요." : "주문 내용과 DP 결제에 동의해 주세요.")
    if (short && isApp) return payByCard()
    if (short) return setError("DP 가 모자라요. DP 를 충전한 뒤 결제해 주세요.")
    setBusy(true)
    setError("")
    const r = await placeOrder({
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      recipient,
      requestNote,
      fromCart,
    })
    setBusy(false)
    if (r.status === "login") return setError("로그인이 필요합니다. 로그인한 뒤 다시 주문해 주세요.")
    if (r.status === "error") {
      loadStoreProducts()
      return setError(r.error)
    }
    // 새로 입력한 주소를 기본 배송지로 저장 (저장한 배송지가 없던 회원은 기본으로 체크됨). 실패해도 주문은 끝난 것
    if (!selected && saveAddress) {
      addMyAddress({
        label: addresses.length ? null : "기본 배송지",
        recipient: recipient.name.trim(),
        phone: recipient.phone.replace(/[^\d]/g, ""),
        zipCode: recipient.postcode.trim(),
        address1: recipient.address.trim(),
        address2: recipient.addressDetail.trim() || null,
        isDefault: true,
      }).then((s) => !s.success && console.warn("address save:", s.error))
    }
    setDone({ order: r.data.order, balance: r.data.dpBalance })
    loadPoints()
    loadStoreProducts()
    if (fromCart) loadSavedItems()
    window.scrollTo({ top: 0 })
  }

  // 앱: 모자란 금액만 카드로 결제 → 입금되면 바로 주문 (데스크톱 결제창은 이 자리에서, 모바일은 페이지를 다녀와서 autoOrder)
  const payByCard = async () => {
    setBusy(true)
    setError("")
    const r = await payShortByCard<Draft>(total - (balance ?? 0), "goods", { choice, form, saveAddress, noteChoice, noteText, quantities })
    setBusy(false)
    if (r.status === "ok") return setAutoOrder(true)
    if (r.status === "pending") return
    setError(r.status === "canceled" ? r.message : r.error)
  }

  const loading =
    status === "idle" || status === "loading" || points.status === "loading" || (fromCart && (saved.status === "unknown" || saved.status === "loading"))

  useEffect(() => {
    if (!autoOrder || loading || !addrReady || !lines.length || points.status === "loading") return
    setAutoOrder(false)
    if (short) return setError("카드 결제는 됐지만 DP 가 아직 모자라요. 다시 결제하기를 눌러 주세요.")
    submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOrder, loading, addrReady, lines.length, short, points.status])

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <GoodsShopHeader active="" />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        <div className={`pb-4 mb-6 border-b ${LINE} flex flex-col sm:flex-row sm:items-end justify-between gap-2`}>
          <h1 className="text-2xl font-black text-white">{done ? "주문 완료" : "주문·결제"}</h1>
          <Steps step={done ? 3 : 2} />
        </div>

        {done ? (
          <OrderComplete order={done.order} balance={done.balance} />
        ) : loading ? (
          <p className="py-24 text-center text-sm text-zinc-400">불러오는 중...</p>
        ) : points.status === "guest" ? (
          <ShopNotice
            action={
              <button type="button" onClick={() => goToLogin()} className="h-10 px-6 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold">
                로그인하기
              </button>
            }
          >
            로그인하면 덕지 포인트로 주문할 수 있어요.
          </ShopNotice>
        ) : lines.length === 0 ? (
          <ShopNotice
            action={
              <Link href={goodsTabHref("ranking")} className={ghostButton}>
                굿즈 둘러보기
              </Link>
            }
          >
            주문할 수 있는 상품이 없어요. 품절됐거나 가격 공개 전인 상품은 주문할 수 없어요.
          </ShopNotice>
        ) : (
          <form onSubmit={submit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
            <div className="space-y-6">
              {/* 주문 상품 */}
              <section className={PANEL}>
                <div className={`px-4 sm:px-5 py-4 border-b ${LINE} flex items-baseline justify-between`}>
                  <h2 className={sectionTitle}>주문 상품</h2>
                  <span className="text-sm text-zinc-400">
                    {lines.length}종 · {itemCount}개
                  </span>
                </div>
                <ul className={`divide-y ${DIVIDE}`}>
                  {lines.map(({ product: p, quantity }) => (
                    <li key={p.id} className="p-4 sm:p-5 flex gap-4">
                      <Link href={productHref(p.id)} className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className="w-full h-full object-cover" />}
                      </Link>
                      <div className="min-w-0 flex-1 flex flex-col gap-2">
                        <div className="min-w-0">
                          {p.series && <div className="text-xs text-zinc-500 truncate">{p.series}</div>}
                          <Link href={productHref(p.id)} className="text-sm font-bold text-white line-clamp-2 hover:underline underline-offset-2">
                            {p.name}
                          </Link>
                          <div className="text-xs text-zinc-400 tabular-nums">{dp(p.priceDp ?? 0)} / 1개</div>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3">
                          <QtyStepper value={quantity} max={maxQty(p)} onChange={(n) => setQty(p.id, n)} small />
                          <span className="text-base font-black text-white tabular-nums">{dp((p.priceDp ?? 0) * quantity)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 배송지 */}
              <section className={`${PANEL} p-4 sm:p-5 space-y-4`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className={sectionTitle}>배송지</h2>
                  {addresses.length > 0 && !picking && (
                    <button type="button" onClick={() => setPicking(true)} className={`h-9 px-3 rounded-lg border ${LINE} text-sm text-zinc-200 hover:bg-white/5`}>
                      배송지 변경
                    </button>
                  )}
                </div>

                {!addrReady ? (
                  <p className="text-sm text-zinc-400">배송지를 불러오는 중...</p>
                ) : picking ? (
                  <div className="space-y-2" role="radiogroup" aria-label="배송지 선택">
                    {addresses.map((a) => (
                      <AddressOption key={a.id} address={a} checked={choice === a.id} onSelect={() => setChoice(a.id)} />
                    ))}
                    <label
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${choice === "new" ? "border-white/50 bg-white/[0.04]" : `${LINE} hover:bg-white/[0.03]`}`}
                    >
                      <input type="radio" name="address" checked={choice === "new"} onChange={() => setChoice("new")} className="w-4 h-4 accent-red-600" />
                      <span className="text-sm font-bold text-white">새 배송지 입력</span>
                    </label>
                    <div className="flex items-center justify-between pt-1">
                      <Link href="/mypage/?tab=address" className="text-xs text-zinc-500 underline underline-offset-2 hover:text-white">
                        배송지 관리
                      </Link>
                      <button type="button" onClick={() => setPicking(false)} className="h-9 px-4 rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200">
                        선택 완료
                      </button>
                    </div>
                  </div>
                ) : selected ? (
                  <AddressCard address={selected} />
                ) : null}

                {addrReady && choice === "new" && (
                  <div className={`space-y-3 ${addresses.length ? `pt-4 border-t ${LINE}` : ""}`}>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="space-y-1.5">
                        <span className="text-xs text-zinc-400">받는 분</span>
                        <input className={FIELD} maxLength={50} placeholder="이름" value={form.name} onChange={(e) => set("name", e.target.value)} />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs text-zinc-400">연락처</span>
                        <input className={FIELD} maxLength={20} inputMode="tel" placeholder="010-0000-0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      <span className="block text-xs text-zinc-400">주소</span>
                      <div className="flex gap-2">
                        <div className="w-28 shrink-0">
                          <input className={`${FIELD} cursor-pointer`} readOnly placeholder="우편번호" value={form.postcode} onClick={findAddress} aria-label="우편번호" />
                        </div>
                        <button type="button" onClick={findAddress} className="h-11 px-4 shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold">
                          주소 검색
                        </button>
                      </div>
                      <input className={`${FIELD} cursor-pointer`} readOnly placeholder="주소 검색을 눌러 주소를 찾아 주세요" value={form.address} onClick={findAddress} aria-label="주소" />
                      <input className={FIELD} maxLength={200} placeholder="상세 주소 (동·호수)" value={form.addressDetail} onChange={(e) => set("addressDetail", e.target.value)} aria-label="상세 주소" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                      <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="w-4 h-4 accent-red-600" />
                      기본 배송지로 저장
                    </label>
                  </div>
                )}

                <div className={`pt-4 border-t ${LINE} space-y-2`}>
                  <label htmlFor="request-note" className="block text-sm font-bold text-zinc-200">
                    배송 요청사항
                  </label>
                  <select id="request-note" value={noteChoice} onChange={(e) => setNoteChoice(e.target.value)} className={FIELD}>
                    <option value="">선택 안 함</option>
                    {NOTE_PRESETS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                    <option value={NOTE_CUSTOM}>직접 입력</option>
                  </select>
                  {noteChoice === NOTE_CUSTOM && (
                    <input className={FIELD} maxLength={200} placeholder="요청사항을 적어 주세요 (200자까지)" value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus />
                  )}
                </div>
              </section>
            </div>

            {/* 결제 금액 */}
            <aside className={`lg:sticky lg:top-28 ${PANEL} p-5 space-y-4`}>
              <h2 className={sectionTitle}>결제 금액</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-400">상품 금액</dt>
                  <dd className="text-zinc-200 tabular-nums">{dp(total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-400">배송비</dt>
                  <dd className="text-zinc-200 tabular-nums">0 DP</dd>
                </div>
              </dl>
              <div className={`pt-4 border-t ${LINE} flex justify-between items-baseline`}>
                <span className="text-sm font-bold text-zinc-200">총 결제 금액</span>
                <span className="text-2xl font-black text-amber-300 tabular-nums">{dp(total)}</span>
              </div>

              <div className="rounded-lg bg-zinc-950 border border-white/[0.08] p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400">보유 DP</span>
                  <span className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums ${short && !isApp ? "text-red-400" : "text-white"}`}>{balance === null ? "-" : dp(balance)}</span>
                    {!isApp && (
                      <Link href={chargeHref} className="h-7 px-2.5 rounded-md border border-white/20 text-xs font-bold text-zinc-200 hover:bg-white/10 inline-flex items-center">
                        DP 충전
                      </Link>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">결제 후 남는 DP</span>
                  <span className={`tabular-nums ${short && !isApp ? "text-red-400" : "text-zinc-200"}`}>{balance === null ? "-" : short ? (isApp ? dp(cardAmountFor(total - balance) - (total - balance)) : "부족") : dp(balance - total)}</span>
                </div>
              </div>

              {short && isApp && (
                <div className="rounded-lg border border-white/[0.08] bg-zinc-950 p-3 text-sm text-zinc-300">
                  DP 가 {dp(total - (balance ?? 0))} 모자라요. 결제하면 모자란 금액 <span className="font-bold text-white">{cardAmountFor(total - (balance ?? 0)).toLocaleString()}원</span>을 카드로 내고 바로 주문해요.
                </div>
              )}
              {short && !isApp && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 space-y-2">
                  <p className="text-sm text-red-300">DP 가 {dp(total - (balance ?? 0))} 모자라요. 충전한 뒤 이 페이지로 돌아와 결제할 수 있어요.</p>
                  <Link href={chargeHref} className="inline-flex h-9 px-4 items-center rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200">
                    DP 충전하러 가기
                  </Link>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-zinc-400 cursor-pointer leading-relaxed">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-red-600 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  주문 상품과 배송지를 확인했고, {isApp ? "결제" : "DP 결제"}에 동의해요. 발송 전에는 직접 취소할 수 있어요.{" "}
                  <Link href="/refund/" className="underline">
                    환불 규정
                  </Link>
                </span>
              </label>
              <button
                type="submit"
                disabled={busy || (short && !isApp)}
                className="w-full h-14 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-base disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {busy ? "결제하는 중..." : short && isApp ? `카드 ${cardAmountFor(total - (balance ?? 0)).toLocaleString()}원 결제하고 주문하기` : `${dp(total)} 결제하기`}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <p className="text-xs text-zinc-500 text-center">{isApp ? "보유 DP 를 먼저 쓰고, 모자라면 카드로 내요. 1 DP = 1원" : "덕지 포인트(DP)로 결제해요. 1 DP = 1원"}</p>
            </aside>
          </form>
        )}
      </main>
      <Footer />
    </div>
  )
}

function AddressLines({ address: a }: { address: MyAddress }) {
  return (
    <div className="space-y-0.5 text-sm">
      <div className="text-zinc-200">
        {a.recipient || "받는 분 없음"} <span className="text-zinc-500">·</span> {a.phone || "연락처 없음"}
      </div>
      <div className="text-zinc-400 break-keep">
        ({a.zipCode}) {a.address1} {a.address2}
      </div>
    </div>
  )
}

function AddressTitle({ address: a }: { address: MyAddress }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-white">{a.label || a.recipient || "배송지"}</span>
      {a.isDefault && <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300 text-xs font-bold">기본</span>}
    </div>
  )
}

function AddressCard({ address }: { address: MyAddress }) {
  return (
    <div className="rounded-lg bg-zinc-950 border border-white/[0.08] p-4 space-y-1.5">
      <AddressTitle address={address} />
      <AddressLines address={address} />
    </div>
  )
}

function AddressOption({ address, checked, onSelect }: { address: MyAddress; checked: boolean; onSelect: () => void }) {
  return (
    <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer ${checked ? "border-white/50 bg-white/[0.04]" : `${LINE} hover:bg-white/[0.03]`}`}>
      <input type="radio" name="address" checked={checked} onChange={onSelect} className="mt-0.5 w-4 h-4 accent-red-600 shrink-0" />
      <div className="min-w-0 space-y-1.5">
        <AddressTitle address={address} />
        <AddressLines address={address} />
      </div>
    </label>
  )
}

function OrderComplete({ order, balance }: { order: StoreOrder; balance: number }) {
  const r = order.recipient
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" />
        <p className="text-2xl font-black text-white">주문이 완료됐어요</p>
        <p className="text-sm text-zinc-400">
          주문 번호 <span className="font-bold text-zinc-100">{order.orderNo}</span>
          <span className="text-zinc-600"> · </span>
          {new Date(order.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <section className={PANEL}>
        <h2 className={`px-5 py-4 border-b ${LINE} text-base font-bold text-white`}>주문 상품</h2>
        <ul className={`divide-y ${DIVIDE}`}>
          {order.items.map((i, idx) => (
            <li key={idx} className="px-5 py-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">{i.imageUrl && <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white line-clamp-2">{i.name}</div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  {dp(i.priceDp)} × {i.quantity}개
                </div>
              </div>
              <span className="text-sm font-bold text-white tabular-nums shrink-0">{dp(i.priceDp * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section className={`${PANEL} p-5 space-y-2`}>
          <h2 className="text-base font-bold text-white">배송지</h2>
          <div className="text-sm text-zinc-200">
            {r.name} <span className="text-zinc-500">·</span> {r.phone}
          </div>
          <div className="text-sm text-zinc-400 break-keep">
            ({r.postcode}) {r.address} {r.addressDetail}
          </div>
          {order.requestNote && <div className="text-sm text-zinc-400">요청사항: {order.requestNote}</div>}
        </section>
        <section className={`${PANEL} p-5 space-y-2`}>
          <h2 className="text-base font-bold text-white">결제 정보</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">결제 수단</dt>
              <dd className="text-zinc-200">덕지 포인트(DP)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">결제한 DP</dt>
              <dd className="font-bold text-amber-300 tabular-nums">{dp(order.totalDp)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">남은 DP</dt>
              <dd className="text-zinc-200 tabular-nums">{dp(balance)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="text-sm text-zinc-400 text-center">발송 전에는 마이페이지 주문 내역에서 직접 취소할 수 있고, 취소하면 DP 가 바로 돌아와요.</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/mypage/?tab=orders" className="h-12 px-8 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm inline-flex items-center justify-center">
          주문 내역 보기
        </Link>
        <Link href={goodsTabHref("ranking")} className={`h-12 px-8 rounded-xl border ${LINE} text-sm font-bold text-zinc-200 hover:bg-white/5 inline-flex items-center justify-center`}>
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  )
}

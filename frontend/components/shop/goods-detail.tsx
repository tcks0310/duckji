"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Heart, ShoppingBag, Star } from "lucide-react"
import { Footer } from "@/components/footer"
import { GoodsShopHeader, goodsTabHref } from "@/components/shop/goods-shop-header"
import { canBuy, ghostButton, LINE, maxQty, PANEL, QtyStepper, ShopNotice, Stars, useWish } from "@/components/shop/shop-ui"
import { goToLogin } from "@/lib/member-auth"
import { addToCart } from "@/lib/saved-items"
import {
  deleteReview,
  dp,
  fetchProduct,
  fetchReviews,
  loadStoreProducts,
  productToGoods,
  saveReview,
  useStoreProducts,
  type StoreProduct,
  type StoreReview,
} from "@/lib/store"

// 굿즈 상세 (/store/goods/detail/?id=<상품 id>): 왼쪽 사진, 오른쪽 가격·수량·찜·장바구니·바로 구매
// 아래 탭: 상품 정보(설명 + 상세 이미지) / 구성·규격 / 후기 / 배송·교환 안내. #reviews 로 열면 후기로 이동
// 바로 구매는 /store/goods/checkout/?product=<id>&qty=<n>

const SECTIONS = [
  { id: "info", label: "상품 정보" },
  { id: "specs", label: "구성·규격" },
  { id: "reviews", label: "후기" },
  { id: "shipping", label: "배송·교환 안내" },
] as const

export function GoodsDetail() {
  const params = useSearchParams()
  const id = Number(params.get("id"))
  const { products, status } = useStoreProducts()
  const listed = products.find((p) => p.id === id)
  const [fetched, setFetched] = useState<StoreProduct | null>(null)
  const [missing, setMissing] = useState(false)

  // 목록에 없는 상품(판매 종료 등)도 주소로 열 수 있게 한 번 따로 확인
  useEffect(() => {
    if (!(id > 0)) return setMissing(true)
    let alive = true
    setMissing(false)
    fetchProduct(id).then((r) => {
      if (!alive) return
      if (r.status === "ok") setFetched(r.data.product)
      else setMissing(true)
    })
    return () => {
      alive = false
    }
  }, [id])

  const product = listed ?? fetched
  const active = product?.category ? `cat:${product.category}` : ""

  return (
    <div className="min-h-screen bg-transparent text-zinc-100 flex flex-col">
      <GoodsShopHeader active={active} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        {product ? (
          <ProductView product={product} />
        ) : missing && status !== "loading" && status !== "idle" ? (
          <ShopNotice
            action={
              <Link href={goodsTabHref("ranking")} className={ghostButton}>
                굿즈샵으로 가기
              </Link>
            }
          >
            상품을 찾을 수 없어요. 판매가 끝났거나 주소가 잘못됐을 수 있어요.
          </ShopNotice>
        ) : (
          <p className="py-24 text-center text-sm text-zinc-400">상품을 불러오는 중...</p>
        )}
      </main>
      <Footer />
    </div>
  )
}

function ProductView({ product: p }: { product: StoreProduct }) {
  const router = useRouter()
  const wish = useWish()
  const liked = wish.liked(p.id)
  const max = maxQty(p)
  const [qty, setQty] = useState(1)
  const [cartMsg, setCartMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState<string>("info")
  const [reviewCount, setReviewCount] = useState(p.reviewCount)
  const buyable = canBuy(p)

  useEffect(() => setReviewCount(p.reviewCount), [p.reviewCount])
  useEffect(() => setQty((q) => Math.min(q, max)), [max])

  // #reviews 로 들어오면 후기로 이동
  useEffect(() => {
    if (window.location.hash === "#reviews") setTimeout(() => document.getElementById("reviews")?.scrollIntoView(), 200)
  }, [])

  // 스크롤 위치에 맞춰 아래 탭 표시
  useEffect(() => {
    const onScroll = () => {
      let current: string = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top < 200) current = s.id
      }
      setSection(current)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const putInCart = async () => {
    if (busy) return
    setBusy(true)
    const r = await addToCart(productToGoods(p), qty)
    setBusy(false)
    if (r === "login") return goToLogin()
    if (r === "error") return window.alert("장바구니에 담지 못했어요. 잠시 후 다시 시도해 주세요.")
    setCartMsg(`장바구니에 ${qty}개 담았어요.`)
  }

  const buyNow = () => router.push(`/store/goods/checkout/?product=${p.id}&qty=${qty}`)

  return (
    <>
      {/* 위치: 굿즈샵 › 분류 */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400" aria-label="상품 위치">
        <Link href={goodsTabHref("ranking")} className="hover:text-white">
          굿즈샵
        </Link>
        {p.categoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <Link href={goodsTabHref({ cat: p.category })} className="hover:text-white">
              {p.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
        <Gallery images={p.imageUrls} name={p.name} soldOut={p.soldOut} />

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {p.badge && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">{p.badge}</span>}
              {p.series && <span className="text-sm text-zinc-400">{p.series}</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight break-keep">{p.name}</h1>
            <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
              {p.rating !== null && reviewCount > 0 ? (
                <>
                  <Stars value={p.rating} />
                  <span className="font-bold text-zinc-200">{p.rating.toFixed(1)}</span>
                  <span className="underline underline-offset-2">후기 {reviewCount.toLocaleString()}개</span>
                </>
              ) : (
                <span className="underline underline-offset-2">아직 후기가 없어요</span>
              )}
            </a>
          </div>

          <div className={`pb-6 border-b ${LINE}`}>
            {p.priceDp === null ? (
              <div className="text-2xl font-semibold text-zinc-300">가격 공개 예정</div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tabular-nums">{p.priceDp.toLocaleString()}</span>
                <span className="text-lg font-bold text-white">DP</span>
                <span className="text-sm text-zinc-500">1 DP = 1원</span>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-[88px_1fr] gap-y-3 text-sm">
            <dt className="text-zinc-500">결제</dt>
            <dd className="text-zinc-200">덕지 포인트(DP)</dd>
            <dt className="text-zinc-500">구매 제한</dt>
            <dd className="text-zinc-200">한 번에 {Math.min(p.maxPerOrder || 99, 99)}개까지</dd>
            <dt className="text-zinc-500">재고</dt>
            <dd className={p.soldOut ? "text-red-400 font-bold" : p.stock !== null && p.stock <= 10 ? "text-amber-400 font-bold" : "text-zinc-200"}>
              {p.soldOut ? "품절" : p.stock !== null && p.stock <= 10 ? `${p.stock}개 남음` : "구매 가능"}
            </dd>
          </dl>

          {buyable && (
            <div className={`${PANEL} p-4 space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-200 line-clamp-1">{p.name}</span>
                <QtyStepper value={qty} max={max} onChange={setQty} small />
              </div>
              <div className={`pt-3 border-t ${LINE} flex items-baseline justify-between`}>
                <span className="text-sm text-zinc-400">총 상품 금액 <span className="text-zinc-500">({qty}개)</span></span>
                <span className="text-2xl font-bold text-emerald-300 tabular-nums">{dp((p.priceDp ?? 0) * qty)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => wish.toggle(p.id)}
              aria-pressed={liked}
              aria-label={liked ? "찜 해제" : "찜하기"}
              className={`h-14 ${buyable ? "w-14 shrink-0" : "flex-1 gap-2"} rounded-full border border-zinc-600 hover:border-zinc-400 flex items-center justify-center text-sm font-bold text-white`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-zinc-300"}`} />
              {!buyable && (liked ? "찜했어요" : "찜하기")}
            </button>
            {buyable ? (
              <>
                <button
                  type="button"
                  onClick={putInCart}
                  disabled={busy}
                  className="flex-1 h-14 rounded-full border border-zinc-600 hover:border-zinc-400 text-white text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <ShoppingBag className="w-5 h-5" />
                  장바구니
                </button>
                <button type="button" onClick={buyNow} className="flex-1 h-14 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-base font-semibold">
                  바로 구매
                </button>
              </>
            ) : (
              <div className="flex-[2] h-14 rounded-full bg-zinc-800 text-zinc-400 text-base font-bold flex items-center justify-center">
                {p.soldOut ? "품절" : "가격 공개 예정"}
              </div>
            )}
          </div>

          {cartMsg && (
            <div className={`${PANEL} px-4 py-3 flex items-center justify-between gap-3 text-sm`}>
              <span className="text-zinc-200">{cartMsg}</span>
              <Link href="/store/goods/cart/" className="font-bold text-white underline underline-offset-2 shrink-0">
                장바구니 보기
              </Link>
            </div>
          )}
          {p.priceDp === null && <p className="text-sm text-zinc-400">가격이 정해지면 살 수 있어요. 찜해 두면 찜 목록에서 다시 찾아볼 수 있어요.</p>}
        </div>
      </div>

      {/* 아래 탭 (화면 위에 붙어 따라옴) */}
      <div
        className={`sticky z-30 mt-14 bg-[hsl(var(--background)/0.95)] backdrop-blur border-b ${LINE} top-[56px] sm:top-[68px] md:top-[76px] lg:top-[84px]`}
      >
        <ul className="grid grid-cols-4">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })}
                className={`w-full h-12 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  section === s.id ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {s.label}
                {s.id === "reviews" && <span className="ml-1 text-zinc-500 tabular-nums">{reviewCount}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="max-w-4xl mx-auto">
        <section id="info" className="scroll-mt-40 pt-10 pb-12">
          <h2 className="sr-only">상품 정보</h2>
          {p.description && <p className="text-base text-zinc-200 leading-relaxed whitespace-pre-line break-keep mb-8">{p.description}</p>}
          {p.detailImageUrls.length > 0 ? (
            <div className="flex flex-col">
              {p.detailImageUrls.map((src, i) => (
                <img key={i} src={src} alt={`${p.name} 상세 설명 ${i + 1}`} className="w-full h-auto block" loading="lazy" />
              ))}
            </div>
          ) : (
            !p.description && <p className="py-12 text-center text-sm text-zinc-500">상세 설명이 아직 없어요.</p>
          )}
        </section>

        <section id="specs" className={`scroll-mt-40 py-12 border-t ${LINE}`}>
          <h2 className="text-lg font-bold text-white mb-4">구성·규격</h2>
          <SpecsTable product={p} />
        </section>

        <section id="reviews" className={`scroll-mt-40 py-12 border-t ${LINE}`}>
          <Reviews product={p} onCount={setReviewCount} />
        </section>

        <section id="shipping" className={`scroll-mt-40 py-12 border-t ${LINE}`}>
          <h2 className="text-lg font-bold text-white mb-4">배송·교환 안내</h2>
          <ul className="space-y-2 text-sm text-zinc-300 list-disc pl-5 leading-relaxed">
            <li>상품 금액은 덕지 포인트(DP)로 결제해요. 1 DP = 1원이에요.</li>
            <li>발송 전(결제 완료 상태)에는 마이페이지 주문 내역에서 직접 취소할 수 있고, 결제한 DP 가 바로 돌아와요.</li>
            <li>발송되면 주문 내역에서 송장 번호를 볼 수 있어요.</li>
            <li>발송한 뒤의 교환·반품은 고객센터로 문의해 주세요.</li>
            <li>
              자세한 내용은{" "}
              <Link href="/refund/" className="underline underline-offset-2 hover:text-white">
                환불 규정
              </Link>
              을 확인해 주세요.
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}

function Gallery({ images, name, soldOut }: { images: string[]; name: string; soldOut: boolean }) {
  const [idx, setIdx] = useState(0)
  const current = images[Math.min(idx, images.length - 1)]
  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length)
  return (
    <div className="space-y-3 lg:sticky lg:top-28">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900">
        {current ? (
          <img src={current} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-zinc-600">이미지 준비 중</div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-full border border-white/40 text-base font-bold text-white">품절</span>
          </div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="이전 사진" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="다음 사진" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center">
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-xs text-white tabular-nums">
              {idx + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              onMouseEnter={() => setIdx(i)}
              aria-label={`사진 ${i + 1}`}
              className={`aspect-square rounded-lg overflow-hidden bg-zinc-900 border-2 ${i === idx ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 규격은 '항목: 내용' 이면 두 칸으로, 아니면 한 줄로
function SpecsTable({ product: p }: { product: StoreProduct }) {
  const rows: [string, string][] = []
  if (p.categoryName) rows.push(["분류", p.categoryName])
  if (p.series) rows.push(["시리즈", p.series])
  p.specs.forEach((s) => {
    const m = s.match(/^([^:：]{1,20})[:：]\s*(.+)$/)
    rows.push(m ? [m[1].trim(), m[2].trim()] : ["", s])
  })
  if (!rows.length) return <p className="text-sm text-zinc-500">등록된 규격 정보가 없어요.</p>
  return (
    <table className={`w-full text-sm border-t ${LINE}`}>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className={`border-b ${LINE}`}>
            {k ? (
              <>
                <th scope="row" className="w-32 sm:w-40 py-3 px-4 text-left font-normal text-zinc-400 bg-white/[0.03] align-top">
                  {k}
                </th>
                <td className="py-3 px-4 text-zinc-200">{v}</td>
              </>
            ) : (
              <td colSpan={2} className="py-3 px-4 text-zinc-200">
                {v}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---- 후기: 주문한 회원만 쓰기, 상품당 하나 (다시 쓰면 고침)

const REVIEW_PAGE = 10

function Reviews({ product: p, onCount }: { product: StoreProduct; onCount: (n: number) => void }) {
  const [data, setData] = useState<{ reviews: StoreReview[]; canWrite: boolean; loggedIn: boolean } | null>(null)
  const [error, setError] = useState("")
  const [shown, setShown] = useState(REVIEW_PAGE)
  const [editing, setEditing] = useState(false)

  const load = async () => {
    const r = await fetchReviews(p.id)
    if (r.status === "ok") {
      setData(r.data)
      setError("")
      onCount(r.data.reviews.length)
    } else setError(r.status === "login" ? "" : r.error)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  const reviews = data?.reviews ?? []
  const mine = reviews.find((r) => r.mine)
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const dist = useMemo(() => [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length })), [reviews])

  const changed = async () => {
    setEditing(false)
    await load()
    loadStoreProducts()
  }

  const remove = async () => {
    if (!window.confirm("내 후기를 지울까요?")) return
    const r = await deleteReview(p.id)
    if (r.status === "login") return goToLogin()
    if (r.status === "error") return window.alert(r.error)
    changed()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          후기 <span className="text-zinc-500 tabular-nums">{reviews.length}</span>
        </h2>
        {data?.canWrite && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="h-10 px-5 rounded-full bg-emerald-400 text-zinc-950 text-sm font-semibold hover:bg-emerald-300">
            {mine ? "내 후기 고치기" : "후기 쓰기"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className={`${PANEL} p-5 sm:p-6 grid sm:grid-cols-[180px_1fr] gap-6 items-center`}>
        <div className="text-center space-y-1">
          <div className="text-4xl font-bold text-white tabular-nums">{reviews.length ? avg.toFixed(1) : "-"}</div>
          <Stars value={avg} size="w-4 h-4" />
          <div className="text-xs text-zinc-500">후기 {reviews.length.toLocaleString()}개</div>
        </div>
        <ul className="space-y-1.5">
          {dist.map(({ n, count }) => (
            <li key={n} className="flex items-center gap-3 text-xs">
              <span className="w-8 text-zinc-400 tabular-nums">{n}점</span>
              <span className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <span className="block h-full bg-amber-400 rounded-full" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} />
              </span>
              <span className="w-8 text-right text-zinc-500 tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      {editing && data?.canWrite && <ReviewForm productId={p.id} mine={mine} onDone={changed} onCancel={() => setEditing(false)} />}

      {data && !data.canWrite && (
        <p className="text-sm text-zinc-500">
          {data.loggedIn ? (
            "후기는 이 상품을 주문한 회원만 쓸 수 있어요."
          ) : (
            <>
              후기는 이 상품을 주문한 회원만 쓸 수 있어요.{" "}
              <button type="button" onClick={() => goToLogin(`${window.location.pathname}${window.location.search}#reviews`)} className="underline underline-offset-2 hover:text-white">
                로그인
              </button>
            </>
          )}
        </p>
      )}

      {data === null && !error ? (
        <p className="py-8 text-center text-sm text-zinc-400">후기를 불러오는 중...</p>
      ) : reviews.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">아직 후기가 없어요.</p>
      ) : (
        <ul className={`border-t ${LINE}`}>
          {reviews.slice(0, shown).map((r) => (
            <li key={r.id} className={`py-5 border-b ${LINE} space-y-2`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Stars value={r.rating} />
                <span className="text-sm font-bold text-zinc-200">{r.author}</span>
                {r.mine && <span className="px-1.5 py-0.5 rounded bg-white/10 text-xs text-zinc-200">내 후기</span>}
                <span className="text-xs text-zinc-500">{new Date(r.createdAt).toLocaleDateString("ko-KR")}</span>
                {r.mine && (
                  <span className="ml-auto flex gap-3 text-xs">
                    <button type="button" onClick={() => setEditing(true)} className="text-zinc-400 hover:text-white">
                      고치기
                    </button>
                    <button type="button" onClick={remove} className="text-zinc-400 hover:text-white">
                      지우기
                    </button>
                  </span>
                )}
              </div>
              {r.content && <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line break-keep">{r.content}</p>}
            </li>
          ))}
        </ul>
      )}
      {reviews.length > shown && (
        <div className="text-center">
          <button type="button" onClick={() => setShown((n) => n + REVIEW_PAGE)} className={ghostButton}>
            후기 더 보기 ({reviews.length - shown})
          </button>
        </div>
      )}
    </div>
  )
}

const STAR_WORDS = ["", "별로예요", "그저 그래요", "괜찮아요", "좋아요", "아주 좋아요"]

function ReviewForm({ productId, mine, onDone, onCancel }: { productId: number; mine?: StoreReview; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState(mine?.content ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const shownRating = hover || rating

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return setError("별점을 골라 주세요.")
    setBusy(true)
    setError("")
    const r = await saveReview(productId, rating, content.trim())
    setBusy(false)
    if (r.status === "login") return goToLogin()
    if (r.status === "error") return setError(r.error)
    onDone()
  }

  return (
    <form onSubmit={submit} className={`${PANEL} p-5 space-y-4`}>
      <h3 className="text-base font-bold text-white">{mine ? "내 후기 고치기" : "후기 쓰기"}</h3>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n}점`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5"
            >
              <Star className={`w-7 h-7 ${n <= shownRating ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
            </button>
          ))}
        </div>
        <span className="text-sm text-zinc-300">{shownRating ? STAR_WORDS[shownRating] : "별점을 골라 주세요"}</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="상품을 받아 보니 어땠는지 적어 주세요. (선택)"
        className="w-full px-3 py-2.5 rounded-lg bg-zinc-950 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500 tabular-nums">{content.length} / 1000</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={ghostButton}>
            취소
          </button>
          <button type="submit" disabled={busy} className="h-10 px-5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-sm font-semibold disabled:opacity-60">
            {busy ? "저장하는 중..." : mine ? "고쳐서 저장" : "후기 올리기"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { MyPageShell } from "@/components/mypage/mypage-shell"
import { EmptyState, failAlert, popupHref, viewTab } from "@/components/mypage/saved-panels"
import { usePopupEvents } from "@/lib/popup-service"
import { dp, useStoreProducts } from "@/lib/store"
import { toggleLike, useSavedItems, type LikeKind } from "@/lib/saved-items"
import { courseDetailHref, fetchCourses, type PilgrimageCourseInfo } from "@/lib/pilgrimage"

// 찜한 항목 (/mypage/liked): 팝업·굿즈·순례 코스를 종류별로. 카드를 누르면 해당 페이지로, 하트를 누르면 찜 해제
// ?kind=popup|goods|course 로 열면 그 종류만

const KINDS: { id: LikeKind; label: string; empty: string; browse: string; browseLabel: string }[] = [
  { id: "popup", label: "팝업", empty: "찜한 팝업이 없어요.", browse: "/popups/", browseLabel: "팝업 둘러보기" },
  { id: "goods", label: "굿즈", empty: "찜한 굿즈가 없어요.", browse: "/store/goods/", browseLabel: "굿즈샵 가기" },
  { id: "course", label: "덕지순례", empty: "찜한 덕지순례가 없어요.", browse: "/popups/pilgrimage/", browseLabel: "덕지순례 보기" },
]

type Filter = "all" | LikeKind
type Card = { id: string; kind: LikeKind; title: string; sub?: string; image?: string; href: string; gone: boolean }

export default function LikedPage() {
  return (
    <MyPageShell active="liked" title="찜한 항목" description="하트를 누른 팝업, 굿즈, 덕지순례예요.">
      <LikedList />
    </MyPageShell>
  )
}

function LikedList() {
  const saved = useSavedItems()
  const storeProducts = useStoreProducts().products
  const popups = usePopupEvents()
  const [filter, setFilter] = useState<Filter>("all")
  // 관리자가 만든 덕지순례 코스 (서버). 예전에 찜한 예시 코스는 화면 파일에서 찾음
  const [dbCourses, setDbCourses] = useState<PilgrimageCourseInfo[]>([])
  useEffect(() => {
    fetchCourses().then((r) => r.ok && setDbCourses(r.data.courses))
  }, [])

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kind")
    if (k && KINDS.some((x) => x.id === k)) setFilter(k as LikeKind)
  }, [])

  const choose = (f: Filter) => {
    setFilter(f)
    window.history.replaceState(null, "", f === "all" ? "/mypage/liked/" : `/mypage/liked/?kind=${f}`)
  }

  if (saved.status === "unknown" || saved.status === "loading") return <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>

  const popupById = new Map(popups.map((p) => [p.id, p]))
  const goodsById = new Map(storeProducts.map((g) => [String(g.id), g]))
  const dbCourseById = new Map(dbCourses.map((c) => [c.id, c]))

  // 최근에 찜한 것이 위로
  const cards: Record<LikeKind, Card[]> = {
    popup: [...saved.likes.popup].reverse().map((id) => {
      const p = popupById.get(id)
      return { id, kind: "popup", title: p?.title || "종료되었거나 내려간 팝업", sub: p ? `${p.location} · ${p.startDate} ~ ${p.endDate}` : undefined, image: p?.posterUrl, href: popupHref(id), gone: !p }
    }),
    goods: [...saved.likes.goods].reverse().map((id) => {
      const g = goodsById.get(id)
      return { id, kind: "goods", title: g?.name || "판매 목록에서 내려간 굿즈", sub: g ? (g.priceDp === null ? "가격 공개 예정" : dp(g.priceDp)) : undefined, image: g?.imageUrls[0], href: `/store/goods/detail/?id=${id}`, gone: !g }
    }),
    course: [...saved.likes.course].reverse().map((id) => {
      const d = dbCourseById.get(id)
      if (d) return { id, kind: "course", title: d.title, sub: [d.region, d.theme, d.durationText].filter(Boolean).join(" · "), image: d.coverImage, href: courseDetailHref(id), gone: false }
      return { id, kind: "course", title: "내려간 덕지순례", href: "/popups/pilgrimage/", gone: true }
    }),
  }
  const total = cards.popup.length + cards.goods.length + cards.course.length
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "전체", count: total },
    ...KINDS.map((k) => ({ id: k.id as Filter, label: k.label, count: cards[k.id].length })),
  ]
  const shown = filter === "all" ? KINDS : KINDS.filter((k) => k.id === filter)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" role="tablist">
        {tabs.map((t, i) => (
          <React.Fragment key={t.id}>
            {i > 0 && <span className="w-px h-3 bg-zinc-700" aria-hidden />}
            <button role="tab" aria-selected={filter === t.id} onClick={() => choose(t.id)} className={viewTab(filter === t.id)}>
              {t.label} {t.count}
            </button>
          </React.Fragment>
        ))}
      </div>

      {filter === "all" && total === 0 ? (
        <EmptyState text="아직 찜한 항목이 없어요. 마음에 드는 팝업이나 굿즈에서 하트를 눌러 보세요." href="/popups/" linkLabel="팝업 둘러보기" />
      ) : (
        shown.map((k) => {
          const list = cards[k.id]
          if (filter === "all" && list.length === 0) return null
          return (
            <section key={k.id}>
              {filter === "all" && (
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">
                    {k.label} <span className="text-zinc-500 font-normal">{list.length}</span>
                  </h3>
                  <Link href={k.browse} className="text-sm text-zinc-400 hover:text-white">
                    {k.browseLabel}
                  </Link>
                </div>
              )}
              {list.length === 0 ? (
                <EmptyState text={k.empty} href={k.browse} linkLabel={k.browseLabel} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {list.map((c) => (
                    <LikedCard key={`${c.kind}-${c.id}`} card={c} label={k.label} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

function LikedCard({ card, label }: { card: Card; label: string }) {
  const [busy, setBusy] = useState(false)
  const unlike = async () => {
    setBusy(true)
    failAlert(await toggleLike(card.kind, card.id))
    setBusy(false)
  }
  const body = (
    <>
      <div className="aspect-[4/3] bg-zinc-900 rounded-lg overflow-hidden">
        {card.image && <img src={card.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
      </div>
      <div className="pt-2.5 space-y-1">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:underline">{card.title}</div>
        {card.sub && <div className="text-xs text-zinc-400 truncate">{card.sub}</div>}
      </div>
    </>
  )
  return (
    <div className="relative group">
      {card.gone ? <div className="opacity-60">{body}</div> : <Link href={card.href}>{body}</Link>}
      <button
        onClick={unlike}
        disabled={busy}
        aria-label="찜 해제"
        title="찜 해제"
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-zinc-950/70 flex items-center justify-center text-rose-400 hover:text-rose-300 disabled:opacity-50"
      >
        <Heart className="w-4 h-4 fill-current" />
      </button>
    </div>
  )
}

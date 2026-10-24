"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Share2,
  Ticket,
  Users,
} from "lucide-react"
import type { PopupEvent } from "@/data/popup-data"
import { fetchPopup, recordPopupView } from "@/lib/popup-service"
import { recordPopupQrScan } from "@/lib/popup-qr"
import { removePopupAlert, setPopupAlert, toggleLike, useSavedItems } from "@/lib/saved-items"
import { SubPageHeader } from "@/components/portal/sub-page-header"
import { Footer } from "@/components/footer"
import { PopupMap } from "@/components/map/popup-map"
import { OwnPopupBooking } from "@/components/events/own-popup-booking"

// 팝업 상세 페이지 (/popups/detail/?id=). 예전에는 목록·지도·캘린더에서 상세 창(모달)만 떴음
// 자사·제휴 팝업(operationType own | partner)은 예약·현장 웨이팅을 이 페이지 안에서 받음

type LoadState = { status: "loading" } | { status: "ok"; popup: PopupEvent } | { status: "missing" } | { status: "error" }

const OPERATION_LABELS: Record<string, string> = {
  own: "덕지 자사 팝업",
  partner: "덕지 제휴 팝업",
  listing: "팝업 소개",
}

const section = "rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6"
const sectionTitle = "text-lg font-bold text-white"

// 비로그인으로 회원 기능을 누르면 로그인 페이지로
function askLogin(message: string) {
  if (window.confirm(`${message} 로그인할까요?`)) window.location.assign("/login/")
}

function dDayText(p: PopupEvent) {
  if (p.status === "ended") return "종료"
  if (p.status === "upcoming") return p.dDay > 0 ? `오픈까지 D-${p.dDay}` : "오픈 예정"
  return p.dDay > 0 ? `종료까지 D-${p.dDay}` : "오늘 마감"
}

function statusClass(status: PopupEvent["status"]) {
  if (status === "ongoing") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  if (status === "upcoming") return "bg-sky-500/15 text-sky-300 border-sky-500/30"
  if (status === "closing_soon") return "bg-rose-500/15 text-rose-300 border-rose-500/30"
  return "bg-zinc-800 text-zinc-400 border-zinc-700"
}

export function PopupDetailPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || ""
  const [state, setState] = useState<LoadState>({ status: "loading" })

  const load = useCallback(() => {
    if (!id) return setState({ status: "missing" })
    setState({ status: "loading" })
    fetchPopup(id)
      .then((popup) => setState(popup ? { status: "ok", popup } : { status: "missing" }))
      .catch(() => setState({ status: "error" }))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // 조회 수 기록 (세션마다 팝업당 한 번), 현장 QR(&ref=qr)로 왔으면 유입 기록 뒤 주소에서 ref 를 뺌
  useEffect(() => {
    if (state.status !== "ok") return
    recordPopupView(state.popup.id)
    document.title = `${state.popup.title} | 덕지`
    const params = new URLSearchParams(window.location.search)
    if (params.get("ref") === "qr") {
      recordPopupQrScan(state.popup.id)
      params.delete("ref")
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`)
    }
  }, [state])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <SubPageHeader groupId="popup" />
      <main className="relative z-20 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-16 flex-1">
        <a href="/popups/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          팝업 목록으로
        </a>

        {state.status === "loading" && <div className="py-24 text-center text-zinc-400">팝업 정보를 불러오는 중입니다.</div>}

        {state.status === "missing" && (
          <div className={`${section} mt-6 py-16 text-center space-y-3`}>
            <p className="text-lg font-bold text-white">팝업을 찾을 수 없습니다.</p>
            <p className="text-sm text-zinc-400">주소가 잘못되었거나 게시가 끝난 팝업입니다.</p>
            <a href="/popups/" className="inline-block mt-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white">
              다른 팝업 보기
            </a>
          </div>
        )}

        {state.status === "error" && (
          <div className={`${section} mt-6 py-16 text-center space-y-3`}>
            <p className="text-lg font-bold text-white">팝업 정보를 불러오지 못했습니다.</p>
            <p className="text-sm text-zinc-400">잠시 후 다시 시도해주세요.</p>
            <button onClick={load} className="mt-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-white">
              다시 불러오기
            </button>
          </div>
        )}

        {state.status === "ok" && <PopupDetail popup={state.popup} />}
      </main>
      <Footer />
    </div>
  )
}

function PopupDetail({ popup }: { popup: PopupEvent }) {
  const saved = useSavedItems()
  const liked = saved.likes.popup.includes(popup.id)
  const images = [popup.posterUrl, ...(popup.galleryImages || [])].filter((src, i, all) => src && all.indexOf(src) === i)
  const [imageIndex, setImageIndex] = useState(0)
  const [shareNote, setShareNote] = useState("")
  const ended = popup.status === "ended"
  const own = !ended && (popup.operationType === "own" || popup.operationType === "partner")

  const handleLike = async () => {
    const r = await toggleLike("popup", popup.id)
    if (r === "login") askLogin("로그인한 회원만 찜할 수 있어요.")
    else if (r === "error") window.alert("저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
  }

  // 오픈·예약 소식 알림 신청 (회원 계정에 저장, 마이페이지 '찜·알림'에서 확인). 실제 발송은 추후 개선
  const myAlert = saved.alerts.find((a) => a.popupId === popup.id)
  const [alertBusy, setAlertBusy] = useState(false)
  const [alertNote, setAlertNote] = useState("")
  const handleAlert = async () => {
    setAlertBusy(true)
    setAlertNote("")
    if (myAlert) {
      const r = await removePopupAlert(popup.id)
      setAlertNote(r === "ok" ? "알림 신청을 취소했어요." : "취소하지 못했어요. 잠시 후 다시 시도해주세요.")
    } else {
      const r = await setPopupAlert(popup.id, "email")
      if (r.status === "login") askLogin("알림 신청은 로그인한 회원만 할 수 있어요.")
      else if (r.status === "error") setAlertNote(r.error || "저장하지 못했어요. 잠시 후 다시 시도해주세요.")
      else setAlertNote("알림을 신청했어요. 오픈·예약 소식을 알려 드릴게요.")
    }
    setAlertBusy(false)
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: popup.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareNote("링크를 복사했습니다.")
    } catch {
      setShareNote("")
      return
    }
    setTimeout(() => setShareNote(""), 2500)
  }

  const infoRows: { icon: React.ElementType; label: string; value: React.ReactNode }[] = [
    {
      icon: Calendar,
      label: "기간",
      value: (
        <>
          {popup.startDate} ~ {popup.endDate}
          <span className="ml-2 text-zinc-400">({dDayText(popup)})</span>
        </>
      ),
    },
    ...(popup.operatingHours ? [{ icon: Clock, label: "운영 시간", value: popup.operatingHours }] : []),
    {
      icon: MapPin,
      label: "장소",
      value: (
        <>
          {popup.venueName && <div>{popup.venueName}</div>}
          {popup.location && <div className="text-zinc-400">{popup.location}</div>}
        </>
      ),
    },
    ...(popup.admission ? [{ icon: Ticket, label: "입장", value: popup.admission }] : []),
    ...(popup.reservationLabel ? [{ icon: Users, label: "예약", value: popup.reservationLabel }] : []),
  ]

  return (
    <div className="mt-5 space-y-6">
      {/* 사진 + 기본 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
            {images.length > 0 ? (
              <img src={images[imageIndex] || images[0]} alt={popup.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-zinc-500">등록된 사진이 없습니다.</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setImageIndex(i)}
                  aria-label={`사진 ${i + 1}`}
                  className={`w-20 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${i === imageIndex ? "border-white" : "border-zinc-800 opacity-70 hover:opacity-100"}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={`px-2.5 py-1 rounded-md border ${statusClass(popup.status)}`}>{popup.statusLabel}</span>
              <span className="px-2.5 py-1 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300">{popup.categoryLabel}</span>
              {popup.operationType && (
                <span className="px-2.5 py-1 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300">{OPERATION_LABELS[popup.operationType]}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug break-keep">{popup.title}</h1>
            {popup.subTitle && <p className="text-base text-zinc-300 leading-relaxed">{popup.subTitle}</p>}
            {ended && (
              <p className="text-sm text-zinc-400">종료된 팝업이에요.</p>
            )}
          </div>

          <dl className="divide-y divide-zinc-800 border-y border-zinc-800">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3 py-3 text-sm">
                <dt className="w-24 shrink-0 flex items-center gap-1.5 text-zinc-400 whitespace-nowrap">
                  <Icon className="w-4 h-4" />
                  {label}
                </dt>
                <dd className="flex-1 min-w-0 text-zinc-100 break-keep">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            {own && (
              <a href="#booking" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold text-black">
                <Ticket className="w-4 h-4" />
                예약·웨이팅
              </a>
            )}
            <button
              onClick={handleLike}
              aria-pressed={liked}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white"
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
              {liked ? "찜함" : "찜하기"}
            </button>
            {!ended && (
            <button
              onClick={handleAlert}
              disabled={alertBusy}
              aria-pressed={Boolean(myAlert)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Bell className={`w-4 h-4 ${myAlert ? "fill-amber-300 text-amber-300" : ""}`} />
              {myAlert ? "알림 신청함" : "알림 신청"}
            </button>
            )}
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white"
            >
              <Share2 className="w-4 h-4" />
              공유
            </button>
            {popup.officialUrl && (
              <a
                href={popup.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white"
              >
                <ExternalLink className="w-4 h-4" />
                공식 페이지
              </a>
            )}
          </div>
          {shareNote && <p className="text-sm text-emerald-300">{shareNote}</p>}
          {alertNote && <p className="text-sm text-zinc-300">{alertNote}</p>}
        </div>
      </div>

      {/* 자사·제휴 팝업: 사전 예약·현장 웨이팅 */}
      {own && <BookingSection popup={popup} />}

      {/* 소개 */}
      {(popup.description || popup.highlights?.length > 0 || popup.perks?.length > 0) && (
        <section className={`${section} space-y-5`}>
          <h2 className={sectionTitle}>팝업 소개</h2>
          {popup.description && <p className="text-base text-zinc-300 leading-relaxed whitespace-pre-line">{popup.description}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popup.highlights?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-200">볼거리</h3>
                <ul className="space-y-1.5 text-sm text-zinc-300 list-disc pl-5">
                  {popup.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {popup.perks?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-200">방문·구매 혜택</h3>
                <ul className="space-y-1.5 text-sm text-zinc-300 list-disc pl-5">
                  {popup.perks.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 오시는 길 */}
      <section className={`${section} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitle}>오시는 길</h2>
          {popup.location && (
            <a
              href={`https://map.naver.com/p/search/${encodeURIComponent(popup.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              네이버 지도에서 보기
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <p className="text-sm text-zinc-300">
          {popup.venueName}
          {popup.location && <span className="block text-zinc-400">{popup.location}</span>}
        </p>
        {/* 지도 키나 좌표가 없으면 지도는 그리지 않음 */}
        <PopupMap events={[popup]} className="w-full h-72 rounded-xl border border-zinc-800 overflow-hidden" />
      </section>

      {/* 출처 */}
      {(popup.sourceName || popup.sourceUrl) && (
        <section className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-zinc-400">
          <span>
            정보 출처: {popup.sourceName || "-"}
            {popup.verifiedDate && ` (확인일 ${popup.verifiedDate})`}
          </span>
          {popup.sourceUrl && (
            <a href={popup.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
              출처 원문
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </section>
      )}
    </div>
  )
}

// 사전 예약 / 현장 웨이팅 탭 (lib/popup-booking, 서버 popups 서비스)
function BookingSection({ popup }: { popup: PopupEvent }) {
  const [mode, setMode] = useState<"booking" | "waiting">(popup.hasNativeBooking || !popup.hasNativeWaiting ? "booking" : "waiting")
  const tabs = [
    { id: "booking" as const, label: "사전 예약" },
    { id: "waiting" as const, label: "현장 웨이팅" },
  ]
  return (
    <section id="booking" className={`${section} space-y-4 scroll-mt-28`}>
      <div className="space-y-1">
        <h2 className={sectionTitle}>예약·웨이팅</h2>
        <p className="text-sm text-zinc-400">덕지 회원이면 무료로 사전 예약하거나, 현장에서 웨이팅 번호를 받을 수 있습니다.</p>
      </div>
      <div role="tablist" className="grid grid-cols-2 gap-2 max-w-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`py-2.5 rounded-xl border text-sm font-bold ${
              mode === t.id ? "bg-zinc-100 border-zinc-100 text-zinc-900" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="text-sm">
        <OwnPopupBooking popupId={popup.id} mode={mode} onRequireLogin={() => askLogin("예약·웨이팅은 로그인한 회원만 할 수 있어요.")} />
      </div>
    </section>
  )
}

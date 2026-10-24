"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePopupEvents } from "@/lib/popup-service"
import { displayStatus, fundingService } from "@/lib/funding-service"
import type { FundingParticipant, FundingProject } from "@/types/funding"
import { removePopupAlert, useSavedItems, type SaveResult } from "@/lib/saved-items"

// 마이페이지 '알림 신청' · '내 펀딩' (회원 계정에 저장된 것, lib/saved-items · funding-service)
// 찜한 항목은 /mypage/liked 페이지

// 마이페이지 목록·빈 화면 공통: 박스 없이 위아래 얇은 선만
export const listBox = "border-y border-zinc-800 divide-y divide-zinc-800"
export const emptyBox = "border-y border-zinc-800 py-14 px-5 text-center"
// 마이페이지 안의 작은 링크형 버튼 (둘러보기, 취소 등)
export const lineBtn = "inline-flex h-9 items-center px-4 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
// 마이페이지 안의 보기 전환 (예: 사전 예약 | 현장 웨이팅, 찜 종류): 박스 없는 글자 탭
export const viewTab = (on: boolean) =>
  `text-sm transition-colors ${on ? "text-white font-bold" : "text-zinc-500 hover:text-zinc-300"}`
const subTitle = "text-base font-bold text-white mb-3"
const textBtn = "text-sm text-zinc-400 hover:text-white shrink-0"
const fmtDate = (v: string) => new Date(v).toLocaleDateString("ko-KR")

// 팝업 상세 페이지 주소 (다른 작업에서 만드는 /popups/detail)
export const popupHref = (id: string) => `/popups/detail/?id=${encodeURIComponent(id)}`

export const failAlert = (r: SaveResult) => {
  if (r !== "ok") window.alert("저장하지 못했습니다. 잠시 후 다시 시도해주세요.")
}

export function EmptyState({ text, href, linkLabel }: { text: string; href?: string; linkLabel?: string }) {
  return (
    <div className={emptyBox}>
      <p className="text-sm text-zinc-400">{text}</p>
      {href && linkLabel && (
        <Link href={href} className={`mt-4 ${lineBtn}`}>
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

export function AlertsPanel() {
  const saved = useSavedItems()
  const popups = usePopupEvents()
  const popupById = new Map(popups.map((p) => [p.id, p]))

  if (saved.status === "unknown" || saved.status === "loading") return <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>

  return (
    <div className="space-y-3">
      {saved.alerts.length === 0 ? (
        <EmptyState text="팝업 상세에서 '알림 신청'을 누르면 여기에 모여요." href="/popups/" linkLabel="팝업 둘러보기" />
      ) : (
        <div className={listBox}>
          {saved.alerts.map((a) => {
            const p = popupById.get(a.popupId)
            return (
              <div key={a.popupId} className="py-4 flex items-center gap-4">
                <Link href={popupHref(a.popupId)} className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                    {p?.posterUrl && <img src={p.posterUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{p?.title || "종료되었거나 내려간 팝업"}</div>
                    {p && <div className="mt-0.5 text-sm text-zinc-400 truncate">{p.location} · {p.startDate} ~ {p.endDate}</div>}
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {a.channel === "kakao" ? "카카오톡 알림톡" : "이메일"} · {fmtDate(a.createdAt)} 신청
                    </div>
                  </div>
                </Link>
                <button onClick={() => removePopupAlert(a.popupId).then(failAlert)} className={textBtn}>
                  신청 취소
                </button>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-sm text-zinc-500">오픈 전날, 마감 3일 전, 기간·장소가 바뀌었을 때 덕지 알림함과 앱 푸시로 알려 드려요. 카카오 알림톡·이메일 발송은 준비 중이에요.</p>
    </div>
  )
}

const PAYMENT_LABEL: Record<string, string> = { reserved: "결제 예약", completed: "DP 결제 완료", refunded: "DP 환불", canceled: "취소" }

export function FundingPanel() {
  const [projects, setProjects] = useState<FundingProject[] | null>(null)
  const [parts, setParts] = useState<FundingParticipant[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([fundingService.getMyProjects(), fundingService.getMyParticipations()])
      .then(([p, j]) => {
        setProjects(p)
        setParts(j)
      })
      .catch(() => {
        setProjects([])
        setError("펀딩 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.")
      })
  }, [])

  if (projects === null) return <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>

  const row = (key: string, href: string, title: string, sub: string) => (
    <Link key={key} href={href} className="py-4 flex items-center justify-between gap-3 group">
      <div className="min-w-0">
        <div className="text-sm font-bold text-white truncate group-hover:underline">{title}</div>
        <div className="mt-0.5 text-sm text-zinc-400 truncate">{sub}</div>
      </div>
    </Link>
  )

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <section>
        <h3 className={subTitle}>참여한 펀딩 {parts.length}</h3>
        {parts.length === 0 ? (
          <EmptyState text="참여한 펀딩이 없어요." href="/funding/browse/" linkLabel="펀딩 둘러보기" />
        ) : (
          <div className={listBox}>
            {parts.map((p) =>
              row(
                p.id,
                `/funding/detail/?id=${encodeURIComponent(p.projectId)}`,
                p.project?.title || "펀딩 프로젝트",
                `${p.rewardTitle} ${p.quantity}개 · ${p.totalPrice.toLocaleString()} DP · ${PAYMENT_LABEL[p.paymentStatus] || p.paymentStatus}`,
              ),
            )}
          </div>
        )}
      </section>
      <section>
        <h3 className={subTitle}>개설한 펀딩 {projects.length}</h3>
        {projects.length === 0 ? (
          <EmptyState text="개설한 펀딩이 없어요." href="/funding/new/" linkLabel="펀딩 열기" />
        ) : (
          <div className={listBox}>
            {projects.map((p) => row(p.id, `/funding/detail/?id=${encodeURIComponent(p.id)}`, p.title, `${p.typeName} · ${displayStatus(p)}`))}
          </div>
        )}
      </section>
      <p className="text-sm text-zinc-500">
        참여 취소·참여자 관리는{" "}
        <Link href="/funding/my/" className="text-zinc-300 underline hover:text-white">
          내 펀딩 관리 페이지
        </Link>
        에서 할 수 있어요.
      </p>
    </div>
  )
}

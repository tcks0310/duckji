"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { MyPageShell } from "@/components/mypage/mypage-shell"
import { useMemberPoints } from "@/lib/member-points"
import { useIsApp } from "@/lib/app-mode"
import { chargeDp, confirmCharge, resumePendingCharges, type ChargeResult, type PayMethod } from "@/lib/dp-charge"

// DP 충전 (/mypage/charge): 네이버 쿠키처럼 덕지 포인트를 돈으로 사는 페이지 (1 DP = 1원)
// 포트원 V2 결제창 (2026-10-16 테스트 채널 KG이니시스). 흐름은 lib/dp-charge.ts
// 1) 서버(users)에 충전 주문 → 2) 결제창 → 3) 서버가 포트원에 금액·상태 재확인 후 원장에 유료 DP 입금(paid_amount)
// 정리 문서: docs/planning/DP-충전과-결제-검토.md (프로젝트 공유 폴더)
// ?next=/store/goods/checkout/?... 로 열면 충전을 마친 뒤 그 페이지로 돌아가는 버튼을 보여 줌 (이 사이트 주소만)

const PACKAGES = [1000, 5000, 10000, 30000, 50000]
// 충전 뒤 돌아갈 주소: 이 사이트 안 주소만 ('/' 로 시작하고 '//' 는 아님)
const NEXT_KEY = "dukji_charge_next"
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "")

const METHODS: { id: PayMethod; label: string }[] = [
  { id: "CARD", label: "신용·체크카드" },
  { id: "TRANSFER", label: "계좌이체" },
]

export default function ChargePage() {
  return (
    <MyPageShell active="points" title="DP 충전" description="덕지 포인트(DP)를 충전해 굿즈·펀딩·놀이에 써요. 1 DP = 1원">
      <ChargeBody />
    </MyPageShell>
  )
}

function ChargeBody() {
  const { balance } = useMemberPoints()
  const [amount, setAmount] = useState(PACKAGES[1])
  const [method, setMethod] = useState<PayMethod>("CARD")
  const [agreed, setAgreed] = useState(false)
  const [notice, setNotice] = useState("")
  const [done, setDone] = useState("")
  const [busy, setBusy] = useState(false)
  const [next, setNext] = useState("")
  const isApp = useIsApp()

  const show = (r: ChargeResult) => {
    if (r.status === "ok") {
      setNotice("")
      setDone(`${r.amount.toLocaleString()} DP 를 충전했어요. 보유 ${r.balance.toLocaleString()} DP`)
    } else if (r.status === "pending") setNotice("결제 확인이 아직 안 됐어요. 잠시 뒤 이 페이지를 다시 열면 자동으로 확인해요.")
    else setNotice(r.status === "canceled" ? r.message : r.error)
  }

  // 모바일 결제창에서 돌아온 경우(?paymentId=...&code=...), 그 밖엔 확인 못 마친 충전 다시 확인
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const paymentId = q.get("paymentId")
    // 모바일 결제창은 ?next 없이 이 페이지로 돌아오므로 결제 전에 기억해 둔 주소를 씀
    let back = safeNext(q.get("next"))
    try {
      if (back) sessionStorage.setItem(NEXT_KEY, back)
      else if (paymentId) back = safeNext(sessionStorage.getItem(NEXT_KEY))
      else sessionStorage.removeItem(NEXT_KEY)
    } catch {
      // 저장소를 못 쓰는 브라우저는 주소의 next 만 씀
    }
    setNext(back)
    window.history.replaceState(null, "", back ? `${window.location.pathname}?next=${encodeURIComponent(back)}` : window.location.pathname)
    if (paymentId && q.get("code")) return setNotice(q.get("message") || "결제가 취소됐어요.")
    if (paymentId) {
      setBusy(true)
      confirmCharge(paymentId).then(show).finally(() => setBusy(false))
      return
    }
    resumePendingCharges().then((r) => r.count && setDone(`결제를 마친 ${r.amount.toLocaleString()} DP 를 충전했어요.`))
  }, [])

  const pay = async () => {
    if (!agreed) return setNotice("충전·환불 규정에 동의해 주세요.")
    setNotice("")
    setDone("")
    setBusy(true)
    show(await chargeDp(amount, method))
    setBusy(false)
  }

  const choice = (on: boolean) =>
    `h-12 rounded-xl border text-sm font-bold transition-colors ${on ? "border-red-500 bg-red-500/10 text-white" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"}`

  // 앱에서는 DP 를 팔지 않음 (스토어 인앱결제 규정). 굿즈·펀딩 결제 화면에서 모자란 금액만 카드로 냄
  if (isApp)
    return (
      <div className="space-y-3 max-w-2xl py-4 border-y border-zinc-800">
        <p className="text-sm text-zinc-300">앱에서는 DP 충전을 하지 않아요. 굿즈를 사거나 펀딩에 참여할 때 보유 DP 가 모자라면, 결제 화면에서 모자란 금액만 카드로 낼 수 있어요.</p>
        <p className="text-sm text-zinc-400">보유 DP {balance === null ? "-" : `${balance.toLocaleString()} DP`}</p>
      </div>
    )

  return (
    <div className="space-y-8 max-w-2xl">
      {next && !done && (
        <p className="text-sm text-zinc-400">
          충전을 마치면 주문하던 페이지로 돌아갈 수 있어요.{" "}
          <Link href={next} className="underline underline-offset-2 hover:text-white">
            충전하지 않고 돌아가기
          </Link>
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3 py-4 border-y border-zinc-800">
        <span className="text-sm text-zinc-400">보유 덕지 포인트</span>
        <span className="text-xl font-bold text-white">{balance === null ? "-" : `${balance.toLocaleString()} DP`}</span>
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-white">충전할 DP</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PACKAGES.map((n) => (
            <button key={n} type="button" onClick={() => setAmount(n)} className={choice(amount === n)}>
              {n.toLocaleString()} DP
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-bold text-white">결제 수단</h3>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={choice(method === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="py-5 border-y border-zinc-800 space-y-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-400">충전 후 DP</dt>
            <dd className="text-zinc-200">{balance === null ? "-" : `${(balance + amount).toLocaleString()} DP`}</dd>
          </div>
          <div className="flex justify-between items-baseline">
            <dt className="text-zinc-300">결제 금액</dt>
            <dd className="text-xl font-black text-white">{amount.toLocaleString()}원</dd>
          </div>
        </dl>
        <label className="flex items-start gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-red-600" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            충전한 DP 는 현금으로 바꾸거나 다른 회원에게 줄 수 없고, 환불은 아래 규정을 따라요.{" "}
            <Link href="/refund/" className="underline">
              환불 규정
            </Link>
          </span>
        </label>
        <button type="button" onClick={pay} disabled={busy} className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm disabled:opacity-60">
          {busy ? "결제 확인 중..." : `${amount.toLocaleString()}원 결제하기`}
        </button>
        {done && <p className="text-sm text-emerald-400">{done}</p>}
        {done && next && (
          <Link href={next} className="flex w-full h-12 items-center justify-center rounded-xl border border-zinc-700 text-sm font-bold text-white hover:bg-zinc-800">
            주문하던 페이지로 돌아가기
          </Link>
        )}
        {notice && <p className="text-sm text-amber-400">{notice}</p>}
      </section>

      <ul className="space-y-1.5 text-sm text-zinc-400 list-disc pl-5">
        <li>DP 는 굿즈샵 주문, 덕질펀딩 참여 등 덕지 안에서 1 DP = 1원으로 써요.</li>
        <li>결제할 때는 무료로 받은 DP 가 먼저 쓰이고, 모자란 만큼 충전한 DP 가 쓰여요.</li>
      </ul>
    </div>
  )
}

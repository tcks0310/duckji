"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Download, Share2 } from "lucide-react"
import { fetchMyReferral, referralLink, type MyReferral } from "@/lib/referral"

// 마이페이지 > 친구 초대: 내 고유 추천 ID · 추천 링크 · QR. 친구가 이 ID 를 적고 가입하면 나는 150 DP, 친구는 50 DP
export function InvitePanel() {
  const [data, setData] = useState<MyReferral | null | undefined>(undefined)
  const [qr, setQr] = useState("")
  const [copied, setCopied] = useState<"" | "code" | "link">("")

  useEffect(() => {
    fetchMyReferral().then(setData)
  }, [])

  const link = data ? referralLink(data.code) : ""
  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 2, width: 480 }).then(setQr).catch(() => setQr(""))
  }, [link])

  if (data === undefined) return <p className="text-sm text-zinc-500">불러오는 중...</p>
  if (!data) return <p className="text-sm text-red-400">추천 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>

  const copy = async (text: string, what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(""), 1500)
    } catch {
      prompt("아래 내용을 복사해 주세요.", text)
    }
  }

  const share = async () => {
    const text = `덕지에 가입할 때 추천인 ID ${data.code} 를 적으면 ${data.referredDp} DP 를 받아요!`
    if (navigator.share) {
      await navigator.share({ title: "덕지 친구 초대", text, url: link }).catch(() => {})
    } else {
      copy(`${text}\n${link}`, "link")
    }
  }

  const downloadQr = () => {
    const a = document.createElement("a")
    a.href = qr
    a.download = `duckji-invite-${data.code}.png`
    a.click()
  }

  const button = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
  // 박스 없이 '이름 | 내용' 줄을 얇은 선으로 나눔 (회원 정보 수정 화면과 같은 모양)
  const row = "py-5 grid gap-2 sm:grid-cols-[140px_1fr] sm:gap-6"
  const rowLabel = "text-sm font-bold text-zinc-300 sm:pt-2"

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-300">
        친구가 내 추천 ID 를 적고 가입하면 나는 <b className="text-white">{data.referrerDp} DP</b>, 친구는{" "}
        <b className="text-white">{data.referredDp} DP</b> 를 받아요.
      </p>

      <div className="border-y border-zinc-800 divide-y divide-zinc-800">
        <div className={row}>
          <div className={rowLabel}>내 추천 ID</div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl font-bold tracking-[0.2em] text-white">{data.code}</span>
            <button type="button" onClick={() => copy(data.code, "code")} className={button}>
              {copied === "code" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "code" ? "복사됨" : "ID 복사"}
            </button>
          </div>
        </div>

        <div className={row}>
          <div className={rowLabel}>추천 링크</div>
          <div className="min-w-0">
            <div className="text-sm text-zinc-300 break-all sm:pt-2">{link}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(link, "link")} className={button}>
                {copied === "link" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "link" ? "복사됨" : "링크 복사"}
              </button>
              <button type="button" onClick={share} className={button}>
                <Share2 className="w-3.5 h-3.5" /> 공유하기
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">링크나 QR 로 들어온 친구는 가입 화면에 내 추천 ID 가 미리 적혀 있어요.</p>
          </div>
        </div>

        <div className={row}>
          <div className={rowLabel}>QR 코드</div>
          <div className="flex items-end gap-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`추천 링크 QR (${data.code})`} className="w-36 h-36 rounded-lg bg-white p-1" />
            ) : (
              <div className="w-36 h-36 rounded-lg bg-zinc-900" />
            )}
            <button type="button" onClick={downloadQr} disabled={!qr} className={button}>
              <Download className="w-3.5 h-3.5" /> QR 저장
            </button>
          </div>
        </div>

        <div className={row}>
          <div className={rowLabel}>추천 현황</div>
          <div className="text-sm text-zinc-300 sm:pt-2 space-y-1">
            <div>
              내 추천으로 가입 <b className="text-white">{data.invitedCount}명</b>
              <span className="mx-2 text-zinc-700">|</span>
              추천으로 받은 DP <b className="text-white">{data.earnedDp.toLocaleString()} DP</b>
            </div>
            {data.referredBy && <div className="text-zinc-500">나는 {data.referredBy} 님의 추천으로 가입했어요.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Copy, Download, X } from "lucide-react"
import { PopupEvent } from "@/data/popup-data"
import { buildPopupQrUrl, PopupQrStats } from "@/lib/popup-qr"

// 관리자 > 팝업 관리 > 현장 QR: 팝업별 QR 이미지 생성·다운로드와 유입 집계
// 스타일은 팝업 관리의 기존 카드·버튼 클래스를 그대로 사용

const QR_OPTIONS = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#000000", light: "#ffffff" } }

function download(href: string, filename: string) {
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function PopupQrPanel({ popup, stats, onClose }: { popup: PopupEvent; stats?: PopupQrStats; onClose?: () => void }) {
  const url = buildPopupQrUrl(popup.id)
  const [preview, setPreview] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 240 }).then(setPreview).catch(() => setPreview(""))
  }, [url])

  // 인쇄용 고해상도 PNG
  const downloadPng = async () => {
    download(await QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1200 }), `duckji-qr-${popup.id}.png`)
  }

  // 크기와 상관없이 깨지지 않는 SVG (현수막·배너용)
  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: "svg" })
    const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    download(href, `duckji-qr-${popup.id}.svg`)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt("QR 주소", url)
    }
  }

  const statItems: [string, string][] = [
    ["전체 유입", String(stats?.total ?? 0)],
    ["순 방문자", String(stats?.uniqueVisitors ?? 0)],
    ["오늘", String(stats?.today ?? 0)],
    ["최근 7일", String(stats?.last7Days ?? 0)],
  ]

  return (
    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">현장 QR</div>
          <div className="text-xs text-zinc-500">QR 을 찍으면 이 팝업 상세 페이지가 열리고 유입이 집계됩니다. (같은 기기가 30분 안에 다시 찍으면 1회로 집계)</div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="shrink-0 self-start rounded-xl bg-white p-2">
          {preview ? <img src={preview} alt={`${popup.title} QR`} width={180} height={180} /> : <div className="w-[180px] h-[180px]" />}
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">QR 주소</span>
            <div className="flex gap-2">
              <input readOnly value={url} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white font-mono" />
              <button type="button" onClick={copyUrl} className="px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1 shrink-0">
                <Copy className="w-3 h-3" />
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadPng} className="px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              PNG 다운로드 (인쇄용)
            </button>
            <button type="button" onClick={downloadSvg} className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              SVG 다운로드 (배너용)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {statItems.map(([label, value]) => (
              <div key={label} className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <div className="text-xs text-zinc-500 font-bold">{label}</div>
                <div className="text-lg font-semibold text-white font-mono">{value}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-zinc-500">
            마지막 유입: {stats?.lastScannedAt ? new Date(stats.lastScannedAt).toLocaleString("ko-KR") : "아직 없음"}
          </div>
        </div>
      </div>
    </div>
  )
}

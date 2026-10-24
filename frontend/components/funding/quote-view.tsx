"use client"

import * as React from "react"
import type { FundingQuote } from "@/types/funding"

// 견적서 한 장 (개설자 화면·관리자 화면 공통)
export function QuoteView({
  quote,
  onAccept,
  accepting,
  tone = "site",
}: {
  quote: FundingQuote
  onAccept?: () => void
  accepting?: boolean
  tone?: "site" | "admin"
}) {
  const date = new Date(quote.createdAt).toLocaleDateString("ko-KR")
  const status =
    quote.status === "accepted" ? `확인 완료 · ${quote.acceptedAt ? new Date(quote.acceptedAt).toLocaleDateString("ko-KR") : ""}` : quote.status === "replaced" ? "이전 견적" : "확인 전"
  return (
    <div className={`space-y-3 ${quote.status === "replaced" ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-zinc-300">견적서 · {date}</span>
        <span className={quote.status === "accepted" ? "text-emerald-300" : quote.status === "sent" ? "text-amber-300" : "text-zinc-500"}>{status}</span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-800 border-y border-zinc-800">
          {quote.lines.map((l, i) => (
            <tr key={i}>
              <td className="py-2 text-zinc-300">{l.label}</td>
              <td className="py-2 text-right text-zinc-100 tabular-nums">{l.amount.toLocaleString()}원</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2.5 font-semibold text-white">합계</td>
            <td className="pt-2.5 text-right font-semibold text-white tabular-nums">{quote.totalAmount.toLocaleString()}원</td>
          </tr>
        </tfoot>
      </table>
      {quote.memo && <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{quote.memo}</p>}
      {quote.fileUrl && (
        <a href={quote.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-zinc-200 underline underline-offset-4">
          견적서 파일 보기
        </a>
      )}
      {onAccept && quote.status === "sent" && (
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          className={`h-10 px-5 rounded-full text-sm font-semibold disabled:opacity-50 ${tone === "admin" ? "bg-sky-700 text-white" : "bg-emerald-400 text-zinc-950"}`}
        >
          {accepting ? "처리 중..." : "견적 확인했어요"}
        </button>
      )}
    </div>
  )
}

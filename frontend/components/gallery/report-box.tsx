"use client"

import * as React from "react"
import { useState } from "react"
import { Flag } from "lucide-react"
import { REPORT_REASONS, reportTarget } from "@/lib/community-api"

// 신고 (글·댓글·회원). 버튼을 누르면 그 자리에 사유 고르는 칸이 펼쳐짐
export function ReportButton({
  targetType,
  targetId,
  label = "신고",
  onError,
}: {
  targetType: "post" | "comment" | "member"
  targetId: string | number
  label?: string
  onError: (e: unknown) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [detail, setDetail] = useState("")
  const [done, setDone] = useState("")
  const [isSending, setIsSending] = useState(false)

  const submit = async () => {
    if (!reason) return
    setIsSending(true)
    try {
      const r = await reportTarget({ targetType, targetId, reason, detail: detail.trim() })
      setDone(r.alreadyReported ? "이미 신고한 내용이에요." : "신고가 접수됐어요. 운영팀이 확인할게요.")
      setOpen(false)
    } catch (e) {
      onError(e)
    } finally {
      setIsSending(false)
    }
  }

  if (done) return <span className="text-xs text-zinc-500">{done}</span>
  return (
    <span className="inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400">
        <Flag className="w-3 h-3" />
        {label}
      </button>
      {open && (
        <span className="mt-2 block w-full max-w-sm p-3 rounded-xl border border-zinc-700 bg-zinc-950 space-y-2">
          <span className="block text-xs font-semibold text-zinc-300">신고 사유</span>
          <span className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`px-2.5 py-1 rounded-full border text-xs ${reason === r.value ? "border-red-400 bg-red-500/15 text-red-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}
              >
                {r.label}
              </button>
            ))}
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="자세한 내용 (선택)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-400"
          />
          <span className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white">
              닫기
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!reason || isSending}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold disabled:opacity-40"
            >
              신고하기
            </button>
          </span>
        </span>
      )}
    </span>
  )
}

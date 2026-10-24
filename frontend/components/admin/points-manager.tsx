"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Zap, Search, Trash2, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import type { PointHistoryItem } from "@/lib/member-points"

// 관리자: 회원 덕지 포인트 조회·지급·차감, 테스트 기록 넣고 지우기 (backend users 서비스 /api/users/admin/points)
// '테스트'로 넣은 기록은 [테스트 기록 지우기]로 한 번에 지우고 잔액을 다시 계산합니다.
// embedded: 회원 관리 > 회원 세부 정보 안에서 쓸 때. ID 조회 칸 없이 그 회원을 바로 불러오고, 바뀌면 onChange(잔액)

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"

type MemberPoints = {
  member: { id: string; name: string }
  balance: number
  testEntries: number
  history: PointHistoryItem[]
}

async function call(path: string, init?: RequestInit & { json?: unknown }) {
  const { json, ...rest } = init || {}
  const res = await apiFetch(`/api/users/admin/points${path}`, {
    ...rest,
    headers: json === undefined ? rest.headers : { "Content-Type": "application/json" },
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "요청을 처리하지 못했습니다.")
  return body
}

export function PointsManager({
  initialMemberId = "",
  embedded = false,
  onChange,
}: {
  initialMemberId?: string
  embedded?: boolean
  onChange?: (balance: number) => void
}) {
  const [memberId, setMemberId] = useState(initialMemberId)
  const [data, setData] = useState<MemberPoints | null>(null)
  const [error, setError] = useState("")
  const [amount, setAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [isTest, setIsTest] = useState(!embedded)
  const [busy, setBusy] = useState(false)

  const load = async (id = memberId.trim()) => {
    if (!id) return
    setBusy(true)
    setError("")
    try {
      const r = await call(`/${encodeURIComponent(id)}`)
      setData(r)
      return r as MemberPoints
    } catch (e: any) {
      setData(null)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    setBusy(true)
    setError("")
    try {
      await call(`/${encodeURIComponent(data.member.id)}/adjust`, { method: "POST", json: { amount: Number(amount), memo, isTest } })
      setAmount("")
      setMemo("")
      const r = await load(data.member.id)
      if (r) onChange?.(r.balance)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  const deleteTestEntries = async () => {
    if (!data || !confirm(`'${data.member.name}' 회원의 테스트 포인트 기록 ${data.testEntries}건을 지울까요?`)) return
    setBusy(true)
    try {
      const r = await call(`/${encodeURIComponent(data.member.id)}/test-entries`, { method: "DELETE" })
      alert(`테스트 기록 ${r.deleted}건을 지웠습니다. 잔액 ${r.balance.toLocaleString()} DP`)
      await load(data.member.id)
      onChange?.(r.balance)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (embedded && initialMemberId) load(initialMemberId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, initialMemberId])

  return (
    <div className={embedded ? "space-y-4" : "p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-5"}>
      {!embedded && (
      <div>
        <h3 className="font-semibold text-lg text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-zinc-400" />
          <span>덕지 포인트(DP) 관리</span>
        </h3>
        <p className="text-xs text-zinc-400">
          회원 ID로 잔액과 지급·사용 기록을 봅니다. 테스트로 넣은 포인트는 테스트 표시가 붙고, 한 번에 지울 수 있습니다.
        </p>
      </div>
      )}

      {!embedded && (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
      >
        <input className={inputClass} value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="회원 ID (예: kakao-1234567890)" />
        <Button type="submit" size="sm" disabled={busy} className="bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 rounded-xl h-auto">
          <Search className="w-3.5 h-3.5 mr-1" />
          조회
        </Button>
      </form>
      )}
      {embedded && busy && !data && <div className="text-xs text-zinc-500">불러오는 중...</div>}

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs text-zinc-400">
                {data.member.name} · {data.member.id}
              </div>
              <div className="text-xl font-semibold text-emerald-400">{data.balance.toLocaleString()} DP</div>
            </div>
            <Button
              size="sm"
              disabled={busy || data.testEntries === 0}
              onClick={deleteTestEntries}
              className="bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              테스트 기록 지우기 ({data.testEntries})
            </Button>
          </div>

          <form onSubmit={adjust} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto_auto] gap-2 items-center">
            <input className={inputClass} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+100 / -50" required />
            <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="사유 (내역에 표시)" required />
            <label className="flex items-center gap-1.5 text-xs text-zinc-300 whitespace-nowrap">
              <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
              테스트
            </label>
            <Button type="submit" size="sm" disabled={busy} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl h-auto py-3">
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              지급·차감
            </Button>
          </form>

          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 divide-y divide-zinc-800">
            {data.history.length === 0 && <div className="p-4 text-center text-xs text-zinc-500">기록이 없습니다.</div>}
            {data.history.map((h) => (
              <div key={h.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {h.label}
                    {h.isTest && <span className="ml-1.5 text-amber-400">테스트</span>}
                    {h.refId && <span className="ml-1.5 text-zinc-500">{h.refId}</span>}
                  </div>
                  <div className="text-zinc-500 truncate">
                    {new Date(h.createdAt).toLocaleString("ko-KR")}
                    {h.memo ? ` · ${h.memo}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-semibold ${h.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {h.amount > 0 ? "+" : ""}
                    {h.amount.toLocaleString()}
                  </div>
                  <div className="text-zinc-500">잔액 {h.balanceAfter.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

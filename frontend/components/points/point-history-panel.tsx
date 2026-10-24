"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchPointHistory, type PointHistoryItem } from "@/lib/member-points"
import { redeemCode } from "@/lib/rewards"

// 마이페이지 '포인트 관리' 탭: 보유 덕지 포인트(충전 페이지 /mypage/charge 로 가는 버튼), 프로모션 코드 등록(팝업·굿즈·이벤트·크리에이터 코드), 어디서 몇 포인트를 받고 썼는지 (최신순)
// 코드를 등록하면 내역을 다시 불러와 맨 위에 방금 받은 줄을 표시
// 마이페이지 탭에 그대로 넣어 쓰는 컴포넌트입니다. 로그인하지 않았으면 onRequireLogin 을 부릅니다.
export function PointHistoryPanel({ onRequireLogin }: { onRequireLogin?: () => void }) {
  const [balance, setBalance] = useState<number | null>(null)
  const [items, setItems] = useState<PointHistoryItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [code, setCode] = useState("")
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = code.trim().toUpperCase()
    if (!value || codeBusy) return
    setCodeBusy(true)
    setCodeMsg(null)
    const r = await redeemCode(value)
    setCodeBusy(false)
    if (r.status === "login") {
      setNeedsLogin(true)
      onRequireLogin?.()
      return
    }
    if (r.status !== "ok") return setCodeMsg({ ok: false, text: r.error })
    setCode("")
    setCodeMsg({
      ok: true,
      text: `'${r.data.name}' 코드로 ${r.amount.toLocaleString()} DP를 받았어요.${r.data.rewardItem ? ` 함께 주는 아이템: ${r.data.rewardItem}` : ""}`,
    })
    const top = await load()
    setHighlightId(top ?? null)
  }

  const load = async (before?: number): Promise<number | undefined> => {
    setLoading(true)
    const result = await fetchPointHistory(before).catch(() => ({ success: false as const, login: false, error: "서버에 연결할 수 없습니다." }))
    setLoading(false)
    if (!result.success) {
      if (result.login) {
        setNeedsLogin(true)
        onRequireLogin?.()
      } else setError(result.error)
      return
    }
    setError(null)
    setBalance(result.balance)
    setItems((prev) => (before ? [...prev, ...result.history] : result.history))
    setHasMore(result.hasMore)
    return result.history[0]?.id
  }

  useEffect(() => {
    load()
  }, [])

  if (needsLogin) {
    return (
      <div className="py-14 border-y border-zinc-800 text-center text-sm text-zinc-400">
        로그인하면 덕지 포인트를 관리할 수 있어요.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">보유 덕지 포인트</div>
          <div className="text-xl font-bold text-white">{balance === null ? "-" : `${balance.toLocaleString()} DP`}</div>
        </div>
        {/* 앱에서는 충전 버튼 숨김 */}
        <a href="/mypage/charge/" className="app-hide h-10 px-5 inline-flex items-center rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shrink-0">
          DP 충전
        </a>
      </div>

      <form onSubmit={submitCode} className="py-5 border-y border-zinc-800 space-y-2">
        <label htmlFor="promo-code" className="block text-sm font-bold text-white">
          프로모션 코드 등록
        </label>
        <p className="text-sm text-zinc-400">팝업 현장, 굿즈, 이벤트에서 받은 코드를 넣으면 바로 적립돼요. 코드마다 한 번 쓸 수 있어요.</p>
        <div className="flex gap-2 pt-1">
          <input
            id="promo-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="코드 입력"
            maxLength={40}
            autoComplete="off"
            className="min-w-0 flex-1 h-11 bg-transparent border border-zinc-700 rounded-xl px-4 text-sm text-white placeholder-zinc-500 font-mono tracking-wider focus:outline-none focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!code.trim() || codeBusy}
            className="h-11 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 disabled:hover:bg-red-600 shrink-0"
          >
            {codeBusy ? "확인 중..." : "적립하기"}
          </button>
        </div>
        {codeMsg && <p className={`text-sm ${codeMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{codeMsg.text}</p>}
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <h3 className="pt-4 text-base font-bold text-white">포인트 내역</h3>
      <div className="border-y border-zinc-800 divide-y divide-zinc-800">
        {items.length === 0 && !loading && !error && (
          <div className="py-14 text-center text-sm text-zinc-500">아직 포인트 기록이 없어요.</div>
        )}
        {items.map((item) => (
          <div key={item.id} className={`py-3.5 flex items-center justify-between gap-3 ${item.id === highlightId ? "bg-emerald-500/5" : ""}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {item.amount > 0 ? (
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {item.label}
                  {item.isTest && <span className="ml-1.5 text-[10px] text-amber-400">테스트</span>}
                  {item.id === highlightId && <span className="ml-1.5 text-xs text-emerald-400">방금 적립</span>}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">
                  {new Date(item.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  {item.memo ? ` · ${item.memo}` : ""}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-black ${item.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {item.amount > 0 ? "+" : ""}
                {item.amount.toLocaleString()} DP
              </div>
              <div className="text-[11px] text-zinc-500">잔액 {item.balanceAfter.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => load(items[items.length - 1]?.id)} className="w-full">
          {loading ? "불러오는 중..." : "더 보기"}
        </Button>
      )}
    </div>
  )
}

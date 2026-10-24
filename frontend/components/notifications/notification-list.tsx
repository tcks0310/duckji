"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GROUP_LABELS, fetchNotifications, markRead, timeAgo, type NotificationItem } from "@/lib/notifications"

// 알림 목록: 상단 종 아이콘(compact)과 알림 페이지(/notifications)가 같이 씀
// 누르면 읽음 처리 후 그 알림의 화면으로 이동
export function NotificationList({
  scope = "member",
  compact = false,
  onNavigate,
}: {
  scope?: "member" | "admin"
  compact?: boolean
  onNavigate?: (link: string) => boolean // true 를 돌려주면 이동을 대신 처리한 것 (관리자 탭 전환 등)
}) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState("")
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    const r = await fetchNotifications(scope, undefined, compact ? 8 : 20)
    if (!r.success) {
      setError(r.error)
      setItems([])
      return
    }
    setError("")
    setItems(r.items)
    setHasMore(!compact && r.hasMore)
  }, [scope, compact])

  useEffect(() => {
    load()
  }, [load])

  const more = async () => {
    if (!items?.length) return
    setLoadingMore(true)
    const r = await fetchNotifications(scope, items[items.length - 1].id, 20)
    setLoadingMore(false)
    if (r.success) {
      setItems([...items, ...r.items])
      setHasMore(r.hasMore)
    }
  }

  const readAll = async () => {
    if (await markRead(scope, "all")) setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list)
  }

  const open = (n: NotificationItem) => {
    if (!n.read) {
      markRead(scope, [n.id])
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? list)
    }
    if (onNavigate?.(n.link)) return
    if (n.link) router.push(n.link)
  }

  const unreadInList = items?.some((n) => !n.read)
  const pad = compact ? "px-4" : "px-1"

  return (
    <div>
      <div className={`flex items-center justify-between gap-3 ${compact ? "px-4 py-3 border-b border-zinc-800" : "pb-3"}`}>
        <span className="text-sm font-bold text-white">{compact ? "알림" : "받은 알림"}</span>
        <button
          type="button"
          onClick={readAll}
          disabled={!unreadInList}
          className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400"
        >
          모두 읽음
        </button>
      </div>

      {items === null ? (
        <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">아직 알림이 없어요.</p>
      ) : (
        <ul className={`divide-y divide-zinc-800/80 ${compact ? "max-h-[min(60vh,440px)] overflow-y-auto" : "border-y border-zinc-800"}`}>
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`w-full text-left ${pad} py-3.5 flex gap-3 hover:bg-white/[0.03] transition-colors`}
              >
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-red-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm font-bold truncate ${n.read ? "text-zinc-400" : "text-white"}`}>{n.title}</span>
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                  </span>
                  {n.body && (
                    <span className={`mt-0.5 block text-[13px] leading-snug ${n.read ? "text-zinc-500" : "text-zinc-300"} ${compact ? "line-clamp-2" : ""}`}>
                      {n.body}
                    </span>
                  )}
                  {!compact && GROUP_LABELS[n.group] && <span className="mt-1 block text-[11px] text-zinc-500">{GROUP_LABELS[n.group]}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={more}
            disabled={loadingMore}
            className="h-10 px-5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-50"
          >
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      )}
    </div>
  )
}

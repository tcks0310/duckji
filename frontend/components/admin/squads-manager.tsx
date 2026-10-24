"use client"

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Search, Trash2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { SquadIcon } from "@/components/community/squad-icon"

// 관리자 '스쿼드 관리' 탭 (backend rewards 서비스 /api/rewards/admin/squads)
// 스쿼드 목록·검색 → 고르면 팀원(회원 정보)·활동 기록·최근 채팅·관리자 조치 기록
// 조치: 강제 이름 변경, 목록·배지에서 숨김, 소개·이미지 비우기, 해산, 팀원 제외, 채팅 삭제 (모두 squad_admin_actions 에 기록)

type Stats = { total: number; completed: number; hidden: number; members: number; messagesToday: number; pendingRequests: number }
type Row = {
  id: number
  name: string
  intro: string
  icon: string
  color: string
  imageUrl: string | null
  joinPolicy: "open" | "request"
  createdAt: string
  completed: boolean
  code: string
  hidden: boolean
  leaderId: string
  leaderName: string
  memberCount: number
  messageCount: number
  lastActivityAt: string | null
}
type AdminAction = { id: number; squadId: number; squadName: string; action: string; reason: string | null; detail: any; actor: string; createdAt: string }
type Detail = {
  squad: Row & { updatedAt: string }
  members: { memberId: string; name: string; email: string; avatarUrl: string | null; status: string; signedUpAt: string | null; isLeader: boolean; joinedAt: string }[]
  events: { id: number; type: string; memberName: string | null; actorName: string | null; detail: any; createdAt: string }[]
  adminActions: AdminAction[]
  messages: { id: number; memberId: string; name: string; body: string; deleted: boolean; deletedBy: string | null; createdAt: string }[]
  requests: { id: number; name: string; message: string; status: string; createdAt: string }[]
  activity: { chatTotal: number; chatWeek: number; chatAll: number; posts30d: number }
}

async function call<T = any>(path: string, method = "GET", json?: unknown): Promise<T> {
  const res = await apiFetch(`/api/rewards/admin${path}`, {
    method,
    cache: "no-store",
    headers: json === undefined ? undefined : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "요청을 처리하지 못했습니다.")
  return body
}

const fmt = (iso: string | null) => {
  if (!iso) return "-"
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`
}

const EVENT_LABEL: Record<string, string> = {
  created: "스쿼드 만듦",
  joined: "가입",
  left: "나감",
  kicked: "내보냄",
  renamed: "이름 변경",
  icon_changed: "아이콘 변경",
  intro_changed: "소개 변경",
  policy_changed: "가입 방식 변경",
  leader_changed: "리더 변경",
  reward_paid: "완성 보상 지급",
  disbanded: "해산",
  hidden: "목록에서 숨김",
  shown: "다시 보이게 함",
}
const VIA_LABEL: Record<string, string> = { invite: "초대 코드", request: "가입 신청 승인", open: "바로 가입" }
const ACTION_LABEL: Record<string, string> = {
  rename: "강제 이름 변경",
  hide: "숨김",
  show: "다시 보이기",
  clear_intro: "소개 비움",
  clear_image: "아이콘 이미지 뺌",
  disband: "해산",
  remove_member: "팀원 제외",
  delete_message: "채팅 삭제",
}
const STATUS_LABEL: Record<string, string> = { active: "정상", dormant: "휴면", suspended: "정지(기간)", banned: "영구 정지", withdrawn: "탈퇴" }
const REQUEST_LABEL: Record<string, string> = { pending: "대기", approved: "승인", rejected: "거절", cancelled: "취소" }

function eventText(e: Detail["events"][number]) {
  const d = e.detail || {}
  const parts: string[] = []
  if (e.memberName) parts.push(e.memberName)
  if (e.type === "joined" && d.via) parts.push(`(${VIA_LABEL[d.via] || d.via})`)
  if (e.type === "renamed") parts.push(`'${d.from}' → '${d.to}'`)
  if (e.type === "policy_changed") parts.push(d.to === "open" ? "→ 바로 가입" : "→ 신청 후 승인")
  if (e.type === "reward_paid") parts.push(`${(d.memberIds || []).length}명 × ${Number(d.dp || 0).toLocaleString()} DP`)
  if (d.byAdmin) parts.push("[관리자]")
  else if (e.actorName && e.actorName !== e.memberName && e.type !== "reward_paid") parts.push(`· ${e.actorName}`)
  return parts.join(" ")
}

const input = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const card = "p-5 rounded-2xl bg-zinc-900 border border-zinc-800"
const btn = "px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
const primary = "px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold text-white disabled:opacity-50"
const danger = "px-3 py-1.5 rounded-lg border border-red-500/40 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"

export function SquadsManager({ onOpenMember }: { onOpenMember?: (memberId: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<AdminAction[]>([])
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [rename, setRename] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async (query: string) => {
    try {
      const r = await call<{ squads: Row[]; stats: Stats; recentActions: AdminAction[] }>(`/squads?${new URLSearchParams(query ? { q: query } : {})}`)
      setRows(r.squads)
      setStats(r.stats)
      setRecent(r.recentActions)
      setError("")
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    try {
      const r = await call<Detail>(`/squads/${id}`)
      setDetail(r)
      setRename(r.squad.name)
    } catch (e: any) {
      setError(e.message)
      setDetail(null)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadList(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q, loadList])

  const open = (id: number) => {
    setSelected(id)
    setDetail(null)
    loadDetail(id).then(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const act = async (fn: () => Promise<unknown>, after: "detail" | "close" = "detail") => {
    setBusy(true)
    try {
      await fn()
      await loadList(q.trim())
      if (after === "close") {
        setSelected(null)
        setDetail(null)
      } else if (selected) await loadDetail(selected)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }
  const askReason = (msg: string) => {
    const r = window.prompt(`${msg}\n사유를 적어 주세요 (기록에 남아요, 비워도 됨)`)
    return r === null ? null : r
  }

  const s = detail?.squad

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-white">스쿼드</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              회원이 만든 스쿼드(정원 20명)를 찾아보고 팀원·활동·채팅을 확인합니다. 숨기면 둘러보기 목록과 글쓴이 배지에서 빠지고, 팀원은 그대로 활동할 수 있어요.
            </p>
          </div>
          <button onClick={() => loadList(q.trim())} className={btn}>
            <RefreshCw className="inline w-3.5 h-3.5 mr-1" />
            새로고침
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(
            [
              ["전체 스쿼드", stats?.total, "팀"],
              ["완성 (3명 이상)", stats?.completed, "팀"],
              ["참가 회원", stats?.members, "명"],
              ["숨김", stats?.hidden, "팀"],
              ["오늘 채팅", stats?.messagesToday, "개"],
              ["대기 중 가입 신청", stats?.pendingRequests, "건"],
            ] as const
          ).map(([label, n, unit]) => (
            <div key={label} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-xs text-zinc-400">{label}</div>
              <div className="text-lg font-semibold text-white">{n === undefined ? "-" : `${n.toLocaleString()}${unit}`}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>}

      <div className={card}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="스쿼드 이름·초대 코드·리더/팀원 이름·회원 ID" className={`${input} w-full pl-9`} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/60">
                <th className="p-3">스쿼드</th>
                <th className="p-3">리더</th>
                <th className="p-3">인원</th>
                <th className="p-3 hidden md:table-cell">채팅</th>
                <th className="p-3 hidden md:table-cell">최근 활동</th>
                <th className="p-3 hidden sm:table-cell">결성</th>
                <th className="p-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    {q ? "찾는 스쿼드가 없습니다." : "아직 만들어진 스쿼드가 없습니다."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} onClick={() => open(r.id)} className={`cursor-pointer hover:bg-zinc-800/40 ${selected === r.id ? "bg-zinc-800/60" : ""}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <SquadIcon icon={r.icon} color={r.color} imageUrl={r.imageUrl} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm text-white font-medium whitespace-nowrap">{r.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{r.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-zinc-200">{r.leaderName}</td>
                  <td className="p-3 whitespace-nowrap text-zinc-200">{r.memberCount}명</td>
                  <td className="p-3 text-zinc-300 hidden md:table-cell">{r.messageCount.toLocaleString()}</td>
                  <td className="p-3 text-zinc-400 hidden md:table-cell">{fmt(r.lastActivityAt)}</td>
                  <td className="p-3 text-zinc-400 hidden sm:table-cell">{fmt(r.createdAt).slice(0, 10)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.hidden ? <span className="text-red-300">숨김</span> : <span className="text-zinc-300">공개</span>}
                    {r.completed && <span className="ml-1.5 text-zinc-500">· 완성</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={detailRef} className="scroll-mt-20">
        {selected && !detail && <div className={`${card} text-xs text-zinc-400`}>불러오는 중...</div>}
        {detail && s && (
          <div className="space-y-5">
            <div className={card}>
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <SquadIcon icon={s.icon} color={s.color} imageUrl={s.imageUrl} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-white break-all">{s.name}</h4>
                    {s.hidden && <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">숨김</span>}
                    <span className="text-xs text-zinc-500 font-mono">#{s.id} · {s.code}</span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">{s.intro || "(소개 없음)"}</p>
                  <div className="mt-1.5 text-xs text-zinc-400 flex flex-wrap gap-x-3">
                    <span>결성 {fmt(s.createdAt)}</span>
                    <span>{s.joinPolicy === "open" ? "바로 가입" : "신청 후 승인"}</span>
                    <span>{s.completed ? "완성 (보상 지급됨)" : "미완성"}</span>
                    <span>
                      채팅 {detail.activity.chatAll.toLocaleString()}개 (이번 주 {detail.activity.chatWeek.toLocaleString()}) · 팀원 30일 글 {detail.activity.posts30d.toLocaleString()}개
                    </span>
                  </div>
                </div>
                <a href={`/community/gallery/squad/?id=${s.id}`} target="_blank" rel="noreferrer" className={btn}>
                  공개 페이지
                </a>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800 grid lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">이름 강제 변경 (부적절한 이름 등)</div>
                  <div className="flex gap-2">
                    <input value={rename} onChange={(e) => setRename(e.target.value)} maxLength={16} className={`${input} flex-1 min-w-0`} />
                    <button
                      disabled={busy || !rename.trim() || rename.trim() === s.name}
                      onClick={() => {
                        const reason = askReason(`'${s.name}' → '${rename.trim()}' 로 바꿀까요?`)
                        if (reason !== null) act(() => call(`/squads/${s.id}`, "PATCH", { name: rename.trim(), reason }))
                      }}
                      className={primary}
                    >
                      이름 바꾸기
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">관리</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = askReason(s.hidden ? "다시 목록과 배지에 보이게 할까요?" : "둘러보기 목록과 글쓴이 배지에서 숨길까요?")
                        if (reason !== null) act(() => call(`/squads/${s.id}`, "PATCH", { hidden: !s.hidden, reason }))
                      }}
                      className={btn}
                    >
                      {s.hidden ? "다시 보이기" : "목록에서 숨기기"}
                    </button>
                    {s.intro && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = askReason("소개 문구를 비울까요?")
                          if (reason !== null) act(() => call(`/squads/${s.id}`, "PATCH", { clearIntro: true, reason }))
                        }}
                        className={btn}
                      >
                        소개 비우기
                      </button>
                    )}
                    {s.imageUrl && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = askReason("아이콘 이미지를 빼고 기본 아이콘으로 돌릴까요?")
                          if (reason !== null) act(() => call(`/squads/${s.id}`, "PATCH", { clearImage: true, reason }))
                        }}
                        className={btn}
                      >
                        아이콘 이미지 빼기
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = askReason(`'${s.name}' 스쿼드를 해산할까요? 팀원 ${detail.members.length}명이 모두 빠지고 채팅도 지워집니다. 되돌릴 수 없어요.`)
                        if (reason !== null) act(() => call(`/squads/${s.id}/disband`, "POST", { reason }), "close")
                      }}
                      className={danger}
                    >
                      해산
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={card}>
              <h4 className="font-semibold text-white text-sm">팀원 {detail.members.length}명</h4>
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/60">
                      <th className="p-3">회원</th>
                      <th className="p-3 hidden md:table-cell">이메일</th>
                      <th className="p-3">역할</th>
                      <th className="p-3">회원 상태</th>
                      <th className="p-3 hidden sm:table-cell">스쿼드 가입</th>
                      <th className="p-3 hidden lg:table-cell">사이트 가입</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {detail.members.map((m) => (
                      <tr key={m.memberId}>
                        <td className="p-3">
                          <div className="text-sm text-white">{m.name}</div>
                          <div className="text-xs text-zinc-500 font-mono break-all">{m.memberId}</div>
                        </td>
                        <td className="p-3 text-zinc-300 hidden md:table-cell break-all">{m.email}</td>
                        <td className="p-3 text-zinc-200">{m.isLeader ? "리더" : "팀원"}</td>
                        <td className={`p-3 ${m.status === "active" ? "text-zinc-300" : "text-red-300"}`}>{STATUS_LABEL[m.status] || m.status}</td>
                        <td className="p-3 text-zinc-400 hidden sm:table-cell">{fmt(m.joinedAt)}</td>
                        <td className="p-3 text-zinc-400 hidden lg:table-cell">{fmt(m.signedUpAt).slice(0, 10)}</td>
                        <td className="p-3 whitespace-nowrap text-right">
                          {onOpenMember && (
                            <button onClick={() => onOpenMember(m.memberId)} className={`${btn} mr-1.5`}>
                              회원 정보
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => {
                              const reason = askReason(
                                `${m.name}님을 스쿼드에서 뺄까요?${m.isLeader ? " 리더라서 가장 먼저 들어온 팀원이 리더가 됩니다 (혼자면 해산)." : ""}`
                              )
                              if (reason !== null) act(() => call(`/squads/${s.id}/remove-member`, "POST", { memberId: m.memberId, reason }))
                            }}
                            className={danger}
                          >
                            제외
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid xl:grid-cols-2 gap-5 items-start">
              <div className={card}>
                <h4 className="font-semibold text-white text-sm">최근 채팅 (최근 100개)</h4>
                <p className="text-xs text-zinc-500 mt-0.5">신고나 문제가 있는 메시지를 지울 수 있어요. 지운 메시지는 회원 화면에 '삭제된 메시지'로 보입니다.</p>
                <ul className="mt-3 max-h-[480px] overflow-y-auto divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                  {detail.messages.length === 0 && <li className="p-3 text-xs text-zinc-500">채팅이 없습니다.</li>}
                  {detail.messages.map((m) => (
                    <li key={m.id} className="p-3 flex gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-400">
                          <span className="text-zinc-200 font-medium">{m.name}</span> · {fmt(m.createdAt)}
                          {m.deleted && <span className="ml-1 text-red-300">삭제됨{m.deletedBy ? ` (${m.deletedBy})` : ""}</span>}
                        </div>
                        <div className={`text-sm whitespace-pre-wrap break-words ${m.deleted ? "text-zinc-500 line-through" : "text-zinc-100"}`}>{m.body}</div>
                      </div>
                      {!m.deleted && (
                        <button
                          disabled={busy}
                          aria-label="메시지 삭제"
                          onClick={() => confirm("이 메시지를 삭제할까요?") && act(() => call(`/squads/messages/${m.id}`, "DELETE"))}
                          className="self-start p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-5">
                <div className={card}>
                  <h4 className="font-semibold text-white text-sm">활동 기록</h4>
                  <ul className="mt-3 max-h-[320px] overflow-y-auto space-y-2">
                    {detail.events.map((e) => (
                      <li key={e.id} className="text-xs flex gap-2">
                        <span className="text-zinc-500 whitespace-nowrap">{fmt(e.createdAt)}</span>
                        <span className="text-zinc-100 font-medium whitespace-nowrap">{EVENT_LABEL[e.type] || e.type}</span>
                        <span className="text-zinc-300 break-all">{eventText(e)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={card}>
                  <h4 className="font-semibold text-white text-sm">가입 신청 기록</h4>
                  <ul className="mt-3 space-y-1.5">
                    {detail.requests.length === 0 && <li className="text-xs text-zinc-500">가입 신청이 없습니다.</li>}
                    {detail.requests.map((r) => (
                      <li key={r.id} className="text-xs text-zinc-300">
                        <span className="text-zinc-500">{fmt(r.createdAt)}</span> · {r.name} · <span className="text-zinc-100">{REQUEST_LABEL[r.status] || r.status}</span>
                        {r.message && <span className="text-zinc-400"> · &quot;{r.message}&quot;</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={card}>
                  <h4 className="font-semibold text-white text-sm">이 스쿼드에 대한 관리자 조치</h4>
                  <AdminActionList actions={detail.adminActions} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={card}>
        <h4 className="font-semibold text-white text-sm">최근 관리자 조치 (전체)</h4>
        <p className="text-xs text-zinc-500 mt-0.5">해산된 스쿼드의 조치도 여기 남습니다.</p>
        <AdminActionList actions={recent} showSquad />
      </div>
    </div>
  )
}

function AdminActionList({ actions, showSquad = false }: { actions: AdminAction[]; showSquad?: boolean }) {
  if (!actions.length) return <p className="mt-3 text-xs text-zinc-500">기록이 없습니다.</p>
  return (
    <ul className="mt-3 space-y-1.5">
      {actions.map((a) => (
        <li key={a.id} className="text-xs text-zinc-300">
          <span className="text-zinc-500">{fmt(a.createdAt)}</span> · <span className="text-zinc-100 font-medium">{ACTION_LABEL[a.action] || a.action}</span>
          {showSquad && <span> · {a.squadName}</span>}
          {a.action === "rename" && a.detail?.from && <span className="text-zinc-400"> · &apos;{a.detail.from}&apos; → &apos;{a.detail.to}&apos;</span>}
          {a.action === "delete_message" && a.detail?.body && <span className="text-zinc-400"> · &quot;{String(a.detail.body).slice(0, 40)}&quot;</span>}
          {a.reason && <span className="text-zinc-400"> · 사유: {a.reason}</span>}
          <span className="text-zinc-500"> · {a.actor}</span>
        </li>
      ))}
    </ul>
  )
}

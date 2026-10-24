"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Bell, History, Send, SlidersHorizontal } from "lucide-react"
import {
  ALIMTALK_STATUS_LABELS,
  CHANNEL_LABELS,
  GROUP_LABELS,
  fetchBroadcasts,
  fetchKinds,
  fetchLog,
  renderTemplate,
  sendAlimtalkTest,
  sendBroadcast,
  updateKind,
  type NotificationBroadcast,
  type NotificationKind,
  type NotificationLogItem,
} from "@/lib/notifications"

// 관리자 > 파트너 및 운영 > 알림 관리 (backend users 서비스 /api/users/admin/notifications)
// 알림 종류별 켜고 끄기·문구·보내는 길·보내는 시각, 보낸 기록, 운영 공지 직접 보내기
// 새 알림 종류는 기능 코드에 한 줄 + 웹 배포로 추가 (앱 업데이트 필요 없음). 설계: docs/planning/알림-구성-설계.md

type Tab = "kinds" | "log" | "broadcast"

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })

// 미리보기 예시 값
const SAMPLE: Record<string, string> = {
  item: "아크릴 키링 외 1건", total: "12,000", orderNo: "DJ-261018-AB12CD", trackingNo: "123456789012",
  amount: "5,000", label: "덕력 퀴즈", paymentId: "dp-...", popup: "강동 팝업", popupId: "...",
  startDate: "10월 20일(화)", endDate: "10월 26일(월)", location: "서울 강동구", date: "10월 20일(화)", time: "14:00",
  party: "2", code: "BK-AB12CD", number: "12", ahead: "3", project: "덕질 펀딩", projectId: "...", reason: "사유",
  preview: "견적 확인 부탁드려요", percent: "64", result: "무산됐어요", price: "30,000", title: "공지 제목", body: "공지 내용",
  link: "/", status: "견적서를 보냈어요", company: "덕지 컴퍼니", brand: "브랜드", event: "행사 이름", target: "글", name: "갤러리 이름",
  period: "7일 동안",
}

function KindsPanel() {
  const [kinds, setKinds] = useState<NotificationKind[] | null>(null)
  const [error, setError] = useState("")
  const [audience, setAudience] = useState<"member" | "admin">("member")
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    fetchKinds().then(setKinds).catch((e) => setError(e.message))
  }, [])

  const replace = (k: NotificationKind) => setKinds((list) => list?.map((x) => (x.code === k.code ? k : x)) ?? list)

  const toggle = async (k: NotificationKind) => {
    try {
      replace(await updateKind(k.code, { enabled: !k.enabled }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.")
    }
  }

  const groups = useMemo(() => {
    const out: { group: string; items: NotificationKind[] }[] = []
    for (const k of kinds?.filter((x) => x.audience === audience) ?? []) {
      const g = out.find((x) => x.group === k.group)
      if (g) g.items.push(k)
      else out.push({ group: k.group, items: [k] })
    }
    return out
  }, [kinds, audience])

  if (kinds === null) return <p className="py-10 text-center text-sm text-zinc-400">{error || "불러오는 중..."}</p>
  if (kinds.length === 0) return <p className="py-10 text-center text-sm text-zinc-400">알림 표가 아직 없어요. 운영 DB 에 056 마이그레이션을 적용하면 보여요.</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["member", "admin"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${audience === a ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-white border border-zinc-800"}`}
            >
              {a === "member" ? "회원 알림" : "관리자 알림"}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">알림함과 알림톡(템플릿 ID 가 있는 종류)이 실제로 가요. 앱 푸시는 앱 출시 때, 메일은 연결되면 같이 가요.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {groups.map((g) => (
        <section key={g.group}>
          <h4 className="text-xs font-semibold text-zinc-500 mb-1.5">{GROUP_LABELS[g.group] || g.group}</h4>
          <ul className="border-y border-zinc-800 divide-y divide-zinc-800">
            {g.items.map((k) => (
              <li key={k.code} className="py-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={k.enabled}
                    aria-label={`${k.name} ${k.enabled ? "끄기" : "켜기"}`}
                    onClick={() => toggle(k)}
                    className={`mt-0.5 relative w-9 h-5 rounded-full shrink-0 transition-colors ${k.enabled ? "bg-sky-600" : "bg-zinc-700"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${k.enabled ? "translate-x-4" : ""}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className={`text-sm font-semibold ${k.enabled ? "text-white" : "text-zinc-500"}`}>{k.name}</span>
                      <span className="text-xs text-zinc-500">{k.description}</span>
                      {k.essential && <span className="text-[11px] text-zinc-500">· 회원이 끌 수 없음</span>}
                      {k.sendHour !== null && <span className="text-[11px] text-sky-300">· {k.sendHour}시 이후</span>}
                    </div>
                    <p className="mt-1 text-[13px] text-zinc-300 truncate">
                      {renderTemplate(k.titleTpl, SAMPLE)} <span className="text-zinc-500">· {renderTemplate(k.bodyTpl, SAMPLE)}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span>{k.channels.map((ch) => CHANNEL_LABELS[ch]?.label || ch).join(" · ")}</span>
                      <span>보낸 수 {k.sentCount.toLocaleString()}</span>
                      {k.lastSentAt && <span>마지막 {when(k.lastSentAt)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(editing === k.code ? null : k.code)}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-600"
                  >
                    {editing === k.code ? "닫기" : "수정"}
                  </button>
                </div>
                {editing === k.code && (
                  <KindEditor
                    kind={k}
                    onSaved={(next) => {
                      replace(next)
                      setEditing(null)
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function KindEditor({ kind, onSaved }: { kind: NotificationKind; onSaved: (k: NotificationKind) => void }) {
  const [titleTpl, setTitleTpl] = useState(kind.titleTpl)
  const [bodyTpl, setBodyTpl] = useState(kind.bodyTpl)
  const [linkTpl, setLinkTpl] = useState(kind.linkTpl)
  const [channels, setChannels] = useState<string[]>(kind.channels)
  const [sendHour, setSendHour] = useState<number | null>(kind.sendHour)
  const [templateId, setTemplateId] = useState(kind.alimtalkTemplateId)
  const [testPhone, setTestPhone] = useState("")
  const [testMsg, setTestMsg] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      onSaved(
        await updateKind(kind.code, {
          titleTpl, bodyTpl, linkTpl, channels, alimtalkTemplateId: templateId.trim(),
          ...(kind.sendHour !== null ? { sendHour } : {}),
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.")
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTestMsg("보내는 중...")
    try {
      await sendAlimtalkTest(kind.code, kind.alimtalkTemplateId, testPhone)
      setTestMsg("보냈어요. 카카오톡을 확인해 주세요.")
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "보내지 못했어요.")
    }
  }

  return (
    <div className="mt-3 ml-12 p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
      {kind.vars && (
        <p className="text-xs text-zinc-400">
          쓸 수 있는 빈칸: {kind.vars.split(",").map((v) => `{${v.trim()}}`).join(" ")}
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-zinc-400">제목</span>
        <input className={inputClass} value={titleTpl} maxLength={200} onChange={(e) => setTitleTpl(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-zinc-400">내용</span>
        <textarea className={`${inputClass} min-h-[72px]`} value={bodyTpl} maxLength={500} onChange={(e) => setBodyTpl(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-zinc-400">누르면 가는 곳 (사이트 안 주소)</span>
        <input className={inputClass} value={linkTpl} maxLength={300} placeholder="/mypage/?tab=orders" onChange={(e) => setLinkTpl(e.target.value)} />
      </label>
      <div className="space-y-1">
        <span className="text-xs font-semibold text-zinc-400">보내는 길</span>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CHANNEL_LABELS).map(([ch, c]) => (
            <label key={ch} className={`inline-flex items-center gap-1.5 text-sm ${ch === "inbox" ? "text-zinc-500" : "text-zinc-200"}`}>
              <input
                type="checkbox"
                className="accent-sky-600"
                checked={channels.includes(ch)}
                disabled={ch === "inbox"}
                onChange={(e) => setChannels(e.target.checked ? [...channels, ch] : channels.filter((x) => x !== ch))}
              />
              {c.label}
              {!c.ready && <span className="text-[11px] text-zinc-500">({c.note})</span>}
            </label>
          ))}
        </div>
      </div>
      {kind.sendHour !== null && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-zinc-400">보내는 시각 (한국 시간, 이 시각부터 만듦)</span>
          <select className={`${inputClass} w-32`} value={sendHour ?? 10} onChange={(e) => setSendHour(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="text-[13px] text-zinc-400">
        미리보기: <span className="text-white font-semibold">{renderTemplate(titleTpl, SAMPLE)}</span> · {renderTemplate(bodyTpl, SAMPLE)}
      </div>
      {channels.includes("alimtalk") && (
        <div className="space-y-2 pt-1">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-zinc-400">알림톡 템플릿 ID (솔라피에서 검수 끝난 템플릿)</span>
            <input className={`${inputClass} w-64`} value={templateId} maxLength={60} placeholder="비우면 알림톡 안 감" onChange={(e) => setTemplateId(e.target.value)} />
          </label>
          <p className="text-xs text-zinc-500">알림톡 문구는 카카오 검수를 받은 템플릿 그대로 가요. 위 제목·내용은 알림함·푸시용이에요.</p>
          {kind.alimtalkTemplateId && (
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} w-44 py-1.5`} value={testPhone} placeholder="받을 번호 01012345678" onChange={(e) => setTestPhone(e.target.value)} />
              <button onClick={test} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-200 hover:border-zinc-500">
                예시 값으로 테스트 발송
              </button>
              {testMsg && <span className="text-xs text-zinc-400">{testMsg}</span>}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  )
}

function LogPanel() {
  const [kinds, setKinds] = useState<NotificationKind[]>([])
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const [items, setItems] = useState<NotificationLogItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState("")

  const load = async (before?: number) => {
    try {
      const r = await fetchLog({ kind: kind || undefined, q: q.trim() || undefined, before })
      setItems(before ? [...(items ?? []), ...r.items] : r.items)
      setHasMore(r.hasMore)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.")
      setItems([])
    }
  }

  useEffect(() => {
    fetchKinds().then(setKinds).catch(() => {})
  }, [])
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
        className="flex flex-wrap gap-2"
      >
        <select className={`${inputClass} w-auto`} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">전체 종류</option>
          {kinds.map((k) => (
            <option key={k.code} value={k.code}>
              {k.audience === "admin" ? "[관리자] " : ""}
              {k.name}
            </option>
          ))}
        </select>
        <input className={`${inputClass} flex-1 min-w-[180px]`} placeholder="회원 이름·이메일·ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="px-4 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-semibold">찾기</button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items === null ? (
        <p className="py-10 text-center text-sm text-zinc-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">보낸 알림이 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left font-semibold py-2 pr-3 whitespace-nowrap">보낸 때</th>
                <th className="text-left font-semibold py-2 pr-3">받는 사람</th>
                <th className="text-left font-semibold py-2 pr-3">종류</th>
                <th className="text-left font-semibold py-2 pr-3">내용</th>
                <th className="text-left font-semibold py-2 whitespace-nowrap">읽음</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((n) => (
                <tr key={n.id} className="align-top">
                  <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap tabular-nums">{when(n.createdAt)}</td>
                  <td className="py-2.5 pr-3 text-zinc-200 whitespace-nowrap">
                    {n.audience === "admin" ? <span className="text-zinc-500">관리자</span> : n.memberName || n.memberId}
                    {n.memberEmail && <div className="text-xs text-zinc-500">{n.memberEmail}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">{n.kindName}</td>
                  <td className="py-2.5 pr-3 text-zinc-200 min-w-[220px]">
                    <div className="font-semibold">{n.title}</div>
                    {n.body && <div className="text-xs text-zinc-400">{n.body}</div>}
                  </td>
                  <td className="py-2.5 text-zinc-400 whitespace-nowrap">
                    {n.readAt ? when(n.readAt) : "안 읽음"}
                    {n.alimtalkStatus && (
                      <div className={`text-xs ${n.alimtalkStatus === "sent" ? "text-sky-300" : "text-amber-300"}`} title={n.alimtalkError || undefined}>
                        {ALIMTALK_STATUS_LABELS[n.alimtalkStatus] || n.alimtalkStatus}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && items && (
        <button onClick={() => load(items[items.length - 1].id)} className="px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-300 hover:text-white">
          더 보기
        </button>
      )}
    </div>
  )
}

function BroadcastPanel() {
  const [data, setData] = useState<{ items: NotificationBroadcast[]; recipients: number } | null>(null)
  const [form, setForm] = useState({ title: "", body: "", link: "" })
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = () => fetchBroadcasts().then(setData).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const send = async () => {
    if (!form.title.trim()) return setError("제목을 입력해 주세요.")
    if (!window.confirm(`활동 중인 회원 ${data?.recipients.toLocaleString() ?? ""}명의 알림함에 보낼까요? 보낸 뒤에는 되돌릴 수 없어요.`)) return
    setSending(true)
    setError("")
    setMessage("")
    try {
      const n = await sendBroadcast(form)
      setMessage(`${n.toLocaleString()}명에게 보냈어요.`)
      setForm({ title: "", body: "", link: "" })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "보내지 못했어요.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 max-w-2xl">
        <p className="text-sm text-zinc-400">
          점검·정책 변경 같은 운영 공지를 활동 중인 회원 전체({data ? data.recipients.toLocaleString() : "…"}명) 알림함에 보내요. 이벤트·혜택 홍보는 광고라 '광고 메시지 보내기'로 보내 주세요.
        </p>
        <input className={inputClass} placeholder="제목" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className={`${inputClass} min-h-[80px]`} placeholder="내용 (선택)" maxLength={500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <input className={inputClass} placeholder="누르면 가는 곳 (선택, 예: /notice)" maxLength={300} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        <button onClick={send} disabled={sending} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? "보내는 중..." : "보내기"}
        </button>
      </div>

      <section>
        <h4 className="text-xs font-semibold text-zinc-500 mb-1.5">보낸 공지</h4>
        {!data || data.items.length === 0 ? (
          <p className="py-6 text-sm text-zinc-500">아직 보낸 공지가 없어요.</p>
        ) : (
          <ul className="border-y border-zinc-800 divide-y divide-zinc-800">
            {data.items.map((b) => (
              <li key={b.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{b.title}</div>
                  {b.body && <div className="text-xs text-zinc-400">{b.body}</div>}
                </div>
                <div className="text-xs text-zinc-500 text-right whitespace-nowrap">
                  {when(b.createdAt)}
                  <div>{b.sentCount.toLocaleString()}명</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function NotificationManager() {
  const [tab, setTab] = useState<Tab>("kinds")
  const TABS: { id: Tab; label: string; icon: typeof Bell }[] = [
    { id: "kinds", label: "알림 종류", icon: SlidersHorizontal },
    { id: "log", label: "보낸 기록", icon: History },
    { id: "broadcast", label: "공지 보내기", icon: Send },
  ]
  return (
    <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5">
      <div>
        <h3 className="font-semibold text-lg text-white">알림 관리</h3>
        <p className="text-sm text-zinc-400">주문·결제·예약·펀딩 상태가 바뀌면 회원 알림함(상단 종 아이콘)에 자동으로 가요. 종류마다 켜고 끄고 문구를 바꿀 수 있어요.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-3">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === "kinds" ? <KindsPanel /> : tab === "log" ? <LogPanel /> : <BroadcastPanel />}
    </div>
  )
}

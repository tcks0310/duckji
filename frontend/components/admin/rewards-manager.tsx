"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { fetchPopups } from "@/lib/popup-service"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 '컨텐츠 관리 > 보상 코드' 탭 (backend rewards 서비스 /api/rewards/admin/codes)
// 코드마다 종류(팝업·굿즈·일반 배포·크리에이터 제휴)와 연결 대상(어떤 팝업·굿즈·배포처·크리에이터)을 남겨 코드별로 관리
// 회원은 마이페이지 '포인트 관리'에서 코드를 넣어 적립 (크리에이터 코드는 회원당 하나)

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const labelClass = "block text-xs text-zinc-400 mb-1"
const btn = "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg h-auto py-2"
const btnPrimary = "bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg h-auto py-2"

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

type Kind = "popup" | "goods" | "general" | "creator"
type Code = {
  code: string
  kind: Kind
  name: string
  targetId: string
  targetName: string
  rewardDp: number
  rewardItem: string
  maxRedemptions: number | null
  startsAt: string | null
  endsAt: string | null
  active: boolean
  memo: string
  used: number
  createdAt: string
}
type Redemption = { memberId: string; name: string; email: string; rewardDp: number; createdAt: string }

const KINDS: { id: Kind; label: string; target: string; placeholder: string }[] = [
  { id: "popup", label: "팝업 코드", target: "연결 팝업", placeholder: "" },
  { id: "goods", label: "굿즈 코드", target: "연결 굿즈", placeholder: "굿즈 이름" },
  { id: "general", label: "일반 배포", target: "배포처", placeholder: "예: 인스타그램 이벤트 (선택)" },
  { id: "creator", label: "크리에이터 제휴", target: "크리에이터", placeholder: "크리에이터·제휴처 이름" },
]
const kindOf = (k: Kind) => KINDS.find((x) => x.id === k)!

const dateText = (v: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "")
const toDateInput = (v: string | null) => (v ? new Date(new Date(v).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : "")
const endOfDay = (d: string) => (d ? `${d}T23:59:59+09:00` : null)
const startOfDay = (d: string) => (d ? `${d}T00:00:00+09:00` : null)

function status(c: Code) {
  const now = Date.now()
  if (!c.active) return { text: "꺼짐", cls: "text-zinc-500" }
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { text: "시작 전", cls: "text-zinc-300" }
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { text: "기간 끝", cls: "text-zinc-500" }
  if (c.maxRedemptions && c.used >= c.maxRedemptions) return { text: "선착순 마감", cls: "text-zinc-500" }
  return { text: "사용 중", cls: "text-emerald-400" }
}

function ErrorLine({ error }: { error: string }) {
  return error ? <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div> : null
}

type PopupOption = { id: string; title: string }

// 팝업 코드의 연결 대상 고르기 (사이트 팝업 목록)
function usePopupOptions() {
  const [popups, setPopups] = useState<PopupOption[]>([])
  useEffect(() => {
    fetchPopups({ includeUnpublished: true })
      .then((list) => setPopups(list.map((p) => ({ id: p.id, title: p.title }))))
      .catch(() => fetchPopups().then((list) => setPopups(list.map((p) => ({ id: p.id, title: p.title })))).catch(() => {}))
  }, [])
  return popups
}

type FormState = {
  code: string
  kind: Kind
  targetId: string
  targetName: string
  name: string
  rewardDp: string
  rewardItem: string
  maxRedemptions: string
  startsAt: string
  endsAt: string
  memo: string
}
const emptyForm: FormState = {
  code: "",
  kind: "popup",
  targetId: "",
  targetName: "",
  name: "",
  rewardDp: "200",
  rewardItem: "",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  memo: "",
}
const formOf = (c: Code): FormState => ({
  code: c.code,
  kind: c.kind,
  targetId: c.targetId,
  targetName: c.targetName,
  name: c.name,
  rewardDp: String(c.rewardDp),
  rewardItem: c.rewardItem,
  maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : "",
  startsAt: toDateInput(c.startsAt),
  endsAt: toDateInput(c.endsAt),
  memo: c.memo,
})
const payloadOf = (f: FormState) => ({
  kind: f.kind,
  targetId: f.kind === "popup" ? f.targetId : "",
  targetName: f.targetName,
  name: f.name,
  rewardDp: Number(f.rewardDp),
  rewardItem: f.rewardItem,
  maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null,
  startsAt: startOfDay(f.startsAt),
  endsAt: endOfDay(f.endsAt),
  memo: f.memo,
})

// 코드 정보 입력칸 (새 코드·수정 같이 씀)
function CodeFields({ form, setForm, popups, isNew }: { form: FormState; setForm: (f: FormState) => void; popups: PopupOption[]; isNew: boolean }) {
  const k = kindOf(form.kind)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label className={labelClass}>종류</label>
        <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind, targetId: "", targetName: "" })}>
          {KINDS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2">
        <label className={labelClass}>{k.target}</label>
        {form.kind === "popup" ? (
          <select
            className={inputClass}
            value={form.targetId}
            onChange={(e) => {
              const p = popups.find((x) => x.id === e.target.value)
              setForm({ ...form, targetId: e.target.value, targetName: p?.title ?? "" })
            }}
          >
            <option value="">팝업 고르기</option>
            {form.targetId && !popups.some((p) => p.id === form.targetId) && <option value={form.targetId}>{form.targetName} (목록에 없음)</option>}
            {popups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        ) : (
          <input className={inputClass} value={form.targetName} onChange={(e) => setForm({ ...form, targetName: e.target.value })} placeholder={k.placeholder} />
        )}
      </div>
      <div>
        <label className={labelClass}>코드</label>
        <input
          className={`${inputClass} font-mono ${isNew ? "" : "opacity-60"}`}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="영문·숫자·-"
          disabled={!isNew}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>이름 (회원 포인트 내역에 보임)</label>
        <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 강동 팝업 방문 감사 코드" required />
      </div>
      <div>
        <label className={labelClass}>지급 DP</label>
        <input className={inputClass} type="number" min={1} max={5000} value={form.rewardDp} onChange={(e) => setForm({ ...form, rewardDp: e.target.value })} required />
      </div>
      <div>
        <label className={labelClass}>선착순 횟수 (빈칸 = 무제한)</label>
        <input className={inputClass} type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>시작일 (빈칸 = 바로)</label>
        <DatePicker className={inputClass} value={form.startsAt} max={form.endsAt || undefined} onChange={(v) => setForm({ ...form, startsAt: v })} placeholder="바로 시작" />
      </div>
      <div>
        <label className={labelClass}>마감일 (빈칸 = 없음)</label>
        <DatePicker className={inputClass} value={form.endsAt} min={form.startsAt || undefined} onChange={(v) => setForm({ ...form, endsAt: v })} placeholder="마감 없음" />
      </div>
      <div>
        <label className={labelClass}>같이 주는 아이템 (선택)</label>
        <input className={inputClass} value={form.rewardItem} onChange={(e) => setForm({ ...form, rewardItem: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>관리자 메모 (회원에게 안 보임)</label>
        <input className={inputClass} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
      </div>
    </div>
  )
}

export function RewardsManager() {
  const [codes, setCodes] = useState<Code[]>([])
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Kind | "all">("all")
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [selected, setSelected] = useState<string | null>(null)
  const popups = usePopupOptions()

  const load = () =>
    call<{ codes: Code[] }>("/codes")
      .then((r) => setCodes(r.codes))
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: codes.length }
    for (const c of codes) m[c.kind] = (m[c.kind] || 0) + 1
    return m
  }, [codes])

  const shown = codes.filter((c) => {
    if (filter !== "all" && c.kind !== filter) return false
    const q = query.trim().toLowerCase()
    return !q || [c.code, c.name, c.targetName, c.memo].some((v) => v.toLowerCase().includes(q))
  })

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await call("/codes", "POST", { ...payloadOf(form), code: form.code })
      setSelected(form.code.trim().toUpperCase())
      setForm({ ...emptyForm, kind: form.kind })
      setAdding(false)
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const current = codes.find((c) => c.code === selected) || null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-lg text-white">보상 코드</h2>
        <Button size="sm" className={btnPrimary} onClick={() => setAdding((v) => !v)}>
          {adding ? "닫기" : "코드 추가"}
        </Button>
      </div>

      {adding && (
        <form onSubmit={create} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <CodeFields form={form} setForm={setForm} popups={popups} isNew />
          <div className="flex justify-end">
            <Button type="submit" size="sm" className={`${btnPrimary} px-4`}>
              코드 만들기
            </Button>
          </div>
        </form>
      )}

      <ErrorLine error={error} />

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {([{ id: "all", label: "전체" }, ...KINDS] as { id: Kind | "all"; label: string }[]).map((x) => (
          <button
            key={x.id}
            onClick={() => setFilter(x.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold ${filter === x.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            {x.label} {counts[x.id] || 0}
          </button>
        ))}
        <input
          className={`${inputClass} sm:w-56 sm:ml-auto`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="코드·이름·연결 대상 검색"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400 text-xs">
            <tr>
              <th className="p-2.5 text-left font-medium">코드</th>
              <th className="p-2.5 text-left font-medium">종류</th>
              <th className="p-2.5 text-left font-medium">연결 대상</th>
              <th className="p-2.5 text-left font-medium">이름</th>
              <th className="p-2.5 text-right font-medium">DP</th>
              <th className="p-2.5 text-right font-medium">사용</th>
              <th className="p-2.5 text-left font-medium">기간</th>
              <th className="p-2.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-zinc-500">
                  {codes.length === 0 ? "등록된 코드가 없습니다. 오른쪽 위 '코드 추가'로 만드세요." : "조건에 맞는 코드가 없습니다."}
                </td>
              </tr>
            )}
            {shown.map((c) => {
              const st = status(c)
              return (
                <tr
                  key={c.code}
                  onClick={() => setSelected(c.code === selected ? null : c.code)}
                  className={`cursor-pointer ${c.code === selected ? "bg-zinc-800/60" : "hover:bg-zinc-900"} ${c.active ? "text-zinc-200" : "text-zinc-500"}`}
                >
                  <td className="p-2.5 font-mono whitespace-nowrap">{c.code}</td>
                  <td className="p-2.5 whitespace-nowrap">{kindOf(c.kind).label}</td>
                  <td className="p-2.5">{c.targetName || <span className="text-zinc-600">-</span>}</td>
                  <td className="p-2.5">{c.name}</td>
                  <td className="p-2.5 text-right">{c.rewardDp.toLocaleString()}</td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    {c.used.toLocaleString()}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions.toLocaleString()}` : ""}
                  </td>
                  <td className="p-2.5 whitespace-nowrap text-zinc-400">
                    {c.startsAt || c.endsAt ? `${dateText(c.startsAt) || "바로"} ~ ${dateText(c.endsAt) || ""}` : "-"}
                  </td>
                  <td className={`p-2.5 whitespace-nowrap ${st.cls}`}>{st.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {current && (
        <CodeDetail
          key={current.code}
          code={current}
          popups={popups}
          onChanged={load}
          onDeleted={() => {
            setSelected(null)
            load()
          }}
        />
      )}

      <p className="text-xs text-zinc-500">
        회원은 마이페이지 '포인트 관리'에서 코드를 넣습니다. 코드마다 회원당 한 번, 크리에이터 제휴 코드는 회원당 하나만 쓸 수 있습니다.
      </p>
    </div>
  )
}

// 코드 하나: 수정·켜고 끄기·지우기, 등록한 회원
function CodeDetail({ code, popups, onChanged, onDeleted }: { code: Code; popups: PopupOption[]; onChanged: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<FormState>(formOf(code))
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [redemptions, setRedemptions] = useState<Redemption[] | null>(null)
  const path = `/codes/${encodeURIComponent(code.code)}`

  useEffect(() => {
    call<{ redemptions: Redemption[] }>(`${path}/redemptions`)
      .then((r) => setRedemptions(r.redemptions))
      .catch(() => setRedemptions([]))
  }, [path, code.used])

  const run = async (fn: () => Promise<unknown>) => {
    setError("")
    setSaved(false)
    try {
      await fn()
      return true
    } catch (e: any) {
      setError(e.message)
      return false
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await run(() => call(path, "PATCH", payloadOf(form)))) {
      setSaved(true)
      onChanged()
    }
  }
  const toggle = async () => {
    if (await run(() => call(path, "PATCH", { active: !code.active }))) onChanged()
  }
  const remove = async () => {
    if (!confirm(`'${code.code}' 코드를 지울까요?`)) return
    if (await run(() => call(path, "DELETE"))) onDeleted()
  }

  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white font-mono">{code.code}</div>
          <div className="text-xs text-zinc-400">
            {kindOf(code.kind).label}
            {code.targetName ? ` · ${code.targetName}` : ""} · 만든 날 {dateText(code.createdAt)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className={btn} onClick={toggle}>
            {code.active ? "끄기" : "켜기"}
          </Button>
          {code.used === 0 && (
            <Button size="sm" className={`${btn} text-red-300`} onClick={remove}>
              지우기
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={save} className="space-y-3">
        <CodeFields form={form} setForm={setForm} popups={popups} isNew={false} />
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-emerald-400">저장했습니다.</span>}
          <Button type="submit" size="sm" className={`${btnPrimary} px-4`}>
            저장
          </Button>
        </div>
      </form>
      <ErrorLine error={error} />

      <div>
        <div className="text-sm font-semibold text-white mb-2">등록한 회원 {code.used.toLocaleString()}명</div>
        {redemptions === null ? (
          <p className="text-xs text-zinc-500">불러오는 중...</p>
        ) : redemptions.length === 0 ? (
          <p className="text-xs text-zinc-500">아직 등록한 회원이 없습니다.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800 text-sm">
            {redemptions.map((r) => (
              <div key={r.memberId} className="px-3 py-2 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-zinc-200">
                  {r.name}
                  {r.email && <span className="text-zinc-500"> · {r.email}</span>}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  +{r.rewardDp.toLocaleString()} DP · {new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

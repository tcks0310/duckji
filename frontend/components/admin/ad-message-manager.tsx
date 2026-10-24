"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { MessageCircle, MessageSquareText, Pencil, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { ImageUploadField } from "@/components/admin/image-upload-field"
import {
  AD_MESSAGE_STATUS_LABELS,
  AdMessage,
  AdMessageInput,
  createAdMessage,
  deleteAdMessage,
  fetchAdAudience,
  fetchAdMessages,
  fullSmsText,
  sendAdMessage,
  smsBytes,
  smsKind,
  updateAdMessage,
  uploadMmsImage,
} from "@/lib/ad-messages"

// 관리자 > 파트너 및 운영 > 광고 메시지 보내기
// 문자: 마케팅 문자 수신 동의 회원에게 보낼 광고 문자 초안 작성·저장 (발송은 솔라피 연결 뒤)
// 카카오톡: 덕지 카카오톡 채널 개설 예정 안내만

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"

const EMPTY: AdMessageInput = { title: "", body: "", imageUrl: "", linkUrl: "", scheduledAt: null }

// "YYYY-MM-DDTHH:mm"(한국 시간) ↔ ISO
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000)
  return d.toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+09:00`).toISOString() : null)
const isNightInput = (v: string) => {
  const h = Number(v.slice(11, 13))
  return v.length >= 13 && (h >= 21 || h < 8)
}
const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })

function SmsPanel() {
  const [audience, setAudience] = useState<number | null>(null)
  const [messages, setMessages] = useState<AdMessage[]>([])
  const [form, setForm] = useState<AdMessageInput>(EMPTY)
  const [scheduled, setScheduled] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")

  const load = async () => {
    const [a, m] = await Promise.all([fetchAdAudience(), fetchAdMessages()])
    if (a.success) setAudience(a.sms)
    if (m.success) setMessages(m.messages)
    else setErrors(m.errors)
  }

  useEffect(() => {
    load()
  }, [])

  const set = <K extends keyof AdMessageInput>(k: K, v: AdMessageInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const reset = () => {
    setForm(EMPTY)
    setScheduled("")
    setEditingId(null)
    setErrors([])
  }

  const edit = (m: AdMessage) => {
    setForm({ title: m.title, body: m.body, imageUrl: m.imageUrl, linkUrl: m.linkUrl, scheduledAt: m.scheduledAt })
    setScheduled(toLocalInput(m.scheduledAt))
    setEditingId(m.id)
    setErrors([])
    setNotice("")
  }

  const save = async () => {
    if (scheduled && isNightInput(scheduled)) return setErrors(["밤 9시부터 아침 8시 사이에는 광고 문자를 보낼 수 없어요."])
    setSaving(true)
    const input = { ...form, scheduledAt: fromLocalInput(scheduled) }
    const result = editingId ? await updateAdMessage(editingId, input) : await createAdMessage(input)
    setSaving(false)
    if (!result.success) return setErrors(result.errors)
    setNotice(editingId ? "초안을 고쳤어요." : "초안을 저장했어요.")
    reset()
    load()
  }

  const remove = async (m: AdMessage) => {
    if (!confirm(`'${m.title || m.body.slice(0, 20)}' 초안을 지울까요?`)) return
    const result = await deleteAdMessage(m.id)
    if (!result.success) return alert(result.errors.join("\n"))
    if (editingId === m.id) reset()
    load()
  }

  const send = async (m: AdMessage) => {
    const result = await sendAdMessage(m.id)
    if (!result.success) alert(result.errors.join("\n"))
  }

  const text = fullSmsText(form)
  const bytes = smsBytes(text)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-500">받는 사람 (마케팅 문자 수신 동의 회원)</div>
          <div className="text-2xl font-semibold text-white mt-1">{audience === null ? "-" : `${audience.toLocaleString()}명`}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-500">문자 발송</div>
          <div className="text-base font-semibold text-amber-300 mt-1">솔라피 연결 전</div>
          <div className="text-xs text-zinc-500 mt-1">지금은 초안 저장만 돼요. 연결하면 저장한 초안을 그대로 보낼 수 있어요.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">{editingId ? "초안 고치기" : "새 광고 문자"}</div>
          <input className={inputClass} value={form.title} maxLength={30} onChange={(e) => set("title", e.target.value)} placeholder="제목 (장문·사진 문자 제목, 30자 이내)" />
          <textarea
            className={`${inputClass} min-h-[160px]`}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="보낼 내용 ((광고)덕지 와 수신거부 문구는 저절로 붙어요)"
          />
          <input className={inputClass} value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="링크 (선택, https://www.duckji.com/...)" />
          <ImageUploadField
            label="사진 (선택, JPG 200KB 이하)"
            value={form.imageUrl}
            onChange={(v) => set("imageUrl", v)}
            target="notices"
            upload={uploadMmsImage}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">보낼 시각 (선택, 비우면 발송 버튼을 누를 때 바로)</span>
            <DatePicker withTime minuteStep={30} className={inputClass} value={scheduled} onChange={setScheduled} placeholder="바로 보내기" />
            <p className="text-xs text-zinc-500">밤 9시부터 아침 8시 사이에는 보낼 수 없어요.</p>
          </div>
          {errors.length > 0 && <div className="text-xs text-red-400">{errors.join(" ")}</div>}
          {notice && <div className="text-xs text-emerald-400">{notice}</div>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold rounded-xl">
              {saving ? "저장 중..." : editingId ? "고친 내용 저장" : "초안 저장"}
            </Button>
            {(editingId || form.body) && (
              <Button size="sm" onClick={reset} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl">
                새로 쓰기
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">받는 화면 미리보기</div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            {form.imageUrl && <img src={form.imageUrl} alt="" className="w-full rounded-lg object-cover" />}
            {form.title && <div className="text-sm font-semibold text-zinc-100">{form.title}</div>}
            <div className="whitespace-pre-line break-all text-sm text-zinc-300">{text}</div>
          </div>
          <div className="text-xs text-zinc-500">
            {smsKind(form)} · {bytes.toLocaleString()} / {bytes <= 90 && !form.imageUrl ? 90 : 2000} 바이트
          </div>
          {bytes > 2000 && <div className="text-xs text-red-400">문자는 2000바이트(한글 약 1000자)까지 보낼 수 있어요.</div>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-white">저장한 광고 문자</div>
        {messages.length === 0 && <div className="text-sm text-zinc-500">아직 없어요.</div>}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">
            <div className="min-w-0">
              <div className="text-sm text-zinc-200 truncate">{m.title || m.body.split("\n")[0]}</div>
              <div>
                {AD_MESSAGE_STATUS_LABELS[m.status]} · {smsKind(m)} · 저장 {when(m.updatedAt)}
                {m.scheduledAt && ` · 보낼 시각 ${when(m.scheduledAt)}`}
                {m.sentAt && ` · ${m.recipientCount ?? 0}명에게 보냄`}
              </div>
            </div>
            {m.status === "draft" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" onClick={() => edit(m)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg">
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  고치기
                </Button>
                <Button size="sm" onClick={() => remove(m)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  지우기
                </Button>
                <Button size="sm" onClick={() => send(m)} disabled title="솔라피 연결 전" className="bg-sky-700 text-white text-xs rounded-lg disabled:opacity-40">
                  <Send className="w-3.5 h-3.5 mr-1" />
                  보내기
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function KakaoPanel() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center space-y-2">
      <MessageCircle className="w-8 h-8 text-zinc-500 mx-auto" />
      <div className="text-base font-semibold text-white">카카오톡 채널 개설 예정</div>
      <p className="text-sm text-zinc-400">덕지 카카오톡 채널을 만들고 솔라피에 연결하면 이 자리에서 광고 카카오톡(브랜드 메시지)을 보낼 수 있어요.</p>
    </div>
  )
}

type Tab = "sms" | "kakao"

export function AdMessageManager() {
  const [tab, setTab] = useState<Tab>("sms")
  const TABS: { id: Tab; label: string; icon: typeof MessageCircle }[] = [
    { id: "sms", label: "문자", icon: MessageSquareText },
    { id: "kakao", label: "카카오톡 (개설 예정)", icon: MessageCircle },
  ]
  return (
    <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5">
      <div>
        <h3 className="font-semibold text-lg text-white">광고 메시지 보내기</h3>
        <p className="text-sm text-zinc-400">가입 화면·마이페이지에서 마케팅 수신에 동의한 회원에게만 보내요.</p>
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
      {tab === "sms" ? <SmsPanel /> : <KakaoPanel />}
    </div>
  )
}

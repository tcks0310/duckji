"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"

// 관리자 '컨텐츠 관리 > 덕력 퀴즈' 탭 (backend rewards 서비스 /api/rewards/admin/quiz)
// 주제 → 버전(한 회차) → 문제 → 보기(하나씩 추가, 정답 하나 표시). 공개한 버전만 사이트 /play/quiz 에 보임
// 회원은 버전마다 처음 푼 결과로 한 번 DP 를 받음 (참여 DP + 정답마다 DP, 버전마다 정함)

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const labelClass = "block text-xs text-zinc-400 mb-1"
const btn = "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg h-auto py-2"
const btnPrimary = "bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg h-auto py-2"
const iconBtn = "p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"

async function call<T = any>(path: string, method = "GET", json?: unknown): Promise<T> {
  const res = await apiFetch(`/api/rewards/admin/quiz${path}`, {
    method,
    cache: "no-store",
    headers: json === undefined ? undefined : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "요청을 처리하지 못했습니다.")
  return body
}

type Topic = { id: number; title: string; description: string; versions: { id: number; title: string; published: boolean; items: number; attempts: number }[] }
type Option = { id: number; label: string; isAnswer: boolean }
type Item = { id: number; question: string; explanation: string; options: Option[]; ready: boolean }
type Version = {
  id: number
  topicId: number
  topicTitle: string
  title: string
  description: string
  baseDp: number
  perCorrectDp: number
  published: boolean
  attempts: number
  avgCorrect: number | null
  items: Item[]
}

function ErrorLine({ error }: { error: string }) {
  return error ? <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div> : null
}

export function QuizManager() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState("")
  const [topicId, setTopicId] = useState<number | null>(null)
  const [versionId, setVersionId] = useState<number | null>(null)
  const [newTopic, setNewTopic] = useState({ title: "", description: "" })
  const [newVersion, setNewVersion] = useState("")

  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setError("")
    try {
      return await fn()
    } catch (e: any) {
      setError(e.message)
      return null
    }
  }

  useEffect(() => {
    run(() => call<{ topics: Topic[] }>("/topics")).then((r) => {
      if (!r) return
      setTopics(r.topics)
      const first = r.topics[0]
      if (first) {
        setTopicId(first.id)
        setVersionId(first.versions[0]?.id ?? null)
      }
    })
  }, [])

  const topic = topics.find((t) => t.id === topicId) || null

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await run(() => call<{ id: number; topics: Topic[] }>("/topics", "POST", newTopic))
    if (!r) return
    setTopics(r.topics)
    setTopicId(r.id)
    setVersionId(null)
    setNewTopic({ title: "", description: "" })
  }

  const addVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic) return
    const r = await run(() => call<{ id: number; topics: Topic[] }>(`/topics/${topic.id}/versions`, "POST", { title: newVersion }))
    if (!r) return
    setTopics(r.topics)
    setVersionId(r.id)
    setNewVersion("")
  }

  const saveTopic = async (patch: Partial<Pick<Topic, "title" | "description">>) => {
    if (!topic) return
    const r = await run(() => call<{ topics: Topic[] }>(`/topics/${topic.id}`, "PATCH", patch))
    if (r) setTopics(r.topics)
  }

  const removeTopic = async () => {
    if (!topic || !confirm(`'${topic.title}' 주제를 지울까요?`)) return
    const r = await run(() => call<{ topics: Topic[] }>(`/topics/${topic.id}`, "DELETE"))
    if (!r) return
    setTopics(r.topics)
    setTopicId(r.topics[0]?.id ?? null)
    setVersionId(r.topics[0]?.versions[0]?.id ?? null)
  }

  // 버전 편집기에서 바뀐 내용을 왼쪽 목록에도 반영
  const syncVersion = (v: Version) =>
    setTopics((prev) =>
      prev.map((t) =>
        t.id !== v.topicId
          ? t
          : { ...t, versions: t.versions.map((x) => (x.id === v.id ? { ...x, title: v.title, published: v.published, items: v.items.length, attempts: v.attempts } : x)) }
      )
    )

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-lg text-white">덕력 퀴즈</h2>
      <ErrorLine error={error} />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] items-start">
        {/* 왼쪽: 주제 · 버전 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="px-3 py-2.5 border-b border-zinc-800 text-xs font-semibold text-zinc-400">주제</div>
            {topics.length === 0 ? (
              <p className="px-3 py-4 text-xs text-zinc-500">아직 주제가 없습니다. 아래에서 추가하세요.</p>
            ) : (
              <ul className="p-1.5 space-y-0.5">
                {topics.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setTopicId(t.id)
                        setVersionId(t.versions[0]?.id ?? null)
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg text-left text-sm flex items-center justify-between gap-2 ${
                        t.id === topicId ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                      <span className={`text-xs shrink-0 ${t.id === topicId ? "text-zinc-600" : "text-zinc-500"}`}>버전 {t.versions.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addTopic} className="p-3 border-t border-zinc-800 space-y-2">
              <input className={inputClass} value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} placeholder="새 주제 이름 (예: 귀멸의 칼날)" maxLength={60} required />
              <input className={inputClass} value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} placeholder="한 줄 설명 (선택)" maxLength={200} />
              <Button type="submit" size="sm" className={`${btn} w-full`}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                주제 추가
              </Button>
            </form>
          </div>

          {topic && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="px-3 py-2.5 border-b border-zinc-800 text-xs font-semibold text-zinc-400">'{topic.title}' 버전</div>
              {topic.versions.length === 0 ? (
                <p className="px-3 py-4 text-xs text-zinc-500">버전을 만들어 문제를 넣으세요.</p>
              ) : (
                <ul className="p-1.5 space-y-0.5">
                  {topic.versions.map((v) => (
                    <li key={v.id}>
                      <button
                        onClick={() => setVersionId(v.id)}
                        className={`w-full px-2.5 py-2 rounded-lg text-left text-sm ${v.id === versionId ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}
                      >
                        <div className={`truncate ${v.id === versionId ? "font-semibold" : ""}`}>{v.title}</div>
                        <div className={`text-xs ${v.id === versionId ? "text-zinc-600" : "text-zinc-500"}`}>
                          {v.published ? "공개" : "비공개"} · 문제 {v.items} · 푼 회원 {v.attempts}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={addVersion} className="p-3 border-t border-zinc-800 flex gap-2">
                <input className={inputClass} value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="새 버전 (예: 1편, 고급편)" maxLength={60} required />
                <Button type="submit" size="sm" className={`${btn} px-3 shrink-0`}>
                  추가
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* 오른쪽: 주제 정보 + 버전 편집 */}
        <div className="space-y-5 min-w-0">
          {topic && <TopicEditor key={topic.id} topic={topic} onSave={saveTopic} onDelete={removeTopic} />}
          {versionId ? (
            <VersionEditor
              key={versionId}
              id={versionId}
              onChange={syncVersion}
              onDeleted={(next) => {
                setTopics(next)
                setVersionId(next.find((t) => t.id === topicId)?.versions[0]?.id ?? null)
              }}
            />
          ) : (
            topic && <p className="p-6 rounded-xl border border-zinc-800 text-sm text-zinc-500 text-center">왼쪽에서 버전을 고르거나 새로 만드세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicEditor({ topic, onSave, onDelete }: { topic: Topic; onSave: (p: { title: string; description: string }) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(topic.title)
  const [description, setDescription] = useState(topic.description)
  const dirty = title !== topic.title || description !== topic.description
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end">
      <div>
        <label className={labelClass}>주제 이름</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      </div>
      <div>
        <label className={labelClass}>주제 설명</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className={`${btnPrimary} px-3`} disabled={!dirty} onClick={() => onSave({ title, description })}>
          저장
        </Button>
        {topic.versions.length === 0 && (
          <Button size="sm" className={`${btn} px-3 text-red-300`} onClick={onDelete}>
            주제 지우기
          </Button>
        )}
      </div>
    </div>
  )
}

function VersionEditor({ id, onChange, onDeleted }: { id: number; onChange: (v: Version) => void; onDeleted: (topics: Topic[]) => void }) {
  const [v, setV] = useState<Version | null>(null)
  const [error, setError] = useState("")
  const [settings, setSettings] = useState({ title: "", description: "", baseDp: "50", perCorrectDp: "30" })
  const [newItem, setNewItem] = useState({ question: "", explanation: "" })

  const apply = (next: Version) => {
    setV(next)
    onChange(next)
  }
  const run = async (fn: () => Promise<{ version: Version }>) => {
    setError("")
    try {
      const r = await fn()
      apply(r.version)
      return true
    } catch (e: any) {
      setError(e.message)
      return false
    }
  }

  useEffect(() => {
    call<{ version: Version }>(`/versions/${id}`)
      .then((r) => {
        setV(r.version)
        setSettings({ title: r.version.title, description: r.version.description, baseDp: String(r.version.baseDp), perCorrectDp: String(r.version.perCorrectDp) })
      })
      .catch((e) => setError(e.message))
  }, [id])

  if (!v) return error ? <ErrorLine error={error} /> : <p className="text-sm text-zinc-500">불러오는 중...</p>

  const maxDp = v.baseDp + v.perCorrectDp * v.items.filter((i) => i.ready).length
  const dirty =
    settings.title !== v.title || settings.description !== v.description || settings.baseDp !== String(v.baseDp) || settings.perCorrectDp !== String(v.perCorrectDp)

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    run(() =>
      call(`/versions/${id}`, "PATCH", { title: settings.title, description: settings.description, baseDp: Number(settings.baseDp), perCorrectDp: Number(settings.perCorrectDp) })
    )
  }
  const togglePublish = () => run(() => call(`/versions/${id}`, "PATCH", { published: !v.published }))
  const removeVersion = async () => {
    if (!confirm(`'${v.title}' 버전을 지울까요? 문제와 보기도 함께 지워집니다.`)) return
    setError("")
    try {
      const r = await call<{ topics: Topic[] }>(`/versions/${id}`, "DELETE")
      onDeleted(r.topics)
    } catch (e: any) {
      setError(e.message)
    }
  }
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await run(() => call(`/versions/${id}/items`, "POST", newItem))) setNewItem({ question: "", explanation: "" })
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">{v.topicTitle}</div>
            <div className="text-base font-semibold text-white">{v.title}</div>
            <div className="mt-1 text-xs text-zinc-400">
              {v.published ? <span className="text-emerald-400">사이트에 공개 중</span> : "비공개"} · 문제 {v.items.length}개 · 최대 {maxDp.toLocaleString()} DP · 푼 회원 {v.attempts}명
              {v.avgCorrect !== null ? ` · 평균 ${v.avgCorrect.toFixed(1)}개 정답` : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className={`${v.published ? btn : btnPrimary} px-3`} onClick={togglePublish}>
              {v.published ? "비공개로" : "공개하기"}
            </Button>
            <Button size="sm" className={`${btn} px-3 text-red-300`} onClick={removeVersion}>
              버전 지우기
            </Button>
          </div>
        </div>

        <form onSubmit={saveSettings} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_110px_110px_auto] items-end">
          <div>
            <label className={labelClass}>버전 이름</label>
            <input className={inputClass} value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} maxLength={60} />
          </div>
          <div>
            <label className={labelClass}>설명 (선택)</label>
            <input className={inputClass} value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} maxLength={200} />
          </div>
          <div>
            <label className={labelClass}>참여 DP</label>
            <input className={inputClass} type="number" min={0} max={1000} value={settings.baseDp} onChange={(e) => setSettings({ ...settings, baseDp: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>정답당 DP</label>
            <input className={inputClass} type="number" min={0} max={1000} value={settings.perCorrectDp} onChange={(e) => setSettings({ ...settings, perCorrectDp: e.target.value })} />
          </div>
          <Button type="submit" size="sm" className={`${btnPrimary} px-4`} disabled={!dirty}>
            저장
          </Button>
        </form>
      </div>

      <ErrorLine error={error} />

      <ol className="space-y-3">
        {v.items.map((it, i) => (
          <ItemEditor key={it.id} item={it} index={i} last={i === v.items.length - 1} run={run} />
        ))}
      </ol>

      <form onSubmit={addItem} className="p-4 rounded-xl border border-dashed border-zinc-700 space-y-2">
        <div className="text-sm font-semibold text-white">문제 {v.items.length + 1} 추가</div>
        <input className={inputClass} value={newItem.question} onChange={(e) => setNewItem({ ...newItem, question: e.target.value })} placeholder="문제" maxLength={300} required />
        <input className={inputClass} value={newItem.explanation} onChange={(e) => setNewItem({ ...newItem, explanation: e.target.value })} placeholder="해설 (채점 후 회원에게 보임, 선택)" maxLength={300} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">문제를 추가한 뒤 보기를 하나씩 넣고 정답을 고르세요.</span>
          <Button type="submit" size="sm" className={`${btnPrimary} px-4`}>
            문제 추가
          </Button>
        </div>
      </form>
    </div>
  )
}

function ItemEditor({ item, index, last, run }: { item: Item; index: number; last: boolean; run: (fn: () => Promise<{ version: Version }>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState(item.question)
  const [explanation, setExplanation] = useState(item.explanation)
  const [label, setLabel] = useState("")
  const [asAnswer, setAsAnswer] = useState(false)

  const saveText = async () => {
    if (await run(() => call(`/items/${item.id}`, "PATCH", { question, explanation }))) setEditing(false)
  }
  const addOption = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await run(() => call(`/items/${item.id}/options`, "POST", { label, isAnswer: asAnswer }))) {
      setLabel("")
      setAsAnswer(false)
    }
  }

  return (
    <li className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center">{index + 1}</span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} />
              <input className={inputClass} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="해설 (선택)" maxLength={300} />
              <div className="flex gap-2">
                <Button size="sm" className={`${btnPrimary} px-3`} onClick={saveText}>
                  저장
                </Button>
                <Button
                  size="sm"
                  className={`${btn} px-3`}
                  onClick={() => {
                    setQuestion(item.question)
                    setExplanation(item.explanation)
                    setEditing(false)
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-white">{item.question}</div>
              {item.explanation && <div className="mt-0.5 text-xs text-zinc-400">해설: {item.explanation}</div>}
              {!item.ready && <div className="mt-1 text-xs text-amber-300">{item.options.length < 2 ? "보기를 2개 이상 넣어주세요." : "정답을 골라주세요."}</div>}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0">
            <button className={iconBtn} disabled={index === 0} onClick={() => run(() => call(`/items/${item.id}/move`, "POST", { dir: "up" }))} aria-label="위로">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button className={iconBtn} disabled={last} onClick={() => run(() => call(`/items/${item.id}/move`, "POST", { dir: "down" }))} aria-label="아래로">
              <ArrowDown className="w-4 h-4" />
            </button>
            <button className={`${iconBtn} text-xs px-2`} onClick={() => setEditing(true)}>
              수정
            </button>
            <button
              className={iconBtn}
              onClick={() => confirm("이 문제를 지울까요?") && run(() => call(`/items/${item.id}`, "DELETE"))}
              aria-label="문제 지우기"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ul className="ml-10 rounded-lg border border-zinc-800 divide-y divide-zinc-800">
        {item.options.length === 0 && <li className="px-3 py-2.5 text-xs text-zinc-500">아직 보기가 없습니다.</li>}
        {item.options.map((o, i) => (
          <li key={o.id} className="px-3 py-2 flex items-center gap-3 text-sm">
            <button
              onClick={() => !o.isAnswer && run(() => call(`/options/${o.id}`, "PATCH", { isAnswer: true }))}
              className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${o.isAnswer ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-600 hover:border-zinc-400"}`}
              aria-label={o.isAnswer ? "정답" : "정답으로 정하기"}
              title={o.isAnswer ? "정답" : "정답으로 정하기"}
            >
              {o.isAnswer && <Check className="w-3 h-3" />}
            </button>
            <span className={`flex-1 min-w-0 ${o.isAnswer ? "text-emerald-300 font-semibold" : "text-zinc-200"}`}>
              {i + 1}. {o.label}
            </span>
            {o.isAnswer && <span className="text-xs text-emerald-400 shrink-0">정답</span>}
            <button className={iconBtn} onClick={() => run(() => call(`/options/${o.id}`, "DELETE"))} aria-label="보기 지우기">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {item.options.length < 6 && (
        <form onSubmit={addOption} className="ml-10 flex flex-wrap sm:flex-nowrap items-center gap-2">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`보기 ${item.options.length + 1}`} maxLength={100} required />
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 shrink-0 cursor-pointer">
            <input type="checkbox" checked={asAnswer} onChange={(e) => setAsAnswer(e.target.checked)} className="accent-emerald-600" />
            정답
          </label>
          <Button type="submit" size="sm" className={`${btn} px-3 shrink-0`}>
            보기 추가
          </Button>
        </form>
      )}
    </li>
  )
}

"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { getSessionMember } from "@/lib/member-auth"
import { loadPoints, useMemberPoints } from "@/lib/member-points"
import {
  askSaju,
  clearSavedBirth,
  describeBirth,
  ELEMENT_STYLE,
  fetchSajuChart,
  fetchSajuDaily,
  fetchSajuReading,
  fetchSajuToday,
  loadBias,
  loadSavedBirth,
  SAJU_DAILY,
  SAJU_TOPICS,
  saveBias,
  saveBirth,
  syncLastInput,
  type SajuBias,
  type SajuBirth,
  type SajuDailyStats,
  type SajuDailyTopic,
  type SajuChart,
  type SajuReading,
  type SajuTopic,
  type SajuAppFree,
} from "@/lib/saju-ai"

// 덕지 도사 AI 사주: 게임기(덕지 에뮬레이터) 화면 안에서 덕지 도사와 대화하듯 정보를 넣고 풀이를 받는 화면
// 흐름: 전원 켜기 → (로그인 확인) → 이름·성별·양력/음력·생년월일·시각 차례로 묻기 → 원국표 → 오늘의 덕질 운세·주제 풀이·이어서 질문

type Entry =
  | { id: number; who: "npc"; text: string; summary?: string }
  | { id: number; who: "me"; text: string }
  | { id: number; who: "system"; text: string }
  | { id: number; who: "chart"; chart: SajuChart }
  | { id: number; who: "daily"; stats: SajuDailyStats; headline: string | null }

type Phase = "checking" | "boot" | "login" | "resume" | "intake" | "confirm" | "play" | "bias"
type Step = "name" | "gender" | "calendar" | "date" | "time"

const NOW_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: NOW_YEAR - 1930 + 1 }, (_, i) => NOW_YEAR - i)
const BRANCH_HOURS = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"]
// 시계 시각의 대략적인 시진 (태양시 보정은 서버가 함)
const hourLabel = (h: number) => `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}시 · ${BRANCH_HOURS[Math.floor(((h + 1) % 24) / 2)]}시 무렵`
// 실제로 누른 사람이 이 수 이상일 때만 'N명이 눌러봄'·'가장 핫함' 표시
const COUNT_MIN = 3
const THINKING = ["고서를 넘기는 중", "오행의 생극제화를 따지는 중", "대운의 흐름을 읽는 중", "만세력을 펼치는 중"]

let nextId = 1
const npc = (text: string, summary?: string): Entry => ({ id: nextId++, who: "npc", text, summary })
const me = (text: string): Entry => ({ id: nextId++, who: "me", text })
const sys = (text: string): Entry => ({ id: nextId++, who: "system", text })

export function SajuEmulator() {
  const [phase, setPhase] = useState<Phase>("checking")
  const [loggedIn, setLoggedIn] = useState(false)
  const [log, setLog] = useState<Entry[]>([])
  const [typingId, setTypingId] = useState<number | null>(null)
  const [step, setStep] = useState<Step>("name")
  const [name, setName] = useState("")
  const [draft, setDraft] = useState<SajuBirth>({ year: 2000, month: 1, day: 1, calendar: "solar", leapMonth: false, hour: 12, minute: 0, gender: "F" })
  const [birth, setBirth] = useState<SajuBirth | null>(null)
  const [chart, setChart] = useState<SajuChart | null>(null)
  const [readings, setReadings] = useState<Partial<Record<SajuTopic, SajuReading>>>({})
  const [price, setPrice] = useState<number | null>(null)
  // 앱에서는 DP 대신 하루 무료 횟수 (null 이면 웹, DP 결제)
  const [appFree, setAppFree] = useState<SajuAppFree | null>(null)
  const freeFrom = (r: { freeLeft?: number }) => {
    if (typeof r.freeLeft === "number") setAppFree((f) => (f ? { ...f, left: r.freeLeft! } : f))
  }
  const { balance } = useMemberPoints()
  const [busy, setBusy] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [qa, setQa] = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [question, setQuestion] = useState("")
  const [bias, setBias] = useState<SajuBias | null>(null)
  const [biasDraft, setBiasDraft] = useState<SajuBias>({ name: "", year: 2000, month: 1, day: 1 })
  const [biasAsked, setBiasAsked] = useState(false)
  const [pendingDaily, setPendingDaily] = useState<SajuDailyTopic | null>(null)
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({})
  const [dailySeen, setDailySeen] = useState<Partial<Record<SajuDailyTopic, boolean>>>({})
  const screenRef = useRef<HTMLDivElement>(null)

  const say = useCallback((...entries: Entry[]) => {
    setLog((l) => [...l, ...entries])
    const lastNpc = [...entries].reverse().find((e) => e.who === "npc")
    if (lastNpc) setTypingId(lastNpc.id)
  }, [])

  const visitors = dailyCounts.visit || 0

  const callName = name.trim() ? `${name.trim()} 님` : "그대"

  useEffect(() => {
    let cancelled = false
    getSessionMember().then(async (m) => {
      if (cancelled) return
      setLoggedIn(!!m)
      // 다른 기기에서 넣었던 사주 정보를 먼저 불러온 뒤 전원을 켬 (회원 정보와는 별개인 사주 이용 기록)
      if (m) await syncLastInput()
      if (cancelled) return
      if (m) fetchSajuToday().then((c) => !cancelled && setDailyCounts((old) => ({ ...c, ...old })))
      const b = loadBias()
      if (b) {
        setBias(b)
        setBiasDraft(b)
      }
      setPhase("boot")
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 새 줄이 생기거나 글자가 찍힐 때 화면 맨 아래로
  const scrollDown = useCallback(() => {
    const el = screenRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(scrollDown, [log, busy, scrollDown])

  const ask = (s: Step) => {
    setStep(s)
    const lines: Record<Step, string> = {
      name: "그대를 뭐라고 부르면 좋을까덕? 별명도 좋다덕.",
      gender: "성별은? (대운 방향을 정하는 데 쓴다덕)",
      calendar: "생일은 양력이덕, 음력이덕?",
      date: "몇 년 몇 월 며칠에 태어났는지 알려 달라덕.",
      time: "태어난 시각은? 모르면 '시간 모름'을 누르라덕.",
    }
    say(npc(lines[s]))
  }

  const start = () => {
    if (!loggedIn) {
      setPhase("login")
      say(npc("어서 오라덕! 이 사주방은 덕지 회원 전용이라덕. 로그인하고 다시 오라덕!"))
      return
    }
    const saved = loadSavedBirth()
    say(
      npc(
        "어서 오라덕! 명리 고서를 정주행한 덕지 도사, 덕순이라덕. 그대의 사주를 풀어 주겠다덕!\n(재미로 보는 풀이라덕.)"
      )
    )
    if (saved) {
      setName(saved.name)
      setDraft(saved.birth)
      setPhase("resume")
      say(npc(`다시 왔구나덕! 지난번 정보(${describeBirth(saved.birth)})로 볼까덕?`))
    } else {
      setPhase("intake")
      setTimeout(() => ask("name"), 0)
    }
  }

  const newIntake = () => {
    clearSavedBirth()
    setChart(null)
    setBirth(null)
    setReadings({})
    setSuggestions([])
    setQa([])
    setPhase("intake")
    ask("name")
  }

  const confirmIntake = (b: SajuBirth) => {
    setPhase("confirm")
    say(npc(`정리하면 ${describeBirth(b)}. 이대로 만세력을 펼쳐 볼까덕?`))
  }

  const loadChart = async (b: SajuBirth) => {
    setBusy("만세력을 펼치는 중")
    const r = await fetchSajuChart(b, name)
    setBusy(null)
    if (!r.ok) return handleError(r)
    saveBirth(b, name)
    setBirth(b)
    setChart(r.chart)
    setReadings(r.readings || {})
    setDailyCounts(r.dailyCounts || {})
    setPrice(r.price)
    setAppFree(r.appFree ?? null)
    setQa([])
    setSuggestions([])
    setPhase("play")
    const c = r.chart
    const notes = [
      c.input.lunarDate ? `음력 생일은 양력 ${c.input.solarDate}로 바꿔 봤다덕.` : "",
      c.input.correctedTime ? "" : "태어난 시각은 빼고 보겠다덕.",
    ]
      .filter(Boolean)
      .join(" ")
    say(
      { id: nextId++, who: "chart", chart: c },
      npc(
        `${callName}은(는) ${c.dayMaster.image} 같은 사람이덕. ${notes}\n아래에서 오늘의 운세나 타고난 사주를 골라 보라덕.`
      )
    )
  }

  const handleError = (r: { status: number; code?: string; error: string }) => {
    if (r.status === 401) {
      setLoggedIn(false)
      setPhase("login")
      say(npc("앗, 로그인이 풀렸다덕. 다시 로그인하고 오라덕."))
      return
    }
    if (r.code === "dp_insufficient") loadPoints()
    if (r.code === "app_free_used") setAppFree((f) => (f ? { ...f, left: 0 } : f))
    say(npc(r.error))
  }

  const openTopic = async (topic: SajuTopic) => {
    if (!birth || busy) return
    const t = SAJU_TOPICS.find((x) => x.id === topic)!
    say(me(`${t.label} 봐 주세요`))
    let reading = readings[topic]
    if (!reading) {
      setBusy(`${t.label} 운을 살펴보는 중`)
      const r = await fetchSajuReading(birth, topic)
      setBusy(null)
      if (!r.ok) return handleError(r)
      reading = r.reading
      setReadings((m) => ({ ...m, [topic]: r.reading }))
      if (r.charged) loadPoints()
      freeFrom(r)
    }
    setSuggestions(reading.suggestions)
    say(npc(reading.text, reading.summary))
  }

  // 오늘의 덕질 운세: 최애가 필요한 질문인데 최애 생일이 없으면 한 번 물어봄
  const openDaily = async (topic: SajuDailyTopic, biasNow: SajuBias | null = bias, skipAsk = false) => {
    if (!birth || busy) return
    const t = SAJU_DAILY.find((x) => x.id === topic)!
    if (t.needsBias && !biasNow && !biasAsked && !skipAsk) {
      say(me(t.ask))
      setPendingDaily(topic)
      setPhase("bias")
      say(npc("최애 생일을 넣으면 최애 기운까지 같이 볼 수 있다덕. 몰라도 괜찮다덕."))
      return
    }
    if (!skipAsk) say(me(t.ask))
    setBusy("오늘 일진을 맞춰 보는 중")
    const r = await fetchSajuDaily(birth, biasNow, topic)
    setBusy(null)
    if (!r.ok) return handleError(r)
    setDailyCounts(r.dailyCounts || {})
    setDailySeen((m) => ({ ...m, [topic]: true }))
    if (r.charged || r.code === "dp_insufficient") loadPoints()
    freeFrom(r)
    const entries: Entry[] = [{ id: nextId++, who: "daily", stats: r.stats, headline: r.reading?.headline ?? null }]
    if (r.reading) {
      setSuggestions(r.reading.suggestions)
      entries.push(npc(r.reading.text))
    } else if (r.code === "app_free_used") {
      entries.push(npc("오늘 무료 질문을 다 써서 지수만 보여 준다덕. 내일 다시 와 달라덕!"))
    } else {
      entries.push(npc(`DP 가 모자라서 지수만 보여 준다덕. 풀이는 ${r.price ?? 100} DP 다덕. 충전하고 다시 누르면 봐 주겠다덕!`))
    }
    say(...entries)
  }

  const finishBias = (b: SajuBias | null) => {
    setBiasAsked(true)
    setPhase("play")
    const topic = pendingDaily
    setPendingDaily(null)
    if (b) {
      setBias(b)
      saveBias(b)
      say(me(`${b.name || "최애"} 생일은 ${b.year}년 ${b.month}월 ${b.day}일이에요`))
    } else say(me("그냥 볼게요"))
    if (topic) openDaily(topic, b, true)
  }

  const sendQuestion = async (text: string) => {
    const q = text.trim().slice(0, 300)
    if (!birth || !q || busy) return
    setQuestion("")
    say(me(q))
    const history = [...qa, { role: "user" as const, content: q }].slice(-10)
    setBusy("도사가 생각하는 중")
    const r = await askSaju(birth, history)
    setBusy(null)
    if (!r.ok) return handleError(r)
    setQa([...history, { role: "assistant", content: r.answer }])
    if (r.charged) loadPoints()
    freeFrom(r)
    setSuggestions(r.suggestions)
    say(npc(r.answer))
  }

  const typing = typingId !== null
  const pressA = () => {
    if (typing) return setTypingId(null)
    if (phase === "boot") return start()
    if (phase === "confirm") return loadChart(draft)
  }
  const pressB = () => {
    if (phase === "checking" || phase === "boot" || busy) return
    if (window.confirm("처음부터 다시 입력할까요?")) {
      setLog([])
      if (loggedIn) newIntake()
      else start()
    }
  }
  const scrollBy = (dy: number) => screenRef.current?.scrollBy({ top: dy, behavior: "smooth" })

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* 게임기 본체 */}
      <div className="relative rounded-[2.25rem] bg-gradient-to-b from-violet-500 via-violet-700 to-indigo-900 p-3 sm:p-5 shadow-[0_20px_60px_-15px_rgba(124,58,237,0.6)] ring-1 ring-white/20">
        <div className="flex items-center justify-between px-2 pb-2 sm:pb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${phase === "checking" ? "bg-zinc-500" : "bg-lime-400 shadow-[0_0_8px_#a3e635] animate-pulse"}`} />
            <span className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.2em] text-violet-100">DUCKJI EMULATOR</span>
          </div>
          <span className="font-mono text-[10px] sm:text-xs font-black italic tracking-widest text-amber-300">SAJU-BOY</span>
        </div>

        {/* 화면 테두리 */}
        <div className="rounded-2xl bg-zinc-900 p-2 sm:p-3 ring-1 ring-black/40">
          <div className="flex items-center justify-between px-1 pb-1.5 font-mono text-[9px] sm:text-[10px] text-zinc-500">
            <span className={visitors && phase !== "boot" ? "text-amber-300" : ""}>{visitors && phase !== "boot" ? `🔥 오늘 ${visitors.toLocaleString()}명이 사주를 봤어요` : "◆ 만세력 엔진 ON"}</span>
            {appFree ? (
              <span className={appFree.left > 0 ? "text-lime-300" : "text-rose-400"}>
                오늘 무료 질문 {appFree.left}/{appFree.limit}회 남음
              </span>
            ) : price !== null && (
              <span className={balance !== null && balance < price ? "text-rose-400" : "text-lime-300"}>
                질문 1회 {price} DP{balance !== null && ` · 보유 ${balance.toLocaleString()} DP`}
                {balance !== null && balance < price && (
                  <Link href="/mypage/charge" className="ml-1.5 underline underline-offset-2">
                    충전
                  </Link>
                )}
              </span>
            )}
          </div>

          {/* 화면 */}
          <div className="relative overflow-hidden rounded-lg border border-black bg-[#0b0f1a]">
            <div className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_3px)]" />
            {/* 덕지 도사 */}
            <div className="relative flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-indigo-950 to-violet-950 px-3 py-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-amber-300 bg-amber-100/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/characters/ducksoon.png" alt="덕지 도사 덕순" className="h-full w-full object-cover object-[50%_18%] scale-125" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-200">
                  덕지 도사 <span className="text-xs">🔮</span>
                </p>
                <p className="truncate text-[11px] text-violet-200/70">만세력 · 생극제화 · 명리 고서</p>
              </div>
            </div>

            <div ref={screenRef} className="relative h-[52vh] min-h-[340px] max-h-[560px] overflow-y-auto px-3 py-4 space-y-3 scroll-smooth" onClick={() => typing && setTypingId(null)}>
              {phase === "checking" && <p className="pt-20 text-center font-mono text-xs text-zinc-500">LOADING…</p>}
              {phase === "boot" && log.length === 0 && <BootScreen visitors={visitors} />}
              {log.map((e) =>
                e.who === "chart" ? (
                  <ChartCard key={e.id} chart={e.chart} />
                ) : e.who === "daily" ? (
                  <DailyCard key={e.id} stats={e.stats} headline={e.headline} />
                ) : e.who === "me" ? (
                  <div key={e.id} className="flex justify-end">
                    <p className="max-w-[80%] rounded-xl rounded-br-sm bg-violet-500/25 px-3 py-2 text-sm text-violet-50 whitespace-pre-wrap">{e.text}</p>
                  </div>
                ) : e.who === "system" ? (
                  <p key={e.id} className="text-center font-mono text-[11px] text-zinc-500">{e.text}</p>
                ) : (
                  <DialogBox key={e.id} entry={e} animate={e.id === typingId} onTick={scrollDown} onDone={() => setTypingId((id) => (id === e.id ? null : id))} />
                )
              )}
              {busy && (
                <p className="font-mono text-xs text-amber-200/90">
                  <ThinkingText base={busy} />
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 조작부 */}
        <div className={`mt-3 sm:mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10 transition-opacity ${typing ? "pointer-events-none opacity-50" : ""}`}>
          <Controls
            phase={phase}
            step={step}
            typing={typing}
            busy={!!busy}
            name={name}
            setName={setName}
            draft={draft}
            setDraft={setDraft}
            readings={readings}
            suggestions={suggestions}
            question={question}
            setQuestion={setQuestion}
            onStart={start}
            onNext={(answer, next) => {
              say(me(answer))
              if (next === "confirm") confirmIntake(draft)
              else ask(next)
            }}
            onConfirm={() => {
              say(me("네, 맞아요"))
              loadChart(draft)
            }}
            onResume={() => {
              say(me("지난 정보로 볼게요"))
              loadChart(draft)
            }}
            onRestart={() => {
              say(me("새로 입력할게요"))
              newIntake()
            }}
            onTopic={openTopic}
            onAsk={sendQuestion}
            bias={bias}
            biasDraft={biasDraft}
            setBiasDraft={setBiasDraft}
            onBias={finishBias}
            onEditBias={() => {
              say(me("최애 생일을 바꿀래요"))
              setPendingDaily(null)
              setPhase("bias")
              say(npc("최애 생일을 알려 달라덕. 이름은 이 기기에만 기억한다덕."))
            }}
            dailyCounts={dailyCounts}
            dailySeen={dailySeen}
            onDaily={(t) => openDaily(t)}
          />
        </div>

        {/* 장식 + 단축 버튼: 십자키 위아래 = 화면 스크롤, A = 넘기기·확인, B = 처음부터 */}
        <div className="mt-3 flex items-center justify-between px-2 sm:px-6">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
            <div className="absolute left-1/3 top-0 h-full w-1/3 rounded bg-zinc-900 shadow-inner" />
            <div className="absolute left-0 top-1/3 h-1/3 w-full rounded bg-zinc-900 shadow-inner" />
            <button type="button" aria-label="위로" onClick={() => scrollBy(-160)} className="absolute left-1/3 top-0 h-1/3 w-1/3 text-[10px] text-zinc-500 hover:text-white">▲</button>
            <button type="button" aria-label="아래로" onClick={() => scrollBy(160)} className="absolute bottom-0 left-1/3 h-1/3 w-1/3 text-[10px] text-zinc-500 hover:text-white">▼</button>
          </div>
          <div className="hidden sm:flex gap-3 font-mono text-[9px] tracking-widest text-violet-200/60">
            <span className="rotate-[-20deg] rounded-full bg-zinc-900/60 px-3 py-1">SELECT</span>
            <span className="rotate-[-20deg] rounded-full bg-zinc-900/60 px-3 py-1">START</span>
          </div>
          <div className="flex items-center gap-3 -rotate-[15deg]">
            <RoundButton label="B" title="처음부터" onClick={pressB} />
            <RoundButton label="A" title="넘기기·확인" onClick={pressA} primary />
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">
        사주에 넣은 정보와 풀이는 사주 이용 기록으로만 남고, 회원 정보는 바꾸지 않아요.
      </p>
    </div>
  )
}

function RoundButton({ label, title, onClick, primary }: { label: string; title: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full font-mono text-sm font-black shadow-[0_4px_0_rgba(0,0,0,0.45)] active:translate-y-0.5 active:shadow-none ${
        primary ? "bg-rose-500 text-white" : "bg-fuchsia-800 text-fuchsia-100"
      }`}
    >
      {label}
    </button>
  )
}

function BootScreen({ visitors }: { visitors: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 pt-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/characters/ducksoon.png" alt="" className="h-32 w-auto drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]" />
      <div>
        <p className="font-mono text-lg font-black tracking-widest text-amber-300">덕지 도사의 사주방</p>
        <p className="mt-1 text-xs text-violet-200/70">만세력으로 세우고, 고서로 푸는 AI 사주</p>
      </div>
      {visitors > 0 && <p className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-200">🔥 오늘 {visitors.toLocaleString()}명이 덕지 도사를 찾아왔어요</p>}
      <p className="animate-pulse font-mono text-xs tracking-[0.3em] text-lime-300">PRESS START</p>
    </div>
  )
}

// 대사창: 마지막 대사만 한 글자씩 찍힘 (화면을 누르거나 A 를 누르면 바로 다 보임)
function DialogBox({ entry, animate, onTick, onDone }: { entry: Extract<Entry, { who: "npc" }>; animate: boolean; onTick: () => void; onDone: () => void }) {
  const [shown, setShown] = useState(animate ? 0 : entry.text.length)
  useEffect(() => {
    if (!animate) {
      setShown(entry.text.length)
      return
    }
    const timer = setInterval(() => {
      setShown((n) => {
        const next = Math.min(entry.text.length, n + 3)
        if (next >= entry.text.length) {
          clearInterval(timer)
          setTimeout(onDone, 0)
        }
        return next
      })
    }, 20)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate])
  useEffect(onTick, [shown, onTick])
  const done = shown >= entry.text.length
  return (
    <div className="relative rounded-lg border-4 border-double border-violet-200/70 bg-indigo-950/90 px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-100 shadow-[0_0_0_2px_rgba(0,0,0,0.6)]">
      <p className="whitespace-pre-wrap">{entry.text.slice(0, shown)}</p>
      {done && entry.summary && <p className="mt-3 rounded-md bg-amber-300/15 px-2.5 py-1.5 text-[13px] font-bold text-amber-200">한 줄 요약: {entry.summary}</p>}
      {!done && <span className="absolute bottom-1 right-2 animate-bounce text-[10px] text-amber-300">▼</span>}
    </div>
  )
}

function ThinkingText({ base }: { base: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 700)
    return () => clearInterval(t)
  }, [])
  const label = i > 0 && i % 4 === 0 ? THINKING[(i / 4) % THINKING.length] : base
  return <>▶ {label}{".".repeat((i % 3) + 1)}</>
}

function ChartCard({ chart }: { chart: SajuChart }) {
  const total = Object.values(chart.elements).reduce((a, b) => a + b, 0) || 1
  const current = chart.daeun.list.find((d) => d.current)
  return (
    <div className="rounded-lg border border-amber-300/40 bg-black/40 p-3">
      <p className="mb-2 text-center font-mono text-[11px] tracking-widest text-amber-300">— 사주 원국 —</p>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {chart.pillars.map((p, i) => (
          <div key={i} className="rounded-md bg-white/5 py-2">
            <p className="text-[10px] text-zinc-400">{["시주", "일주", "월주", "연주"][i]}</p>
            {p ? (
              <>
                <p className="mt-1 text-[10px] text-zinc-400">{p.stem.tenGod ?? "나"}</p>
                <p className={`text-2xl font-black ${ELEMENT_STYLE[p.stem.element].text}`}>{p.stem.hanja}</p>
                <p className="text-[10px] text-zinc-400">{p.stem.hangul}</p>
                <p className={`mt-1 text-2xl font-black ${ELEMENT_STYLE[p.branch.element].text}`}>{p.branch.hanja}</p>
                <p className="text-[10px] text-zinc-400">
                  {p.branch.hangul} · {p.branch.tenGod}
                </p>
              </>
            ) : (
              <p className="mt-6 text-xl font-black text-zinc-600">?</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/10">
        {(Object.keys(chart.elements) as (keyof typeof chart.elements)[]).map((el) =>
          chart.elements[el] ? <div key={el} className={ELEMENT_STYLE[el].bg} style={{ width: `${(chart.elements[el] / total) * 100}%` }} /> : null
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]">
        {(Object.keys(chart.elements) as (keyof typeof chart.elements)[]).map((el) => (
          <span key={el} className={ELEMENT_STYLE[el].text}>
            {ELEMENT_STYLE[el].ko} {chart.elements[el]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
        {chart.strength.label} · {current ? `지금 대운 ${current.ganzhi}(${current.hangul}) · ` : ""}
        {chart.seun.map((s) => `${s.year} ${s.ganzhi}`).join(" · ")}
      </p>
    </div>
  )
}

const selectCls = "rounded-lg border border-white/15 bg-zinc-900 px-2 py-2 text-sm text-white focus:border-amber-300 focus:outline-none"
const choiceCls =
  "rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-amber-300 hover:bg-amber-300/10 disabled:opacity-40"
const primaryCls = "rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-amber-300 disabled:opacity-40"

function Controls(props: {
  phase: Phase
  step: Step
  typing: boolean
  busy: boolean
  name: string
  setName: (v: string) => void
  draft: SajuBirth
  setDraft: React.Dispatch<React.SetStateAction<SajuBirth>>
  readings: Partial<Record<SajuTopic, SajuReading>>
  suggestions: string[]
  question: string
  setQuestion: (v: string) => void
  onStart: () => void
  onNext: (answer: string, next: Step | "confirm") => void
  onConfirm: () => void
  onResume: () => void
  onRestart: () => void
  onTopic: (t: SajuTopic) => void
  onAsk: (q: string) => void
  bias: SajuBias | null
  biasDraft: SajuBias
  setBiasDraft: React.Dispatch<React.SetStateAction<SajuBias>>
  onBias: (b: SajuBias | null) => void
  onEditBias: () => void
  dailyCounts: Record<string, number>
  dailySeen: Partial<Record<SajuDailyTopic, boolean>>
  onDaily: (t: SajuDailyTopic) => void
}) {
  const { phase, step, draft, setDraft, busy } = props
  const days = useMemo(() => Array.from({ length: draft.calendar === "lunar" ? 30 : 31 }, (_, i) => i + 1), [draft.calendar])
  const set = (patch: Partial<SajuBirth>) => setDraft((d) => ({ ...d, ...patch }))
  const [tab, setTab] = useState<"today" | "nature">("today")

  if (phase === "checking") return <p className="py-2 text-center font-mono text-xs text-zinc-400">전원 켜는 중…</p>
  if (phase === "boot")
    return (
      <div className="flex justify-center">
        <button type="button" onClick={props.onStart} className={`${primaryCls} px-8 font-mono tracking-widest`}>
          ▶ START
        </button>
      </div>
    )
  if (phase === "login")
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/login" className={primaryCls}>
          로그인하러 가기
        </Link>
        <Link href="/signup/" className={choiceCls}>
          회원가입
        </Link>
      </div>
    )
  if (phase === "resume")
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={props.onResume} className={primaryCls}>
          지난 정보로 보기
        </button>
        <button type="button" onClick={props.onRestart} className={choiceCls}>
          새로 입력하기
        </button>
      </div>
    )
  if (phase === "confirm")
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={props.onConfirm} className={primaryCls} disabled={busy}>
          네, 맞아요
        </button>
        <button type="button" onClick={props.onRestart} className={choiceCls} disabled={busy}>
          다시 입력
        </button>
      </div>
    )

  if (phase === "bias") {
    const b = props.biasDraft
    const setB = (patch: Partial<SajuBias>) => props.setBiasDraft((d) => ({ ...d, ...patch }))
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <input value={b.name} onChange={(e) => setB({ name: e.target.value.slice(0, 12) })} placeholder="최애 이름 (선택)" className={`${selectCls} w-32`} />
          <select value={b.year} onChange={(e) => setB({ year: Number(e.target.value) })} className={selectCls} aria-label="최애 생년">
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select value={b.month} onChange={(e) => setB({ month: Number(e.target.value) })} className={selectCls} aria-label="최애 생월">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <select value={b.day} onChange={(e) => setB({ day: Number(e.target.value) })} className={selectCls} aria-label="최애 생일">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={primaryCls} disabled={busy} onClick={() => props.onBias({ ...b, name: b.name.trim() })}>
            최애 생일 넣기 (양력)
          </button>
          <button type="button" className={choiceCls} disabled={busy} onClick={() => props.onBias(null)}>
            그냥 볼래요
          </button>
        </div>
      </div>
    )
  }

  if (phase === "intake") {
    if (step === "name")
      return (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            props.onNext(props.name.trim() ? `${props.name.trim()}(이)라고 불러 주세요` : "이름 없이 할게요", "gender")
          }}
        >
          <input
            value={props.name}
            onChange={(e) => props.setName(e.target.value.slice(0, 10))}
            placeholder="부를 이름 (선택, 10자까지)"
            className={`${selectCls} min-w-0 flex-1`}
            autoFocus
          />
          <button type="submit" className={primaryCls}>
            확인
          </button>
        </form>
      )
    if (step === "gender")
      return (
        <div className="flex justify-center gap-2">
          {(["F", "M"] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={choiceCls}
              onClick={() => {
                set({ gender: g })
                props.onNext(g === "F" ? "여성이에요" : "남성이에요", "calendar")
              }}
            >
              {g === "F" ? "여성" : "남성"}
            </button>
          ))}
        </div>
      )
    if (step === "calendar")
      return (
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { label: "양력", patch: { calendar: "solar", leapMonth: false } },
            { label: "음력", patch: { calendar: "lunar", leapMonth: false } },
            { label: "음력 (윤달)", patch: { calendar: "lunar", leapMonth: true } },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              className={choiceCls}
              onClick={() => {
                set(o.patch as Partial<SajuBirth>)
                props.onNext(`${o.label}이에요`, "date")
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )
    if (step === "date")
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select value={draft.year} onChange={(e) => set({ year: Number(e.target.value) })} className={selectCls} aria-label="태어난 해">
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select value={draft.month} onChange={(e) => set({ month: Number(e.target.value) })} className={selectCls} aria-label="태어난 달">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <select value={Math.min(draft.day, days.length)} onChange={(e) => set({ day: Number(e.target.value) })} className={selectCls} aria-label="태어난 날">
            {days.map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
          <button
            type="button"
            className={primaryCls}
            onClick={() => {
              const day = Math.min(draft.day, days.length)
              set({ day })
              props.onNext(`${draft.calendar === "lunar" ? "음력 " : ""}${draft.year}년 ${draft.month}월 ${day}일이에요`, "time")
            }}
          >
            확인
          </button>
        </div>
      )
    // 태어난 시각
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <select value={draft.hour ?? 12} onChange={(e) => set({ hour: Number(e.target.value) })} className={selectCls} aria-label="태어난 시">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
        <select value={draft.minute ?? 0} onChange={(e) => set({ minute: Number(e.target.value) })} className={selectCls} aria-label="태어난 분">
          {Array.from({ length: 60 }, (_, m) => m).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}분
            </option>
          ))}
        </select>
        <button
          type="button"
          className={primaryCls}
          onClick={() => {
            const b = { ...draft, hour: draft.hour ?? 12, minute: draft.minute ?? 0 }
            setDraft(b)
            props.onNext(`${b.hour}시 ${String(b.minute).padStart(2, "0")}분에 태어났어요`, "confirm")
          }}
        >
          확인
        </button>
        <button
          type="button"
          className={choiceCls}
          onClick={() => {
            setDraft((d) => ({ ...d, hour: null, minute: null }))
            props.onNext("시간은 몰라요", "confirm")
          }}
        >
          시간 모름
        </button>
      </div>
    )
  }

  // 풀이·대화: 이어서 물어볼 질문 줄 / 탭(오늘 운세·타고난 풀이) / 질문 입력. 높이를 고정해 대답 중에도 버튼이 들썩이지 않게 함
  const tabCls = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${on ? "bg-amber-400 text-zinc-950" : "text-violet-100/80 hover:bg-white/10"}`
  return (
    <div className="space-y-2.5">
      <div className="flex h-7 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        {props.suggestions.length > 0 ? (
          props.suggestions.map((q) => (
            <button key={q} type="button" disabled={busy} onClick={() => props.onAsk(q)} className="shrink-0 rounded-full border border-lime-300/40 bg-lime-300/10 px-3 py-1 text-xs text-lime-200 hover:bg-lime-300/20 disabled:opacity-40">
              {q}
            </button>
          ))
        ) : (
          <span className="px-1 text-[11px] text-zinc-500">풀이를 보면 이어서 물어볼 만한 질문이 여기 나와요</span>
        )}
      </div>

      <div className="rounded-xl bg-black/25 p-2 ring-1 ring-white/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button type="button" className={tabCls(tab === "today")} onClick={() => setTab("today")}>
              오늘의 운세
            </button>
            <button type="button" className={tabCls(tab === "nature")} onClick={() => setTab("nature")}>
              타고난 사주
            </button>
          </div>
          {tab === "today" && (
            <button type="button" onClick={props.onEditBias} disabled={busy} className="truncate text-[11px] text-violet-200/70 hover:text-white disabled:opacity-40">
              {props.bias ? `최애 ${props.bias.name || `${props.bias.month}/${props.bias.day}생`} · 바꾸기` : "최애 생일 넣기"}
            </button>
          )}
        </div>
        {tab === "today" ? (
          <DailyMenu counts={props.dailyCounts} seen={props.dailySeen} busy={busy} onDaily={props.onDaily} />
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {SAJU_TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => props.onTopic(t.id)}
                title={t.desc}
                className="relative flex h-[68px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-1 text-center hover:border-amber-300 hover:bg-amber-300/10 disabled:opacity-40"
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="mt-1 text-[11px] font-bold text-white">{t.label}</span>
                {props.readings[t.id] && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-lime-300" title="본 풀이" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          props.onAsk(props.question)
        }}
      >
        <input
          value={props.question}
          onChange={(e) => props.setQuestion(e.target.value.slice(0, 300))}
          placeholder="직접 물어보기 (예: 이번 주 티켓팅 언제가 좋아?)"
          className={`${selectCls} min-w-0 flex-1`}
          disabled={busy}
        />
        <button type="submit" className={primaryCls} disabled={busy || !props.question.trim()}>
          묻기
        </button>
      </form>
    </div>
  )
}

// 오늘의 운세 버튼 5개. 누른 사람 수·HOT 표시는 오늘 실제로 누른 회원 수로만 (COUNT_MIN 명 이상일 때)
function DailyMenu(props: { counts: Record<string, number>; seen: Partial<Record<SajuDailyTopic, boolean>>; busy: boolean; onDaily: (t: SajuDailyTopic) => void }) {
  const top = SAJU_DAILY.reduce((best, t) => ((props.counts[t.id] || 0) > (props.counts[best.id] || 0) ? t : best), SAJU_DAILY[0])
  const hotId = (props.counts[top.id] || 0) >= COUNT_MIN ? top.id : null
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {SAJU_DAILY.map((t) => {
        const n = props.counts[t.id] || 0
        return (
          <button
            key={t.id}
            type="button"
            disabled={props.busy}
            onClick={() => props.onDaily(t.id)}
            className={`relative flex h-[68px] flex-col items-center justify-center rounded-lg border px-1 text-center transition-colors disabled:opacity-40 ${
              hotId === t.id ? "border-rose-400/60 bg-rose-500/10 hover:bg-rose-500/20" : "border-white/10 bg-white/5 hover:border-amber-300 hover:bg-amber-300/10"
            }`}
          >
            {hotId === t.id && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 text-[9px] font-black leading-4 text-white">HOT</span>}
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="mt-1 text-[11px] font-bold text-white">{t.label}</span>
            <span className="text-[10px] text-zinc-400">{n >= COUNT_MIN ? `오늘 ${n.toLocaleString()}명 봄` : t.tag}</span>
            {props.seen[t.id] && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-lime-300" title="오늘 본 운세" />}
          </button>
        )
      })}
    </div>
  )
}

// 오늘 운세 결과 카드: 지수 + 한마디, 아래 한 줄에 지금 시간대·추천 시간·행운 색
function DailyCard({ stats, headline }: { stats: SajuDailyStats; headline: string | null }) {
  const buff = stats.hour.buff
  return (
    <div className="rounded-lg border border-rose-300/30 bg-black/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <p className="text-3xl font-black text-amber-200">
          {stats.score}
          <span className="text-base">%</span>
        </p>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-rose-300">오늘의 {stats.metric}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300" style={{ width: `${stats.score}%` }} />
          </div>
          {headline && <p className="mt-1 truncate text-[13px] font-bold text-white">{headline}</p>}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
        지금({stats.hour.range}) <span className={buff > 0 ? "text-lime-300" : buff < 0 ? "text-sky-300" : ""}>{buff > 0 ? `+${buff}` : buff}%</span> · 추천 시간{" "}
        <span className="text-amber-200">{stats.bestHour}</span> · 행운 색 <span className="text-amber-200">{stats.luckyColor}</span>
      </p>
    </div>
  )
}

"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { SquadIcon } from "@/components/community/squad-icon"
import { MySquad } from "@/components/community/squad/my-squad"
import { SquadDirectory } from "@/components/community/squad/squad-directory"
import { SquadForm, emptySquadForm } from "@/components/community/squad/squad-form"
import { createSquad, fetchInvite, fetchMySquad, joinByCode, type MySquad as MySquadData, type SquadInvite } from "@/lib/squads"

// 초대 링크(?join=코드)로 왔는데 로그인 전이면 코드를 잠시 기억해 두었다가 로그인 뒤 이어서 보여 줌
const PENDING_KEY = "duckji_squad_join"

type Tab = "mine" | "browse"

// 덕지 갤러리 안 스쿼드 화면 (/community/gallery/squads) 본문
// 둘러보기/내 스쿼드 전환은 갤러리 위쪽 탭이 맡음. 탭이 바뀌면 onTabChange 로 알려 위쪽 탭 표시를 맞춤
export function SquadHub({ onTabChange }: { onTabChange?: (tab: Tab) => void } = {}) {
  const [state, setState] = useState<"loading" | "guest" | "ready">("loading")
  const [squad, setSquad] = useState<MySquadData | null>(null)
  const [tab, setTab] = useState<Tab>("browse")
  const [invite, setInvite] = useState<SquadInvite | null>(null)
  const [inviteError, setInviteError] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let code = ""
    let wanted: string | null = null
    try {
      const params = new URLSearchParams(window.location.search)
      code = params.get("join") || sessionStorage.getItem(PENDING_KEY) || ""
      wanted = params.get("tab")
      if (wanted === "mine" || code) setTab("mine")
    } catch {}
    fetchMySquad().then((r) => {
      if (r.ok) {
        setSquad(r.data.squad)
        setState("ready")
        try {
          sessionStorage.removeItem(PENDING_KEY)
        } catch {}
      } else if (r.status === 401) {
        setState("guest")
        if (code) {
          setTab("mine")
          try {
            sessionStorage.setItem(PENDING_KEY, code)
          } catch {}
        }
      } else {
        setState("ready")
        setError(r.error)
      }
    })
    if (code) {
      fetchInvite(code).then((r) => {
        if (r.ok) setInvite(r.data.squad)
        else setInviteError(r.error)
      })
    }
  }, [])

  const goLogin = () => (window.location.href = "/login")

  // 주소와 탭을 맞춤: ?tab=mine 이면 내 스쿼드, 아니면 스쿼드 둘러보기 (위쪽 탭 표시도 같이)
  useEffect(() => {
    onTabChange?.(tab)
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get("join")) return
      if (url.searchParams.get("tab") !== tab) {
        url.searchParams.set("tab", tab)
        window.history.replaceState(null, "", url.pathname + url.search)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const join = async (code: string) => {
    setBusy(true)
    setError("")
    const r = await joinByCode(code)
    setBusy(false)
    if (!r.ok) {
      if (r.status === 401) return goLogin()
      return setError(r.error)
    }
    setSquad(r.data.squad)
    setInvite(null)
    setNotice(r.data.rewardDp ? `스쿼드가 완성됐어요! +${r.data.rewardDp} DP` : `'${r.data.squad.name}' 스쿼드에 들어왔어요.`)
    try {
      sessionStorage.removeItem(PENDING_KEY)
      window.history.replaceState(null, "", "/community/gallery/squads/?tab=mine")
    } catch {}
  }

  const create = async (v: Parameters<typeof createSquad>[0]) => {
    setBusy(true)
    setError("")
    const r = await createSquad(v)
    setBusy(false)
    if (!r.ok) {
      if (r.status === 401) return goLogin()
      return setError(r.error)
    }
    setSquad(r.data.squad)
    setNotice(`'${r.data.squad.name}' 스쿼드를 만들었어요. 초대 링크를 친구에게 보내 보세요.`)
  }

  return (
    <div className="space-y-6">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">스쿼드</h1>
            <p className="mt-2 text-sm sm:text-base text-zinc-300 max-w-2xl">
              취향이 맞는 덕후들과 길드처럼 모여 보세요. 스쿼드 아이콘은 커뮤니티 글·댓글의 내 이름 옆에 함께 보여요.
              처음 3명이 모이면 팀원 모두 300 DP를 받아요.
            </p>
          </div>
          {tab === "browse" && state !== "loading" && !squad && (
            <button
              type="button"
              onClick={() => setTab("mine")}
              className="self-start md:self-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
            >
              스쿼드 만들기
            </button>
          )}
        </section>

        {notice && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">{notice}</div>}

        {squad && invite && invite.id !== squad.id && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-300">
            &apos;{invite.name}&apos; 스쿼드 초대를 받았어요. 회원은 한 스쿼드에만 들어갈 수 있어서, 들어가려면 지금 스쿼드에서 먼저 나와야 해요.
          </div>
        )}

        {/* 초대 링크로 왔을 때 */}
        {!squad && (invite || inviteError) && (
          <section className="rounded-2xl bg-zinc-900 border border-amber-500/40 p-5">
            {invite ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <SquadIcon icon={invite.icon} color={invite.color} imageUrl={invite.imageUrl} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-amber-400">스쿼드 초대</div>
                  <div className="text-lg font-bold text-white break-all">{invite.name}</div>
                  <div className="text-sm text-zinc-400">
                    리더 {invite.leaderName} · {invite.members} / {invite.size}명{invite.intro && ` · ${invite.intro}`}
                  </div>
                </div>
                <button
                  onClick={state === "guest" ? goLogin : () => join(invite.code)}
                  disabled={busy || invite.full}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold disabled:opacity-50"
                >
                  {invite.full ? "정원이 다 찼어요" : state === "guest" ? "로그인하고 들어가기" : "이 스쿼드에 들어가기"}
                </button>
              </div>
            ) : (
              <div className="text-sm text-red-300">{inviteError}</div>
            )}
          </section>
        )}

        {tab === "browse" && <SquadDirectory mySquadId={squad?.id ?? null} />}

        {tab === "mine" && (
          <>
            {state === "loading" && <div className="py-12 text-center text-sm text-zinc-500">불러오는 중...</div>}
            {state === "guest" && (
              <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center space-y-3">
                <p className="text-base text-zinc-200">로그인하면 스쿼드를 만들거나 들어갈 수 있어요.</p>
                <button onClick={goLogin} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold">
                  로그인
                </button>
                <p className="text-sm text-zinc-400">
                  먼저 둘러보고 싶다면{" "}
                  <button onClick={() => setTab("browse")} className="underline underline-offset-2 text-zinc-200">
                    스쿼드 둘러보기
                  </button>
                </p>
              </section>
            )}
            {state === "ready" && squad && (
              <MySquad
                squad={squad}
                onChange={setSquad}
                onGone={() => {
                  setSquad(null)
                  setNotice("스쿼드에서 나왔어요.")
                }}
              />
            )}
            {state === "ready" && !squad && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-white">새 스쿼드 만들기</h2>
                  <p className="text-sm text-zinc-400 mt-1 mb-5">만든 사람이 리더가 돼요. 이름은 스쿼드마다 하나뿐이에요. 회원은 한 스쿼드에만 들어갈 수 있어요.</p>
                  <SquadForm initial={emptySquadForm} submitLabel="스쿼드 만들기" allowImage busy={busy} error={error} onSubmit={create} />
                </section>
                <aside className="space-y-5">
                  <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
                    <h3 className="text-base font-bold text-white">초대 코드가 있나요?</h3>
                    <p className="text-sm text-zinc-400 mt-1">친구에게 받은 SQ-로 시작하는 코드를 넣으면 바로 들어가요.</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (codeInput.trim()) join(codeInput.trim())
                      }}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        placeholder="SQ-XXXXXX"
                        maxLength={9}
                        className="flex-1 min-w-0 rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                      <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl border border-zinc-600 text-sm text-zinc-100 hover:bg-zinc-800">
                        들어가기
                      </button>
                    </form>
                  </section>
                  <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-2.5 text-sm text-zinc-300">
                    <h3 className="text-base font-bold text-white">스쿼드는 이렇게 굴러가요</h3>
                    <p>· 정원은 20명. 리더가 이름·소개·아이콘을 정하고 가입 신청을 받아요.</p>
                    <p>· 팀원끼리만 보는 스쿼드 채팅이 있어요.</p>
                    <p>· 커뮤니티 글·댓글·코스어 등록에 내 스쿼드 배지가 붙어요.</p>
                    <p>· 처음 3명이 모이면 팀원 모두 300 DP (회원마다 한 번).</p>
                    <p>
                      ·{" "}
                      <button onClick={() => setTab("browse")} className="underline underline-offset-2 text-zinc-100">
                        다른 스쿼드 둘러보고 가입 신청하기
                      </button>
                    </p>
                  </section>
                </aside>
              </div>
            )}
          </>
        )}

        {tab === "browse" && !squad && state !== "loading" && (
          <p className="text-sm text-zinc-400">
            마음에 드는 스쿼드가 없나요?{" "}
            <button onClick={() => setTab("mine")} className="underline underline-offset-2 text-zinc-100">
              직접 만들어 보세요
            </button>
            .
          </p>
        )}
    </div>
  )
}

"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { Check, Copy, Crown, ExternalLink, LogOut, Settings, UserMinus, Users } from "lucide-react"
import { SquadIcon } from "@/components/community/squad-icon"
import { SquadBadge } from "@/components/community/squad-badge"
import { MemberAvatar } from "@/components/community/squad/member-avatar"
import { SquadChat } from "@/components/community/squad/squad-chat"
import { SquadForm, type SquadFormValue } from "@/components/community/squad/squad-form"
import {
  decideSquadRequest,
  disbandSquad,
  fmtDate,
  kickSquadMember,
  leaveSquad,
  squadInviteUrl,
  transferSquadLeader,
  updateMySquad,
  type MySquad as MySquadData,
  type Res,
} from "@/lib/squads"

// 내 스쿼드: 채팅 · 팀원 · 초대 링크 · (리더) 가입 신청 처리·꾸미기·내보내기·리더 넘기기 · 나가기
export function MySquad({ squad, onChange, onGone }: { squad: MySquadData; onChange: (s: MySquadData) => void; onGone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [copied, setCopied] = useState<"link" | "code" | null>(null)
  const link = squadInviteUrl(squad.code)
  const full = squad.members.length >= squad.maxMembers

  const run = async <T,>(fn: () => Promise<Res<T>>, done?: (d: T) => void) => {
    setBusy(true)
    setError("")
    setNotice("")
    const r = await fn()
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return false
    }
    done?.(r.data)
    return true
  }
  const copy = (what: "link" | "code") => {
    navigator.clipboard?.writeText(what === "link" ? link : squad.code)
    setCopied(what)
    setTimeout(() => setCopied(null), 1800)
  }

  const save = (v: SquadFormValue) =>
    run(
      () => updateMySquad(v),
      (d) => {
        onChange(d.squad)
        setEditing(false)
        setNotice("스쿼드 정보를 바꿨어요.")
      }
    )

  const leave = () => {
    const alone = squad.members.length <= 1
    if (squad.isLeader && !alone) return setError("리더는 다른 팀원에게 리더를 넘긴 뒤 나갈 수 있어요. 아래 팀원 목록에서 '리더 넘기기'를 눌러주세요.")
    if (!confirm(squad.isLeader ? "혼자 남은 스쿼드라 나가면 스쿼드가 사라져요. 나갈까요?" : `'${squad.name}' 스쿼드에서 나갈까요?`)) return
    run(leaveSquad, onGone)
  }
  const disband = () => {
    if (!confirm(`'${squad.name}' 스쿼드를 해산할까요? 팀원 ${squad.members.length}명 모두 빠지고 채팅도 사라져요.`)) return
    run(disbandSquad, onGone)
  }

  const progress = Math.min(squad.members.length, squad.size)

  return (
    <div className="space-y-5">
      {/* 스쿼드 머리 */}
      <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <SquadIcon icon={squad.icon} color={squad.color} imageUrl={squad.imageUrl} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white break-all">{squad.name}</h2>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${squad.isLeader ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>
                {squad.isLeader ? "리더" : "팀원"}
              </span>
              {squad.hidden && <span className="px-2 py-0.5 rounded-md text-xs font-semibold border bg-red-500/10 text-red-300 border-red-500/30">운영팀이 목록에서 숨김</span>}
            </div>
            <p className="text-sm text-zinc-300 mt-1">{squad.intro || "아직 소개가 없어요."}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Users className="w-4 h-4" /> {squad.members.length} / {squad.maxMembers}명
              </span>
              <span>{squad.joinPolicy === "open" ? "누구나 바로 가입" : "가입 신청 후 승인"}</span>
              <span>{fmtDate(squad.createdAt)} 결성</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <Link
              href={`/community/gallery/squad/?id=${squad.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              <ExternalLink className="w-4 h-4" /> 공개 페이지
            </Link>
            {squad.isLeader && (
              <button
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <Settings className="w-4 h-4" /> {editing ? "꾸미기 닫기" : "스쿼드 꾸미기"}
              </button>
            )}
          </div>
        </div>

        {/* 3명 완성 보상 */}
        <div className="mt-5 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm">
            <span className="text-zinc-200 font-semibold whitespace-nowrap">{squad.completedAt ? "스쿼드 완성" : `${squad.size}명이 모이면 스쿼드 완성`}</span>
            <span className="text-zinc-400">
              {squad.completedAt ? `${fmtDate(squad.completedAt)} 완성 · 팀원 ${squad.rewardDp.toLocaleString()} DP 지급` : `${progress} / ${squad.size}명 · 완성하면 모두 ${squad.rewardDp.toLocaleString()} DP`}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(progress / squad.size) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">완성 보상은 스쿼드마다 한 번, 회원마다 평생 한 번만 받아요.</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-400">내 글에는 이렇게 보여요</span>
          <SquadBadge squad={{ id: squad.id, name: squad.name, icon: squad.imageUrl || squad.icon, color: squad.color }} link={false} />
        </div>
      </section>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}
      {notice && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">{notice}</div>}

      {editing && squad.isLeader && (
        <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6">
          <h3 className="text-base font-bold text-white mb-4">스쿼드 꾸미기</h3>
          <SquadForm
            initial={{ name: squad.name, intro: squad.intro, icon: squad.icon, color: squad.color, imageUrl: squad.imageUrl, joinPolicy: squad.joinPolicy }}
            submitLabel="저장"
            allowImage
            busy={busy}
            error=""
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <SquadChat squadName={squad.name} />

        <div className="space-y-5">
          {/* 가입 신청 (리더) */}
          {squad.isLeader && squad.requests.length > 0 && (
            <section className="rounded-2xl bg-zinc-900 border border-amber-500/40 p-4">
              <h3 className="text-base font-bold text-white">가입 신청 {squad.requests.length}건</h3>
              <ul className="mt-3 space-y-3">
                {squad.requests.map((r) => (
                  <li key={r.id} className="flex gap-2.5">
                    <MemberAvatar name={r.name} src={r.avatarUrl} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{r.name}</div>
                      {r.message && <div className="text-sm text-zinc-300 break-words">{r.message}</div>}
                      <div className="text-xs text-zinc-500">{fmtDate(r.createdAt)}</div>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          disabled={busy || full}
                          onClick={() => run(() => decideSquadRequest(r.id, true), (d) => {
                            onChange(d.squad)
                            setNotice(d.notice)
                          })}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold disabled:opacity-50"
                        >
                          받기
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => run(() => decideSquadRequest(r.id, false), (d) => {
                            onChange(d.squad)
                            setNotice(d.notice)
                          })}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 초대 */}
          <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
            <h3 className="text-base font-bold text-white">친구 초대</h3>
            <p className="text-sm text-zinc-400 mt-0.5">초대 링크로 들어온 친구는 승인 없이 바로 팀원이 돼요.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="flex-1 min-w-0 rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs text-zinc-300" onFocus={(e) => e.target.select()} />
              <button onClick={() => copy("link")} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold">
                {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === "link" ? "복사됨" : "링크 복사"}
              </button>
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              초대 코드 <span className="font-mono text-zinc-100">{squad.code}</span>
              <button onClick={() => copy("code")} className="ml-2 text-xs underline underline-offset-2 text-zinc-400 hover:text-white">
                {copied === "code" ? "복사됨" : "복사"}
              </button>
            </div>
          </section>

          {/* 팀원 */}
          <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
            <h3 className="text-base font-bold text-white">
              팀원 <span className="text-zinc-400 font-normal text-sm">{squad.members.length}명</span>
            </h3>
            <ul className="mt-3 divide-y divide-zinc-800">
              {squad.members.map((m) => (
                <li key={m.memberId} className="py-2.5 flex items-center gap-2.5">
                  <MemberAvatar name={m.name} src={m.avatarUrl} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate flex items-center gap-1">
                      {m.isLeader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="리더" />}
                      {m.name}
                      {m.isMe && <span className="text-xs text-zinc-500 font-normal">(나)</span>}
                    </div>
                    <div className="text-xs text-zinc-500">{fmtDate(m.joinedAt)} 가입</div>
                  </div>
                  {squad.isLeader && !m.isMe && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        disabled={busy}
                        title="리더 넘기기"
                        onClick={() => confirm(`${m.name}님에게 리더를 넘길까요? 넘긴 뒤에는 팀원이 돼요.`) && run(() => transferSquadLeader(m.memberId), (d) => onChange(d.squad))}
                        className="px-2 py-1 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        리더 넘기기
                      </button>
                      <button
                        disabled={busy}
                        title="내보내기"
                        aria-label={`${m.name} 내보내기`}
                        onClick={() => confirm(`${m.name}님을 스쿼드에서 내보낼까요?`) && run(() => kickSquadMember(m.memberId), (d) => onChange(d.squad))}
                        className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
            <button
              onClick={leave}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <LogOut className="w-4 h-4" /> 스쿼드 나가기
            </button>
            {squad.isLeader && squad.members.length > 1 && (
              <button onClick={disband} disabled={busy} className="w-full px-3 py-2 rounded-xl border border-red-500/40 text-sm text-red-300 hover:bg-red-500/10">
                스쿼드 해산
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

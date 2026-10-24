"use client"

import * as React from "react"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Crown, ExternalLink, ImagePlus, Megaphone, MessageCircle, PenLine, PenSquare, Plus, Trash2, Users } from "lucide-react"
import { Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { MoreButton, PostGrid, useFeed } from "@/components/gallery/post-cards"
import { SquadIcon } from "@/components/community/squad-icon"
import { MemberAvatar } from "@/components/community/squad/member-avatar"
import { fetchFeed } from "@/lib/community-api"
import { uploadImageFile } from "@/lib/image-upload"
import { applyToSquad, cancelSquadApplication, fetchSquadDetail, fmtDate, squadEventText, updateMySquad, type SquadDetail } from "@/lib/squads"

// 스쿼드 홈 (/community/gallery/squad?id=1): 누구나 보는 스쿼드 얼굴
// 표지·아이콘·소개·공지·SNS, 팀원, 스쿼드 이름으로 쓴 글, 최근 소식, 가입. 리더는 표지·공지·링크를 꾸밀 수 있음
export default function SquadHomePage() {
  return (
    <Suspense fallback={null}>
      <SquadHome />
    </Suspense>
  )
}

function SquadHome() {
  const id = Number(useSearchParams().get("id"))
  const [data, setData] = useState<SquadDetail | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")
  const [decorating, setDecorating] = useState(false)
  const feed = useFeed((cursor) => fetchFeed({ squad: id, cursor }), [id])

  const load = useCallback(async () => {
    if (!id) return setError("스쿼드를 찾을 수 없어요.")
    const r = await fetchSquadDetail(id)
    if (r.ok) setData(r.data)
    else setError(r.error)
  }, [id])
  useEffect(() => {
    load()
  }, [load])

  const apply = async () => {
    if (!data) return
    if (!data.viewer.loggedIn) return (window.location.href = "/login")
    setBusy(true)
    setActionError("")
    const r = await applyToSquad(data.squad.id, message)
    setBusy(false)
    if (!r.ok) return setActionError(r.error)
    setMessage("")
    setNotice(
      r.data.joined
        ? r.data.rewardDp
          ? `스쿼드에 들어왔어요! 스쿼드 완성 보상 +${r.data.rewardDp} DP`
          : "스쿼드에 들어왔어요. 이제 글·댓글에 스쿼드 배지가 붙어요."
        : "가입 신청을 보냈어요. 리더가 받아주면 팀원이 돼요."
    )
    load()
  }
  const cancel = async () => {
    if (!data) return
    setBusy(true)
    const r = await cancelSquadApplication(data.squad.id)
    setBusy(false)
    if (!r.ok) return setActionError(r.error)
    setNotice("가입 신청을 취소했어요.")
    load()
  }

  const s = data?.squad
  const full = s ? s.memberCount >= s.maxMembers : false
  const isLeader = Boolean(data?.members.some((m) => m.isMe && m.isLeader))

  return (
    <GalleryLayout nav="squads">
      <Link href="/community/gallery/squads/?tab=browse" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> 스쿼드 목록
      </Link>
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <Notice>불러오는 중...</Notice>}

      {data && s && (
        <>
          <section className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="relative h-32 sm:h-48 bg-gradient-to-br from-zinc-800 to-zinc-900">
              {s.coverUrl && <img src={s.coverUrl} alt="" className="w-full h-full object-cover" />}
              {isLeader && (
                <button
                  type="button"
                  onClick={() => setDecorating((v) => !v)}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm hover:bg-black/80"
                >
                  {decorating ? "꾸미기 닫기" : "스쿼드 홈 꾸미기"}
                </button>
              )}
            </div>
            <div className="relative px-5 sm:px-7 pb-5 sm:pb-7">
              <div className="-mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
                <SquadIcon icon={s.icon} color={s.color} imageUrl={s.imageUrl} size="xl" className="ring-4 ring-zinc-900" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white break-all">{s.name}</h1>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="w-4 h-4 text-amber-400" /> 리더 {s.leaderName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-4 h-4" /> {s.memberCount} / {s.maxMembers}명
                    </span>
                    <span>{fmtDate(s.createdAt)} 결성</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm sm:text-base text-zinc-300 whitespace-pre-wrap">{s.intro || "소개가 아직 없어요."}</p>
              {s.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.links.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-emerald-500"
                    >
                      {l.label}
                      <ExternalLink className="w-3 h-3 text-zinc-500" />
                    </a>
                  ))}
                </div>
              )}

              {/* 가입 */}
              <div className="mt-5 pt-5 border-t border-zinc-800">
                {notice && <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">{notice}</div>}
                {actionError && <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{actionError}</div>}
                {data.viewer.isMember ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/community/gallery/write/?slug=squad-talk"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold"
                    >
                      <PenSquare className="w-4 h-4" />
                      스쿼드 이름으로 글쓰기
                    </Link>
                    <Link href="/community/gallery/squads/?tab=mine" className="px-4 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800">
                      채팅·팀원 관리
                    </Link>
                  </div>
                ) : data.viewer.inOtherSquad ? (
                  <p className="text-sm text-zinc-400">이미 다른 스쿼드에 들어가 있어요. 회원은 한 스쿼드에만 들어갈 수 있어요.</p>
                ) : data.viewer.pendingRequest ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-zinc-300">가입 신청을 보냈어요. 리더의 승인을 기다리는 중이에요.</span>
                    <button onClick={cancel} disabled={busy} className="px-4 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800">
                      신청 취소
                    </button>
                  </div>
                ) : full ? (
                  <p className="text-sm text-zinc-400">정원이 다 찬 스쿼드예요.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {s.joinPolicy === "request" && data.viewer.loggedIn && (
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={200}
                        placeholder="리더에게 남길 한마디 (선택)"
                        className="flex-1 min-w-0 rounded-xl bg-zinc-950 border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                    <button onClick={apply} disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-50">
                      {!data.viewer.loggedIn ? "로그인하고 가입하기" : s.joinPolicy === "open" ? "바로 가입하기" : "가입 신청하기"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {decorating && isLeader && (
            <Decorator
              initial={{ coverUrl: s.coverUrl, notice: s.notice, links: s.links }}
              onSaved={() => {
                setDecorating(false)
                setNotice("스쿼드 홈을 꾸몄어요.")
                load()
              }}
            />
          )}

          {s.notice && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
                <Megaphone className="w-4 h-4" />
                스쿼드 공지
              </h2>
              <p className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{s.notice}</p>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
            <section className="space-y-3 min-w-0">
              <h2 className="text-base font-bold text-white">스쿼드 글</h2>
              {feed.posts === null ? <Notice>불러오는 중...</Notice> : <PostGrid posts={feed.posts} showGallery emptyText="아직 스쿼드 이름으로 쓴 글이 없어요." />}
              <MoreButton onClick={feed.more} />
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <h2 className="text-base font-bold text-white">
                  팀원 <span className="text-sm font-normal text-zinc-400">{data.members.length}명</span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {data.members.map((m, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <MemberAvatar name={m.name} src={m.avatarUrl} size={32} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {m.name}
                          {m.isMe && <span className="ml-1 text-xs font-normal text-zinc-500">(나)</span>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className={m.isLeader ? "text-amber-400 font-semibold" : ""}>{m.isLeader ? "리더" : "팀원"}</span> · {fmtDate(m.joinedAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <h2 className="text-base font-bold text-white">활동</h2>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <dt className="text-xs text-zinc-400 inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> 이번 주 채팅
                    </dt>
                    <dd className="text-lg font-bold text-white">{data.activity.chatWeek.toLocaleString()}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <dt className="text-xs text-zinc-400 inline-flex items-center gap-1">
                      <PenLine className="w-3.5 h-3.5" /> 30일 글
                    </dt>
                    <dd className="text-lg font-bold text-white">{data.activity.posts30d.toLocaleString()}</dd>
                  </div>
                </dl>
                {data.activity.events.length > 0 && (
                  <ol className="mt-4 space-y-2.5">
                    {data.activity.events.map((e) => (
                      <li key={e.id} className="text-sm">
                        <div className="text-zinc-200">{squadEventText(e)}</div>
                        <div className="text-xs text-zinc-500">{fmtDate(e.createdAt)}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </GalleryLayout>
  )
}

// 리더: 스쿼드 홈 꾸미기 (표지 사진·공지·SNS 링크)
function Decorator({ initial, onSaved }: { initial: { coverUrl: string | null; notice: string; links: { url: string; label: string }[] }; onSaved: () => void }) {
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl)
  const [notice, setNotice] = useState(initial.notice)
  const [links, setLinks] = useState(initial.links)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"

  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      setCoverUrl(await uploadImageFile("squad", file))
    } catch (e: any) {
      setError(e?.message || "사진을 올리지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    setBusy(true)
    setError("")
    const r = await updateMySquad({ coverUrl, notice, links: links.filter((l) => l.url.trim()) })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    onSaved()
  }

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 sm:p-5 space-y-4">
      <h2 className="text-base font-bold text-white">스쿼드 홈 꾸미기</h2>
      <div className="space-y-1.5">
        <span className="block text-sm font-semibold text-zinc-300">표지 사진</span>
        <div className="flex items-center gap-3">
          <label className="w-40 h-20 rounded-xl border border-dashed border-zinc-700 overflow-hidden flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
            {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {coverUrl && (
            <button type="button" onClick={() => setCoverUrl(null)} className="text-sm text-zinc-400 hover:text-red-400">
              표지 빼기
            </button>
          )}
        </div>
      </div>
      <label className="block">
        <span className="block text-sm font-semibold text-zinc-300 mb-1.5">스쿼드 공지 ({notice.length}/500)</span>
        <textarea value={notice} onChange={(e) => setNotice(e.target.value)} maxLength={500} rows={3} placeholder="모임 일정, 규칙, 환영 인사 등" className={input} />
      </label>
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-zinc-300">SNS 링크 ({links.length}/5)</span>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://instagram.com/스쿼드계정" className={input} />
            <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="빼기" className="px-2 text-zinc-500 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {links.length < 5 && (
          <button type="button" onClick={() => setLinks([...links, { url: "", label: "" }])} className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline">
            <Plus className="w-4 h-4" />
            링크 추가
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">이름·소개·아이콘은 채팅·팀원 관리 화면에서 바꿀 수 있어요.</p>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40">
          저장
        </button>
      </div>
    </section>
  )
}

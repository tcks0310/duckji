"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Grid3x3, List, Pencil, Plus, Trash2 } from "lucide-react"
import { Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { MoreButton, PostGrid, useFeed } from "@/components/gallery/post-cards"
import { NoSquadCard, ProfileHeader } from "@/components/gallery/profile-header"
import {
  ApiError,
  deletePost,
  fetchMe,
  fetchMyComments,
  fetchMyDuckryeok,
  fetchMyPosts,
  formatPostDate,
  memberHref,
  postHref,
  updateMyProfile,
  type Comment,
  type LinkItem,
  type Profile,
} from "@/lib/community-api"

type Today = { post: { count: number; limit: number; amount: number }; comment: { count: number; limit: number; amount: number } }
type Tab = "posts" | "comments" | "duckryeok"

// 내 갤러리 홈: 내 레벨·덕력, 오늘 받은 덕력, 소개·SNS, 내 글 관리, 내 댓글, 덕력 기록, 스쿼드
export default function MyGalleryHomePage() {
  const [me, setMe] = useState<{ profile: Profile; today: Today } | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("posts")
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? setNeedLogin(true) : setError(e.message)))
  }, [])

  if (needLogin) {
    return (
      <GalleryLayout nav="me">
        <Notice>
          로그인하면 내 갤러리 홈을 볼 수 있어요.{" "}
          <Link href="/login" className="text-emerald-400 font-semibold">
            로그인하기
          </Link>
        </Notice>
      </GalleryLayout>
    )
  }

  return (
    <GalleryLayout nav="me">
      {error && <Notice tone="error">{error}</Notice>}
      {!me && !error && <Notice>불러오는 중...</Notice>}
      {me && (
        <>
          <ProfileHeader
            profile={me.profile}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  소개 고치기
                </button>
                <Link href={memberHref(me.profile.id)} className="inline-flex items-center px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800">
                  남에게 보이는 홈
                </Link>
              </>
            }
          />
          {editing && (
            <ProfileEditor
              profile={me.profile}
              onSaved={(profile) => {
                setMe({ ...me, profile })
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {!me.profile.squad && <NoSquadCard />}

          <section className="grid sm:grid-cols-2 gap-3">
            <TodayCard label="오늘 글 덕력" done={me.today.post.count} limit={me.today.post.limit} amount={me.today.post.amount} hint="하루 첫 글에 30" />
            <TodayCard label="오늘 댓글 덕력" done={me.today.comment.count} limit={me.today.comment.limit} amount={me.today.comment.amount} hint="댓글 하나에 10, 하루 5번" />
          </section>
          <p className="text-xs text-zinc-500">내 글에 덕업을 받으면 덕력 +1, 덕다운을 받으면 -1이에요. 글이나 댓글을 지우면 그걸로 받은 덕력도 빠져요.</p>

          <div role="tablist" className="flex gap-1 border-b border-zinc-800">
            {(
              [
                ["posts", "내 글"],
                ["comments", "내 댓글"],
                ["duckryeok", "덕력 기록"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === id ? "border-emerald-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "posts" && <MyPosts />}
          {tab === "comments" && <MyComments />}
          {tab === "duckryeok" && <MyLedger />}
        </>
      )}
    </GalleryLayout>
  )
}

function TodayCard({ label, done, limit, amount, hint }: { label: string; done: number; limit: number; amount: number; hint: string }) {
  return (
    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">+{(done * amount).toLocaleString()}</span>
        <span className="text-sm text-zinc-500">
          {done}/{limit}번
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: limit }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-emerald-500" : "bg-zinc-800"}`} />
        ))}
      </div>
      <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>
    </div>
  )
}

function ProfileEditor({ profile, onSaved, onCancel }: { profile: Profile; onSaved: (p: Profile) => void; onCancel: () => void }) {
  const [bio, setBio] = useState(profile.bio)
  const [links, setLinks] = useState<LinkItem[]>(profile.links)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
  const save = async () => {
    setIsSaving(true)
    setError("")
    try {
      onSaved(await updateMyProfile({ bio, links: links.filter((l) => l.url.trim()) }))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsSaving(false)
    }
  }
  return (
    <section className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-3">
      <label className="block">
        <span className="block text-sm font-semibold text-zinc-300 mb-1.5">소개</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="좋아하는 작품, 덕질 분야를 소개해 주세요" className={input} />
      </label>
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-zinc-300">인스타그램·SNS ({links.length}/5)</span>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={l.url}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://instagram.com/내계정"
              className={input}
            />
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
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white">
          취소
        </button>
        <button type="button" onClick={save} disabled={isSaving} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40">
          저장
        </button>
      </div>
    </section>
  )
}

// 내 글: 기본은 인스타 피드처럼 사진 격자, '관리'로 바꾸면 고치기·지우기 목록
function MyPosts() {
  const feed = useFeed((cursor) => fetchMyPosts(cursor), [])
  const [removed, setRemoved] = useState<number[]>([])
  const [view, setView] = useState<"grid" | "manage">("grid")
  if (feed.posts === null) return <Notice>불러오는 중...</Notice>
  const posts = feed.posts.filter((p) => !removed.includes(p.id))
  const remove = async (id: number) => {
    if (!confirm("글을 지울까요? 이 글로 받은 덕력도 함께 빠져요.")) return
    try {
      await deletePost(id)
      setRemoved((r) => [...r, id])
    } catch (e: any) {
      alert(e.message)
    }
  }
  const viewButton = (v: "grid" | "manage", label: string, Icon: typeof List) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${view === v ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-white"}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
  return (
    <div className="space-y-3">
      {feed.error && <Notice tone="error">{feed.error}</Notice>}
      {posts.length > 0 && (
        <div className="flex justify-end">
          <div className="flex gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-900/60">
            {viewButton("grid", "피드", Grid3x3)}
            {viewButton("manage", "관리", List)}
          </div>
        </div>
      )}
      {!posts.length && <Notice>아직 쓴 글이 없어요. 첫 글을 올리면 덕력 30을 받아요.</Notice>}
      {posts.length > 0 && view === "grid" && <PostGrid posts={posts} showGallery />}
      {posts.length > 0 && view === "manage" && (
        <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <Link href={postHref(p.id)} className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-zinc-900">
                {p.cover && (p.cover.type === "video" ? <video src={`${p.cover.url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" /> : <img src={p.cover.url} alt="" className="w-full h-full object-cover" />)}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={postHref(p.id)} className="block text-sm font-semibold text-zinc-100 truncate hover:underline">
                  {p.title}
                </Link>
                <div className="text-xs text-zinc-500 truncate">
                  {p.galleryName} · {formatPostDate(p.createdAt)} · 덕업 {p.upCount} · 덕다운 {p.downCount} · 댓글 {p.commentCount}
                </div>
              </div>
              {p.status === "hidden" ? (
                <span className="text-xs text-red-400 shrink-0">운영팀이 숨김</span>
              ) : (
                <div className="flex gap-3 shrink-0">
                  <Link href={`/community/gallery/write/?id=${p.id}`} className="text-xs text-zinc-400 hover:text-white">
                    고치기
                  </Link>
                  <button type="button" onClick={() => remove(p.id)} className="text-xs text-zinc-400 hover:text-red-400">
                    지우기
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <MoreButton onClick={feed.more} />
    </div>
  )
}

function MyComments() {
  const [list, setList] = useState<(Comment & { postTitle: string })[] | null>(null)
  useEffect(() => {
    fetchMyComments()
      .then(setList)
      .catch(() => setList([]))
  }, [])
  if (!list) return <Notice>불러오는 중...</Notice>
  if (!list.length) return <Notice>아직 쓴 댓글이 없어요.</Notice>
  return (
    <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70">
      {list.map((c) => (
        <li key={c.id} className="p-3 sm:p-4 space-y-1">
          <p className="text-sm text-zinc-200 line-clamp-2">{c.body}</p>
          <div className="text-xs text-zinc-500">
            <Link href={postHref(c.postId)} className="hover:text-zinc-300">
              {c.postTitle}
            </Link>{" "}
            · {formatPostDate(c.createdAt)}
          </div>
        </li>
      ))}
    </ul>
  )
}

function MyLedger() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchMyDuckryeok>> | null>(null)
  useEffect(() => {
    fetchMyDuckryeok()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  if (!rows) return <Notice>불러오는 중...</Notice>
  if (!rows.length) return <Notice>아직 덕력 기록이 없어요. 글을 쓰거나 댓글을 달아 보세요.</Notice>
  return (
    <ul className="rounded-2xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/70">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="flex-1 min-w-0 text-zinc-300 truncate">
            {r.refType === "post" && r.refId ? (
              <Link href={postHref(r.refId)} className="hover:underline">
                {r.label}
              </Link>
            ) : (
              r.label
            )}
          </span>
          <span className="text-xs text-zinc-500 shrink-0">{formatPostDate(r.createdAt)}</span>
          <span className={`w-14 text-right font-bold shrink-0 ${r.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {r.amount > 0 ? "+" : ""}
            {r.amount}
          </span>
        </li>
      ))}
    </ul>
  )
}

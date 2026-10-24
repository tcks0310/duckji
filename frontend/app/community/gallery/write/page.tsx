"use client"

import * as React from "react"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, BarChart3, ImagePlus, Link2, Plus, Trash2, X } from "lucide-react"
import { Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout, useGalleryTree } from "@/components/gallery/gallery-layout"
import { apiFetch } from "@/lib/api"
import {
  ApiError,
  MAX_MEDIA,
  createPost,
  fetchGallery,
  fetchMe,
  fetchPost,
  isVideoUrl,
  postHref,
  updatePost,
  uploadGalleryMedia,
  type Gallery,
  type LinkItem,
  type Permissions,
  type PollInput,
  type Profile,
} from "@/lib/community-api"
import { PARTY_POST_HEAD, fetchPartyEvent, linkPartyPost, type PartyEvent } from "@/lib/party-api"
import { dropHighlight, useImageDrop } from "@/lib/use-image-drop"
import { DatePicker } from "@/components/ui/date-picker"

const MAX_BODY = 5000
const MAX_TAGS = 10
const MAX_LINKS = 5
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
const isMediaFile = (f: File) => f.type.startsWith("image/") || f.type.startsWith("video/")

// 글쓰기 (/community/gallery/write?slug=cosplay-request) · 고치기 (?id=12)
// 파티 이벤트의 "파티할래요?" 글 (?slug=party&partyEvent=naruto-birthday): 저장 후 이벤트에 연결
export default function GalleryWritePage() {
  return (
    <Suspense fallback={null}>
      <GalleryWrite />
    </Suspense>
  )
}

const emptyPoll = (): PollInput => ({ question: "", endsAt: null, options: [0, 1].map(() => ({ label: "", description: "", imageUrl: null, linkUrl: null })) })

function GalleryWrite() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = Number(params.get("id")) || null
  const partyEventSlug = editId ? null : params.get("partyEvent")
  const { tree } = useGalleryTree()

  const [who, setWho] = useState<{ isAdmin: boolean; profile: Profile | null } | null>(null)
  const [slug, setSlug] = useState(params.get("slug") || "")
  const [pickedGroupId, setPickedGroupId] = useState<number | null>(null)
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [perm, setPerm] = useState<Permissions | null>(null)
  const [partyEvent, setPartyEvent] = useState<PartyEvent | null>(null)

  const [head, setHead] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [media, setMedia] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [links, setLinks] = useState<LinkItem[]>([])
  const [isNotice, setIsNotice] = useState(false)
  const [asSquad, setAsSquad] = useState(false)
  const [poll, setPoll] = useState<PollInput | null>(null)
  const [uploading, setUploading] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  // 누가 쓰는지 (회원·관리자)
  useEffect(() => {
    Promise.all([
      fetchMe().then((r) => r.profile).catch(() => null),
      apiFetch("/api/admin/session")
        .then((r) => r.json())
        .then((d) => Boolean(d.authenticated))
        .catch(() => false),
    ]).then(([profile, isAdmin]) => setWho({ profile, isAdmin }))
  }, [])

  // 고치기: 원래 글 불러오기
  useEffect(() => {
    if (!editId) return
    fetchPost(editId)
      .then(({ post, gallery: g }) => {
        setSlug(g.slug)
        setHead(post.head)
        setTitle(post.title)
        setBody(post.body)
        setMedia(post.media.map((m) => m.url))
        setTags(post.hashtags)
        setLinks(post.links)
        setIsNotice(post.isNotice)
        setPoll(
          post.poll
            ? {
                question: post.poll.question,
                endsAt: post.poll.endsAt,
                options: post.poll.options.map((o) => ({ id: o.id, label: o.label, description: o.description, imageUrl: o.imageUrl, linkUrl: o.linkUrl })),
              }
            : null
        )
      })
      .catch((e) => setError(e.message))
  }, [editId])

  // 고른 갤러리 정보·권한
  useEffect(() => {
    if (!slug) {
      setGallery(null)
      setPerm(null)
      return
    }
    fetchGallery(slug)
      .then((r) => {
        setGallery(r.gallery)
        setPerm(r.viewer)
        if (!editId) setHead((h) => (r.gallery.heads.includes(h) ? h : r.gallery.heads[0] || ""))
      })
      .catch((e) => setError(e.message))
  }, [slug, editId])

  // 파티 이벤트 글
  useEffect(() => {
    if (!partyEventSlug || !gallery) return
    fetchPartyEvent(partyEventSlug)
      .then(({ event }) => {
        setPartyEvent(event)
        const hasHead = gallery.heads.includes(PARTY_POST_HEAD)
        if (hasHead) setHead(PARTY_POST_HEAD)
        setTitle((t) => t || `${hasHead ? "" : `[${PARTY_POST_HEAD}] `}${event.title} 파티 같이 해요`)
      })
      .catch(() => {})
  }, [partyEventSlug, gallery])

  const addFiles = async (files: File[]) => {
    const room = MAX_MEDIA - media.length - uploading
    if (files.length > room) setError(`사진·동영상은 합쳐서 ${MAX_MEDIA}개까지 올릴 수 있어요.`)
    for (const file of files.filter(isMediaFile).slice(0, Math.max(room, 0))) {
      setUploading((n) => n + 1)
      try {
        const url = await uploadGalleryMedia(file)
        setMedia((prev) => (prev.length < MAX_MEDIA ? [...prev, url] : prev))
      } catch (e: any) {
        setError(e?.message || "파일을 올리지 못했습니다.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }
  const drop = useImageDrop((files) => addFiles(files), uploading > 0 || media.length >= MAX_MEDIA, isMediaFile)

  const move = (i: number, d: number) =>
    setMedia((prev) => {
      const next = [...prev]
      const j = i + d
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const addTag = (raw: string) => {
    const t = raw
      .trim()
      .replace(/^#+/, "")
      .replace(/[\s#,.!?~`'"()[\]{}<>@$%^&*+=|\\/:;-]/g, "")
      .slice(0, 20)
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) setTags([...tags, t])
    setTagInput("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gallery) return
    if (tagInput.trim()) addTag(tagInput)
    setIsSaving(true)
    setError("")
    try {
      const input = {
        gallerySlug: gallery.slug,
        head,
        title: title.trim(),
        body,
        media,
        links: links.filter((l) => l.url.trim()),
        hashtags: tagInput.trim() ? [...tags, tagInput.trim().replace(/^#+/, "")] : tags,
        ...(who?.isAdmin ? { isNotice, poll } : {}),
        asSquad: gallery.postAsSquad || asSquad,
      }
      let id = editId
      if (editId) {
        await updatePost(editId, input)
      } else {
        const r = await createPost(input)
        id = r.post.id
        if (partyEvent) await linkPartyPost(partyEvent.slug, r.post.id).catch(() => {})
      }
      router.push(postHref(id!))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.push("/login")
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
  const label = "block text-sm font-semibold text-zinc-300 mb-1.5"

  // 쓸 수 있는 갤러리 (운영팀 갤러리는 관리자만)
  const writable = (tree?.groups || []).map((g) => ({
    ...g,
    galleries: g.galleries.filter((x) => x.status === "active" && (x.writeRole === "member" || who?.isAdmin)),
  }))
  // 대분류 → 하위 갤러리 순서로 고름
  const currentGroupId = writable.find((g) => g.galleries.some((x) => x.slug === slug))?.id ?? null
  const shownGroupId = pickedGroupId ?? currentGroupId
  const shownGroup = writable.find((g) => g.id === shownGroupId) || null

  if (who && !who.profile && !who.isAdmin) {
    return (
      <GalleryLayout>
        <Notice>
          로그인하면 글을 쓸 수 있어요.{" "}
          <Link href="/login" className="text-emerald-400 font-semibold">
            로그인하기
          </Link>
        </Notice>
      </GalleryLayout>
    )
  }

  const squad = who?.profile?.squad
  const blocked = perm && !perm.canWrite ? perm.writeBlockedReason : null

  return (
    <GalleryLayout activeSlug={gallery?.slug ?? null}>
      <h1 className="text-xl font-bold text-white">{editId ? "글 고치기" : "글쓰기"}</h1>
      {partyEvent && (
        <p className="text-sm text-zinc-400">
          <Link href={`/funding/party/event?slug=${encodeURIComponent(partyEvent.slug)}`} className="text-emerald-400 font-semibold">
            {partyEvent.title}
          </Link>{" "}
          이벤트의 &quot;파티할래요?&quot; 글로 연결돼요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
        <div className="grid sm:grid-cols-[1fr_1fr_10rem] gap-3">
          <div>
            <label className={label} htmlFor="w-group">
              대분류
            </label>
            <select
              id="w-group"
              value={shownGroupId ?? ""}
              onChange={(e) => {
                setPickedGroupId(e.target.value ? Number(e.target.value) : null)
                setSlug("")
              }}
              disabled={Boolean(editId || partyEvent)}
              className={input}
            >
              <option value="">대분류를 골라 주세요</option>
              {writable
                .filter((g) => g.galleries.length)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="w-gallery">
              하위 갤러리
            </label>
            <select id="w-gallery" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={Boolean(editId || partyEvent) || !shownGroup} className={input}>
              <option value="">{shownGroup ? "갤러리를 골라 주세요" : "대분류를 먼저 고르세요"}</option>
              {shownGroup?.galleries.map((x) => (
                <option key={x.id} value={x.slug}>
                  {x.name}
                  {x.writeRole === "admin" ? " (운영팀)" : ""}
                </option>
              ))}
              {gallery && !shownGroup?.galleries.some((x) => x.slug === gallery.slug) && <option value={gallery.slug}>{gallery.name}</option>}
            </select>
          </div>
          {gallery && gallery.heads.length > 0 && (
            <div>
              <label className={label} htmlFor="w-head">
                말머리
              </label>
              <select id="w-head" value={head} onChange={(e) => setHead(e.target.value)} className={input}>
                {gallery.heads.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {gallery?.description && <p className="-mt-3 text-xs text-zinc-500">{gallery.description}</p>}
        {blocked && !editId && <Notice tone="error">{blocked}</Notice>}

        {/* 사진·동영상 (합쳐서 10개, 첫 번째가 대표) */}
        <div>
          <span className={label}>
            사진·동영상 <span className="font-normal text-zinc-500">{media.length}/{MAX_MEDIA}</span>
            {gallery?.layout === "grid" && <span className="ml-1.5 font-normal text-xs text-emerald-400">사진 갤러리는 1개 이상 필요해요</span>}
          </span>
          <div {...drop.dropProps} className={`flex flex-wrap gap-2 ${drop.dragging ? dropHighlight : ""}`}>
            {media.map((url, i) => (
              <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-800 bg-black">
                {isVideoUrl(url) ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" /> : <img src={url} alt="" className="w-full h-full object-cover" />}
                {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">대표</span>}
                <div className="absolute top-1 right-1 flex gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="앞으로" className="p-0.5 rounded-full bg-black/70 text-white disabled:opacity-30">
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === media.length - 1} aria-label="뒤로" className="p-0.5 rounded-full bg-black/70 text-white disabled:opacity-30">
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => setMedia((p) => p.filter((u) => u !== url))} aria-label="빼기" className="p-0.5 rounded-full bg-black/70 text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {media.length < MAX_MEDIA && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-24 h-24 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 flex flex-col items-center justify-center gap-1 text-xs"
              >
                <ImagePlus className="w-5 h-5" />
                {uploading ? `올리는 중 ${uploading}` : "추가"}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []))
              e.target.value = ""
            }}
          />
          <p className="mt-1.5 text-xs text-zinc-500">사진(JPG·PNG·WEBP·GIF) 15MB, 동영상(MP4·WEBM·MOV) 100MB까지. 끌어다 놓아도 돼요.</p>
        </div>

        <div>
          <label className={label} htmlFor="w-title">
            제목
          </label>
          <input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required className={input} />
        </div>

        <div>
          <label className={label} htmlFor="w-body">
            내용
          </label>
          <textarea id="w-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_BODY} rows={8} placeholder="본문에 #태그 를 쓰면 해시태그로 들어가요." className={input} />
          <div className="text-right text-xs text-zinc-500">
            {body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}자
          </div>
        </div>

        <div>
          <span className={label}>
            해시태그 <span className="font-normal text-zinc-500">{tags.length}/{MAX_TAGS}</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-zinc-950 border border-zinc-800 focus-within:border-emerald-500">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-sky-500/15 text-sky-300 text-sm">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`${t} 빼기`} className="p-0.5 rounded-full hover:bg-sky-500/20">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {tags.length < MAX_TAGS && (
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "," || e.key === " ") && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (e.key === "Backspace" && !tagInput && tags.length) setTags(tags.slice(0, -1))
                }}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={tags.length ? "" : "태그를 쓰고 엔터"}
                className="flex-1 min-w-[8rem] bg-transparent px-1 py-1 text-sm text-white placeholder-zinc-600 focus:outline-none"
              />
            )}
          </div>
        </div>

        <div>
          <span className={label}>
            인스타그램·SNS 링크 <span className="font-normal text-zinc-500">{links.length}/{MAX_LINKS}</span>
          </span>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Link2 className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    value={l.url}
                    onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://instagram.com/내계정"
                    inputMode="url"
                    className={`${input} pl-9`}
                  />
                </div>
                <input
                  value={l.label}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="이름 (비우면 자동)"
                  maxLength={30}
                  className={`${input} w-32 sm:w-40 shrink-0`}
                />
                <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="링크 빼기" className="px-2 text-zinc-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <button type="button" onClick={() => setLinks([...links, { url: "", label: "" }])} className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline">
                <Plus className="w-4 h-4" />
                링크 추가
              </button>
            )}
          </div>
        </div>

        {/* 스쿼드 이름으로 쓰기 */}
        {gallery && !who?.isAdmin && squad && (
          gallery.postAsSquad ? (
            <p className="text-sm text-zinc-400">
              이 갤러리 글은 <span className="font-semibold text-emerald-300">{squad.name}</span> 스쿼드 이름으로 올라가요.
            </p>
          ) : (
            !editId && (
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={asSquad} onChange={(e) => setAsSquad(e.target.checked)} />
                {squad.name} 스쿼드 이름으로 올리기
              </label>
            )
          )
        )}

        {/* 운영팀: 공지 고정 · 투표 (이달의 굿즈·코스어) */}
        {who?.isAdmin && (
          <div className="space-y-3 p-4 rounded-xl border border-zinc-700 bg-zinc-950/50">
            <div className="text-sm font-semibold text-zinc-200">운영팀</div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={isNotice} onChange={(e) => setIsNotice(e.target.checked)} />
              공지로 고정 (갤러리 맨 위)
            </label>
            {poll ? (
              <PollEditor poll={poll} onChange={setPoll} onRemove={() => setPoll(null)} onError={setError} />
            ) : (
              <button type="button" onClick={() => setPoll(emptyPoll())} className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline">
                <BarChart3 className="w-4 h-4" />
                투표 붙이기
              </button>
            )}
          </div>
        )}

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={isSaving || uploading > 0 || !gallery || Boolean(blocked && !editId)}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40"
        >
          {isSaving ? "저장 중..." : editId ? "고치기 완료" : "올리기"}
        </button>
        {!editId && !who?.isAdmin && <p className="text-center text-xs text-zinc-500">하루 첫 글에 덕력 30을 받아요.</p>}
      </form>
    </GalleryLayout>
  )
}

// 투표 마감 날짜·시간: 캘린더에서 날짜, 30분 단위로 시간을 고름 (비우면 관리자 화면에서 '지금 마감'으로 닫음)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)
const pad = (n: number) => String(n).padStart(2, "0")
const localParts = (iso: string | null) => {
  if (!iso) return { date: "", time: "23:30" }
  const d = new Date(iso)
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
const toIso = (date: string, time: string) => (date ? new Date(`${date}T${time || "23:30"}:00`).toISOString() : null)

function PollDeadline({ endsAt, onChange }: { endsAt: string | null; onChange: (iso: string | null) => void }) {
  const { date, time } = localParts(endsAt)
  const today = localParts(new Date().toISOString()).date
  const after = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    onChange(toIso(localParts(d.toISOString()).date, time))
  }
  const field = "bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-emerald-500"
  const quick = "px-2.5 py-1 rounded-lg border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
  const timeList = TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [...TIME_OPTIONS, time].sort()
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <span>마감</span>
        <DatePicker
          aria-label="마감 날짜"
          placeholder="마감 날짜"
          min={today}
          value={date}
          clearable={false}
          onChange={(v) => onChange(toIso(v, time))}
          wrapperClassName="w-52"
          className={`${field} cursor-pointer`}
        />
        <select aria-label="마감 시간" value={time} disabled={!date} onChange={(e) => onChange(toIso(date, e.target.value))} className={`${field} disabled:opacity-40`}>
          {timeList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {endsAt && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-zinc-500 hover:text-red-400">
            마감일 지우기
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => after(3)} className={quick}>
          3일 뒤
        </button>
        <button type="button" onClick={() => after(7)} className={quick}>
          1주 뒤
        </button>
        <button
          type="button"
          onClick={() => {
            const d = new Date()
            const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
            onChange(toIso(`${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`, time))
          }}
          className={quick}
        >
          이달 말일
        </button>
        <span className="text-xs text-zinc-500">{endsAt ? `${new Date(endsAt).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" })}에 자동으로 마감돼요.` : "마감일을 비우면 관리자 화면의 '지금 마감'으로 닫아요."}</span>
      </div>
    </div>
  )
}

// 투표 만들기 (운영팀): 질문·마감·후보(이름·설명·사진·링크)
function PollEditor({ poll, onChange, onRemove, onError }: { poll: PollInput; onChange: (p: PollInput) => void; onRemove: () => void; onError: (m: string) => void }) {
  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
  const setOption = (i: number, patch: Partial<PollInput["options"][number]>) => onChange({ ...poll, options: poll.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) })
  const upload = async (i: number, file?: File) => {
    if (!file) return
    try {
      setOption(i, { imageUrl: await uploadGalleryMedia(file) })
    } catch (e: any) {
      onError(e?.message || "사진을 올리지 못했습니다.")
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          <BarChart3 className="w-4 h-4" />
          투표
        </span>
        <button type="button" onClick={onRemove} className="text-xs text-zinc-500 hover:text-red-400">
          투표 빼기
        </button>
      </div>
      <input value={poll.question} onChange={(e) => onChange({ ...poll, question: e.target.value })} maxLength={200} placeholder="질문 (예: 10월의 코스어는?)" className={input} />
      <PollDeadline endsAt={poll.endsAt} onChange={(endsAt) => onChange({ ...poll, endsAt })} />
      <ol className="space-y-2">
        {poll.options.map((o, i) => (
          <li key={o.id ?? `n${i}`} className="flex gap-2 p-2 rounded-lg border border-zinc-800">
            <label className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-700 overflow-hidden flex items-center justify-center cursor-pointer text-zinc-500 hover:text-white">
              {o.imageUrl ? <img src={o.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-4 h-4" />}
              <input type="file" accept="image/*" hidden onChange={(e) => upload(i, e.target.files?.[0])} />
            </label>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input value={o.label} onChange={(e) => setOption(i, { label: e.target.value })} maxLength={100} placeholder={`후보 ${i + 1} 이름`} className={input} />
              <input value={o.description} onChange={(e) => setOption(i, { description: e.target.value })} maxLength={300} placeholder="한 줄 소개 (선택)" className={input} />
              <input value={o.linkUrl || ""} onChange={(e) => setOption(i, { linkUrl: e.target.value || null })} placeholder="링크 (인스타그램 등, 선택)" className={input} />
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...poll, options: poll.options.filter((_, j) => j !== i) })}
              disabled={poll.options.length <= 2}
              aria-label="후보 빼기"
              className="self-start p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ol>
      {poll.options.length < 30 && (
        <button
          type="button"
          onClick={() => onChange({ ...poll, options: [...poll.options, { label: "", description: "", imageUrl: null, linkUrl: null }] })}
          className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:underline"
        >
          <Plus className="w-4 h-4" />
          후보 추가
        </button>
      )}
    </div>
  )
}

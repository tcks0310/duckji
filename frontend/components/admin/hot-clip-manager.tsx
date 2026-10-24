"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ExternalLink, Pencil, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageUploadField } from "@/components/admin/image-upload-field"
import { uploadNoticeImage } from "@/lib/site-notices"
import {
  HOT_CLIP_PLATFORMS,
  HOT_CLIP_SLOTS,
  deleteHotClip,
  fetchAdminHotClips,
  guessPlatform,
  saveHotClip,
  youtubeThumbnail,
  type HotClip,
  type HotClipInput,
  type HotClipPlatform,
} from "@/lib/hot-clips"

// 관리자 > 컨텐츠 관리 > 핫클립 관리: 홈 마지막 화면 'SNS 핫클립' 자리 1~4 를 하나씩 등록·수정
// 썸네일은 직접 올리거나, 유튜브 링크면 유튜브 썸네일을 바로 가져옴

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"

const EMPTY: HotClipInput = { platform: "youtube", title: "", creator: "", thumbnailUrl: "", linkUrl: "" }

function ClipPreview({ clip, slot }: { clip: HotClipInput | null; slot: number }) {
  if (!clip) {
    return (
      <div className="aspect-video rounded-xl border border-dashed border-zinc-800 bg-zinc-950 flex items-center justify-center text-xs text-zinc-500">
        {slot}번 자리 비어 있음
      </div>
    )
  }
  const platform = HOT_CLIP_PLATFORMS[clip.platform]
  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
        {clip.thumbnailUrl && <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${platform.tone}`}>{platform.label}</span>
        <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-zinc-200">0{slot}</span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-8 h-8 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-white">
            <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
          </span>
        </span>
      </div>
      <p className="text-sm font-semibold text-white line-clamp-2">{clip.title || "제목 없음"}</p>
      {clip.creator && <p className="text-xs text-zinc-500 truncate">{clip.creator}</p>}
    </div>
  )
}

export function HotClipManager() {
  const [clips, setClips] = useState<HotClip[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<HotClipInput>(EMPTY)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")

  const load = () =>
    fetchAdminHotClips()
      .then((c) => {
        setClips(c)
        setLoadError("")
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다."))

  useEffect(() => {
    load()
  }, [])

  const bySlot = (slot: number) => clips?.find((c) => c.slot === slot) || null
  const set = <K extends keyof HotClipInput>(k: K, v: HotClipInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (slot: number) => {
    const clip = bySlot(slot)
    setForm(clip ? { platform: clip.platform, title: clip.title, creator: clip.creator, thumbnailUrl: clip.thumbnailUrl, linkUrl: clip.linkUrl } : EMPTY)
    setEditing(slot)
    setErrors([])
    setNotice("")
  }

  // 링크를 넣으면 플랫폼을 맞춰 고르고, 유튜브면 썸네일이 비어 있을 때 채움
  const changeLink = (url: string) => {
    setForm((f) => {
      const platform = guessPlatform(url) || f.platform
      const yt = platform === "youtube" ? youtubeThumbnail(url) : null
      return { ...f, linkUrl: url, platform, thumbnailUrl: f.thumbnailUrl || yt || "" }
    })
  }
  const ytThumb = form.platform === "youtube" ? youtubeThumbnail(form.linkUrl) : null

  const save = async () => {
    if (editing === null) return
    setSaving(true)
    try {
      await saveHotClip(editing, form)
      setNotice(`${editing}번 자리를 저장했어요. 홈에는 1분 안에 바뀌어요.`)
      setEditing(null)
      load()
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "저장하지 못했습니다."])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (slot: number) => {
    if (!confirm(`${slot}번 자리의 핫클립을 지울까요?`)) return
    try {
      await deleteHotClip(slot)
      if (editing === slot) setEditing(null)
      setNotice(`${slot}번 자리를 비웠어요.`)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "지우지 못했습니다.")
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">핫클립</h2>
        <p className="text-sm text-zinc-400 mt-1">
          홈 마지막 화면 &lsquo;SNS 핫클립&rsquo;에 걸 영상을 최대 4개까지 자리별로 등록해요. 비어 있는 자리는 홈에 나오지 않아요.
        </p>
      </div>

      {loadError && <p className="text-sm text-red-400">{loadError}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {HOT_CLIP_SLOTS.map((slot) => {
          const clip = bySlot(slot)
          return (
            <div key={slot} className={`rounded-2xl border bg-zinc-900/40 p-3 space-y-3 ${editing === slot ? "border-sky-600" : "border-zinc-800"}`}>
              <ClipPreview clip={editing === slot ? form : clip} slot={slot} />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => startEdit(slot)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  {clip ? "수정" : "등록"}
                </Button>
                {clip && (
                  <>
                    <a href={clip.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5" /> 영상
                    </a>
                    <button type="button" onClick={() => remove(slot)} className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" /> 비우기
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing !== null && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-4 max-w-2xl">
          <div className="text-sm font-semibold text-white">{editing}번 자리 {bySlot(editing) ? "수정" : "등록"}</div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">영상 링크</span>
            <input className={inputClass} value={form.linkUrl} onChange={(e) => changeLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">플랫폼</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(HOT_CLIP_PLATFORMS) as HotClipPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("platform", p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    form.platform === p ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {HOT_CLIP_PLATFORMS[p].label}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">제목</span>
            <input className={inputClass} value={form.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="홈 카드에 보일 영상 제목" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-zinc-400">채널 이름 (선택)</span>
            <input className={inputClass} value={form.creator} maxLength={60} onChange={(e) => set("creator", e.target.value)} placeholder="예: 덕지 공식" />
          </label>
          <ImageUploadField
            label="썸네일 (16:9 권장)"
            target="notices"
            upload={uploadNoticeImage}
            value={form.thumbnailUrl}
            onChange={(v) => set("thumbnailUrl", v)}
          />
          {ytThumb && ytThumb !== form.thumbnailUrl && (
            <button type="button" onClick={() => set("thumbnailUrl", ytThumb)} className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-4">
              유튜브 썸네일 가져오기
            </button>
          )}
          {errors.length > 0 && (
            <ul className="text-sm text-red-400 space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="h-9">
              {saving ? "저장 중..." : "저장"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="h-9">
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

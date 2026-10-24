"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { SQUAD_COLORS, SQUAD_ICONS, SquadIcon } from "@/components/community/squad-icon"
import { uploadImageFile } from "@/lib/image-upload"
import { checkSquadName, type SquadInput } from "@/lib/squads"

// 스쿼드 만들기·꾸미기 공통 폼 (이름·소개·아이콘·색·가입 방식, 리더는 아이콘 이미지도 올림)
export type SquadFormValue = Required<Omit<SquadInput, "imageUrl" | "coverUrl" | "notice" | "links">> & { imageUrl: string | null }

export const emptySquadForm: SquadFormValue = { name: "", intro: "", icon: "star", color: "amber", imageUrl: null, joinPolicy: "request" }

export function SquadForm({
  initial,
  submitLabel,
  allowImage,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: SquadFormValue
  submitLabel: string
  allowImage: boolean // 스쿼드를 만들 때와 리더가 꾸밀 때 아이콘 이미지를 올림
  busy: boolean
  error: string
  onSubmit: (v: SquadFormValue) => void
  onCancel?: () => void
}) {
  const [v, setV] = useState<SquadFormValue>(initial)
  const [nameState, setNameState] = useState<{ checking: boolean; error: string }>({ checking: false, error: "" })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<SquadFormValue>) => setV((p) => ({ ...p, ...patch }))

  // 이름을 고치면 잠시 뒤 쓸 수 있는 이름인지 확인
  useEffect(() => {
    const name = v.name.trim()
    if (!name || name === initial.name) return setNameState({ checking: false, error: "" })
    setNameState({ checking: true, error: "" })
    const t = setTimeout(async () => {
      const r = await checkSquadName(name)
      setNameState({ checking: false, error: r.ok ? (r.data.ok ? "" : r.data.error || "") : "" })
    }, 400)
    return () => clearTimeout(t)
  }, [v.name, initial.name])

  const pickFile = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    setUploadError("")
    try {
      set({ imageUrl: await uploadImageFile("squad", file) })
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const label = "block text-sm font-semibold text-zinc-200 mb-1.5"
  const input =
    "w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!nameState.error) onSubmit({ ...v, name: v.name.trim(), intro: v.intro.trim() })
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-4">
        <SquadIcon icon={v.icon} color={v.color} imageUrl={v.imageUrl} size="xl" />
        <div className="min-w-0">
          <div className="text-base font-bold text-white truncate">{v.name.trim() || "스쿼드 이름"}</div>
          <div className="text-sm text-zinc-400 line-clamp-2">{v.intro.trim() || "한 줄 소개가 여기에 보여요."}</div>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="squad-name">
          스쿼드 이름
        </label>
        <input
          id="squad-name"
          className={input}
          value={v.name}
          maxLength={16}
          placeholder="2~16자, 다른 스쿼드와 겹치지 않게"
          onChange={(e) => set({ name: e.target.value })}
          required
        />
        <p className={`mt-1.5 text-xs ${nameState.error ? "text-red-400" : "text-zinc-500"}`}>
          {nameState.checking ? "확인하는 중..." : nameState.error || "한글·영문·숫자·공백·_ - . 를 쓸 수 있어요. 대소문자만 다른 이름도 같은 이름으로 봐요."}
        </p>
      </div>

      <div>
        <label className={label} htmlFor="squad-intro">
          한 줄 소개
        </label>
        <input
          id="squad-intro"
          className={input}
          value={v.intro}
          maxLength={100}
          placeholder="어떤 스쿼드인지 짧게 알려주세요"
          onChange={(e) => set({ intro: e.target.value })}
        />
      </div>

      <div>
        <span className={label}>아이콘</span>
        <div className="flex flex-wrap gap-1.5 max-w-lg">
          {SQUAD_ICONS.map(({ id, label: name }) => (
            <button
              key={id}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={v.icon === id && !v.imageUrl}
              onClick={() => set({ icon: id, imageUrl: null })}
              className={`p-0.5 rounded-xl border ${v.icon === id && !v.imageUrl ? "border-white" : "border-transparent hover:border-zinc-600"}`}
            >
              <SquadIcon icon={id} color={v.color} size="md" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>색</span>
        <div className="flex flex-wrap gap-2">
          {SQUAD_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              aria-pressed={v.color === c.id}
              onClick={() => set({ color: c.id })}
              className={`w-8 h-8 rounded-full border-2 ${v.color === c.id ? "border-white" : "border-zinc-800"}`}
            >
              <span className={`block w-full h-full rounded-full ${c.swatch}`} />
            </button>
          ))}
        </div>
      </div>

      {allowImage && (
        <div>
          <span className={label}>아이콘 이미지 (선택)</span>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {v.imageUrl ? "다른 이미지로" : "이미지 올리기"}
            </button>
            {v.imageUrl && (
              <button
                type="button"
                onClick={() => set({ imageUrl: null })}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" /> 이미지 빼기
              </button>
            )}
          </div>
          <p className={`mt-1.5 text-xs ${uploadError ? "text-red-400" : "text-zinc-500"}`}>
            {uploadError || "정사각형 이미지가 잘 보여요. 3MB 이하 JPG·PNG·WEBP·GIF. 이미지를 올리면 기본 아이콘 대신 보여요."}
          </p>
        </div>
      )}

      <div>
        <span className={label}>가입 방식</span>
        <div className="grid sm:grid-cols-2 gap-2">
          {(
            [
              ["request", "가입 신청 후 리더 승인", "스쿼드 페이지에서 신청하면 리더가 받아줘요."],
              ["open", "누구나 바로 가입", "스쿼드 페이지에서 누르면 바로 들어와요."],
            ] as const
          ).map(([id, title, desc]) => (
            <button
              key={id}
              type="button"
              aria-pressed={v.joinPolicy === id}
              onClick={() => set({ joinPolicy: id })}
              className={`text-left p-3 rounded-xl border ${v.joinPolicy === id ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-600"}`}
            >
              <div className="text-sm font-semibold text-white">{title}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">초대 링크로 온 친구는 어느 방식이든 바로 들어와요.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || uploading || nameState.checking || !!nameState.error || v.name.trim().length < 2}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold disabled:opacity-50"
        >
          {busy ? "저장하는 중..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800">
            취소
          </button>
        )}
      </div>
    </form>
  )
}

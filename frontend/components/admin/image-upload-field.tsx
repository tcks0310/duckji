"use client"

import * as React from "react"
import { useState } from "react"
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react"
import { uploadImageFile, type ImageUploadTarget } from "@/lib/image-upload"
import { dropHighlight, useImageDrop } from "@/lib/use-image-drop"

// 관리자 화면 공통 이미지 칸: 파일을 고르거나 끌어다 놓으면 바로 업로드하고 주소를 채움
// 예전에 넣어 둔 주소(/images/... 등)도 그대로 보이고, 필요하면 주소를 직접 붙여 넣을 수 있음

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

function useUploader(target: ImageUploadTarget, upload?: (file: File) => Promise<string>) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState("")
  const run = async (files: File[], onDone: (url: string) => void) => {
    setError("")
    for (const file of files) {
      setUploading((n) => n + 1)
      try {
        onDone(await (upload ? upload(file) : uploadImageFile(target, file)))
      } catch (e: any) {
        setError(e?.message || "이미지를 올리지 못했습니다.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }
  return { uploading, error, run }
}

function PickButton({ label, busy, multiple, onFiles }: { label: string; busy: boolean; multiple?: boolean; onFiles: (files: File[]) => void }) {
  return (
    <label className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer">
      <ImagePlus className="w-3.5 h-3.5" />
      {busy ? "올리는 중..." : label}
      <input
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []))
          e.target.value = ""
        }}
      />
    </label>
  )
}

// 이미지 한 장
export function ImageUploadField({
  label,
  value,
  onChange,
  target,
  upload,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  target: ImageUploadTarget
  upload?: (file: File) => Promise<string> // 기본 업로드 대신 쓸 함수 (형식·크기 사전 검사 등)
  hint?: string
}) {
  const { uploading, error, run } = useUploader(target, upload)
  const { dragging, dropProps } = useImageDrop((f) => run(f.slice(0, 1), onChange), uploading > 0)
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      <div {...dropProps} className={`flex gap-2 items-start ${dragging ? dropHighlight : ""}`}>
        {value ? (
          <img src={value} alt="" className="w-16 h-16 rounded-xl object-cover bg-zinc-900 border border-zinc-800 shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 shrink-0" />
        )}
        <div className="flex-1 space-y-1.5 min-w-0">
          <PickButton label={value ? "다른 이미지로 바꾸기" : "이미지 올리기"} busy={uploading > 0} onFiles={(f) => run(f.slice(0, 1), onChange)} />
          <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder="또는 이미지 주소 붙여 넣기 (https:// 또는 /)" />
          <div className="text-xs text-zinc-500">{hint || "이미지를 여기로 끌어다 놓아도 됩니다."}</div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>
    </div>
  )
}

// 이미지 여러 장 (순서대로 저장, 각 사진의 X 로 빼기)
// reorder 를 켜면 사진 아래 ‹ › 로 순서를 바꿈, firstLabel 은 첫 장 위에 붙는 표시 (예: 대표)
export function ImageListUploadField({
  label,
  value,
  onChange,
  target,
  max = 10,
  reorder,
  firstLabel,
  hint,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  target: ImageUploadTarget
  max?: number
  reorder?: boolean
  firstLabel?: string
  hint?: string
}) {
  const { uploading, error, run } = useUploader(target)
  // 업로드가 끝나는 순서대로 이어 붙이도록 최신 목록을 ref 로 들고 있음
  const latest = React.useRef(value)
  latest.current = value
  const add = (url: string) => {
    latest.current = [...latest.current, url].slice(0, max)
    onChange(latest.current)
  }
  const room = max - value.length
  const move = (i: number, d: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  const { dragging, dropProps } = useImageDrop((f) => run(f.slice(0, room), add), uploading > 0 || room <= 0)
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold text-zinc-400">
        {label} <span className="font-normal text-zinc-500">{value.length}/{max}</span>
      </span>
      <div {...dropProps} className={`flex flex-wrap gap-2 items-center ${dragging ? dropHighlight : ""}`}>
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className="relative">
            <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover bg-zinc-900 border border-zinc-800" />
            {firstLabel && i === 0 && (
              <span className="absolute left-1 top-1 px-1 rounded bg-zinc-950/80 text-xs text-zinc-200">{firstLabel}</span>
            )}
            {reorder && value.length > 1 && (
              <div className="mt-1 flex justify-between">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="앞으로"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                  className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="뒤로"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-zinc-800 text-zinc-300 hover:text-white"
              aria-label="이미지 빼기"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {room > 0 && <PickButton label="이미지 추가" busy={uploading > 0} multiple onFiles={(f) => run(f.slice(0, room), add)} />}
      </div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
      {room > 0 && <div className="text-xs text-zinc-500">이미지를 여기로 끌어다 놓아도 됩니다.</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}

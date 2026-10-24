"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { uploadImageFile } from "@/lib/image-upload"
import { EMAIL_DOMAINS } from "@/lib/mall"
import { dropHighlight, useImageDrop } from "@/lib/use-image-drop"

// 스토어 문의 폼 공통 칸 (덕지몰 견적 신청)

export const fieldClass =
  "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 [color-scheme:dark]"

export function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-zinc-200 mb-1.5">
      {children}
      {required && <span className="text-amber-400 ml-0.5">*</span>}
    </label>
  )
}

const CUSTOM = "__custom__"

// 이메일: 아이디 @ 도메인(목록에서 고르거나 직접 입력). 값은 합친 주소 하나로 넘김
export function EmailField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [local, setLocal] = useState(() => value.split("@")[0] || "")
  const [domain, setDomain] = useState(() => {
    const d = value.split("@")[1] || ""
    return !d || (EMAIL_DOMAINS as readonly string[]).includes(d) ? d : CUSTOM
  })
  const [custom, setCustom] = useState(() => {
    const d = value.split("@")[1] || ""
    return (EMAIL_DOMAINS as readonly string[]).includes(d) ? "" : d
  })

  useEffect(() => {
    const d = domain === CUSTOM ? custom.trim() : domain
    onChange(local.trim() && d ? `${local.trim()}@${d}` : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, domain, custom])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="아이디"
          value={local}
          // 주소 전체를 붙여 넣으면 나눠서 채움
          onChange={(e) => {
            const v = e.target.value.replace(/\s/g, "")
            if (v.includes("@")) {
              const [l, d] = v.split("@")
              setLocal(l)
              if ((EMAIL_DOMAINS as readonly string[]).includes(d)) setDomain(d)
              else if (d) {
                setDomain(CUSTOM)
                setCustom(d)
              }
            } else setLocal(v)
          }}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <span className="text-zinc-400 shrink-0">@</span>
        <select
          aria-label="이메일 도메인"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className={`${fieldClass} min-w-0 flex-1`}
        >
          <option value="">선택해 주세요</option>
          {EMAIL_DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={CUSTOM}>직접 입력</option>
        </select>
      </div>
      {domain === CUSTOM && (
        <input
          type="text"
          aria-label="이메일 도메인 직접 입력"
          placeholder="예: company.co.kr"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[\s@]/g, ""))}
          className={fieldClass}
        />
      )}
    </div>
  )
}

export type Attachment = { url: string; preview: string; name: string }

const ACCEPT = "image/jpeg,image/png,image/webp"

// 시안·참고 사진 첨부: 고르거나 끌어다 놓으면 바로 올리고, 미리보기에서 X 로 뺌
export function AttachmentField({
  value,
  onChange,
  onBusyChange,
  max = 10,
}: {
  value: Attachment[]
  onChange: (v: Attachment[]) => void
  onBusyChange?: (busy: boolean) => void
  max?: number
}) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState("")
  // 업로드가 끝나는 순서대로 이어 붙이도록 최신 목록을 ref 로 들고 있음
  const latest = useRef(value)
  latest.current = value
  const room = max - value.length

  useEffect(() => onBusyChange?.(uploading > 0), [uploading, onBusyChange])

  const run = async (files: File[]) => {
    setError("")
    const picked = files.filter((f) => ACCEPT.split(",").includes(f.type))
    if (picked.length < files.length) setError("JPG, PNG, WEBP 이미지만 올릴 수 있습니다.")
    for (const file of picked.slice(0, Math.max(room, 0))) {
      setUploading((n) => n + 1)
      try {
        const url = await uploadImageFile("inquiry", file)
        latest.current = [...latest.current, { url, preview: URL.createObjectURL(file), name: file.name }].slice(0, max)
        onChange(latest.current)
      } catch (e: any) {
        setError(e?.message || "이미지를 올리지 못했습니다.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const { dragging, dropProps } = useImageDrop(run, room <= 0)

  return (
    <div className="space-y-2">
      <label
        {...dropProps}
        className={`flex flex-col items-center justify-center gap-1 px-4 py-6 rounded-lg border border-dashed text-center transition-colors ${
          room > 0 ? "border-zinc-600 bg-zinc-950 hover:border-zinc-400 cursor-pointer" : "border-zinc-800 bg-zinc-950/50 cursor-not-allowed"
        } ${dragging ? dropHighlight : ""}`}
      >
        {uploading > 0 ? <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" /> : <ImagePlus className="w-5 h-5 text-zinc-400" />}
        <span className="text-sm text-zinc-200">
          {uploading > 0 ? "올리는 중..." : room > 0 ? "사진을 고르거나 여기로 끌어다 놓으세요" : `최대 ${max}장까지 올릴 수 있습니다`}
        </span>
        <span className="text-xs text-zinc-500">JPG, PNG, WEBP · 한 장 10MB 이하 · 최대 {max}장</span>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={room <= 0}
          onChange={(e) => {
            run(Array.from(e.target.files || []))
            e.target.value = ""
          }}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {value.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.map((a, i) => (
            <li key={a.url} className="relative">
              <img src={a.preview} alt={a.name} className="w-full aspect-square rounded-lg object-cover bg-zinc-900 border border-zinc-800" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-zinc-200 hover:text-white"
                aria-label={`${a.name} 빼기`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <p className="mt-1 text-xs text-zinc-500 truncate">{a.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

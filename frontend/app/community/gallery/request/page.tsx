"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, ThumbsUp } from "lucide-react"
import { GalleryLayout, useGalleryTree } from "@/components/gallery/gallery-layout"
import { ApiError, REQUEST_CATEGORIES, createGalleryRequest, fetchGalleryRequests, galleryHref, type GalleryRequest } from "@/lib/community-api"

const categoryLabel = (v: string) => REQUEST_CATEGORIES.find((c) => c.value === v)?.label ?? v

// 갤러리 개설 요청 페이지: 요청하기 + 지금 올라온 요청에 "나도 원해요"
export default function GalleryRequestPage() {
  const { tree } = useGalleryTree()
  const [requests, setRequests] = useState<GalleryRequest[] | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("anime")
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; slug?: string; needLogin?: boolean } | null>(null)

  const load = () =>
    fetchGalleryRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
  useEffect(() => {
    load()
  }, [])

  const submit = async (input: { name: string; category: string; reason: string }) => {
    setIsSaving(true)
    setMessage(null)
    try {
      const { joined, request } = await createGalleryRequest(input)
      setMessage({
        tone: "ok",
        text: joined
          ? `"${request.name}" 요청에 함께했어요. 지금 ${request.supporterCount}명이 원하고 있어요.`
          : `"${request.name}" 갤러리 개설을 요청했어요. 운영팀이 확인하고 열어 드릴게요.`,
      })
      setName("")
      setReason("")
      load()
    } catch (e) {
      const err = e as ApiError
      if (err.status === 401) setMessage({ tone: "error", text: "로그인한 회원만 요청할 수 있어요.", needLogin: true })
      else if (err.status === 409) {
        const existing = tree?.galleries.find((g) => g.name === input.name || g.aliases.includes(input.name))
        setMessage({ tone: "error", text: err.message, slug: existing?.slug })
      } else setMessage({ tone: "error", text: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const input = "bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"

  return (
    <GalleryLayout nav="request">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-white">갤러리 개설 요청</h1>
        <p className="text-sm text-zinc-400">원하는 갤러리가 없으면 요청해 주세요. 같은 요청이 많을수록 먼저 열어 드려요.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) submit({ name: name.trim(), category, reason: reason.trim() })
        }}
        className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3"
      >
        <div className="grid sm:grid-cols-[1fr_10rem] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="갤러리 이름 (예: 귀멸의 칼날)" className={input} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="분류" className={input}>
            {REQUEST_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} placeholder="요청 이유 (선택)" className={`${input} w-full resize-none`} />
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-bold flex items-center justify-center gap-1.5"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          요청하기
        </button>
        {message && (
          <div className={`p-3 rounded-xl text-sm border ${message.tone === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            {message.text}
            {message.slug && (
              <Link href={galleryHref(message.slug)} className="ml-2 font-semibold underline">
                바로 가기
              </Link>
            )}
            {message.needLogin && (
              <Link href="/login/" className="ml-2 font-semibold underline">
                로그인
              </Link>
            )}
          </div>
        )}
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-white">지금 올라온 요청</h2>
        {requests === null ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 요청이 없어요. 첫 요청을 남겨 보세요.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 overflow-hidden">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-900/40">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{r.name}</div>
                  <div className="text-xs text-zinc-500">
                    {categoryLabel(r.category)} · {r.supporterCount}명이 원해요
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => submit({ name: r.name, category: r.category, reason: "" })}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  나도 원해요
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </GalleryLayout>
  )
}

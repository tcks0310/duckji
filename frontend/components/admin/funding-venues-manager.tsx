"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageListUploadField } from "@/components/admin/image-upload-field"
import {
  VENUE_PARTNER,
  adminCreateVenue,
  adminDeleteVenue,
  adminFetchVenues,
  adminUpdateVenue,
  type VenueSpace,
} from "@/lib/funding-venues"

// 관리자 > 펀딩 관리 > 대관 장소 (backend funding 서비스 /api/funding/admin/venues)
// 공개한 장소는 펀딩 열기 2단계에서 장소로 고를 수 있음. 예전 '펀딩 신청(대관·굿즈)' 탭의 대관 공간 부분을 옮김

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const thClass = "p-3.5"
const smallButton = "px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center gap-1"

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

function Card({ title, desc, onRefresh, actions, children }: { title: string; desc: string; onRefresh: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-semibold text-lg text-white">{title}</h3>
          <p className="text-xs text-zinc-400">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onRefresh} className="bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            새로고침
          </Button>
          {actions}
        </div>
      </div>
      {children}
    </div>
  )
}

function useList<T>(fetcher: () => Promise<T[]>, deps: unknown[] = []) {
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const load = () => {
    setIsLoading(true)
    setError("")
    fetcher()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps)
  return { items, setItems, isLoading, error, load }
}

const EMPTY_VENUE = {
  name: "", location: "", address: "", capacity: "", area: "", imageUrls: "", availablePeriod: "",
  priceGuide: "", description: "", partner: VENUE_PARTNER as string, isPublished: true, sortOrder: "0",
}
type VenueForm = typeof EMPTY_VENUE

const venueToForm = (v: VenueSpace): VenueForm => ({
  ...v,
  capacity: String(v.capacity),
  imageUrls: v.imageUrls.join("\n"),
  sortOrder: String(v.sortOrder),
})

export function FundingVenuesManager() {
  const { items, isLoading, error, load } = useList<VenueSpace>(adminFetchVenues)
  const [editingId, setEditingId] = useState<number | "new" | null>(null)
  const [form, setForm] = useState<VenueForm>(EMPTY_VENUE)
  const [errors, setErrors] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const set = <K extends keyof VenueForm>(k: K, v: VenueForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrors("")
    const payload = {
      ...form,
      capacity: Number(form.capacity) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      imageUrls: form.imageUrls.split("\n").map((l) => l.trim()).filter(Boolean),
    }
    try {
      if (editingId === "new") await adminCreateVenue(payload)
      else if (editingId) await adminUpdateVenue(editingId, payload)
      setEditingId(null)
      load()
    } catch (err) {
      setErrors(err instanceof Error ? err.message : "저장하지 못했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (v: VenueSpace) => {
    if (!confirm(`'${v.name}' 공간을 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      await adminDeleteVenue(v.id)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제하지 못했습니다.")
    }
  }

  return (
    <Card
      title="대관 장소"
      desc={`${VENUE_PARTNER}와 확보한 공간을 등록합니다. 공개한 장소는 펀딩 열기에서 고를 수 있어요.`}
      onRefresh={load}
      actions={
        <Button size="sm" onClick={() => { setForm(EMPTY_VENUE); setEditingId("new") }} className="bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white rounded-xl">
          <Plus className="w-3.5 h-3.5 mr-1" />
          공간 등록
        </Button>
      }
    >
      {editingId !== null && (
        <form onSubmit={submit} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="text-sm font-semibold text-white">{editingId === "new" ? "새 공간 등록" : "공간 수정"}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="공간명" wide><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
            <Field label="지역 (예: 강동·고덕)"><input className={inputClass} value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="주소"><input className={inputClass} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="수용 인원"><input className={inputClass} type="number" min={0} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
            <Field label="면적 (예: 30평)"><input className={inputClass} value={form.area} onChange={(e) => set("area", e.target.value)} /></Field>
            <Field label="이용 가능 기간"><input className={inputClass} value={form.availablePeriod} onChange={(e) => set("availablePeriod", e.target.value)} /></Field>
            <Field label="가격 안내"><input className={inputClass} value={form.priceGuide} onChange={(e) => set("priceGuide", e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <ImageListUploadField
                label="공간 사진"
                target="fundingVenues"
                value={form.imageUrls.split("\n").map((l) => l.trim()).filter(Boolean)}
                onChange={(v) => set("imageUrls", v.join("\n"))}
              />
            </div>
            <Field label="설명" wide><textarea className={inputClass} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="협력사 표기"><input className={inputClass} value={form.partner} onChange={(e) => set("partner", e.target.value)} /></Field>
            <Field label="노출 순서 (작을수록 앞)"><input className={inputClass} type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            사이트에 공개
          </label>
          {errors && <div className="text-xs text-red-400 whitespace-pre-line">{errors}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold">취소</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      )}

      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-bold bg-zinc-950">
              <th className={thClass}>순서</th>
              <th className={thClass}>공간명</th>
              <th className={thClass}>지역 · 인원 · 면적</th>
              <th className={thClass}>협력사</th>
              <th className={thClass}>공개</th>
              <th className={`${thClass} text-right`}>관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">불러오는 중...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-zinc-500">등록된 공간이 없습니다.</td></tr>
            ) : (
              items.map((v) => (
                <tr key={v.id} className="hover:bg-zinc-950/60 transition-colors">
                  <td className="p-3.5 font-mono text-zinc-400">{v.sortOrder}</td>
                  <td className="p-3.5 font-bold text-white">{v.name}</td>
                  <td className="p-3.5 text-zinc-300">{v.location || "-"} · {v.capacity}명 · {v.area || "-"}</td>
                  <td className="p-3.5 text-zinc-300">{v.partner}</td>
                  <td className="p-3.5">{v.isPublished ? <span className="text-emerald-400">공개</span> : <span className="text-zinc-500">비공개</span>}</td>
                  <td className="p-3.5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => { setForm(venueToForm(v)); setEditingId(v.id) }} className={smallButton}>
                        <Pencil className="w-3 h-3" />
                        수정
                      </button>
                      <button onClick={() => remove(v)} className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-bold flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}


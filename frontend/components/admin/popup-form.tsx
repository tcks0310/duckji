"use client"

import * as React from "react"
import { useState } from "react"
import { Crosshair, Search } from "lucide-react"
import { PopupEvent } from "@/data/popup-data"
import { createPopup, updatePopup } from "@/lib/popup-service"
import { searchAddress } from "@/lib/postcode"
import { geocodeAddress } from "@/lib/geocode"
import { NAVER_MAP_KEY } from "@/components/map/naver-map"
import { PointPicker } from "@/components/admin/point-picker"
import { PlaceSearch } from "@/components/admin/place-search"
import { ImageListUploadField, ImageUploadField } from "@/components/admin/image-upload-field"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 팝업 등록·수정 양식. 같은 성격의 칸을 묶어 섹션으로 나눔
//   기본 정보 → 분류 → 일정 → 장소(주소 검색 → 지도 위치) → 입장·예약 → 사진 → 소개 → 링크·출처 → 공개 설정
// 진행 상태(진행중·오픈예정·종료)는 서버가 기간으로 계산하므로 입력받지 않음

export type OperationType = NonNullable<PopupEvent["operationType"]>

export const OPERATION_OPTIONS: { value: OperationType; label: string; help: string }[] = [
  { value: "partner", label: "제휴 팝업", help: "운영사와 제휴한 팝업. 예약·웨이팅을 덕지에서 받을 수 있어요" },
  { value: "own", label: "자사 팝업", help: "덕지가 직접 여는 팝업. 예약·웨이팅을 덕지에서 받아요" },
  { value: "listing", label: "일반 팝업", help: "정보 소개만. 예약·웨이팅은 받지 않아요" },
]

export const CATEGORY_OPTIONS: { value: PopupEvent["category"]; label: string }[] = [
  { value: "anime", label: "애니메이션·캐릭터" },
  { value: "cafe", label: "콜라보 카페" },
  { value: "exhibition", label: "전시·페스티벌" },
  { value: "goods", label: "굿즈샵" },
  { value: "flagship", label: "DUCKJI 플래그십" },
]

export const RESERVATION_OPTIONS: { value: PopupEvent["reservationType"]; label: string }[] = [
  { value: "free", label: "자유 입장" },
  { value: "native", label: "덕지 예약" },
  { value: "naver", label: "네이버 예약" },
  { value: "onsite", label: "현장 대기" },
  { value: "ticket", label: "티켓 구매" },
]

type FormState = {
  id: string
  title: string
  subTitle: string
  category: PopupEvent["category"]
  categoryLabel: string
  startDate: string
  endDate: string
  operatingHours: string
  location: string
  venueName: string
  latitude: string
  longitude: string
  admission: string
  operationType: OperationType
  reservationType: PopupEvent["reservationType"]
  reservationLabel: string
  posterUrl: string
  galleryImages: string[]
  description: string
  highlights: string
  perks: string
  officialUrl: string
  sourceName: string
  sourceUrl: string
  sortOrder: string
  isPublished: boolean
  isFeatured: boolean
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean)

const toForm = (p: PopupEvent | null, defaults: { sortOrder: number; operationType?: OperationType }): FormState => ({
  id: p?.id || "",
  title: p?.title || "",
  subTitle: p?.subTitle || "",
  category: p?.category || "anime",
  categoryLabel: p?.categoryLabel || "",
  startDate: p?.startDate || "",
  endDate: p?.endDate || "",
  operatingHours: p?.operatingHours || "",
  location: p?.location || "",
  venueName: p?.venueName || "",
  latitude: p?.latitude?.toString() ?? "",
  longitude: p?.longitude?.toString() ?? "",
  admission: p?.admission || "",
  operationType: p?.operationType || defaults.operationType || "listing",
  reservationType: p?.reservationType || "free",
  reservationLabel: p?.reservationLabel || "",
  posterUrl: p?.posterUrl || "",
  galleryImages: p?.galleryImages || [],
  description: p?.description || "",
  highlights: (p?.highlights || []).join("\n"),
  perks: (p?.perks || []).join("\n"),
  officialUrl: p?.officialUrl || "",
  sourceName: p?.sourceName || "",
  sourceUrl: p?.sourceUrl || "",
  sortOrder: String(p?.sortOrder ?? defaults.sortOrder),
  isPublished: p ? p.isPublished !== false : true,
  isFeatured: Boolean(p?.isFeatured),
})

// ID 를 비워 두면 시작일·임의 글자로 만듦 (예: popup-20261020-k3f9)
const autoId = (startDate: string) => `popup-${(startDate || new Date().toISOString().slice(0, 10)).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6)}`

const toPayload = (f: FormState): Partial<PopupEvent> => ({
  ...f,
  id: f.id.trim() || autoId(f.startDate),
  categoryLabel: f.categoryLabel.trim() || CATEGORY_OPTIONS.find((o) => o.value === f.category)?.label || "",
  reservationLabel: f.reservationLabel.trim() || RESERVATION_OPTIONS.find((o) => o.value === f.reservationType)?.label || "",
  latitude: f.latitude.trim() === "" ? null : Number(f.latitude),
  longitude: f.longitude.trim() === "" ? null : Number(f.longitude),
  highlights: lines(f.highlights),
  perks: lines(f.perks),
  officialUrl: f.officialUrl || undefined,
  sortOrder: Number(f.sortOrder) || 0,
  ...(f.category === "flagship" ? { isFlagship: true } : {}),
})

export const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600 disabled:opacity-60"

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-3 lg:gap-6 py-5 border-t border-zinc-800 first:border-t-0 first:pt-0">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">{children}</div>
    </section>
  )
}

export function PopupForm({
  popup,
  defaults,
  onCancel,
  onSaved,
}: {
  popup: PopupEvent | null
  defaults: { sortOrder: number; operationType?: OperationType }
  onCancel: () => void
  onSaved: (popup: PopupEvent) => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(popup, defaults))
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const payload = toPayload(form)
    const result = popup ? await updatePopup(popup.id, payload) : await createPopup(payload)
    setIsSaving(false)
    if (!result.success) {
      setErrors(result.errors)
      return
    }
    onSaved(result.popup)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      <Section title="기본 정보">
        <Field label="팝업 이름" wide>
          <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 주술회전 POP-UP STORE in 서울" required />
        </Field>
        <Field label="한 줄 소개" wide>
          <input className={inputClass} value={form.subTitle} onChange={(e) => set("subTitle", e.target.value)} placeholder="목록과 상세 제목 아래에 보이는 문구" />
        </Field>
      </Section>

      <Section title="분류">
        <div className="sm:col-span-2 space-y-1.5">
          <span className="text-xs font-semibold text-zinc-300">팝업 종류</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {OPERATION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set("operationType", o.value)}
                aria-pressed={form.operationType === o.value}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  form.operationType === o.value ? "border-sky-600 bg-sky-950/40" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                }`}
              >
                <div className="text-sm font-semibold text-white">{o.label}</div>
                <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{o.help}</div>
              </button>
            ))}
          </div>
        </div>
        <Field label="카테고리">
          <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value as FormState["category"])}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="카테고리 표시 문구" hint="비우면 카테고리 이름을 그대로 씁니다">
          <input className={inputClass} value={form.categoryLabel} onChange={(e) => set("categoryLabel", e.target.value)} placeholder={CATEGORY_OPTIONS.find((o) => o.value === form.category)?.label} />
        </Field>
      </Section>

      <Section title="일정">
        <Field label="시작일">
          <DatePicker className={inputClass} value={form.startDate} max={form.endDate || undefined} onChange={(v) => set("startDate", v)} required />
        </Field>
        <Field label="종료일">
          <DatePicker className={inputClass} value={form.endDate} min={form.startDate || undefined} onChange={(v) => set("endDate", v)} required />
        </Field>
        <Field label="운영 시간" wide>
          <input className={inputClass} value={form.operatingHours} onChange={(e) => set("operatingHours", e.target.value)} placeholder="예: 매일 10:30 ~ 20:00 (금·토 21:00까지)" />
        </Field>
      </Section>

      <Section title="장소">
        <LocationFields form={form} set={set} />
      </Section>

      <Section title="입장·예약">
        <Field label="입장 안내" wide>
          <input className={inputClass} value={form.admission} onChange={(e) => set("admission", e.target.value)} placeholder="예: 무료 입장 / 1인 5,000원" />
        </Field>
        <Field label="예약 방식">
          <select className={inputClass} value={form.reservationType} onChange={(e) => set("reservationType", e.target.value as FormState["reservationType"])}>
            {RESERVATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="예약 안내 문구" hint="비우면 예약 방식 이름을 씁니다">
          <input className={inputClass} value={form.reservationLabel} onChange={(e) => set("reservationLabel", e.target.value)} />
        </Field>
        {form.operationType !== "listing" && (
          <p className="sm:col-span-2 text-xs text-zinc-400">덕지 예약·현장 웨이팅은 저장한 뒤 &apos;팝업 예약·웨이팅&apos; 메뉴에서 시간대를 열고 켭니다.</p>
        )}
      </Section>

      <Section title="사진">
        <div className="sm:col-span-2">
          <ImageUploadField label="포스터 (대표 사진)" target="popups" value={form.posterUrl} onChange={(v) => set("posterUrl", v)} />
        </div>
        <div className="sm:col-span-2">
          <ImageListUploadField label="추가 사진" target="popups" value={form.galleryImages} onChange={(v) => set("galleryImages", v)} />
        </div>
      </Section>

      <Section title="소개">
        <Field label="소개 글" wide>
          <textarea className={inputClass} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="볼거리" hint="한 줄에 하나씩">
          <textarea className={inputClass} rows={4} value={form.highlights} onChange={(e) => set("highlights", e.target.value)} />
        </Field>
        <Field label="방문·구매 혜택" hint="한 줄에 하나씩">
          <textarea className={inputClass} rows={4} value={form.perks} onChange={(e) => set("perks", e.target.value)} />
        </Field>
      </Section>

      <Section title="링크·출처">
        <Field label="공식 페이지 주소" wide>
          <input className={inputClass} value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} placeholder="https://" />
        </Field>
        <Field label="정보 출처">
          <input className={inputClass} value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} placeholder="예: 공식 인스타그램" />
        </Field>
        <Field label="출처 주소">
          <input className={inputClass} value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://" />
        </Field>
      </Section>

      <Section title="공개 설정">
        <Field label="팝업 ID" hint={popup ? "등록 후에는 바꿀 수 없어요" : "비우면 자동으로 만들어요. 영문 소문자·숫자·하이픈"}>
          <input className={`${inputClass} font-mono`} value={form.id} disabled={Boolean(popup)} onChange={(e) => set("id", e.target.value)} placeholder="예: jujutsu-popup-2026" />
        </Field>
        <Field label="노출 순서" hint="작을수록 앞에 보여요">
          <input className={inputClass} type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
        </Field>
        <div className="sm:col-span-2 flex flex-wrap gap-5 text-sm text-zinc-200">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-sky-600" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            사이트에 공개
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-sky-600" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
            추천 팝업으로 표시
          </label>
        </div>
        {!form.isPublished && <p className="sm:col-span-2 text-xs text-zinc-400">공개하지 않으면 &apos;등록 대기 팝업&apos;에 들어가 사이트에는 보이지 않아요.</p>}
      </Section>

      {errors.length > 0 && (
        <ul className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-1 list-disc pl-6">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2 pt-5 border-t border-zinc-800">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold">
          취소
        </button>
        <button type="submit" disabled={isSaving} className="px-6 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50">
          {isSaving ? "저장 중..." : popup ? "수정 저장" : "등록"}
        </button>
      </div>
    </form>
  )
}

// ---- 장소: 장소 이름 직접 입력 + 주소 검색 → 지도 위치 ----

function LocationFields({ form, set }: { form: FormState; set: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)
  const lat = Number(form.latitude)
  const lng = Number(form.longitude)
  const hasPoint = form.latitude.trim() !== "" && form.longitude.trim() !== "" && Number.isFinite(lat) && Number.isFinite(lng)

  const setPoint = (la: number, ln: number) => {
    set("latitude", la.toFixed(6))
    set("longitude", ln.toFixed(6))
  }

  const locate = async (address: string) => {
    if (!address.trim()) return
    setBusy(true)
    setNote(null)
    try {
      const r = await geocodeAddress(address)
      setPoint(r.lat, r.lng)
      setNote({ ok: true, text: "주소로 지도 위치를 찾았어요. 위치가 다르면 지도를 눌러 옮겨주세요." })
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "주소로 위치를 찾지 못했어요." })
    } finally {
      setBusy(false)
    }
  }

  const pickAddress = async () => {
    try {
      const r = await searchAddress()
      if (!r) return
      set("location", r.address)
      await locate(r.address)
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "주소 검색을 열지 못했어요." })
    }
  }

  return (
    <>
      <div className="sm:col-span-2 space-y-1.5">
        <span className="text-xs font-semibold text-zinc-300">장소 찾기</span>
        <PlaceSearch
          inputClass={inputClass}
          onPick={(p) => {
            if (!form.venueName.trim()) set("venueName", p.name)
            set("location", p.address)
            setPoint(p.lat, p.lng)
            setNote({ ok: true, text: `'${p.name}' 위치로 정했어요. 자리가 다르면 지도를 눌러 옮겨주세요.` })
          }}
        />
        <span className="block text-xs text-zinc-500">네이버에 등록된 매장·건물이면 이름으로 찾아 장소 이름·주소·지도 위치를 한 번에 채워요. 없으면 아래에 직접 적어주세요.</span>
      </div>
      <Field label="장소 이름" hint="사이트에 보이는 이름이에요. 건물·매장 이름을 직접 적어주세요" wide>
        <input className={inputClass} value={form.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="예: 더현대 서울 B1 이벤트홀" />
      </Field>
      <div className="sm:col-span-2 space-y-1.5">
        <span className="text-xs font-semibold text-zinc-300">주소</span>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            onBlur={() => !hasPoint && form.location.trim() && NAVER_MAP_KEY && locate(form.location)}
            placeholder="주소 검색을 누르거나 직접 입력"
          />
          <button type="button" onClick={pickAddress} className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-100">
            <Search className="w-4 h-4" />
            주소 검색
          </button>
        </div>
      </div>

      <div className="sm:col-span-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-300">지도 위치</span>
          <div className="flex items-center gap-3 text-xs">
            {form.location.trim() && NAVER_MAP_KEY && (
              <button type="button" disabled={busy} onClick={() => locate(form.location)} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white disabled:opacity-50">
                <Crosshair className="w-3.5 h-3.5" />
                {busy ? "찾는 중..." : "주소로 다시 찾기"}
              </button>
            )}
            <button type="button" onClick={() => setManual((v) => !v)} className="text-zinc-400 hover:text-white underline underline-offset-2">
              {manual ? "좌표 칸 닫기" : "좌표 직접 입력"}
            </button>
          </div>
        </div>
        {NAVER_MAP_KEY ? (
          <PointPicker lat={hasPoint ? lat : null} lng={hasPoint ? lng : null} onPick={(la, ln) => {
            setPoint(la, ln)
            setNote({ ok: true, text: "지도에서 고른 위치로 정했어요." })
          }} />
        ) : (
          <p className="text-xs text-zinc-500">지도 키가 없어 지도를 띄울 수 없어요. 좌표를 직접 입력해주세요.</p>
        )}
        <div className="text-xs text-zinc-400">
          {hasPoint ? `위도 ${lat.toFixed(5)} · 경도 ${lng.toFixed(5)}` : "아직 위치가 없어요. 위치가 없으면 지도·일정 화면에 표시되지 않아요."}
        </div>
        {note && <p className={`text-xs ${note.ok ? "text-emerald-300" : "text-amber-300"}`}>{note.text}</p>}
        {(manual || !NAVER_MAP_KEY) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="위도">
              <input className={inputClass} value={form.latitude} onChange={(e) => set("latitude", e.target.value)} inputMode="decimal" placeholder="37.5583" />
            </Field>
            <Field label="경도">
              <input className={inputClass} value={form.longitude} onChange={(e) => set("longitude", e.target.value)} inputMode="decimal" placeholder="127.1648" />
            </Field>
          </div>
        )}
      </div>
    </>
  )
}

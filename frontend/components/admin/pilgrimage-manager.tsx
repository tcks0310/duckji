"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Crosshair, ExternalLink, Footprints, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageListUploadField, ImageUploadField } from "@/components/admin/image-upload-field"
import { RouteMap } from "@/components/map/route-map"
import { NAVER_MAP_KEY } from "@/components/map/naver-map"
import { geocodeAddress } from "@/lib/geocode"
import { fetchWalkRoute } from "@/lib/walk-route"
import { searchAddress } from "@/lib/postcode"
import { PointPicker } from "@/components/admin/point-picker"
import { PlaceSearch } from "@/components/admin/place-search"
import { RouteList } from "@/components/pilgrimage/course-view"
import { apiFetch } from "@/lib/api"
import { courseDetailHref, fullAddress, legBetween, naverMapLink, stepPalette, type PilgrimageCourseInfo, type RouteLeg, type PilgrimageSpotInfo } from "@/lib/pilgrimage"

// 관리자 '덕지순례 관리' 탭 (backend rewards 서비스 /api/rewards/admin/pilgrimage)
// 코스(소개·사진·보상)와 순서 있는 장소(이름·주소 검색 → 지도 핀 → 찾아가는 설명, 다음 장소까지)를 만들고 공개
// 코스를 누르면 상세: 장소·숫자와 그 코스에 남은 후기(숨김·삭제)
// 회원 휴대폰 위치가 핀 반경 안이어야 도장과 DP 가 나가므로 길 위 포토스팟은 지도에서 핀을 그 자리로 옮김

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const labelClass = "text-xs font-semibold text-zinc-400"
const btn = "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg h-auto py-2"
const btnPrimary = "bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg h-auto py-2"

type AdminSpot = PilgrimageSpotInfo & { visits: number }
type AdminCourse = Omit<PilgrimageCourseInfo, "spots"> & {
  published: boolean
  sortOrder: number
  checkins: number
  hiddenReviews: number
  updatedAt: string
  spots: AdminSpot[]
}
type AdminReview = { courseId: string; courseTitle: string; memberId: string; memberName: string; rating: number; comment: string; hidden: boolean; updatedAt: string }

async function call<T = any>(path: string, method = "GET", json?: unknown): Promise<T> {
  const res = await apiFetch(`/api/rewards/admin/pilgrimage${path}`, {
    method,
    cache: "no-store",
    headers: json === undefined ? undefined : { "Content-Type": "application/json" },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "요청을 처리하지 못했습니다.")
  return body
}

function ErrorLine({ error }: { error: string }) {
  return error ? <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div> : null
}

export function PilgrimageManager() {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<AdminCourse | "new" | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () =>
    call<{ courses: AdminCourse[] }>("")
      .then((r) => {
        setCourses(r.courses)
        setLoaded(true)
      })
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const togglePublish = async (c: AdminCourse) => {
    setError("")
    try {
      const r = await call<{ courses: AdminCourse[] }>(`/courses/${c.id}/publish`, "PATCH", { published: !c.published })
      setCourses(r.courses)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const remove = async (c: AdminCourse) => {
    if (!window.confirm(`'${c.title}' 코스를 지울까요? 후기도 함께 지워집니다.`)) return false
    setError("")
    try {
      const r = await call<{ courses: AdminCourse[] }>(`/courses/${c.id}`, "DELETE")
      setCourses(r.courses)
      return true
    } catch (e: any) {
      setError(e.message)
      return false
    }
  }

  const published = courses.filter((c) => c.published).length
  const totals = courses.reduce(
    (t, c) => ({ checkins: t.checkins + c.checkins, completions: t.completions + c.completions, reviews: t.reviews + c.reviewCount }),
    { checkins: 0, completions: 0, reviews: 0 }
  )

  if (editing) {
    return (
      <CourseEditor
        course={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={(list) => {
          setCourses(list)
          setEditing(null)
        }}
      />
    )
  }

  const opened = openId ? courses.find((c) => c.id === openId) : null
  if (opened) {
    return (
      <CourseDetailView
        course={opened}
        error={error}
        onBack={() => setOpenId(null)}
        onEdit={() => setEditing(opened)}
        onTogglePublish={() => togglePublish(opened)}
        onRemove={async () => {
          if (await remove(opened)) setOpenId(null)
        }}
        onChanged={load}
      />
    )
  }

  return (
    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg text-white">덕지순례</h3>
          <p className="text-xs text-zinc-400">
            공개한 덕지순례만 사이트에 보이고 도장을 찍을 수 있어요. 덕지순례를 누르면 장소와 남겨진 후기를 볼 수 있어요.
          </p>
        </div>
        <Button size="sm" className={`${btnPrimary} px-4`} onClick={() => setEditing("new")}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          덕지순례 추가
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["전체", `${courses.length}개`],
          ["공개 중", `${published}개`],
          ["도장 · 완주", `${totals.checkins.toLocaleString()} · ${totals.completions.toLocaleString()}`],
          ["후기", `${totals.reviews.toLocaleString()}개`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="text-lg font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <ErrorLine error={error} />

      {!loaded ? (
          <p className="text-xs text-zinc-400">불러오는 중...</p>
        ) : courses.length === 0 ? (
          <p className="text-xs text-zinc-400">아직 덕지순례가 없습니다. '덕지순례 추가'로 첫 덕지순례를 만들어 주세요.</p>
        ) : (
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
            {courses.map((c) => (
              <div key={c.id} onClick={() => setOpenId(c.id)} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-zinc-900/60">
                <div className="w-full sm:w-24 h-28 sm:h-16 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                  {c.coverImage && <img src={c.coverImage} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${c.published ? "bg-sky-900/60 text-sky-200" : "bg-zinc-800 text-zinc-400"}`}>
                      {c.published ? "공개" : "비공개"}
                    </span>
                    <span className="text-sm font-semibold text-white">{c.title}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {[c.region, `장소 ${c.spots.length}곳`, c.durationText, `완주 보상 ${c.rewardDp} DP`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-xs text-zinc-500">
                    도장 {c.checkins.toLocaleString()} · 완주 {c.completions.toLocaleString()}명 · 후기 {c.reviewCount}
                    {c.hiddenReviews > 0 && ` (숨김 ${c.hiddenReviews})`} · 평균 {c.avgRating !== null ? `★ ${c.avgRating.toFixed(1)}` : "-"}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-300 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={c.published} onChange={() => togglePublish(c)} className="accent-sky-600" />
                    공개
                  </label>
                  <button className="underline underline-offset-2" onClick={() => setEditing(c)}>
                    고치기
                  </button>
                  {c.published && (
                    <a className="underline underline-offset-2" href={courseDetailHref(c.id)} target="_blank" rel="noreferrer">
                      사이트에서 보기
                    </a>
                  )}
                  <button className="underline underline-offset-2 text-zinc-400 hover:text-red-300" onClick={() => remove(c)}>
                    지우기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ---- 덕지순례 상세: 장소 · 숫자 · 이 덕지순례의 후기 ----

function CourseDetailView({
  course: c,
  error,
  onBack,
  onEdit,
  onTogglePublish,
  onRemove,
  onChanged,
}: {
  course: AdminCourse
  error: string
  onBack: () => void
  onEdit: () => void
  onTogglePublish: () => void
  onRemove: () => void
  onChanged: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" className={`${btn} px-3`} onClick={onBack}>
            목록
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {c.published && (
              <a className={`${btn} px-3 inline-flex items-center gap-1`} href={courseDetailHref(c.id)} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                사이트에서 보기
              </a>
            )}
            <Button size="sm" className={`${btn} px-3`} onClick={onTogglePublish}>
              {c.published ? "비공개로" : "공개하기"}
            </Button>
            <Button size="sm" className={`${btnPrimary} px-3`} onClick={onEdit}>
              고치기
            </Button>
            <Button size="sm" className="bg-transparent hover:bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold rounded-lg h-auto py-2 px-3" onClick={onRemove}>
              지우기
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-48 aspect-[16/9] rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0">
            {c.coverImage && <img src={c.coverImage} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 space-y-1.5">
            <span className={`px-1.5 py-0.5 rounded text-xs ${c.published ? "bg-sky-900/60 text-sky-200" : "bg-zinc-800 text-zinc-400"}`}>{c.published ? "공개" : "비공개"}</span>
            <h3 className="text-xl font-semibold text-white">{c.title}</h3>
            {c.summary && <p className="text-sm text-zinc-400">{c.summary}</p>}
            <p className="text-xs text-zinc-500">{[c.region, c.theme, c.durationText, `완주 보상 ${c.rewardDp} DP`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["도장", c.checkins.toLocaleString()],
            ["완주", `${c.completions.toLocaleString()}명`],
            ["후기", `${c.reviewCount}개${c.hiddenReviews ? ` (숨김 ${c.hiddenReviews})` : ""}`],
            ["평균 별점", c.avgRating !== null ? `★ ${c.avgRating.toFixed(1)}` : "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs text-zinc-400">{label}</div>
              <div className="text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <ErrorLine error={error} />
      </div>

      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <h4 className="text-sm font-semibold text-white">장소 {c.spots.length}곳</h4>
        <ol className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
          {c.spots.map((s, i) => (
            <li key={s.id} className="p-3 flex items-start gap-3 text-sm">
              <span className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${stepPalette(i).cls}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-white font-medium">{s.name}</div>
                <div className="text-xs text-zinc-500">{fullAddress(s) || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}</div>
              </div>
              <span className="text-xs text-zinc-400 shrink-0">도장 {s.visits.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <h4 className="text-sm font-semibold text-white">후기</h4>
        <CourseReviewsAdmin courseId={c.id} onChanged={onChanged} />
      </div>
    </div>
  )
}

// ---- 코스 편집 ----

type SpotForm = {
  key: string
  id: string
  name: string
  address: string
  addressDetail: string
  lat: string
  lng: string
  imageUrl: string
  description: string
  stayTime: string
  nextMove: string
  radiusM: string
  visits: number
}

let keySeq = 0
const blankSpot = (): SpotForm => ({
  key: `n${++keySeq}`,
  id: "",
  name: "",
  address: "",
  addressDetail: "",
  lat: "",
  lng: "",
  imageUrl: "",
  description: "",
  stayTime: "",
  nextMove: "",
  radiusM: "300",
  visits: 0,
})

const toSpotForm = (s: AdminSpot): SpotForm => ({
  key: s.id,
  id: s.id,
  name: s.name,
  address: s.address,
  addressDetail: s.addressDetail || "",
  lat: String(s.lat),
  lng: String(s.lng),
  imageUrl: s.imageUrl,
  description: s.description,
  stayTime: s.stayTime,
  nextMove: s.nextMove,
  radiusM: String(s.radiusM),
  visits: s.visits,
})

function CourseEditor({ course, onCancel, onSaved }: { course: AdminCourse | null; onCancel: () => void; onSaved: (list: AdminCourse[]) => void }) {
  const [form, setForm] = useState({
    title: course?.title || "",
    summary: course?.summary || "",
    coverImage: course?.coverImage || "",
    gallery: course?.gallery || [],
    theme: course?.theme || "",
    tags: (course?.tags || []).join(", "),
    region: course?.region || "",
    durationText: course?.durationText || "",
    rewardDp: String(course?.rewardDp ?? 300),
    sortOrder: String(course?.sortOrder ?? 0),
    published: course?.published ?? false,
  })
  const [spots, setSpots] = useState<SpotForm[]>(course?.spots.length ? course.spots.map(toSpotForm) : [blankSpot(), blankSpot()])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  // 장소 사이 걷는 길 (카카오 도보). 저장할 때 바뀐 구간만 다시 찾음
  const [legs, setLegs] = useState<(RouteLeg | null)[]>(course?.routeLegs || [])
  const [routing, setRouting] = useState(false)
  const [routeNote, setRouteNote] = useState("")
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const setSpot = (i: number, patch: Partial<SpotForm>) => setSpots((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i: number, d: -1 | 1) =>
    setSpots((list) => {
      const next = [...list]
      const j = i + d
      if (j < 0 || j >= next.length) return list
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const removeSpot = (i: number) => {
    const s = spots[i]
    if (s.visits > 0 && !window.confirm(`'${s.name}'에는 도장 기록이 ${s.visits}개 있어요. 빼면 사이트에서 사라지고 기록은 남습니다. 뺄까요?`)) return
    setSpots((list) => list.filter((_, j) => j !== i))
  }

  // 핀이 있는 장소 순서대로 걷는 길을 맞춤. force 가 아니면 이미 있는 구간은 다시 부르지 않음
  const ensureLegs = async (force = false): Promise<(RouteLeg | null)[]> => {
    const pts = spots
      .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng), ok: s.lat.trim() !== "" && s.lng.trim() !== "" }))
      .filter((p) => p.ok && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(({ lat, lng }) => ({ lat, lng }))
    if (pts.length < 2) return []
    const current = pts.slice(0, -1).map((a, i) => legBetween(legs, a, pts[i + 1]))
    if (!force && current.every(Boolean)) return current
    setRouting(true)
    setRouteNote("")
    try {
      const r = await fetchWalkRoute(pts)
      if (!r.configured) {
        setRouteNote("걷는 길 찾기 키가 아직 서버에 없어 직선으로 보여요.")
        return current
      }
      const next = r.legs.map((l, i) => l ?? current[i] ?? null)
      setLegs(next)
      const missing = next.filter((l) => !l).length
      setRouteNote(missing ? `${missing}구간은 걷는 길을 못 찾아 직선으로 보여요.${r.error ? ` (${r.error.slice(0, 160)})` : ""}` : "모든 구간을 걷는 길로 이었어요.")
      return next
    } catch (err: any) {
      setRouteNote(`걷는 길을 찾지 못해 직선으로 보여요. ${err?.message || ""}`)
      return current
    } finally {
      setRouting(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    const routeLegs = await ensureLegs()
    const body = {
      routeLegs,
      ...form,
      rewardDp: Number(form.rewardDp),
      sortOrder: Number(form.sortOrder) || 0,
      tags: form.tags.split(/[,\s]+/).filter(Boolean),
      spots: spots.map((s) => ({
        id: s.id || undefined,
        name: s.name,
        address: s.address,
        addressDetail: s.addressDetail,
        lat: s.lat.trim() === "" ? "" : Number(s.lat),
        lng: s.lng.trim() === "" ? "" : Number(s.lng),
        imageUrl: s.imageUrl,
        description: s.description,
        stayTime: s.stayTime,
        nextMove: s.nextMove,
        radiusM: Number(s.radiusM) || 300,
      })),
    }
    try {
      const r = course
        ? await call<{ courses: AdminCourse[] }>(`/courses/${course.id}`, "PUT", body)
        : await call<{ courses: AdminCourse[] }>("/courses", "POST", body)
      onSaved(r.courses)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  // 미리보기 지도: 좌표가 있는 장소만
  const preview = spots
    .map((s, i) => ({ s, i, lat: Number(s.lat), lng: Number(s.lng) }))
    .filter((p) => p.s.lat.trim() && p.s.lng.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const previewSpots: PilgrimageSpotInfo[] = preview.map(({ s, lat, lng }) => ({
    id: s.key,
    name: s.name || "(이름 없음)",
    address: s.address,
    addressDetail: s.addressDetail,
    lat,
    lng,
    imageUrl: "",
    description: "",
    stayTime: "",
    nextMove: "",
    radiusM: 300,
  }))

  const pinned = previewSpots.length
  const missingPin = spots.length - pinned

  return (
    <form onSubmit={save} className="rounded-2xl bg-zinc-900 border border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800">
        <div>
          <h3 className="font-semibold text-lg text-white">{course ? "덕지순례 수정" : "새 덕지순례"}</h3>
          <p className="text-xs text-zinc-400">위에서부터 차례로 채우면 돼요. 별표(*)는 꼭 넣어야 하는 칸이에요.</p>
        </div>
        <Button type="button" size="sm" className={`${btn} px-4`} onClick={onCancel}>
          목록으로
        </Button>
      </div>

      <div className="px-6 py-2">
        <EditorSection title="기본 정보" hint="목록과 상세 맨 위에 보이는 내용이에요.">
          <Field label="이름 *" wide>
            <input className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="예: 성수 팝업 반나절 코스" required maxLength={200} />
          </Field>
          <Field label="한두 줄 소개" wide hint={`${form.summary.length}/500`}>
            <textarea className={`${inputClass} min-h-[72px]`} value={form.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={500} placeholder="어떤 코스인지, 누구에게 좋은지" />
          </Field>
        </EditorSection>

        <EditorSection title="안내" hint="목록 카드에 작게 붙는 정보예요.">
          <Field label="지역">
            <input className={inputClass} value={form.region} onChange={(e) => set({ region: e.target.value })} placeholder="예: 성수·서울숲" maxLength={50} />
          </Field>
          <Field label="테마">
            <input className={inputClass} value={form.theme} onChange={(e) => set({ theme: e.target.value })} placeholder="예: 팝업 & 카페" maxLength={50} />
          </Field>
          <Field label="예상 소요 시간">
            <input className={inputClass} value={form.durationText} onChange={(e) => set({ durationText: e.target.value })} placeholder="예: 약 3시간" maxLength={50} />
          </Field>
          <Field label="태그" hint="쉼표로 나눠 적어주세요">
            <input className={inputClass} value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="예: 성수, 팝업, 카페" />
          </Field>
        </EditorSection>

        <EditorSection title="사진" hint="대표 사진은 목록 카드와 상세 맨 위에 쓰여요.">
          <ImageUploadField label="대표 사진" value={form.coverImage} onChange={(v) => set({ coverImage: v })} target="pilgrimage" />
          <ImageListUploadField label="추가 사진 (10장까지)" value={form.gallery} onChange={(v) => set({ gallery: v })} target="pilgrimage" max={10} />
        </EditorSection>

        <section className="py-5 border-t border-zinc-800 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">장소 ({spots.length}곳)</h4>
              <p className="text-xs text-zinc-500">걷는 순서대로 넣어주세요. 1번이 출발, 마지막이 도착이에요. 장소를 누르면 펼쳐져요.</p>
            </div>
            <Button type="button" size="sm" className={`${btn} px-3`} onClick={() => setSpots((l) => [...l, blankSpot()])} disabled={spots.length >= 12}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              장소 추가
            </Button>
          </div>
          <div className="space-y-2">
            {spots.map((s, i) => (
              <SpotEditor
                key={s.key}
                spot={s}
                index={i}
                count={spots.length}
                onChange={(patch) => setSpot(i, patch)}
                onMove={(d) => move(i, d)}
                onRemove={() => removeSpot(i)}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">동선 미리보기</span>
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                {missingPin > 0 ? `핀이 없는 장소 ${missingPin}곳은 빠져 있어요` : "모든 장소가 지도에 있어요"}
                {pinned > 1 && (
                  <button type="button" disabled={routing} onClick={() => ensureLegs(true)} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white disabled:opacity-50">
                    <Footprints className="w-3.5 h-3.5" />
                    {routing ? "걷는 길 찾는 중..." : "걷는 길 다시 찾기"}
                  </button>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {routeNote || "저장할 때 장소 사이를 실제 걷는 길로 이어요. 실선은 걷는 길, 점선은 아직 직선인 구간이에요."}
            </p>
            {pinned ? (
              <RouteMap
                points={previewSpots.map((p) => ({ lat: p.lat, lng: p.lng, title: p.name }))}
                legs={legs}
                className="w-full h-72 rounded-xl overflow-hidden border border-zinc-800"
                fallback={<RouteList spots={previewSpots} />}
              />
            ) : (
              <p className="text-xs text-zinc-500 rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center">장소의 핀을 정하면 번호 순서대로 선이 이어져 여기 보여요.</p>
            )}
          </div>
        </section>

        <EditorSection title="보상·공개" hint="공개해야 사이트에 보이고 도장을 찍을 수 있어요.">
          <Field label="완주 보상 (DP)" hint="장소마다 주는 100 DP 와 따로 줘요">
            <input className={inputClass} type="number" min={0} max={5000} value={form.rewardDp} onChange={(e) => set({ rewardDp: e.target.value })} />
          </Field>
          <Field label="목록 순서" hint="작을수록 앞에 보여요">
            <input className={inputClass} type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex gap-2">
            {[
              { v: false, label: "비공개", desc: "관리자만 봐요" },
              { v: true, label: "공개", desc: "사이트에 보이고 도장을 찍을 수 있어요" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => set({ published: o.v })}
                className={`flex-1 text-left rounded-lg border px-4 py-3 ${form.published === o.v ? "border-sky-600 bg-sky-950/40" : "border-zinc-800 hover:border-zinc-700"}`}
              >
                <div className="text-sm font-semibold text-white">{o.label}</div>
                <div className="text-xs text-zinc-400">{o.desc}</div>
              </button>
            ))}
          </div>
        </EditorSection>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 px-6 py-3 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur rounded-b-2xl">
        {error && <span className="mr-auto text-xs text-amber-300">{error}</span>}
        <Button type="button" size="sm" className={`${btn} px-4`} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="sm" className={`${btnPrimary} px-5`} disabled={saving}>
          {saving ? "저장 중..." : course ? "수정 저장" : "등록"}
        </Button>
      </div>
    </form>
  )
}

function EditorSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-3 lg:gap-6 py-5 border-t border-zinc-800 first:border-t-0">
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">{children}</div>
    </section>
  )
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

function SpotEditor({
  spot: s,
  index: i,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  spot: SpotForm
  index: number
  count: number
  onChange: (patch: Partial<SpotForm>) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(!s.id)
  const [finding, setFinding] = useState(false)
  const [manual, setManual] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const lat = Number(s.lat)
  const lng = Number(s.lng)
  const hasPos = s.lat.trim() !== "" && s.lng.trim() !== "" && Number.isFinite(lat) && Number.isFinite(lng)
  const setPoint = (la: number, ln: number) => onChange({ lat: la.toFixed(6), lng: ln.toFixed(6) })

  const locate = async (address: string) => {
    if (!address.trim() || !NAVER_MAP_KEY) return
    setFinding(true)
    setNote(null)
    try {
      const r = await geocodeAddress(address.trim())
      setPoint(r.lat, r.lng)
      setNote({ ok: true, text: "주소 위치에 핀을 꽂았어요. 길 위 포토스팟이면 지도를 눌러 실제 자리로 옮겨주세요." })
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "주소로 위치를 찾지 못했어요. 지도를 눌러 자리를 골라주세요." })
    } finally {
      setFinding(false)
    }
  }

  const pickAddress = async () => {
    try {
      const r = await searchAddress()
      if (!r) return
      onChange({ address: r.address })
      await locate(r.address)
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "주소 검색을 열지 못했어요." })
    }
  }

  return (
    <div className={`rounded-xl border bg-zinc-950 ${open ? "border-zinc-700" : "border-zinc-800"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <span className={`w-7 h-7 shrink-0 rounded-full text-xs font-bold flex items-center justify-center ${stepPalette(i).cls}`}>{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white truncate">
              {s.name || "이름 없는 장소"}
              <span className="ml-2 text-xs font-normal text-zinc-500">{i === 0 ? "출발" : i === count - 1 ? "도착" : ""}</span>
              {s.visits > 0 && <span className="ml-2 text-xs font-normal text-zinc-400">도장 {s.visits}개</span>}
            </span>
            <span className="block text-xs text-zinc-500 truncate">
              {fullAddress(s) || "주소 없음"} · {hasPos ? "핀 있음" : <span className="text-amber-300">핀 없음</span>}
            </span>
          </span>
          {open ? <ChevronUp className="w-4 h-4 shrink-0 text-zinc-500" /> : <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500" />}
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={i === 0} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-800 disabled:opacity-30" aria-label="위로">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={i === count - 1} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-800 disabled:opacity-30" aria-label="아래로">
            <ArrowDown className="w-4 h-4" />
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-red-300" aria-label="빼기">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {open && (
      <div className="grid gap-4 sm:grid-cols-2 px-4 pb-4 pt-1 border-t border-zinc-800/70">
        <div className="space-y-1 sm:col-span-2">
          <span className={labelClass}>위치 찾기</span>
          <PlaceSearch
            inputClass={inputClass}
            placeholder="장소 이름이나 주소 (예: AK플라자 홍대, 연무장길 47)"
            onPick={(p) => {
              onChange({ ...(s.name.trim() ? {} : { name: p.name }), address: p.address, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) })
              setNote({ ok: true, text: `'${p.name}' 위치에 핀을 꽂았어요. 길 위 포토스팟이면 지도를 눌러 실제 자리로 옮겨주세요.` })
            }}
          />
          <p className="text-xs text-zinc-500">
            검색 한 번으로 이름·주소·지도 핀이 채워져요. 결과가 없으면{" "}
            <button type="button" onClick={pickAddress} className="text-zinc-300 hover:text-white underline underline-offset-2">
              도로명 주소로 고르기
            </button>
          </p>
        </div>
        <label className="space-y-1">
          <span className={labelClass}>장소 이름 *</span>
          <input className={inputClass} value={s.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="예: 연무장길 벽화 포토스팟" maxLength={200} />
          <span className="block text-xs text-zinc-500">코스 화면에 장소 제목으로 보여요.</span>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>찾아가는 설명 (선택)</span>
          <input
            className={inputClass}
            value={s.addressDetail}
            onChange={(e) => onChange({ addressDetail: e.target.value })}
            placeholder="예: 2층 / 정문 앞 벽화"
            maxLength={200}
          />
          <span className="block text-xs text-zinc-500">화면에서 주소 뒤에 붙어 보여요.</span>
        </label>
        <p className="sm:col-span-2 text-xs text-zinc-400">
          화면에 보이는 주소: <span className="text-zinc-200">{fullAddress(s) || "아직 없어요. 위에서 위치를 찾아주세요."}</span>
        </p>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>도장 찍는 자리 (지도 핀)</span>
            <div className="flex items-center gap-3 text-xs">
              {s.address && NAVER_MAP_KEY && (
                <button type="button" disabled={finding} onClick={() => locate(s.address)} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white disabled:opacity-50">
                  <Crosshair className="w-3.5 h-3.5" />
                  {finding ? "찾는 중..." : "주소 위치로 되돌리기"}
                </button>
              )}
              {(s.address || s.name) && (
                <a href={naverMapLink(s)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-300 hover:text-white">
                  네이버 지도 <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button type="button" onClick={() => setManual((v) => !v)} className="text-zinc-400 hover:text-white underline underline-offset-2">
                {manual ? "좌표 칸 닫기" : "좌표 직접 입력"}
              </button>
            </div>
          </div>
          {NAVER_MAP_KEY ? (
            <PointPicker
              lat={hasPos ? lat : null}
              lng={hasPos ? lng : null}
              onPick={(la, ln) => {
                setPoint(la, ln)
                setNote({ ok: true, text: "핀을 고른 자리로 옮겼어요." })
              }}
            />
          ) : (
            <p className="text-xs text-zinc-500">지도 키가 없어 지도를 띄울 수 없어요. 좌표를 직접 입력해주세요.</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
            <span>{hasPos ? `핀 위치 ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "아직 핀이 없어요. 위에서 위치를 찾거나 지도를 눌러 자리를 정해주세요."}</span>
            <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
              인증 반경
              <input className={`${inputClass} w-20`} type="number" min={50} max={2000} value={s.radiusM} onChange={(e) => onChange({ radiusM: e.target.value })} />m
            </label>
          </div>
          {note && <p className={`text-xs ${note.ok ? "text-emerald-300" : "text-amber-300"}`}>{note.text}</p>}
          {(manual || !NAVER_MAP_KEY) && (
            <div className="flex flex-wrap gap-2">
              <input className={`${inputClass} w-36 sm:w-40`} value={s.lat} onChange={(e) => onChange({ lat: e.target.value })} placeholder="위도 37.5445" inputMode="decimal" />
              <input className={`${inputClass} w-36 sm:w-40`} value={s.lng} onChange={(e) => onChange({ lng: e.target.value })} placeholder="경도 127.0560" inputMode="decimal" />
            </div>
          )}
        </div>
        <label className="space-y-1 sm:col-span-2">
          <span className={labelClass}>짧은 설명</span>
          <textarea className={`${inputClass} min-h-[60px]`} value={s.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={500} placeholder="여기서 무엇을 하면 좋은지" />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>머무는 시간</span>
          <input className={inputClass} value={s.stayTime} onChange={(e) => onChange({ stayTime: e.target.value })} placeholder="예: 40분" maxLength={50} />
        </label>
        {i < count - 1 && (
          <label className="space-y-1">
            <span className={labelClass}>다음 장소까지</span>
            <input className={inputClass} value={s.nextMove} onChange={(e) => onChange({ nextMove: e.target.value })} placeholder="예: 도보 8분 / 2호선 2정거장" maxLength={100} />
          </label>
        )}
        <div className="sm:col-span-2">
          <ImageUploadField label="장소 사진" value={s.imageUrl} onChange={(v) => onChange({ imageUrl: v })} target="pilgrimage" />
        </div>
      </div>
      )}
    </div>
  )
}

// ---- 덕지순례 한 곳의 후기 (숨김·삭제) ----

function CourseReviewsAdmin({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [error, setError] = useState("")

  const load = () =>
    call<{ reviews: AdminReview[] }>(`/reviews?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => setReviews(r.reviews))
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [courseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (r: AdminReview, action: "hide" | "show" | "delete") => {
    if (action === "delete" && !window.confirm(`${r.memberName} 님의 후기를 지울까요?`)) return
    setError("")
    try {
      const path = `/reviews/${encodeURIComponent(r.courseId)}/${encodeURIComponent(r.memberId)}`
      if (action === "delete") await call(path, "DELETE")
      else await call(path, "PATCH", { hidden: action === "hide" })
      await load()
      onChanged()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-3">
      <ErrorLine error={error} />
      {!reviews ? (
        <p className="text-xs text-zinc-400">불러오는 중...</p>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-zinc-400">아직 남겨진 후기가 없습니다.</p>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
          {reviews.map((r) => (
            <div key={`${r.courseId}-${r.memberId}`} className={`p-3 flex flex-col sm:flex-row sm:items-center gap-2 ${r.hidden ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-xs text-zinc-400">
                  {r.memberName} ({r.memberId}) · {new Date(r.updatedAt).toLocaleString("ko-KR")}
                  {r.hidden && <span className="ml-1 text-amber-300">숨김</span>}
                </div>
                <div className="text-sm text-zinc-100">
                  <span className="text-amber-300 mr-2">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.comment}
                </div>
              </div>
              <div className="flex gap-3 text-xs text-zinc-300 shrink-0">
                <button className="underline underline-offset-2" onClick={() => act(r, r.hidden ? "show" : "hide")}>
                  {r.hidden ? "다시 보이기" : "숨기기"}
                </button>
                <button className="underline underline-offset-2 text-zinc-400 hover:text-red-300" onClick={() => act(r, "delete")}>
                  지우기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

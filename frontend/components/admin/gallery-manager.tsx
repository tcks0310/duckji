"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SquadsManager } from "@/components/admin/squads-manager"
import {
  REPORT_REASONS,
  REQUEST_CATEGORIES,
  adminGallery,
  formatPostDate,
  galleryHref,
  postHref,
  type AdminGallery,
  type GalleryGroup,
  type GalleryRequest,
  type GalleryStats,
  type AdminPostSummary,
  type ReportGroup,
} from "@/lib/community-api"
import { DatePicker } from "@/components/ui/date-picker"

// 관리자 · 덕지 갤러리 (한 곳에서): 요약 / 갤러리 구성 / 개설 요청 / 신고 / 글 관리 / 통계 / 스쿼드
// 백엔드 gallery 서비스 /api/galleries/admin/*

const input = "bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
const card = "p-5 rounded-2xl bg-zinc-900 border border-zinc-800"
const btn = "px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
const primary = "px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold text-white disabled:opacity-50"
const th = "p-3 text-xs font-semibold text-zinc-400"

type Sub = "summary" | "tree" | "requests" | "reports" | "posts" | "stats" | "squads"

export function GalleryManager({ onOpenMember }: { onOpenMember?: (memberId: string) => void }) {
  const [sub, setSub] = useState<Sub>("summary")
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof adminGallery.summary>> | null>(null)
  const [tree, setTree] = useState<{ groups: GalleryGroup[]; galleries: AdminGallery[] } | null>(null)
  const [error, setError] = useState("")

  const loadSummary = useCallback(() => adminGallery.summary().then(setSummary).catch((e) => setError(e.message)), [])
  const loadTree = useCallback(() => adminGallery.tree().then(setTree).catch((e) => setError(e.message)), [])
  useEffect(() => {
    loadSummary()
    loadTree()
  }, [loadSummary, loadTree])

  const tabs: { id: Sub; label: string }[] = [
    { id: "summary", label: "요약" },
    { id: "tree", label: "갤러리 구성" },
    { id: "requests", label: `개설 요청${summary?.pendingRequests ? ` ${summary.pendingRequests}` : ""}` },
    { id: "reports", label: `신고${summary?.openReports ? ` ${summary.openReports}` : ""}` },
    { id: "posts", label: "글 관리" },
    { id: "stats", label: "통계" },
    { id: "squads", label: "스쿼드" },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-white">덕지 갤러리</h3>
        <p className="text-sm text-zinc-400 mt-0.5">대분류·갤러리 구성, 개설 요청, 신고, 글, 통계, 스쿼드를 여기서 관리합니다.</p>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={sub === t.id}
            onClick={() => setSub(t.id)}
            className={`px-3.5 py-2 text-sm border-b-2 -mb-px ${sub === t.id ? "border-sky-500 text-white font-semibold" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-300">{error}</div>}

      {sub === "summary" && <Summary summary={summary} tree={tree} go={setSub} />}
      {sub === "tree" && tree && <TreeEditor tree={tree} reload={loadTree} />}
      {sub === "requests" && tree && (
        <Requests
          tree={tree}
          onChanged={() => {
            loadSummary()
            loadTree()
          }}
        />
      )}
      {sub === "reports" && <Reports onChanged={loadSummary} onOpenMember={onOpenMember} />}
      {sub === "posts" && tree && <Posts groups={tree.groups} galleries={tree.galleries} />}
      {sub === "stats" && tree && <Stats tree={tree} />}
      {sub === "squads" && <SquadsManager onOpenMember={onOpenMember} />}
    </div>
  )
}

// ---------------- 요약 ----------------
function Summary({ summary, tree, go }: { summary: Awaited<ReturnType<typeof adminGallery.summary>> | null; tree: { groups: GalleryGroup[]; galleries: AdminGallery[] } | null; go: (s: Sub) => void }) {
  if (!summary || !tree) return <div className={`${card} text-sm text-zinc-400`}>불러오는 중...</div>
  const items: [string, number, Sub | null][] = [
    ["오늘 방문자", summary.todayVisitors, "stats"],
    ["오늘 새 글", summary.todayPosts, "posts"],
    ["오늘 새 댓글", summary.todayComments, "stats"],
    ["전체 글", summary.totalPosts, "posts"],
    ["대기 중인 개설 요청", summary.pendingRequests, "requests"],
    ["처리 안 한 신고", summary.openReports, "reports"],
  ]
  const top = [...tree.galleries].filter((g) => g.status !== "closed").sort((a, b) => b.stats.todayVisitors - a.stats.todayVisitors || b.stats.todayPosts - a.stats.todayPosts).slice(0, 8)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map(([label, n, to]) => (
          <button key={label} onClick={() => to && go(to)} className="text-left p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${(label.includes("신고") || label.includes("요청")) && n > 0 ? "text-amber-300" : "text-white"}`}>{n.toLocaleString()}</div>
          </button>
        ))}
      </div>
      <div className={card}>
        <h4 className="text-sm font-semibold text-white">오늘 많이 찾은 갤러리</h4>
        <GalleryStatsTable galleries={top} groups={tree.groups} />
      </div>
    </div>
  )
}

function GalleryStatsTable({ galleries, groups }: { galleries: AdminGallery[]; groups: GalleryGroup[] }) {
  const groupName = (id: number | null) => groups.find((g) => g.id === id)?.name ?? "(대분류 없음)"
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className={th}>갤러리</th>
            <th className={th}>대분류</th>
            <th className={`${th} text-right`}>오늘 방문</th>
            <th className={`${th} text-right`}>오늘 글</th>
            <th className={`${th} text-right`}>전체 글</th>
            <th className={`${th} text-right`}>전체 댓글</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {galleries.map((g) => (
            <tr key={g.id}>
              <td className="p-3 text-zinc-100">
                <a href={galleryHref(g.slug)} target="_blank" rel="noreferrer" className="hover:underline">
                  {g.name}
                </a>
              </td>
              <td className="p-3 text-zinc-400">{groupName(g.groupId)}</td>
              <td className="p-3 text-right text-zinc-200">{g.stats.todayVisitors.toLocaleString()}</td>
              <td className="p-3 text-right text-zinc-200">{g.stats.todayPosts.toLocaleString()}</td>
              <td className="p-3 text-right text-zinc-200">{g.stats.posts.toLocaleString()}</td>
              <td className="p-3 text-right text-zinc-200">{g.stats.comments.toLocaleString()}</td>
            </tr>
          ))}
          {!galleries.length && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-zinc-500">
                갤러리가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------- 갤러리 구성 ----------------
type GalleryForm = {
  id?: number
  slug: string
  name: string
  groupId: number | null
  description: string
  coverImageUrl: string
  heads: string
  aliases: string
  status: AdminGallery["status"]
  sortOrder: number
  writeRole: "member" | "admin"
  commentRole: "member" | "admin"
  layout: "grid" | "list"
  postAsSquad: boolean
}

const newSlug = () => `g-${Date.now().toString(36)}`
const toForm = (g?: Partial<AdminGallery>, groupId: number | null = null): GalleryForm => ({
  id: g?.id,
  slug: g?.slug ?? newSlug(),
  name: g?.name ?? "",
  groupId: g?.groupId ?? groupId,
  description: g?.description ?? "",
  coverImageUrl: g?.coverImageUrl ?? "",
  heads: (g?.heads ?? []).join(", "),
  aliases: (g?.aliases ?? []).join(", "),
  status: g?.status ?? "active",
  sortOrder: g?.sortOrder ?? 0,
  writeRole: g?.writeRole ?? "member",
  commentRole: g?.commentRole ?? "member",
  layout: g?.layout ?? "grid",
  postAsSquad: g?.postAsSquad ?? false,
})
const splitList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const STATUS_LABEL: Record<string, string> = { active: "운영 중", dormant: "휴면", closed: "닫힘" }

function TreeEditor({ tree, reload }: { tree: { groups: GalleryGroup[]; galleries: AdminGallery[] }; reload: () => void }) {
  const [form, setForm] = useState<GalleryForm | null>(null)
  const [groupForm, setGroupForm] = useState<Partial<GalleryGroup> | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const sections = [
    ...tree.groups.map((g) => ({ group: g as GalleryGroup | null, galleries: tree.galleries.filter((x) => x.groupId === g.id) })),
    { group: null, galleries: tree.galleries.filter((x) => x.groupId === null) },
  ]

  const saveGroup = async () => {
    if (!groupForm) return
    setBusy(true)
    setError("")
    try {
      await adminGallery.saveGroup(groupForm, groupForm.id)
      setGroupForm(null)
      reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const removeGroup = async (g: GalleryGroup) => {
    if (!confirm(`'${g.name}' 대분류를 지울까요? 안에 열린 갤러리가 있으면 지울 수 없습니다.`)) return
    try {
      await adminGallery.deleteGroup(g.id)
      reload()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} onClick={() => setForm(toForm())}>
          갤러리 만들기
        </button>
        <button className={btn} onClick={() => setGroupForm({ slug: "", name: "", kind: "normal", sortOrder: (tree.groups.length + 1) * 10, isActive: true })}>
          대분류 추가
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          닫힌 갤러리도 보기
        </label>
      </div>
      {error && <div className="text-sm text-red-300">{error}</div>}

      {groupForm && (
        <div className={`${card} space-y-3`}>
          <h4 className="text-sm font-semibold text-white">{groupForm.id ? "대분류 고치기" : "대분류 추가"}</h4>
          <div className="grid sm:grid-cols-4 gap-2">
            <input className={input} value={groupForm.name ?? ""} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="이름 (예: 굿즈)" />
            <input className={input} value={groupForm.slug ?? ""} onChange={(e) => setGroupForm({ ...groupForm, slug: e.target.value })} placeholder="주소 (영문, 예: goods)" />
            <select className={input} value={groupForm.kind} onChange={(e) => setGroupForm({ ...groupForm, kind: e.target.value as GalleryGroup["kind"] })}>
              <option value="normal">일반</option>
              <option value="squad">스쿼드 (스쿼드 목록 링크 붙음)</option>
            </select>
            <input className={input} type="number" value={groupForm.sortOrder ?? 0} onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) })} placeholder="순서" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={groupForm.isActive !== false} onChange={(e) => setGroupForm({ ...groupForm, isActive: e.target.checked })} />
            화면에 보이기
          </label>
          <div className="flex gap-2">
            <button className={primary} disabled={busy} onClick={saveGroup}>
              저장
            </button>
            <button className={btn} onClick={() => setGroupForm(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {form && (
        <GalleryFormCard
          form={form}
          groups={tree.groups}
          onCancel={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}

      {sections.map(({ group, galleries }) => {
        const shown = galleries.filter((g) => showClosed || g.status !== "closed")
        if (!group && !shown.length) return null
        return (
          <div key={group?.id ?? "none"} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-white">{group ? group.name : "대분류 없음 (갤러리 메뉴에 안 보임)"}</h4>
              {group && (
                <>
                  <span className="text-xs text-zinc-500">
                    {group.slug} · 순서 {group.sortOrder}
                    {group.kind === "squad" && " · 스쿼드"}
                    {!group.isActive && " · 숨김"}
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <button className={btn} onClick={() => setForm(toForm(undefined, group.id))}>
                      이 대분류에 갤러리 추가
                    </button>
                    <button className={btn} onClick={() => setGroupForm(group)}>
                      고치기
                    </button>
                    <button className={btn} onClick={() => removeGroup(group)}>
                      지우기
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className={th}>갤러리</th>
                    <th className={th}>글쓰기</th>
                    <th className={th}>모양</th>
                    <th className={th}>상태</th>
                    <th className={`${th} text-right`}>글</th>
                    <th className={`${th} text-right`}>오늘 글</th>
                    <th className={`${th} text-right`}>댓글</th>
                    <th className={`${th} text-right`}>오늘 방문</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {shown.map((g) => (
                    <tr key={g.id}>
                      <td className="p-3">
                        <div className="text-zinc-100">{g.name}</div>
                        <div className="text-xs text-zinc-500">{g.slug}</div>
                      </td>
                      <td className="p-3 text-zinc-300 whitespace-nowrap">
                        {g.writeRole === "admin" ? "운영팀만" : "회원"}
                        {g.postAsSquad && <span className="text-zinc-500"> · 스쿼드 이름</span>}
                      </td>
                      <td className="p-3 text-zinc-300 whitespace-nowrap">{g.layout === "grid" ? "사진" : "목록"}</td>
                      <td className={`p-3 whitespace-nowrap ${g.status === "active" ? "text-zinc-300" : "text-zinc-500"}`}>{STATUS_LABEL[g.status]}</td>
                      <td className="p-3 text-right text-zinc-200">{g.stats.posts.toLocaleString()}</td>
                      <td className="p-3 text-right text-zinc-200">{g.stats.todayPosts.toLocaleString()}</td>
                      <td className="p-3 text-right text-zinc-200">{g.stats.comments.toLocaleString()}</td>
                      <td className="p-3 text-right text-zinc-200">{g.stats.todayVisitors.toLocaleString()}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button className={btn} onClick={() => setForm(toForm(g))}>
                          설정
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-zinc-500">
                        갤러리가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GalleryFormCard({
  form: initial,
  groups,
  onSaved,
  onCancel,
  submitLabel,
}: {
  form: GalleryForm
  groups: GalleryGroup[]
  onSaved: (g: { id: number }) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => setF(initial), [initial])
  const set = (patch: Partial<GalleryForm>) => setF((prev) => ({ ...prev, ...patch }))

  const save = async () => {
    setBusy(true)
    setError("")
    try {
      const { id, heads, aliases, ...rest } = f
      const gallery = await adminGallery.saveGallery({ ...rest, coverImageUrl: rest.coverImageUrl || null, heads: splitList(heads), aliases: splitList(aliases) }, id)
      onSaved(gallery)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const label = "block text-xs text-zinc-400 mb-1"
  return (
    <div className={`${card} space-y-3`}>
      <h4 className="text-sm font-semibold text-white">{f.id ? `'${initial.name}' 설정` : "새 갤러리"}</h4>
      <div className="grid sm:grid-cols-3 gap-3">
        <label>
          <span className={label}>이름</span>
          <input className={`${input} w-full`} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          <span className={label}>주소 (영문 소문자·숫자·하이픈)</span>
          <input className={`${input} w-full`} value={f.slug} onChange={(e) => set({ slug: e.target.value })} />
        </label>
        <label>
          <span className={label}>대분류</span>
          <select className={`${input} w-full`} value={f.groupId ?? ""} onChange={(e) => set({ groupId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">(대분류 없음)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={label}>글쓰기 권한</span>
          <select className={`${input} w-full`} value={f.writeRole} onChange={(e) => set({ writeRole: e.target.value as GalleryForm["writeRole"] })}>
            <option value="member">회원 누구나</option>
            <option value="admin">운영팀만 (관리자 권한)</option>
          </select>
        </label>
        <label>
          <span className={label}>댓글 권한</span>
          <select className={`${input} w-full`} value={f.commentRole} onChange={(e) => set({ commentRole: e.target.value as GalleryForm["commentRole"] })}>
            <option value="member">회원 누구나</option>
            <option value="admin">운영팀만</option>
          </select>
        </label>
        <label>
          <span className={label}>모양</span>
          <select className={`${input} w-full`} value={f.layout} onChange={(e) => set({ layout: e.target.value as GalleryForm["layout"] })}>
            <option value="grid">사진 격자 (사진·동영상 필수)</option>
            <option value="list">글 목록 (공지 등)</option>
          </select>
        </label>
        <label>
          <span className={label}>상태</span>
          <select className={`${input} w-full`} value={f.status} onChange={(e) => set({ status: e.target.value as GalleryForm["status"] })}>
            <option value="active">운영 중</option>
            <option value="dormant">휴면 (보기만, 글쓰기 막힘)</option>
            <option value="closed">닫힘 (안 보임)</option>
          </select>
        </label>
        <label>
          <span className={label}>순서</span>
          <input className={`${input} w-full`} type="number" value={f.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
        </label>
        <label className="flex items-end gap-1.5 text-sm text-zinc-300 pb-2">
          <input type="checkbox" checked={f.postAsSquad} onChange={(e) => set({ postAsSquad: e.target.checked })} />
          스쿼드 이름으로만 쓰기
        </label>
      </div>
      <label className="block">
        <span className={label}>소개</span>
        <input className={`${input} w-full`} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label>
          <span className={label}>말머리 (쉼표로 구분, 비우면 없음)</span>
          <input className={`${input} w-full`} value={f.heads} onChange={(e) => set({ heads: e.target.value })} placeholder="예: 후기, 질문" />
        </label>
        <label>
          <span className={label}>검색 별칭 (쉼표로 구분)</span>
          <input className={`${input} w-full`} value={f.aliases} onChange={(e) => set({ aliases: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className={label}>표지 이미지 주소 (선택)</span>
        <input className={`${input} w-full`} value={f.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} placeholder="https://img.duckji.com/..." />
      </label>
      {error && <div className="text-sm text-red-300">{error}</div>}
      <div className="flex gap-2">
        <button className={primary} disabled={busy || !f.name.trim()} onClick={save}>
          {submitLabel || "저장"}
        </button>
        <button className={btn} onClick={onCancel}>
          취소
        </button>
        {f.id && (
          <a className={`${btn} ml-auto`} href={galleryHref(f.slug)} target="_blank" rel="noreferrer">
            갤러리 열기
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------- 개설 요청 ----------------
const categoryLabel = (v: string) => REQUEST_CATEGORIES.find((c) => c.value === v)?.label ?? v

function Requests({ tree, onChanged }: { tree: { groups: GalleryGroup[]; galleries: AdminGallery[] }; onChanged: () => void }) {
  const [status, setStatus] = useState<GalleryRequest["status"]>("pending")
  const [list, setList] = useState<GalleryRequest[] | null>(null)
  const [opening, setOpening] = useState<GalleryRequest | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(() => {
    setList(null)
    adminGallery
      .requests(status)
      .then(setList)
      .catch((e) => setError(e.message))
  }, [status])
  useEffect(() => {
    load()
  }, [load])

  const reject = async (r: GalleryRequest) => {
    const note = prompt(`'${r.name}' 요청을 반려합니다. 사유 (선택)`)
    if (note === null) return
    try {
      await adminGallery.handleRequest(r.id, { status: "rejected", adminNote: note })
      load()
      onChanged()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} className={status === s ? primary : btn} onClick={() => setStatus(s)}>
            {s === "pending" ? "대기" : s === "approved" ? "개설함" : "반려"}
          </button>
        ))}
      </div>
      {error && <div className="text-sm text-red-300">{error}</div>}
      {opening && (
        <GalleryFormCard
          form={{ ...toForm(undefined, tree.groups[0]?.id ?? null), name: opening.name }}
          groups={tree.groups}
          submitLabel="갤러리 열고 요청 처리"
          onCancel={() => setOpening(null)}
          onSaved={async (g) => {
            await adminGallery.handleRequest(opening.id, { status: "approved", galleryId: g.id }).catch((e) => setError(e.message))
            setOpening(null)
            load()
            onChanged()
          }}
        />
      )}
      <div className={card}>
        {list === null ? (
          <div className="text-sm text-zinc-400">불러오는 중...</div>
        ) : !list.length ? (
          <div className="text-sm text-zinc-500">요청이 없습니다.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className={th}>이름</th>
                <th className={th}>분류</th>
                <th className={`${th} text-right`}>원하는 사람</th>
                <th className={`${th} hidden md:table-cell`}>이유</th>
                <th className={th}>요청</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 text-zinc-100">{r.name}</td>
                  <td className="p-3 text-zinc-400">{categoryLabel(r.category)}</td>
                  <td className="p-3 text-right text-zinc-200">{r.supporterCount}</td>
                  <td className="p-3 text-zinc-400 hidden md:table-cell max-w-xs truncate">{r.reason || r.adminNote || "-"}</td>
                  <td className="p-3 text-zinc-400 whitespace-nowrap">
                    {r.requesterName} · {formatPostDate(r.createdAt)}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-1.5">
                        <button className={primary} onClick={() => setOpening(r)}>
                          개설
                        </button>
                        <button className={btn} onClick={() => reject(r)}>
                          반려
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">{r.handledAt ? formatPostDate(r.handledAt) : ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------------- 신고 ----------------
const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v
const TARGET_LABEL = { post: "글", comment: "댓글", member: "회원" } as const

function Reports({ onChanged, onOpenMember }: { onChanged: () => void; onOpenMember?: (id: string) => void }) {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open")
  const [list, setList] = useState<ReportGroup[] | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(() => {
    setList(null)
    adminGallery
      .reports(status)
      .then(setList)
      .catch((e) => setError(e.message))
  }, [status])
  useEffect(() => {
    load()
  }, [load])

  const resolve = async (r: ReportGroup, action: "hide" | "dismiss") => {
    try {
      await adminGallery.resolveReport(r.targetType, r.targetId, action)
      load()
      onChanged()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["open", "actioned", "dismissed"] as const).map((s) => (
          <button key={s} className={status === s ? primary : btn} onClick={() => setStatus(s)}>
            {s === "open" ? "처리 전" : s === "actioned" ? "조치함" : "문제없음"}
          </button>
        ))}
        <span className="text-xs text-zinc-500 ml-2">같은 글·댓글에 신고 5건이 쌓이면 자동으로 가려집니다.</span>
      </div>
      {error && <div className="text-sm text-red-300">{error}</div>}
      {list === null ? (
        <div className={`${card} text-sm text-zinc-400`}>불러오는 중...</div>
      ) : !list.length ? (
        <div className={`${card} text-sm text-zinc-500`}>신고가 없습니다.</div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={`${r.targetType}-${r.targetId}`} className={`${card} flex flex-col sm:flex-row gap-4`}>
              {r.coverUrl && <img src={r.coverUrl} alt="" className="w-20 h-20 rounded-lg object-cover border border-zinc-800 shrink-0" />}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300">{TARGET_LABEL[r.targetType]}</span>
                  <span className="text-amber-300 font-semibold">신고 {r.reportCount}건</span>
                  {r.galleryName && <span className="text-zinc-500">{r.galleryName}</span>}
                  {r.targetStatus && r.targetStatus !== "published" && r.targetStatus !== "active" && <span className="text-zinc-500">현재 {r.targetStatus === "hidden" ? "숨김" : r.targetStatus}</span>}
                </div>
                <div className="text-sm text-zinc-100 break-words">{r.preview || "(내용 없음)"}</div>
                <div className="text-xs text-zinc-400">
                  {r.authorName && <>작성자 {r.authorName} · </>}사유 {r.reasons.map(reasonLabel).join(", ")} · 마지막 신고 {formatPostDate(r.lastReportedAt)}
                </div>
                {r.details.length > 0 && (
                  <ul className="text-xs text-zinc-400 list-disc pl-4 space-y-0.5">
                    {r.details.slice(0, 5).map((d, i) => (
                      <li key={i} className="break-words">
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex sm:flex-col gap-1.5 shrink-0">
                {r.postId && (
                  <a className={btn} href={postHref(r.postId)} target="_blank" rel="noreferrer">
                    글 보기
                  </a>
                )}
                {r.authorId && r.authorId !== "admin" && onOpenMember && (
                  <button className={btn} onClick={() => onOpenMember(r.authorId!)}>
                    회원 정보
                  </button>
                )}
                {status === "open" && (
                  <>
                    <button className={primary} onClick={() => resolve(r, "hide")}>
                      {r.targetType === "member" ? "조치함" : "가리기"}
                    </button>
                    <button className={btn} onClick={() => resolve(r, "dismiss")}>
                      문제없음
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------- 글 관리 ----------------
// 투표 상태 한 줄: 진행 중(마감 시각) / 마감
const pollState = (p: AdminPostSummary) => {
  const closed = Boolean(p.pollClosedAt) || Boolean(p.pollEndsAt && new Date(p.pollEndsAt).getTime() <= Date.now())
  const at = p.pollEndsAt ? new Date(p.pollEndsAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null
  return { closed, label: closed ? "투표 마감됨" : at ? `투표 중 · ${at} 마감` : "투표 중 · 마감일 없음" }
}

function Posts({ groups, galleries }: { groups: GalleryGroup[]; galleries: AdminGallery[] }) {
  const [groupId, setGroupId] = useState<number | null>(null)
  const [galleryId, setGalleryId] = useState<number | null>(null)
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ posts: AdminPostSummary[]; total: number; pageSize: number } | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    adminGallery
      .posts({ galleryId, groupId, status: status || undefined, q: query || undefined, page })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [galleryId, groupId, status, query, page])
  const groupName = (id: number | null) => groups.find((g) => g.id === id)?.name
  const subGalleries = galleries.filter((g) => groupId !== null && g.groupId === groupId)
  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQuery(q.trim())
        }}
        className="flex flex-wrap gap-2"
      >
        <select
          className={input}
          aria-label="대분류"
          value={groupId ?? ""}
          onChange={(e) => (setPage(1), setGalleryId(null), setGroupId(e.target.value ? Number(e.target.value) : null))}
        >
          <option value="">모든 대분류</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          className={input}
          aria-label="하위 갤러리"
          value={galleryId ?? ""}
          disabled={groupId === null}
          onChange={(e) => (setPage(1), setGalleryId(e.target.value ? Number(e.target.value) : null))}
        >
          <option value="">{groupId === null ? "대분류를 먼저 고르세요" : "모든 하위 갤러리"}</option>
          {subGalleries.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select className={input} value={status} onChange={(e) => (setPage(1), setStatus(e.target.value))}>
          <option value="">모든 상태</option>
          <option value="published">게시 중</option>
          <option value="hidden">숨김</option>
          <option value="deleted">지움</option>
        </select>
        <input className={`${input} flex-1 min-w-[10rem]`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·글쓴이·태그" />
        <button className={primary}>찾기</button>
      </form>
      {error && <div className="text-sm text-red-300">{error}</div>}
      <div className={`${card} overflow-x-auto`}>
        {!data ? (
          <div className="text-sm text-zinc-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className={th}>글</th>
                <th className={th}>갤러리</th>
                <th className={th}>글쓴이</th>
                <th className={`${th} text-right`}>덕업/덕다운</th>
                <th className={`${th} text-right`}>댓글</th>
                <th className={th}>상태</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data.posts.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 max-w-xs">
                    <a href={postHref(p.id)} target="_blank" rel="noreferrer" className="block text-zinc-100 truncate hover:underline">
                      {p.isNotice && <span className="text-amber-300 mr-1">[공지]</span>}
                      {p.title}
                    </a>
                    <div className="text-xs text-zinc-500">
                      {formatPostDate(p.createdAt)} · 사진·영상 {p.mediaCount}
                      {p.hasPoll && <span className={pollState(p).closed ? "text-zinc-400" : "text-emerald-400"}> · {pollState(p).label}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-zinc-400 whitespace-nowrap">
                    <span className="text-zinc-500">{groupName(galleries.find((g) => g.id === p.galleryId)?.groupId ?? null) ?? "대분류 없음"} › </span>
                    {p.galleryName}
                  </td>
                  <td className="p-3 text-zinc-300 whitespace-nowrap">
                    {p.authorName}
                    {p.postedAsSquad && <span className="text-zinc-500"> ({p.postedAsSquad.name})</span>}
                  </td>
                  <td className="p-3 text-right text-zinc-300">
                    {p.upCount}/{p.downCount}
                  </td>
                  <td className="p-3 text-right text-zinc-300">{p.commentCount}</td>
                  <td className="p-3 text-zinc-400 whitespace-nowrap">{p.status === "published" ? "게시" : p.status === "hidden" ? "숨김" : "지움"}</td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex justify-end gap-1.5">
                      {p.status !== "deleted" && (
                        <button className={btn} onClick={() => act(() => adminGallery.setPost(p.id, { status: p.status === "hidden" ? "published" : "hidden" }))}>
                          {p.status === "hidden" ? "다시 보이기" : "숨기기"}
                        </button>
                      )}
                      {p.status === "published" && (
                        <button className={btn} onClick={() => act(() => adminGallery.setPost(p.id, { isNotice: !p.isNotice }))}>
                          {p.isNotice ? "공지 해제" : "공지 고정"}
                        </button>
                      )}
                      {p.hasPoll && !pollState(p).closed && (
                        <button
                          className={btn}
                          onClick={() => confirm("이 투표를 지금 마감할까요? 마감하면 더 이상 표를 받지 않아요.") && act(() => adminGallery.closePoll(p.id))}
                        >
                          지금 마감
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.posts.length && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    글이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
          <button className={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            이전
          </button>
          <span>
            {page} / {pages} (전체 {data.total.toLocaleString()})
          </span>
          <button className={btn} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            다음
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------- 통계 ----------------
type Preset = "day" | "week" | "month" | "year" | "custom"
const PRESETS: { id: Preset; label: string }[] = [
  { id: "day", label: "하루" },
  { id: "week", label: "한 주" },
  { id: "month", label: "한 달" },
  { id: "year", label: "일 년" },
  { id: "custom", label: "직접 고르기" },
]
const SERIES: { key: keyof GalleryStats["series"]; label: string; color: string }[] = [
  { key: "visitors", label: "방문자", color: "#38bdf8" },
  { key: "views", label: "조회", color: "#a1a1aa" },
  { key: "posts", label: "글", color: "#34d399" },
  { key: "comments", label: "댓글", color: "#fbbf24" },
  { key: "ups", label: "덕업", color: "#f472b6" },
]
// 한국 날짜 YYYY-MM-DD
const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10)
const daysAgo = (n: number) => kstDay(new Date(Date.now() - n * 86400000))

function Stats({ tree }: { tree: { groups: GalleryGroup[]; galleries: AdminGallery[] } }) {
  const [preset, setPreset] = useState<Preset>("week")
  const [galleryId, setGalleryId] = useState<number | null>(null)
  const [custom, setCustom] = useState({ from: daysAgo(13), to: daysAgo(0) })
  const [metric, setMetric] = useState<keyof GalleryStats["series"]>("visitors")
  const [stats, setStats] = useState<GalleryStats | null>(null)
  const [error, setError] = useState("")

  const range = useMemo(() => {
    if (preset === "custom") return custom
    const back = { day: 0, week: 6, month: 29, year: 364 }[preset]
    return { from: daysAgo(back), to: daysAgo(0) }
  }, [preset, custom])

  useEffect(() => {
    setStats(null)
    setError("")
    adminGallery
      .stats({ galleryId, ...range })
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [galleryId, range])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} className={preset === p.id ? primary : btn} onClick={() => setPreset(p.id)}>
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <span className="flex items-center gap-1.5 text-sm text-zinc-400">
            <DatePicker wrapperClassName="w-44" className={input} value={custom.from} max={custom.to} required onChange={(v) => setCustom({ ...custom, from: v })} aria-label="시작일" />~
            <DatePicker wrapperClassName="w-44" className={input} value={custom.to} min={custom.from} required onChange={(v) => setCustom({ ...custom, to: v })} aria-label="종료일" />
          </span>
        )}
        <select className={`${input} ml-auto`} value={galleryId ?? ""} onChange={(e) => setGalleryId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">갤러리 전체</option>
          {tree.galleries
            .filter((g) => g.status !== "closed")
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </div>
      <div className="text-xs text-zinc-500">
        {range.from} ~ {range.to} (한국 시간){stats?.unit === "month" && " · 기간이 길어 월별로 묶었습니다"}
      </div>
      {error && <div className="text-sm text-red-300">{error}</div>}
      {!stats ? (
        <div className={`${card} text-sm text-zinc-400`}>불러오는 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {SERIES.map((s) => (
              <button
                key={s.key}
                onClick={() => setMetric(s.key)}
                className={`text-left p-4 rounded-xl border ${metric === s.key ? "border-sky-600 bg-zinc-900" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}
              >
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-white">{stats.totals[s.key].toLocaleString()}</div>
              </button>
            ))}
          </div>
          <div className={card}>
            <BarChart labels={stats.labels} values={stats.series[metric]} color={SERIES.find((s) => s.key === metric)!.color} />
            {preset === "day" && <p className="mt-2 text-xs text-zinc-500">방문자는 하루 단위로 셉니다. 같은 사람이 여러 번 와도 하루 한 번.</p>}
          </div>
          {!galleryId && (
            <div className={card}>
              <h4 className="text-sm font-semibold text-white">갤러리별</h4>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className={th}>갤러리</th>
                      <th className={th}>대분류</th>
                      <th className={`${th} text-right`}>방문자</th>
                      <th className={`${th} text-right`}>글</th>
                      <th className={`${th} text-right`}>댓글</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {stats.galleries.map((g) => (
                      <tr key={g.id}>
                        <td className="p-3 text-zinc-100">{g.name}</td>
                        <td className="p-3 text-zinc-400">{g.groupName}</td>
                        <td className="p-3 text-right text-zinc-200">{g.visitors.toLocaleString()}</td>
                        <td className="p-3 text-right text-zinc-200">{g.posts.toLocaleString()}</td>
                        <td className="p-3 text-right text-zinc-200">{g.comments.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <button className={btn} onClick={() => setGalleryId(g.id)}>
                            자세히
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!stats.galleries.length && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-zinc-500">
                          이 기간에는 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// 막대 그래프 (라이브러리 없이). 막대가 많으면 글자는 몇 개만
function BarChart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const every = Math.max(1, Math.ceil(labels.length / 12))
  const short = (l: string) => (l.length === 10 ? l.slice(5).replace("-", ".") : l.replace("-", "."))
  if (!labels.length) return <div className="text-sm text-zinc-500">기록이 없습니다.</div>
  return (
    <div>
      <div className="flex items-end gap-[2px] h-48">
        {values.map((v, i) => (
          <div key={labels[i]} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
            <div className="rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0, background: color, opacity: 0.85 }} />
            <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap px-1.5 py-0.5 rounded bg-zinc-800 text-xs text-white">
              {short(labels[i])} · {v.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1.5">
        {labels.map((l, i) => (
          <div key={l} className="flex-1 min-w-0 text-center text-xs text-zinc-500 truncate">
            {i % every === 0 ? short(l) : ""}
          </div>
        ))}
      </div>
    </div>
  )
}

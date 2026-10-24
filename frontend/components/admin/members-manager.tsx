"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Search, Download, RefreshCw, ShieldOff, BadgeCheck, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { PointsManager } from "@/components/admin/points-manager"
import { fmtDateTime } from "@/components/admin/goods-shared"

// 관리자: 전체 회원 (회원 DB 기준, backend users 서비스 /api/users/admin/members)
// 한 회원 = 한 줄. 카카오·네이버·구글·애플·이메일을 연동해도 로그인 수단만 늘어남
// 조치: 관리자 지정·해제, 기간 정지, 영구 정지(+ 그 번호·본인으로 재가입 금지), 해제, 탈퇴 처리, 조치 이력
// 분류는 선택 상자로 고르고, 표는 30명씩 나눠 보여 줌. 줄을 누르면 회원 세부 정보 창(관리 버튼·조치 이력·덕지 포인트 지급·차감)

type Status = "active" | "dormant" | "suspended" | "banned" | "withdrawn"
type Role = "member" | "creator" | "partner" | "admin"

interface AdminMember {
  id: string
  name: string
  email: string
  provider: string
  avatarUrl?: string
  phone?: string // 가린 번호
  joinedAt: string
  lastLoginAt: string
  role: Role
  points: number
  status: Status
  authSource: string
  loginMethods: string[]
  providers: string[]
  suspendedUntil: string | null
  sanctionReason: string | null
  signupCompleted: boolean
  phoneVerified: boolean
  identityVerified: boolean
  phoneBanned: boolean
  signupPlatform?: "web" | "app"
}

interface SignupBan {
  id: string
  kind: "phone" | "ci" | "rejoin"
  rejoin_after?: string
  member_id: string | null
  member_name: string | null
  reason: string | null
  created_by: string
  created_at: string
}

// 회원 세부 정보 (/members/:id/profile, 개인정보는 서버가 가려서 보냄)
interface MemberProfileDetail {
  identityVerified: boolean
  identityVerifiedAt: string | null
  signupCompletedAt: string | null
  profile: { realName: string | null; phone: string | null; birthDate: string | null; gender: string | null; age: number | null }
  addresses: { id: number; label: string | null; recipient: string | null; zipCode: string; address1: string | null; isDefault: boolean }[]
  loginMethods: { provider: string; email: string | null; linkedAt: string; lastLoginAt: string }[]
  consents: Record<string, { agreed: boolean; at: string }>
}

interface AdminAction {
  action: string
  reason: string | null
  detail: Record<string, unknown>
  actor: string
  created_at: string
}

async function call(path: string, init?: { method?: string; json?: unknown }) {
  const res = await apiFetch(`/api/users/admin${path}`, {
    method: init?.method || "GET",
    cache: "no-store",
    headers: init?.json === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "요청을 처리하지 못했습니다.")
  return body
}

// 이메일 로그인 계정(Cognito)은 admin 서비스가 관리 (회원 DB 는 users 서비스)
async function cognitoCall(path: string, method = "GET") {
  const res = await apiFetch(`/api/admin/cognito${path}`, { method, cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) throw new Error(body.error || "이메일 로그인 계정을 처리하지 못했습니다.")
  return body
}

// Cognito 에서 직접 지운 이메일 계정을 회원 목록에 반영 (목록에 없는 이메일 회원은 탈퇴 처리, 소셜이 함께 연결돼 있으면 이메일 연결만 끊음)
async function syncCognitoMembers(): Promise<number> {
  const { subs } = await cognitoCall("/users")
  let res = await apiFetch("/api/users/admin/members/cognito-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subs }),
  })
  let body = await res.json().catch(() => ({}))
  if (res.status === 409 && body.needsConfirm) {
    const ok = confirm(`Cognito 에 없는 이메일 회원이 ${body.missing.length}명입니다. 모두 탈퇴 처리할까요?\n${body.missing.join("\n")}`)
    if (!ok) return 0
    res = await apiFetch("/api/users/admin/members/cognito-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subs, confirm: true }),
    })
    body = await res.json().catch(() => ({}))
  }
  if (!res.ok || !body.success) throw new Error(body.error || "이메일 계정 대조에 실패했습니다.")
  return body.withdrawn.length + body.unlinked.length
}

const STATUS_LABEL: Record<Status, string> = {
  active: "정상 활동",
  dormant: "휴면",
  suspended: "기간 정지",
  banned: "영구 정지",
  withdrawn: "탈퇴",
}
const ACTION_LABEL: Record<string, string> = {
  suspend: "기간 정지",
  ban: "영구 정지",
  restore: "해제",
  withdraw: "탈퇴 처리",
  signup_ban_lifted: "재가입 금지 해제",
  rejoin_wait_lifted: "재가입 대기 해제",
  rename: "닉네임 변경",
}
const PROVIDER_NAME: Record<string, string> = { kakao: "카카오톡", naver: "네이버", google: "Google", apple: "Apple", cognito: "이메일", email: "이메일" }

const fmt = (v: string) => (v ? fmtDateTime(v) : "-") // YYYY.MM.DD HH:mm (한국 시간)

// focusMemberId: 다른 탭(스쿼드 관리 등)에서 넘어오면 그 회원으로 검색하고 상세를 엶
export function MembersManager({ focusMemberId }: { focusMemberId?: string | null } = {}) {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [bans, setBans] = useState<SignupBan[]>([])
  const [status, setStatus] = useState<"all" | Status>("all")
  const [provider, setProvider] = useState("all")
  const [verified, setVerified] = useState("all")
  const [platform, setPlatform] = useState("all")
  const [search, setSearch] = useState(focusMemberId || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailActions, setDetailActions] = useState<AdminAction[] | null>(null)
  const [detailProfile, setDetailProfile] = useState<MemberProfileDetail | null | "error">(null)
  const detail = detailId ? members.find((m) => m.id === detailId) || null : null

  const openDetail = async (u: AdminMember) => {
    setDetailId(u.id)
    setDetailActions(null)
    setDetailProfile(null)
    call(`/members/${encodeURIComponent(u.id)}/profile`)
      .then((r) => setDetailProfile(r))
      .catch(() => setDetailProfile("error"))
    try {
      const r = await call(`/members/${encodeURIComponent(u.id)}/actions`)
      setDetailActions(r.actions)
    } catch {
      setDetailActions([])
    }
  }

  // DP 를 바꾸면 목록의 보유 DP 도 바로 맞춤
  const setMemberPoints = (id: string, points: number) => setMembers((list) => list.map((m) => (m.id === id ? { ...m, points } : m)))

  const load = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (status !== "all") q.set("status", status)
      const [m, b] = await Promise.all([call(`/members?${q}`), call("/signup-bans")])
      setMembers(m.members)
      setCounts(m.counts || {})
      setBans(b.bans)
      setError("")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // 회원 관리를 열 때 한 번 Cognito 와 대조 (설정 전이거나 실패하면 조용히 넘어감)
  useEffect(() => {
    syncCognitoMembers()
      .then((n) => {
        if (n > 0) load()
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 넘겨받은 회원의 상세를 한 번 엶
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (focused || !focusMemberId) return
    const m = members.find((u) => u.id === focusMemberId)
    if (m) {
      setFocused(true)
      openDetail(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, focusMemberId, focused])

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    return members.filter(
      (u) =>
        (provider === "all" || u.providers.includes(provider) || (provider === "email" && u.providers.includes("cognito"))) &&
        (verified === "all" || (verified === "yes" ? u.identityVerified : !u.identityVerified)) &&
        (platform === "all" || (u.signupPlatform || "web") === platform) &&
        (!t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.id.toLowerCase().includes(t) || (u.phone || "").includes(t))
    )
  }, [members, provider, verified, platform, search])

  const byProvider = (p: string) => members.filter((u) => u.providers.includes(p)).length
  const totalActive = Object.entries(counts).reduce((n, [k, v]) => (k === "withdrawn" ? n : n + v), 0)

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      if (done) alert(done)
      await load()
      if (detailId) {
        call(`/members/${encodeURIComponent(detailId)}/actions`).then((r) => setDetailActions(r.actions)).catch(() => {})
        call(`/members/${encodeURIComponent(detailId)}/profile`).then((r) => setDetailProfile(r)).catch(() => {})
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const changeRole = (u: AdminMember) => {
    const role: Role = u.role === "admin" ? "member" : "admin"
    const label = role === "admin" ? "관리자로 지정" : "관리자 권한 해제"
    if (!confirm(`'${u.name}' 회원을 ${label}하시겠습니까?\n바뀐 권한은 그 회원이 다음에 로그인할 때 적용됩니다.`)) return
    act(async () => {
      const res = await apiFetch(`/api/users/${encodeURIComponent(u.id)}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || "권한을 변경하지 못했습니다.")
    })
  }

  const rename = (u: AdminMember) => {
    const name = window.prompt(`'${u.name}' 회원의 새 닉네임 (2~20자)`, u.name)
    if (!name?.trim() || name.trim() === u.name) return
    act(() => call(`/members/${encodeURIComponent(u.id)}/name`, { method: "PUT", json: { name: name.trim() } }), "닉네임을 바꿨습니다.")
  }

  const suspend = (u: AdminMember) => {
    const days = window.prompt(`'${u.name}' 회원을 며칠 동안 정지할까요? (1~365)`, "7")
    if (!days) return
    const reason = window.prompt("정지 사유 (회원에게 보여집니다)")
    if (!reason?.trim()) return
    act(() => call(`/members/${encodeURIComponent(u.id)}/sanction`, { method: "POST", json: { action: "suspend", days: Number(days), reason } }), "정지했습니다.")
  }

  const ban = (u: AdminMember) => {
    const reason = window.prompt(`'${u.name}' 회원을 영구 정지합니다. 사유를 입력해주세요.`)
    if (!reason?.trim()) return
    const banPhone = confirm(
      "이 회원의 휴대폰 번호(본인인증한 회원은 본인 정보까지)로 다시 가입하지 못하게 막을까요?\n[확인] 재가입 금지  [취소] 계정만 정지"
    )
    act(() => call(`/members/${encodeURIComponent(u.id)}/sanction`, { method: "POST", json: { action: "ban", reason, banPhone } }), "영구 정지했습니다.")
  }

  const restore = (u: AdminMember) => {
    if (!confirm(`'${u.name}' 회원의 정지를 해제할까요?`)) return
    const liftPhoneBan = u.phoneBanned ? confirm("재가입 금지도 함께 풀까요?") : false
    act(() => call(`/members/${encodeURIComponent(u.id)}/sanction`, { method: "POST", json: { action: "restore", liftPhoneBan } }), "해제했습니다.")
  }

  const withdraw = (u: AdminMember) => {
    if (!confirm(`'${u.name}' 회원을 탈퇴 처리할까요? 회원 정보가 바로 지워지고 되돌릴 수 없습니다.`)) return
    const reason = window.prompt("탈퇴 처리 사유 (선택)") || ""
    act(async () => {
      const r = await call(`/members/${encodeURIComponent(u.id)}/sanction`, { method: "POST", json: { action: "withdraw", reason } })
      // 이메일 회원이면 로그인 계정(Cognito)도 삭제
      const failed: string[] = []
      for (const sub of (r.cognitoSubs || []) as string[]) {
        await cognitoCall(`/users/${encodeURIComponent(sub)}`, "DELETE").catch(() => failed.push(sub))
      }
      if (failed.length) alert(`탈퇴 처리는 됐지만 이메일 로그인 계정을 지우지 못했습니다. Cognito 에서 직접 지워 주세요: ${failed.join(", ")}`)
    }, "탈퇴 처리했습니다.")
  }

  const liftBan = (b: SignupBan) => {
    const what = b.kind === "rejoin" ? "탈퇴 후 재가입 대기" : `재가입 금지(${b.kind === "ci" ? "본인" : "휴대폰 번호"})`
    if (!confirm(`'${b.member_name || b.member_id || "알 수 없음"}' 회원의 ${what}를 풀까요?`)) return
    act(() => call(`/signup-bans/${encodeURIComponent(b.id)}`, { method: "DELETE" }), "재가입 금지를 풀었습니다.")
  }

  const exportCsv = () => {
    const head = ["회원ID", "닉네임", "이메일", "휴대폰(가림)", "로그인 수단", "가입 경로", "본인인증", "등급", "DP", "상태", "가입일", "최근 로그인"]
    const rows = filtered.map((u) => [u.id, u.name, u.email, u.phone || "", u.loginMethods.join("/"), u.signupPlatform === "app" ? "앱" : "웹", u.identityVerified ? "완료" : "미인증", u.role, u.points, STATUS_LABEL[u.status], u.joinedAt, u.lastLoginAt])
    const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `dukji_members_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 정렬·페이지 (목록은 서버가 최대 500명까지 줌)
  const [sort, setSort] = useState<"joined" | "joinedOld" | "login" | "points">("joined")
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => {
    const list = [...filtered]
    const time = (v: string) => new Date(v).getTime() || 0
    if (sort === "joined") list.sort((a, b) => time(b.joinedAt) - time(a.joinedAt))
    if (sort === "joinedOld") list.sort((a, b) => time(a.joinedAt) - time(b.joinedAt))
    if (sort === "login") list.sort((a, b) => time(b.lastLoginAt) - time(a.lastLoginAt))
    if (sort === "points") list.sort((a, b) => b.points - a.points)
    return list
  }, [filtered, sort])
  useEffect(() => setPage(1), [provider, verified, status, search, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const unfinished = members.filter((u) => !u.signupCompleted).length
  const unverified = members.filter((u) => u.status !== "withdrawn" && !u.identityVerified).length
  const hasFilter = provider !== "all" || verified !== "all" || status !== "all" || search.trim() !== ""

  const btn = "px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs transition-colors cursor-pointer"
  const dangerBtn = "px-3 py-1.5 rounded-lg border border-red-900/60 bg-transparent hover:bg-red-950/50 text-red-400 text-xs transition-colors cursor-pointer"

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">전체 회원</h2>
            <p className="text-xs text-zinc-500 mt-0.5">한 사람은 한 줄입니다. 카카오·네이버·구글·이메일을 연동해도 로그인 수단만 늘어납니다. 줄을 누르면 세부 정보와 조치 메뉴가 열립니다.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} disabled={loading} className={`${btn} inline-flex items-center gap-1.5 disabled:opacity-50`}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              새로고침
            </button>
            <button onClick={exportCsv} className={`${btn} inline-flex items-center gap-1.5`}>
              <Download className="w-3.5 h-3.5" />
              CSV 내보내기
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px rounded-xl border border-zinc-800 bg-zinc-800 overflow-hidden">
          <Stat label="회원 (탈퇴 제외)" value={totalActive} hint={unfinished ? `가입 미완료 ${unfinished}명 포함` : undefined} />
          <Stat label="카카오" value={byProvider("kakao")} />
          <Stat label="네이버" value={byProvider("naver")} />
          <Stat label="Google" value={byProvider("google")} />
          <Stat label="Apple" value={byProvider("apple")} />
          <Stat label="이메일" value={byProvider("cognito") + byProvider("email")} />
          <Stat label="본인인증 미완료" value={unverified} />
          <Stat label="정지 중" value={(counts.suspended || 0) + (counts.banned || 0)} tone={(counts.suspended || 0) + (counts.banned || 0) ? "warn" : undefined} wide />
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-zinc-800">
          <label className="relative flex-1 min-w-[14rem]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="닉네임, 이메일, 회원 ID, 전화번호 끝자리"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-600"
            />
          </label>
          <FilterSelect
            label="로그인 수단"
            value={provider}
            onChange={setProvider}
            options={[
              { id: "all", label: "로그인 수단 전체" },
              { id: "kakao", label: `카카오 (${byProvider("kakao")})` },
              { id: "naver", label: `네이버 (${byProvider("naver")})` },
              { id: "google", label: `Google (${byProvider("google")})` },
              { id: "apple", label: `Apple (${byProvider("apple")})` },
              { id: "email", label: `이메일 (${byProvider("cognito") + byProvider("email")})` },
            ]}
          />
          <FilterSelect
            label="본인인증"
            value={verified}
            onChange={setVerified}
            options={[
              { id: "all", label: "본인인증 전체" },
              { id: "yes", label: "인증 완료" },
              { id: "no", label: "미인증" },
            ]}
          />
          <FilterSelect
            label="가입 경로"
            value={platform}
            onChange={setPlatform}
            options={[
              { id: "all", label: "가입 경로 전체" },
              { id: "web", label: `웹 (${members.filter((u) => (u.signupPlatform || "web") === "web").length})` },
              { id: "app", label: `앱 (${members.filter((u) => u.signupPlatform === "app").length})` },
            ]}
          />
          <FilterSelect
            label="상태"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { id: "all", label: "상태 전체 (탈퇴 제외)" },
              { id: "active", label: `정상 (${counts.active || 0})` },
              { id: "suspended", label: `기간 정지 (${counts.suspended || 0})` },
              { id: "banned", label: `영구 정지 (${counts.banned || 0})` },
              { id: "withdrawn", label: `탈퇴 (${counts.withdrawn || 0})` },
            ]}
          />
          <FilterSelect
            label="정렬"
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              { id: "joined", label: "최근 가입순" },
              { id: "joinedOld", label: "오래된 가입순" },
              { id: "login", label: "최근 로그인순" },
              { id: "points", label: "보유 DP 많은순" },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-zinc-400 border-b border-zinc-800">
          <span>
            <span className="text-zinc-200 font-medium tabular-nums">{sorted.length.toLocaleString()}</span>명
            {hasFilter && (
              <button
                onClick={() => {
                  setProvider("all")
                  setVerified("all")
                  setStatus("all")
                  setSearch("")
                }}
                className="ml-3 text-zinc-500 hover:text-zinc-200 underline underline-offset-2"
              >
                조건 초기화
              </button>
            )}
          </span>
          {members.length >= 500 && <span className="text-zinc-500">최근 가입 500명까지 불러옵니다. 검색으로 좁혀 주세요.</span>}
        </div>

        {error && <div className="mx-4 mt-3 text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">{error}</div>}

        {/* 넓은 화면: 표 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 whitespace-nowrap">
                <th className="px-4 py-2.5 font-medium">회원</th>
                <th className="px-4 py-2.5 font-medium">이메일 · 연락처</th>
                <th className="px-4 py-2.5 font-medium">로그인 수단</th>
                <th className="px-4 py-2.5 font-medium">본인인증</th>
                <th className="px-4 py-2.5 font-medium text-right">보유 DP</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
                <th className="px-4 py-2.5 font-medium">가입일</th>
                <th className="px-4 py-2.5 font-medium">최근 로그인</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500 border-t border-zinc-800">
                    {loading ? "불러오는 중..." : "조건에 맞는 회원이 없습니다."}
                  </td>
                </tr>
              ) : (
                shown.map((u) => (
                  <tr key={u.id} onClick={() => openDetail(u)} className="border-t border-zinc-800/80 hover:bg-zinc-800/30 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-[11rem]">
                        <Avatar member={u} size="w-8 h-8" />
                        <div className="min-w-0">
                          <div className="text-zinc-100 flex items-center gap-1.5">
                            <span className="truncate max-w-[10rem]">{u.name}</span>
                            {u.role !== "member" && <RoleTag role={u.role} />}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[12rem]">{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-300 truncate max-w-[14rem]">{u.email}</div>
                      {u.phone && <div className="text-xs text-zinc-500 tabular-nums">{u.phone}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-300">
                      <Providers providers={u.providers} />
                      {!u.signupCompleted && <div className="text-xs text-amber-400/90">가입 정보 미입력</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.identityVerified ? (
                        <span className="inline-flex items-center gap-1 text-zinc-300">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                          완료
                        </span>
                      ) : u.phoneVerified ? (
                        <span className="text-zinc-400">문자 인증</span>
                      ) : (
                        <span className="text-zinc-500">미인증</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-200 whitespace-nowrap">{u.points.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusLabel member={u} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-400 tabular-nums">{day(u.joinedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-400 tabular-nums">{fmt(u.lastLoginAt)}</td>
                    <td className="pr-3 text-zinc-600">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 좁은 화면: 목록 */}
        <ul className="md:hidden">
          {shown.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">{loading ? "불러오는 중..." : "조건에 맞는 회원이 없습니다."}</li>
          ) : (
            shown.map((u) => (
              <li key={u.id} className="border-t border-zinc-800 first:border-t-0">
                <button onClick={() => openDetail(u)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30">
                  <Avatar member={u} size="w-9 h-9" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-100">
                      <span className="truncate">{u.name}</span>
                      {u.role !== "member" && <RoleTag role={u.role} />}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400">
                      <Providers providers={u.providers} />
                      <span className="text-zinc-700">|</span>
                      <StatusLabel member={u} />
                      <span className="text-zinc-700">|</span>
                      <span className="tabular-nums">{u.points.toLocaleString()} DP</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                </button>
              </li>
            ))
          )}
        </ul>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-zinc-800 text-xs">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`${btn} disabled:opacity-40`} aria-label="이전 페이지">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 2)
              .map((n, i, arr) => (
                <React.Fragment key={n}>
                  {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-zinc-600">…</span>}
                  <button
                    onClick={() => setPage(n)}
                    className={`min-w-8 px-2 py-1.5 rounded-lg tabular-nums ${n === page ? "bg-zinc-100 text-zinc-900 font-medium" : "text-zinc-400 hover:bg-zinc-800"}`}
                  >
                    {n}
                  </button>
                </React.Fragment>
              ))}
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className={`${btn} disabled:opacity-40`} aria-label="다음 페이지">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" onClick={() => setDetailId(null)}>
          <div
            className="w-full max-w-2xl my-auto rounded-2xl bg-zinc-900 border border-zinc-800"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="회원 세부 정보"
          >
            <div className="flex items-start justify-between gap-3 p-5">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar member={detail} size="w-11 h-11" />
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white flex items-center gap-1.5">
                    <span className="truncate">{detail.name}</span>
                    {detail.role !== "member" && <RoleTag role={detail.role} />}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono break-all">{detail.id}</div>
                </div>
              </div>
              <button onClick={() => setDetailId(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800" aria-label="닫기">
                <X className="w-4 h-4" />
              </button>
            </div>

            <DetailSection title="계정">
              <dl className={detailGrid}>
                <dt>이메일</dt>
                <dd className="break-all">{detail.email}</dd>
                <dt>휴대폰</dt>
                <dd className="tabular-nums">{detail.phone || "-"}</dd>
                <dt>로그인 수단</dt>
                <dd>
                  <Providers providers={detail.providers} />
                  {!detail.signupCompleted && <span className="ml-2 text-amber-400/90">가입 정보 미입력</span>}
                </dd>
                <dt>등급</dt>
                <dd>{ROLE_LABEL[detail.role]}</dd>
                <dt>상태</dt>
                <dd>
                  <StatusLabel member={detail} />
                  {detail.suspendedUntil && <span className="text-zinc-400"> · {fmt(detail.suspendedUntil)}까지</span>}
                  {detail.sanctionReason && <span className="text-zinc-400"> · {detail.sanctionReason}</span>}
                  {detail.phoneBanned && <span className="text-red-400"> · 재가입 금지</span>}
                </dd>
                <dt>가입</dt>
                <dd>
                  {fmt(detail.joinedAt)} · {detail.authSource} · {detail.signupPlatform === "app" ? "앱에서 가입" : "웹에서 가입"}
                </dd>
                <dt>최근 로그인</dt>
                <dd>{fmt(detail.lastLoginAt)}</dd>
                <dt>보유 DP</dt>
                <dd className="tabular-nums">{detail.points.toLocaleString()} DP</dd>
              </dl>
            </DetailSection>

            <DetailSection title="본인 정보 · 연동 기록">
              {detailProfile === null ? (
                <p className="text-xs text-zinc-500">불러오는 중...</p>
              ) : detailProfile === "error" ? (
                <p className="text-xs text-zinc-500">세부 정보를 불러오지 못했습니다.</p>
              ) : (
                <dl className={detailGrid}>
                  <dt>본인인증</dt>
                  <dd>
                    {detailProfile.identityVerified ? (
                      <span className="text-emerald-400">완료{detailProfile.identityVerifiedAt && ` · ${fmt(detailProfile.identityVerifiedAt)}`}</span>
                    ) : (
                      <span className="text-amber-400/90">미인증 (다음 로그인 때 인증 화면으로 이동)</span>
                    )}
                  </dd>
                  <dt>이름</dt>
                  <dd>{detailProfile.profile.realName || "-"}</dd>
                  <dt>출생연도 · 나이</dt>
                  <dd>
                    {detailProfile.profile.birthDate ? `${detailProfile.profile.birthDate}년` : "-"}
                    {detailProfile.profile.age !== null && ` · 만 ${detailProfile.profile.age}세`}
                  </dd>
                  <dt>성별</dt>
                  <dd>{detailProfile.profile.gender === "male" ? "남성" : detailProfile.profile.gender === "female" ? "여성" : "-"}</dd>
                  <dt>배송지</dt>
                  <dd className="space-y-0.5">
                    {detailProfile.addresses.length === 0
                      ? "등록 안 함"
                      : detailProfile.addresses.map((a) => (
                          <div key={a.id}>
                            {a.isDefault && <span className="text-zinc-400">[기본] </span>}
                            {a.recipient} · ({a.zipCode}) {a.address1}
                          </div>
                        ))}
                  </dd>
                  <dt>연동 기록</dt>
                  <dd className="space-y-0.5">
                    {detailProfile.loginMethods.map((l) => (
                      <div key={l.provider}>
                        <span>{PROVIDER_NAME[l.provider] || l.provider}</span>
                        {l.email && <span className="text-zinc-400"> · {l.email}</span>}
                        <span className="text-zinc-500"> · 연동 {fmt(l.linkedAt)} · 최근 {fmt(l.lastLoginAt)}</span>
                      </div>
                    ))}
                  </dd>
                  <dt>마케팅 수신</dt>
                  <dd>
                    이메일 {detailProfile.consents.marketing_email?.agreed ? "동의" : "거부"} · 문자 {detailProfile.consents.marketing_sms?.agreed ? "동의" : "거부"}
                  </dd>
                </dl>
              )}
            </DetailSection>

            {detail.status !== "withdrawn" && (
              <DetailSection title="관리">
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => rename(detail)} className={btn}>
                    닉네임 변경
                  </button>
                  <button onClick={() => changeRole(detail)} className={btn}>
                    {detail.role === "admin" ? "관리자 해제" : "관리자 지정"}
                  </button>
                  {detail.status === "suspended" || detail.status === "banned" ? (
                    <button onClick={() => restore(detail)} className={btn}>
                      정지 해제
                    </button>
                  ) : (
                    <>
                      <button onClick={() => suspend(detail)} className={btn}>
                        기간 정지
                      </button>
                      <button onClick={() => ban(detail)} className={dangerBtn}>
                        영구 정지
                      </button>
                    </>
                  )}
                  <button onClick={() => withdraw(detail)} className={dangerBtn}>
                    탈퇴 처리
                  </button>
                </div>
              </DetailSection>
            )}

            <DetailSection title="덕지 포인트(DP) 지급·차감" note="+는 지급, -는 차감입니다. '테스트'에 체크하면 나중에 테스트 기록만 한 번에 지울 수 있습니다.">
              {detail.status === "withdrawn" ? (
                <p className="text-xs text-zinc-500">탈퇴한 회원은 포인트를 바꿀 수 없습니다.</p>
              ) : (
                <PointsManager key={detail.id} embedded initialMemberId={detail.id} onChange={(b) => setMemberPoints(detail.id, b)} />
              )}
            </DetailSection>

            <DetailSection title="조치 이력">
              {detailActions === null ? (
                <p className="text-xs text-zinc-500">불러오는 중...</p>
              ) : detailActions.length === 0 ? (
                <p className="text-xs text-zinc-500">조치 기록이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  {detailActions.map((a, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="text-zinc-500 tabular-nums">{fmt(a.created_at)}</span>
                      <span className="text-zinc-100">{ACTION_LABEL[a.action] || a.action}</span>
                      {typeof a.detail?.days === "number" && <span>{a.detail.days as number}일</span>}
                      {a.reason && <span className="text-zinc-400">{a.reason}</span>}
                      <span className="text-zinc-500">· {a.actor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldOff className="w-4 h-4 text-zinc-500" />
            재가입 금지 목록
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            영구 정지하면서 막은 휴대폰 번호·본인인증 정보와, 탈퇴 후 재가입 대기 중인 회원(본인 탈퇴 30일, 강제 탈퇴 90일)입니다. 번호 자체는 저장하지 않아 회원·사유로 보여 줍니다.
          </p>
        </div>
        {bans.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-500">재가입 금지된 회원이 없습니다.</p>
        ) : (
          <ul className="text-xs">
            {bans.map((b) => (
              <li key={b.id} className="px-4 py-2.5 border-t border-zinc-800 first:border-t-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-16 shrink-0 text-zinc-400">{b.kind === "rejoin" ? "탈퇴 대기" : b.kind === "ci" ? "본인" : "휴대폰"}</span>
                <span className="flex-1 min-w-[12rem] text-zinc-300">
                  {b.member_name || "탈퇴 회원"} <span className="text-zinc-500 font-mono">{b.member_id}</span>
                  {b.reason && <span className="text-zinc-400"> · {b.reason}</span>}
                  {b.rejoin_after && <span className="text-zinc-400"> · {fmt(b.rejoin_after)}부터 가입 가능</span>}
                </span>
                <span className="text-zinc-500 tabular-nums">{fmt(b.created_at)}</span>
                <button onClick={() => liftBan(b)} className={btn}>
                  금지 해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const PAGE_SIZE = 30
const detailGrid = "grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-xs [&>dt]:text-zinc-500 [&>dd]:text-zinc-200"
const ROLE_LABEL: Record<Role, string> = { member: "일반 회원", creator: "펀딩 개설자", partner: "B2B 파트너", admin: "관리자" }
const day = (v: string) => fmt(v).slice(0, 10)

function Stat({ label, value, hint, tone, wide }: { label: string; value: number; hint?: string; tone?: "warn"; wide?: boolean }) {
  return (
    <div className={`bg-zinc-900 px-4 py-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "warn" ? "text-amber-400" : "text-white"}`}>
        {value.toLocaleString()}
        <span className="ml-0.5 text-xs font-normal text-zinc-500">명</span>
      </dd>
      {hint && <dd className="text-[11px] text-zinc-500">{hint}</dd>}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-zinc-950 border rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-sky-600 cursor-pointer ${
          value === options[0].id ? "border-zinc-800 text-zinc-300" : "border-zinc-600 text-white"
        }`}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </label>
  )
}

function Avatar({ member, size }: { member: AdminMember; size: string }) {
  return (
    <img
      src={member.avatarUrl || "/images/avatar/female.jpg"}
      alt=""
      className={`${size} rounded-full object-cover bg-zinc-800 shrink-0`}
      onError={(e: any) => {
        e.target.src = "/images/avatar/female.jpg"
      }}
    />
  )
}

function RoleTag({ role }: { role: Role }) {
  return <span className="px-1.5 rounded border border-zinc-700 text-[11px] leading-5 text-zinc-300 shrink-0">{ROLE_LABEL[role]}</span>
}

const PROVIDER_DOT: Record<string, string> = { kakao: "bg-[#FEE500]", naver: "bg-[#03C75A]", google: "bg-sky-500", apple: "bg-white", cognito: "bg-zinc-400", email: "bg-zinc-400" }

function Providers({ providers }: { providers: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      {providers.map((p) => (
        <span key={p} className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_DOT[p] || "bg-zinc-500"}`} />
          {PROVIDER_NAME[p] || p}
        </span>
      ))}
    </span>
  )
}

const STATUS_DOT: Record<Status, string> = {
  active: "bg-emerald-400",
  dormant: "bg-zinc-500",
  suspended: "bg-amber-400",
  banned: "bg-red-500",
  withdrawn: "bg-zinc-600",
}

function StatusLabel({ member }: { member: AdminMember }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-300">
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[member.status]}`} />
      {STATUS_LABEL[member.status]}
    </span>
  )
}

function DetailSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="p-5 space-y-3 border-t border-zinc-800">
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        {note && <p className="text-xs text-zinc-500 mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  )
}

import { timingSafeEqual } from "crypto"
import { Hono, type Context } from "hono"
import { config } from "../../../shared/config"
import { requireAdmin } from "../../../shared/auth/require-admin"
import { DuplicatePopupError, popupsRepository } from "../repository"
import { draftFromCandidate } from "./convert"
import { findDuplicates } from "./duplicates"
import { intakeRepository } from "./repository"
import { CANDIDATE_STATUSES, type CandidateCheck, type CandidateStatus } from "./types"
import { isHttpUrl, scoreChecks, todayKst, validateCandidateInput } from "./validation"

// /api/popups 아래에 붙는 자동 수집 후보 · 기간 종료 처리 API
//   수집기   : /collector/...   (Authorization: Bearer POPUP_COLLECTOR_TOKEN)
//   관리자   : /admin/...       (관리자 세션)
// 예전 운영사 팝업 신청(/applications)은 2026-10-16 삭제 (코드는 archive/popup-application/)

export const intakeRoute = new Hono()

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const json = async (c: Context) => c.req.json<Record<string, any>>().catch(() => null)
const adminId = () => config.adminId

// ---------------------------------------------------------------------------
// 수집기
// ---------------------------------------------------------------------------
const requireCollector = async (c: Context, next: () => Promise<void>) => {
  const expected = process.env.POPUP_COLLECTOR_TOKEN || ""
  const got = (c.req.header("authorization") || "").replace(/^Bearer\s+/i, "")
  if (!expected || !got || !safeEqual(got, expected)) return c.json({ success: false, error: "Unauthorized" }, 401)
  await next()
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}
const isBlocked = (url: string, hosts: string[]) => {
  const h = hostOf(url)
  return !!h && hosts.some((b) => h === b || h.endsWith(`.${b}`))
}

// 수집 전에 받아 가는 값: 제외할 사이트, 이미 등록된 팝업(중복 수집 줄이기)
intakeRoute.get("/collector/context", requireCollector, async (c) => {
  const [blocked, popups] = await Promise.all([intakeRepository.listBlockedSources(), popupsRepository.list({ includeUnpublished: true })])
  return c.json({
    success: true,
    today: todayKst(),
    blockedHosts: blocked.map((b) => b.host),
    knownPopups: popups.filter((p) => p.endDate >= todayKst()).map((p) => ({ id: p.id, title: p.title, startDate: p.startDate, endDate: p.endDate })),
  })
})

// 후보 저장: 형식 검증 → 제외 사이트 거름 → 기존 팝업과 중복 검사(검증 항목에 추가) → 점수 → 저장
intakeRoute.post("/collector/candidates", requireCollector, async (c) => {
  const body = await json(c)
  const items: unknown[] = Array.isArray(body?.candidates) ? body!.candidates.slice(0, 100) : []
  const [blocked, popups] = await Promise.all([intakeRepository.listBlockedSources(), popupsRepository.list({ includeUnpublished: true })])
  const blockedHosts = blocked.map((b) => b.host)

  const errors: string[] = []
  const accepted = []
  for (const [i, raw] of items.entries()) {
    const r = validateCandidateInput((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>)
    if (!r.ok) {
      errors.push(`#${i}: ${r.errors.join(" ")}`)
      continue
    }
    if (isBlocked(r.value.sourceUrl, blockedHosts)) continue
    const dup = findDuplicates(r.value, popups)[0]
    const checks: CandidateCheck[] = [
      ...r.value.checks.filter((ch) => ch.key !== "not_duplicate"),
      { key: "not_duplicate", label: "기존 팝업과 중복 아님", ok: !dup, detail: dup ? `${dup.title} (${dup.popupId}) — ${dup.reason}` : "" },
    ]
    accepted.push({ ...r.value, checks, score: scoreChecks(checks), duplicateOf: dup?.popupId ?? null })
  }
  const result = await intakeRepository.insertCandidates(accepted)
  return c.json({ success: true, received: items.length, ...result, rejected: errors })
})

// ---------------------------------------------------------------------------
// 관리자
// ---------------------------------------------------------------------------
const admin = new Hono()
admin.use("*", requireAdmin)

// 대시보드용 대기 건수 (관리자 센터 기능 정의서 3.1)
admin.get("/summary", async (c) => {
  const [counts, popups] = await Promise.all([intakeRepository.counts(), popupsRepository.list({ includeUnpublished: true })])
  const today = todayKst()
  const in7 = new Date(Date.parse(today) + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  return c.json({
    success: true,
    summary: {
      candidatesPending: counts.candidates.pending || 0,
      expiredToEnd: popups.filter((p) => p.endDate < today && p.isPublished).length,
      endingWithin7Days: popups.filter((p) => p.isPublished && p.endDate >= today && p.endDate <= in7).length,
      // 등록 대기: 비공개이고 종료 처리 전인 초안 (자동 수집에서 옮겼거나 관리자가 비공개로 저장)
      draftsWaiting: popups.filter((p) => !p.isPublished && !p.endedAt).length,
    },
  })
})

// --- 자동 수집 후보 ---
admin.get("/candidates", async (c) => {
  const status = c.req.query("status") as CandidateStatus | undefined
  if (status && !CANDIDATE_STATUSES.includes(status)) return c.json({ success: false, error: "잘못된 상태" }, 400)
  return c.json({ success: true, candidates: await intakeRepository.listCandidates({ status }) })
})

// 무시 / 중복으로 표시(duplicateOf) / 다시 미검토로
admin.patch("/candidates/:id", async (c) => {
  const id = c.req.param("id")
  const body = await json(c)
  const cand = await intakeRepository.getCandidate(id)
  if (!cand || !body) return c.json({ success: false, error: "Not Found" }, 404)
  const next = body.status as CandidateStatus
  if (!["pending", "dismissed", "duplicate"].includes(next)) return c.json({ success: false, errors: ["status 는 pending, dismissed, duplicate 중 하나입니다."] }, 400)
  if (cand.status === "converted") return c.json({ success: false, errors: ["이미 초안으로 옮긴 후보입니다."] }, 409)
  const duplicateOf = next === "duplicate" ? String(body.duplicateOf || cand.duplicateOf || "") : cand.duplicateOf
  if (next === "duplicate" && !duplicateOf) return c.json({ success: false, errors: ["중복 대상 팝업을 선택해 주세요."] }, 400)
  const updated = await intakeRepository.updateCandidate(id, { status: next, duplicateOf })
  await intakeRepository.logAction({ targetType: "candidate", targetId: id, action: "status", fromStatus: cand.status, toStatus: next, reason: duplicateOf || "", adminId: adminId() })
  return c.json({ success: true, candidate: updated })
})

admin.post("/candidates/:id/convert", async (c) => {
  const id = c.req.param("id")
  const cand = await intakeRepository.getCandidate(id)
  if (!cand) return c.json({ success: false, error: "Not Found" }, 404)
  if (cand.status === "converted") return c.json({ success: false, errors: ["이미 초안으로 옮긴 후보입니다."] }, 409)
  try {
    const popup = await popupsRepository.create(draftFromCandidate(cand))
    const updated = await intakeRepository.updateCandidate(id, { status: "converted", popupId: popup.id })
    await intakeRepository.logAction({ targetType: "candidate", targetId: id, action: "convert", fromStatus: cand.status, toStatus: "converted", reason: popup.id, adminId: adminId() })
    return c.json({ success: true, candidate: updated, popup }, 201)
  } catch (e) {
    if (e instanceof DuplicatePopupError) return c.json({ success: false, errors: [e.message] }, 409)
    throw e
  }
})

// --- 수집 제외 사이트 ---
admin.get("/blocked-sources", async (c) => c.json({ success: true, sources: await intakeRepository.listBlockedSources() }))

admin.post("/blocked-sources", async (c) => {
  const body = await json(c)
  const raw = String(body?.host || "").trim()
  const host = (isHttpUrl(raw) ? hostOf(raw) : raw.replace(/^www\./, "")).toLowerCase()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return c.json({ success: false, errors: ["사이트 주소(예: example.com)를 입력해 주세요."] }, 400)
  await intakeRepository.addBlockedSource(host, String(body?.reason || "").slice(0, 500))
  await intakeRepository.logAction({ targetType: "candidate", targetId: host, action: "block_source", fromStatus: null, toStatus: null, reason: String(body?.reason || ""), adminId: adminId() })
  return c.json({ success: true, host })
})

admin.delete("/blocked-sources/:host", async (c) => {
  const ok = await intakeRepository.removeBlockedSource(c.req.param("host"))
  return ok ? c.json({ success: true }) : c.json({ success: false, error: "Not Found" }, 404)
})

// --- 기간 종료 처리 (자동 삭제하지 않음, 관리자 확인 후 비공개) ---
const ARCHIVE_AFTER_DAYS = 30

admin.get("/expired", async (c) => {
  const today = todayKst()
  const popups = await popupsRepository.list({ includeUnpublished: true })
  const archiveBefore = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 3600 * 1000
  return c.json({
    success: true,
    today,
    // 종료일이 지났는데 아직 공개 중 → 종료 처리 대상
    toEnd: popups.filter((p) => p.endDate < today && p.isPublished),
    // 종료 처리 후 30일 지남 → 보관(삭제 검토) 대상
    toArchive: popups.filter((p) => !p.isPublished && p.endedAt && Date.parse(p.endedAt) < archiveBefore),
  })
})

admin.post("/end-expired", async (c) => {
  const body = await json(c)
  const ids: string[] | null = Array.isArray(body?.ids) ? body!.ids.map(String) : null
  const today = todayKst()
  const popups = await popupsRepository.list({ includeUnpublished: true })
  const targets = popups.filter((p) => p.endDate < today && p.isPublished && (!ids || ids.includes(p.id)))
  const endedAt = new Date().toISOString()
  for (const p of targets) {
    const { coordinates: _c, ...input } = p
    await popupsRepository.update(p.id, { ...input, status: "ended", statusLabel: "종료", isPublished: false, endedAt })
    await intakeRepository.logAction({ targetType: "popup", targetId: p.id, action: "end_expired", fromStatus: p.status, toStatus: "ended", reason: `종료일 ${p.endDate}`, adminId: adminId() })
  }
  return c.json({ success: true, ended: targets.map((p) => p.id) })
})

intakeRoute.route("/admin", admin)

export async function logPopupDeleted(id: string) {
  await intakeRepository.logAction({ targetType: "popup", targetId: id, action: "delete", fromStatus: null, toStatus: null, reason: "", adminId: adminId() })
}

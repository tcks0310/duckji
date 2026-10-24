import { Hono, type Context } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { db } from "../../shared/db/require-database"
import { B2bError, logAction, tx, ymd } from "./repository"
import { DATE_RE, todayKst } from "./time"
import { APPLY_KINDS, CONTRACT_SLOTS, cleanSlots } from "./validation"

// 계약·광고 기간 (b2b.contracts)
// 입점·광고 신청 건이나 전화·메일로 받은 건을 관리자가 계약 기간과 함께 추가하고, 기간별(진행 중·예정·끝남, 월별)로 봄.
// 홈 광고·공지 팝업은 site-notices 서비스가 띄우고, 계약과의 연결은 notices.items.contract_id 로만 둠 (서비스 간 의존 없음).
// 계약 기간을 바꾸거나 취소하면 관리자 화면이 이어서 /api/notices/admin/contracts/:id/sync 를 불러 광고 기간을 맞춤
// 관리자: GET/POST /api/b2b/admin/contracts, PATCH/DELETE /api/b2b/admin/contracts/:id

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

const toContract = (r: any) => {
  const startsOn = ymd(r.starts_on)!
  const endsOn = ymd(r.ends_on)!
  const today = todayKst()
  return {
    id: Number(r.id),
    code: `C-${r.id}`,
    applicationId: r.application_id === null ? null : Number(r.application_id),
    kind: r.kind as (typeof APPLY_KINDS)[number],
    brandName: r.brand_name as string,
    title: r.title as string,
    slots: r.slots as string[],
    startsOn,
    endsOn,
    amount: r.amount === null ? null : Number(r.amount),
    managerName: r.manager_name as string,
    managerPhone: r.manager_phone as string,
    managerEmail: r.manager_email as string,
    memo: r.memo as string,
    status: r.status as "active" | "cancelled",
    // 한국 날짜 기준 기간 상태 (끝난 날 밤 12시에 끝남)
    period: r.status === "cancelled" ? "cancelled" : today < startsOn ? "upcoming" : today > endsOn ? "ended" : "running",
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  }
}

export type Contract = ReturnType<typeof toContract>

type ContractInput = Omit<Contract, "id" | "code" | "period" | "createdAt" | "updatedAt">

function validateContract(body: Record<string, unknown>, existing?: Contract): { ok: true; value: ContractInput } | { ok: false; errors: string[] } {
  const merged = { ...(existing || {}), ...body } as Record<string, unknown>
  const errors: string[] = []
  const kind = str(merged.kind, 20) || "ad"
  const amountRaw = merged.amount
  const amount = amountRaw === null || amountRaw === undefined || amountRaw === "" ? null : Math.floor(Number(amountRaw))
  const applicationId = Number(merged.applicationId)
  const value: ContractInput = {
    applicationId: Number.isSafeInteger(applicationId) && applicationId > 0 ? applicationId : null,
    kind: kind as ContractInput["kind"],
    brandName: str(merged.brandName, 100),
    title: str(merged.title, 200),
    slots: cleanSlots(merged.slots, CONTRACT_SLOTS),
    startsOn: str(merged.startsOn, 10),
    endsOn: str(merged.endsOn, 10),
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    managerName: str(merged.managerName, 100),
    managerPhone: str(merged.managerPhone, 30),
    managerEmail: str(merged.managerEmail, 200).toLowerCase(),
    memo: str(merged.memo, 3000),
    status: merged.status === "cancelled" ? "cancelled" : "active",
  }
  if (!(APPLY_KINDS as readonly string[]).includes(kind)) errors.push("계약 종류가 올바르지 않습니다.")
  if (!value.brandName) errors.push("주최사·광고주 이름을 입력해 주세요.")
  if (!value.title) errors.push("계약 이름을 입력해 주세요.")
  if (!DATE_RE.test(value.startsOn) || !DATE_RE.test(value.endsOn)) errors.push("계약 시작일과 종료일을 골라 주세요.")
  else if (value.endsOn < value.startsOn) errors.push("종료일이 시작일보다 빠릅니다.")
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1e12)) errors.push("계약 금액을 확인해 주세요.")
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

const COLUMNS = [
  "application_id", "kind", "brand_name", "title", "slots", "starts_on", "ends_on", "amount",
  "manager_name", "manager_phone", "manager_email", "memo", "status",
]
const values = (i: ContractInput) => [
  i.applicationId, i.kind, i.brandName, i.title, i.slots, i.startsOn, i.endsOn, i.amount,
  i.managerName, i.managerPhone, i.managerEmail, i.memo, i.status,
]

async function getContract(id: number) {
  const { rows } = await db().query("SELECT * FROM b2b.contracts WHERE id = $1", [id])
  return rows[0] ? toContract(rows[0]) : null
}

// period: running(진행 중) | upcoming(예정) | ended(끝남) | cancelled(취소), month: YYYY-MM (그 달에 걸친 계약)
async function listContracts(opts: { period?: string; month?: string; applicationId?: number }) {
  const where: string[] = []
  const params: unknown[] = []
  const today = todayKst()
  const p = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }
  if (opts.period === "running") where.push(`status = 'active' AND starts_on <= ${p(today)} AND ends_on >= ${p(today)}`)
  else if (opts.period === "upcoming") where.push(`status = 'active' AND starts_on > ${p(today)}`)
  else if (opts.period === "ended") where.push(`status = 'active' AND ends_on < ${p(today)}`)
  else if (opts.period === "cancelled") where.push(`status = 'cancelled'`)
  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const first = `${opts.month}-01`
    where.push(`starts_on < (${p(first)}::date + INTERVAL '1 month') AND ends_on >= ${p(first)}::date`)
  }
  if (opts.applicationId) where.push(`application_id = ${p(opts.applicationId)}`)
  const { rows } = await db().query(
    `SELECT * FROM b2b.contracts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (status = 'active' AND ends_on >= ${p(today)}) DESC, starts_on, id DESC LIMIT 500`,
    params
  )
  return rows.map(toContract)
}

export const adminContractsRoute = new Hono()
adminContractsRoute.use("*", requireAdmin)

const json = async (c: Context) => c.req.json<Record<string, unknown>>().catch(() => null)
const idParam = (c: Context) => {
  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) throw new B2bError("잘못된 ID 입니다.", 404)
  return id
}

adminContractsRoute.get("/", async (c) => {
  const applicationId = Number(c.req.query("application")) || undefined
  const contracts = await listContracts({ period: c.req.query("period"), month: c.req.query("month"), applicationId })
  return c.json({ success: true, contracts })
})

adminContractsRoute.post("/", async (c) => {
  const body = await json(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validateContract(body)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const contract = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO b2b.contracts (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      values(result.value)
    )
    await logAction(client, { targetType: "contract", targetId: Number(rows[0].id), action: "create", to: rows[0].status })
    return toContract(rows[0])
  })
  return c.json({ success: true, contract }, 201)
})

adminContractsRoute.patch("/:id", async (c) => {
  const existing = await getContract(idParam(c))
  if (!existing) return c.json({ success: false, error: "Not Found" }, 404)
  const body = await json(c)
  if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
  const result = validateContract(body, existing)
  if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
  const contract = await tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE b2b.contracts SET ${COLUMNS.map((col, i) => `${col} = $${i + 2}`).join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [existing.id, ...values(result.value)]
    )
    const changed = existing.status !== rows[0].status
    await logAction(client, {
      targetType: "contract",
      targetId: existing.id,
      action: changed ? "status" : "update",
      from: existing.status,
      to: rows[0].status,
    })
    return toContract(rows[0])
  })
  return c.json({ success: true, contract })
})

adminContractsRoute.delete("/:id", async (c) => {
  const id = idParam(c)
  const deleted = await tx(async (client) => {
    const { rows } = await client.query("DELETE FROM b2b.contracts WHERE id = $1 RETURNING status", [id])
    if (!rows[0]) return false
    await logAction(client, { targetType: "contract", targetId: id, action: "delete", from: rows[0].status })
    return true
  })
  if (!deleted) return c.json({ success: false, error: "Not Found" }, 404)
  return c.json({ success: true })
})

import type { Context } from "hono"
import { getCookie } from "hono/cookie"
import type { PoolClient } from "pg"
import { ADMIN_SESSION_COOKIE, readAdminSession } from "../../shared/auth/admin-session"
import { getOptionalMember } from "../../shared/auth/require-member"
import { db } from "../../shared/db/require-database"

export type Q = Pick<PoolClient, "query">

// 화면에 그대로 보여 줄 오류 (status 와 문구)
export class GalleryError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 429, message: string) {
    super(message)
  }
}

export const fail = (c: Context, e: unknown) => {
  if (e instanceof GalleryError) return c.json({ success: false, error: e.message }, e.status)
  throw e
}

// 라우트 본문을 감싸 GalleryError 는 JSON 오류로
export const run = async (c: Context, fn: () => Promise<Record<string, unknown> | void>, status: 200 | 201 = 200) => {
  try {
    return c.json({ success: true, ...((await fn()) || {}) }, status)
  } catch (e) {
    return fail(c, e)
  }
}

export const adminSession = (c: Context) => readAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))
export const isAdmin = (c: Context) => adminSession(c) !== null
// 관리자 조치 기록용 이름 (회원 관리자는 admin:<회원id>, 비상용 계정은 admin)
export const adminActor = (c: Context) => {
  const s = adminSession(c)
  return s?.memberId ? `admin:${s.memberId}` : "admin"
}

export const idOf = (v: string | undefined | null) => (v && /^\d{1,18}$/.test(v) ? Number(v) : null)
export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
export const jsonBody = (c: Context) => c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)

// 비상용 관리자 계정(ADMIN_ID 로그인)으로 쓴 글의 작성자
export const ADMIN_AUTHOR = { id: "admin", name: "덕지 운영팀" }

export interface Actor {
  id: string
  name: string
  isStaff: boolean // 관리자 권한
}

// 지금 요청한 사람: 회원(관리자 회원이면 isStaff) 또는 비상용 관리자 계정. 둘 다 아니면 null
export function currentActor(c: Context): Actor | null {
  const member = getOptionalMember(c)
  const admin = isAdmin(c)
  if (member) return { id: member.id, name: member.name, isStaff: admin }
  if (admin) return { ...ADMIN_AUTHOR, isStaff: true }
  return null
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

// 한국 시간 오늘 (SQL)
export const KST_TODAY = "(NOW() AT TIME ZONE 'Asia/Seoul')::date"

export const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)

import { randomUUID } from "crypto"
import { pool } from "../../shared/db/pool"
import type { DukjiUser } from "./types"
import { fromRow, type UserRow } from "./rows"
import { recordSignup } from "./members"

export interface UserFilter {
  query?: string
  provider?: string
}

export interface EmailSignupInput {
  email: string
  passwordHash: string
  name: string
  marketingAgreed: boolean
}

export interface UsersRepository {
  list(filter: UserFilter): Promise<DukjiUser[]>
  upsert(input: Partial<DukjiUser>): Promise<DukjiUser>
  delete(id: string): Promise<void>
  findByEmail(email: string): Promise<DukjiUser | null>
  createEmailUser(input: EmailSignupInput): Promise<DukjiUser>
  getPasswordHash(userId: string): Promise<string | null>
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("이미 가입된 이메일입니다.")
  }
}

// 신규 회원 기본값. role·points·status 는 클라이언트 값을 받지 않음
const buildNewUser = (input: Partial<DukjiUser>, now: string): DukjiUser => {
  const provider = input.provider || "kakao"
  return {
    id: input.id || `user-${Date.now()}`,
    name: input.name || "신규 회원",
    email: input.email || `${provider}_user_${Date.now()}@dukji.kr`,
    provider,
    avatarUrl: input.avatarUrl || "/images/avatar/female.jpg",
    phone: input.phone,
    joinedAt: input.joinedAt || now,
    lastLoginAt: now,
    role: "member",
    points: 350,
    status: "active",
    authSource: input.authSource || (provider === "kakao" ? "카카오톡 간편가입" : "소셜 가입"),
    favoriteAnime: input.favoriteAnime,
  }
}

// 이메일이 겹치는 소셜 계정용 대체 주소 (실제 메일 발송에는 쓰지 않음)
const fallbackEmail = (id: string) => `${id}@users.dukji.kr`

const matchesFilter = (u: DukjiUser, { query, provider }: UserFilter) => {
  if (provider && provider !== "all" && u.provider !== provider) return false
  if (!query) return true
  const q = query.toLowerCase()
  return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
}

// 메모리 저장소 (DATABASE_URL 미설정 시, 재시작하면 사라짐)
class MemoryUsersRepository implements UsersRepository {
  private users: DukjiUser[] = []

  async list(filter: UserFilter) {
    return this.users.filter((u) => matchesFilter(u, filter))
  }

  async upsert(input: Partial<DukjiUser>) {
    const now = new Date().toISOString()
    // id 가 있으면 id 로만 찾음 (다른 가입 수단의 같은 이메일 계정을 덮어쓰지 않도록)
    const index = this.users.findIndex((u) => (input.id ? u.id === input.id : u.email === input.email))
    if (index > -1) {
      const existing = this.users[index]
      const saved = {
        ...existing,
        name: input.name || existing.name,
        avatarUrl: input.avatarUrl || existing.avatarUrl,
        lastLoginAt: now,
      }
      this.users[index] = saved
      return saved
    }
    const saved = buildNewUser(input, now)
    if (this.users.some((u) => u.email.toLowerCase() === saved.email.toLowerCase())) saved.email = fallbackEmail(saved.id)
    this.users.unshift(saved)
    return saved
  }

  async delete(id: string) {
    this.users = this.users.filter((u) => u.id !== id)
    this.passwords.delete(id)
  }

  private passwords = new Map<string, string>()

  async findByEmail(email: string) {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
  }

  async createEmailUser(input: EmailSignupInput) {
    if (await this.findByEmail(input.email)) throw new DuplicateEmailError()
    const user = buildNewUser(
      { id: `email-${randomUUID()}`, name: input.name, email: input.email, provider: "email", authSource: "이메일 회원가입" },
      new Date().toISOString()
    )
    this.users.unshift(user)
    this.passwords.set(user.id, input.passwordHash)
    return user
  }

  async getPasswordHash(userId: string) {
    return this.passwords.get(userId) || null
  }
}


// PostgreSQL 저장소 (dukji_users 테이블)
class PostgresUsersRepository implements UsersRepository {
  constructor(private db: NonNullable<typeof pool>) {}

  async list({ query, provider }: UserFilter) {
    // points 는 포인트 원장 잔액으로 덮어씀(뒤 컬럼이 이김). dukji_users.points 는 가입 때 넣은 350 그대로임
    const { rows } = await this.db.query<UserRow>(
      `SELECT u.*, COALESCE((SELECT pb.balance FROM member_point_balances pb WHERE pb.member_id = u.id), 0) AS points
       FROM dukji_users u
       WHERE ($1::text IS NULL OR provider = $1)
         AND ($2::text IS NULL OR name ILIKE $2 OR email ILIKE $2 OR id ILIKE $2)
       ORDER BY joined_at DESC`,
      [provider && provider !== "all" ? provider : null, query ? `%${query}%` : null]
    )
    return rows.map(fromRow)
  }

  async upsert(input: Partial<DukjiUser>) {
    const now = new Date().toISOString()
    const { rows: existing } = await this.db.query<UserRow>(
      "SELECT * FROM dukji_users WHERE id = $1 OR ($1::text IS NULL AND email = $2) LIMIT 1",
      [input.id || null, input.email || null]
    )
    if (existing[0]) {
      const { rows } = await this.db.query<UserRow>(
        `UPDATE dukji_users
         SET name = COALESCE($2, name), avatar_url = COALESCE($3, avatar_url), last_login_at = $4
         WHERE id = $1 RETURNING *`,
        [existing[0].id, input.name || null, input.avatarUrl || null, now]
      )
      return fromRow(rows[0])
    }
    const u = buildNewUser(input, now)
    const insert = (email: string) =>
      this.db.query<UserRow>(
        `INSERT INTO dukji_users
           (id, name, email, provider, avatar_url, phone, joined_at, last_login_at, role, points, status, auth_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [u.id, u.name, email, u.provider, u.avatarUrl, u.phone, u.joinedAt, u.lastLoginAt, u.role, u.points, u.status, u.authSource]
      )
    try {
      return fromRow((await insert(u.email)).rows[0])
    } catch (e: any) {
      // 같은 이메일로 다른 수단 가입이 이미 있으면 계정을 합치지 않고 따로 만듦 (계정 연결은 추후 본인인증과 함께)
      if (e?.code !== "23505") throw e
      return fromRow((await insert(fallbackEmail(u.id))).rows[0])
    }
  }

  async delete(id: string) {
    await this.db.query("DELETE FROM dukji_users WHERE id = $1", [id])
  }

  async findByEmail(email: string) {
    const { rows } = await this.db.query<UserRow>("SELECT * FROM dukji_users WHERE lower(email) = lower($1)", [email])
    return rows[0] ? fromRow(rows[0]) : null
  }

  async createEmailUser(input: EmailSignupInput) {
    if (await this.findByEmail(input.email)) throw new DuplicateEmailError()
    const u = buildNewUser(
      { id: `email-${randomUUID()}`, name: input.name, email: input.email, provider: "email", authSource: "이메일 회원가입" },
      new Date().toISOString()
    )
    const client = await this.db.connect()
    try {
      await client.query("BEGIN")
      const { rows } = await client.query<UserRow>(
        `INSERT INTO dukji_users
           (id, name, email, provider, avatar_url, phone, joined_at, last_login_at, role, points, status, auth_source,
            terms_agreed_at, marketing_agreed)
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11,NOW(),$12) RETURNING *`,
        [u.id, u.name, u.email, u.provider, u.avatarUrl, u.joinedAt, u.lastLoginAt, u.role, u.points, u.status, u.authSource, input.marketingAgreed]
      )
      await client.query("INSERT INTO dukji_user_email_credentials (user_id, password_hash) VALUES ($1, $2)", [u.id, input.passwordHash])
      await recordSignup(client, u.id, u.email, {
        age_14: true,
        terms: true,
        privacy_required: true,
        marketing_email: input.marketingAgreed,
      })
      await client.query("COMMIT")
      return fromRow(rows[0])
    } catch (e: any) {
      await client.query("ROLLBACK")
      if (e?.code === "23505") throw new DuplicateEmailError()
      throw e
    } finally {
      client.release()
    }
  }

  async getPasswordHash(userId: string) {
    const { rows } = await this.db.query<{ password_hash: string }>(
      "SELECT password_hash FROM dukji_user_email_credentials WHERE user_id = $1",
      [userId]
    )
    return rows[0]?.password_hash || null
  }
}

export const usersRepository: UsersRepository = pool
  ? new PostgresUsersRepository(pool)
  : new MemoryUsersRepository()

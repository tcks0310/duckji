import type { DukjiUser } from "./types"

// dukji_users 행 ↔ DukjiUser
export type UserRow = {
  id: string
  name: string
  email: string
  provider: DukjiUser["provider"]
  avatar_url: string | null
  phone: string | null
  joined_at: Date
  last_login_at: Date
  role: DukjiUser["role"]
  points: string
  status: DukjiUser["status"]
  auth_source: string | null
  email_verified?: boolean
  signup_completed_at?: Date | null
  ci_hash?: string | null
  identity_verified_at?: Date | null
  phone_verified_at?: Date | null
}

export const fromRow = (r: UserRow): DukjiUser => ({
  id: r.id,
  name: r.name,
  email: r.email,
  provider: r.provider,
  avatarUrl: r.avatar_url || undefined,
  phone: r.phone || undefined,
  joinedAt: r.joined_at.toISOString(),
  lastLoginAt: r.last_login_at.toISOString(),
  role: r.role,
  points: Number(r.points),
  status: r.status,
  authSource: r.auth_source || "",
  emailVerified: r.email_verified === true,
})

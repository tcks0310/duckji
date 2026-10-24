import { createMiddleware } from "hono/factory"
import { pool } from "./pool"

// DB 가 꼭 필요한 서비스(커뮤니티 등)용. DATABASE_URL 이 없으면 503
export const requireDatabase = createMiddleware(async (c, next) => {
  if (!pool) {
    return c.json({ success: false, error: "데이터베이스가 연결되지 않았습니다. (DATABASE_URL)" }, 503)
  }
  await next()
})

export const db = () => {
  if (!pool) throw new Error("DATABASE_URL is not configured")
  return pool
}

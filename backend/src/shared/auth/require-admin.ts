import { createMiddleware } from "hono/factory"
import { getCookie } from "hono/cookie"
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "./admin-session"

export const requireAdmin = createMiddleware(async (c, next) => {
  if (!isValidAdminSession(getCookie(c, ADMIN_SESSION_COOKIE))) {
    return c.json({ success: false, error: "Unauthorized" }, 401)
  }
  await next()
})

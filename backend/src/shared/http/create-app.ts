import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { config } from "../config"
import type { ServiceDefinition } from "./service"

// 하나 이상의 서비스를 묶어 Hono 앱을 만듭니다.
// - Lambda: 서비스 하나씩 (services/<name>/lambda.ts)
// - 컨테이너/로컬: SERVICES 환경변수로 고른 서비스들 (server.ts)
export function createServiceApp(services: ServiceDefinition[]) {
  const app = new Hono()

  app.use("*", logger())
  app.use(
    "/api/*",
    cors({
      origin: config.frontendOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )

  app.get("/health", (c) => c.json({ ok: true, services: services.map((s) => s.name) }))

  for (const service of services) {
    app.route(service.basePath, service.routes)
  }

  app.onError((err, c) => {
    console.error(err)
    return c.json({ success: false, error: "Internal Server Error" }, 500)
  })

  return app
}

import { serve } from "@hono/node-server"
import { allServices } from "./services"
import { createServiceApp } from "./shared/http/create-app"

// 로컬 개발 · 컨테이너(ECS/EKS) 진입점
// SERVICES=users,admin 처럼 지정하면 그 서비스만 띄우고, 비우면 전체를 한 프로세스로 띄웁니다.
const selected = (process.env.SERVICES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const unknown = selected.filter((name) => !allServices.some((s) => s.name === name))
if (unknown.length) {
  throw new Error(`Unknown service(s): ${unknown.join(", ")}`)
}

const services = selected.length ? allServices.filter((s) => selected.includes(s.name)) : allServices
const port = Number(process.env.PORT || 4000)

serve({ fetch: createServiceApp(services).fetch, port }, () => {
  console.log(`DUCKJI backend [${services.map((s) => s.name).join(", ")}] listening on http://localhost:${port}`)
})

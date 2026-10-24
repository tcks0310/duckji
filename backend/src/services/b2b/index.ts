import type { ServiceDefinition } from "../../shared/http/service"
import { b2bRoute } from "./routes"

export const b2bService: ServiceDefinition = {
  name: "b2b",
  basePath: "/api/b2b",
  routes: b2bRoute,
  needsDatabase: true,
}

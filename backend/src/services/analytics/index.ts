import type { ServiceDefinition } from "../../shared/http/service"
import { analyticsRoute } from "./routes"

export const analyticsService: ServiceDefinition = {
  name: "analytics",
  basePath: "/api/analytics",
  routes: analyticsRoute,
  needsDatabase: true,
}

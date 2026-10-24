import type { ServiceDefinition } from "../../shared/http/service"
import { adminRoute } from "./routes"

export const adminService: ServiceDefinition = {
  name: "admin",
  basePath: "/api/admin",
  routes: adminRoute,
  needsDatabase: false,
}

import type { ServiceDefinition } from "../../shared/http/service"
import { authRoute } from "./routes"

export const authService: ServiceDefinition = {
  name: "auth",
  basePath: "/api/auth",
  routes: authRoute,
  needsDatabase: false,
}

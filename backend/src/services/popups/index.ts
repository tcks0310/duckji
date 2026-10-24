import type { ServiceDefinition } from "../../shared/http/service"
import { popupsRoute } from "./routes"

export const popupsService: ServiceDefinition = {
  name: "popups",
  basePath: "/api/popups",
  routes: popupsRoute,
  needsDatabase: true,
}

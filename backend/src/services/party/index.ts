import type { ServiceDefinition } from "../../shared/http/service"
import { partyRoute } from "./routes"

export const partyService: ServiceDefinition = {
  name: "party",
  basePath: "/api/party",
  routes: partyRoute,
  needsDatabase: true,
}

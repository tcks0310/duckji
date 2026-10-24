import type { ServiceDefinition } from "../../shared/http/service"
import { mapStatsRoute } from "./routes"

export const mapStatsService: ServiceDefinition = {
  name: "map-stats",
  basePath: "/api/map-stats",
  routes: mapStatsRoute,
  needsDatabase: true,
}

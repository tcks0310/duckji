import type { ServiceDefinition } from "../../shared/http/service"
import { rewardsRoute } from "./routes"

export const rewardsService: ServiceDefinition = {
  name: "rewards",
  basePath: "/api/rewards",
  routes: rewardsRoute,
  needsDatabase: true,
}

import type { ServiceDefinition } from "../../shared/http/service"
import { storeRoute } from "./routes"

export const storeService: ServiceDefinition = {
  name: "store",
  basePath: "/api/store",
  routes: storeRoute,
  needsDatabase: true,
}

import type { ServiceDefinition } from "../../shared/http/service"
import { siteNoticesRoute } from "./routes"

export const siteNoticesService: ServiceDefinition = {
  name: "site-notices",
  basePath: "/api/notices",
  routes: siteNoticesRoute,
  needsDatabase: true,
}

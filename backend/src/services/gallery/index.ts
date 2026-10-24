import type { ServiceDefinition } from "../../shared/http/service"
import { galleryRoute } from "./routes"

export const galleryService: ServiceDefinition = {
  name: "gallery",
  basePath: "/api/galleries",
  routes: galleryRoute,
  needsDatabase: true,
}

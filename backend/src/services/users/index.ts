import type { ServiceDefinition } from "../../shared/http/service"
import { usersRoute } from "./routes"

export const usersService: ServiceDefinition = {
  name: "users",
  basePath: "/api/users",
  routes: usersRoute,
  needsDatabase: true,
}

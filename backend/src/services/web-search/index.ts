import type { ServiceDefinition } from "../../shared/http/service"
import { webSearchRoute } from "./routes"

// 홈 통합 검색의 외부(네이버) 검색 결과. 사이트 안 검색은 화면에서 하고, 여기서는 외부 검색만 대신 불러 줍니다.
// DB 를 쓰지 않아 VPC 밖에서 실행 → 네이버 검색 API 에 바로 나갈 수 있음
export const webSearchService: ServiceDefinition = {
  name: "web-search",
  basePath: "/api/web-search",
  routes: webSearchRoute,
  needsDatabase: false,
}

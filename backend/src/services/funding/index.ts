import type { ServiceDefinition } from "../../shared/http/service"
import { fundingRoute } from "./routes"

// 덕지 펀딩 (docs/planning/관리자센터-기능정의서.md 4.4)
// 덕질펀딩 프로젝트(개설·참여·댓글·신고) + 대관(아이노브코리아)·굿즈 제작(더클코리아) 신청
export const fundingService: ServiceDefinition = {
  name: "funding",
  basePath: "/api/funding",
  routes: fundingRoute,
  needsDatabase: true,
}

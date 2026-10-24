import type { ServiceDefinition } from "../shared/http/service"
import { adminService } from "./admin"
import { analyticsService } from "./analytics"
import { authService } from "./auth"
import { b2bService } from "./b2b"
import { fundingService } from "./funding"
import { galleryService } from "./gallery"
import { mapStatsService } from "./map-stats"
import { partyService } from "./party"
import { popupsService } from "./popups"
import { rewardsService } from "./rewards"
import { pushService } from "./push"
import { siteNoticesService } from "./site-notices"
import { storeService } from "./store"
import { usersService } from "./users"
import { webSearchService } from "./web-search"

// 전체 서비스 목록. 새 기능은 services/<이름>/ 폴더를 만들고 여기에 추가합니다.
export const allServices: ServiceDefinition[] = [
  authService,
  usersService,
  adminService,
  popupsService,
  galleryService,
  mapStatsService,
  partyService,
  fundingService,
  b2bService,
  siteNoticesService,
  analyticsService,
  webSearchService,
  rewardsService,
  pushService,
  storeService,
]

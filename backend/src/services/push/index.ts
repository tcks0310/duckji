import type { ServiceDefinition } from "../../shared/http/service"
import { pushRoute } from "./routes"

// 앱 푸시·카카오 알림톡 보내기 (1분마다 EventBridge 스케줄)
// FCM(구글)·솔라피에 나가야 해서 VPC 밖. 보낼 알림은 users 서비스에 서명한 호출로 받아 옴 (users/push.ts)
// FCM 서비스 계정 키는 uploads 버킷 private/push/fcm-service-account.json (없으면 아무것도 안 보냄)
export const pushService: ServiceDefinition = {
  name: "push",
  basePath: "/api/push",
  routes: pushRoute,
  needsDatabase: false,
}

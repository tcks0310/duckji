import type { Hono } from "hono"

// 백엔드 서비스(기능) 하나의 정의
// 서비스끼리는 서로 import 하지 않고, 공통 코드는 shared/ 만 사용합니다.
// 그래야 서비스별로 따로 Lambda / ECS / EKS 에 배포할 수 있습니다.
export interface ServiceDefinition {
  name: string
  basePath: string // 예: /api/users
  routes: Hono<any, any, any>
  needsDatabase: boolean // true 면 RDS 가 있는 VPC 안에서 실행해야 함
}

import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { usersService } from "./index"
import { handleSesNotifications, isSnsEvent } from "./mail-events"
import { handleCognitoMigration, isCognitoMigrationEvent } from "./cognito-migration"

// API Gateway → Lambda 진입점 (users 서비스 단독)
const http = handle(createServiceApp([usersService]))

// SNS(SES 반송·스팸 신고 알림) → 메일 차단 목록, Cognito 사용자 이전 트리거 → 예전 이메일 회원 이전, 나머지는 HTTP
export const handler = async (event: any, context: any) => {
  if (isSnsEvent(event)) return handleSesNotifications(event)
  if (isCognitoMigrationEvent(event)) return handleCognitoMigration(event)
  return http(event, context)
}

import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { b2bService } from "./index"
import { flushOutbox } from "./mailer"

// API Gateway → Lambda 진입점 (b2b 서비스 단독)
const http = handle(createServiceApp([b2bService]))

// 예전 키워드 뉴스레터 스케줄(EventBridge)이 아직 남아 있으면 쌓인 메일만 발송 (뉴스레터는 2026-10-18 삭제, 스케줄도 다음 apply 때 삭제)
export const handler = async (event: any, context: any) => {
  if (event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event") {
    return { mail: await flushOutbox() }
  }
  return http(event, context)
}

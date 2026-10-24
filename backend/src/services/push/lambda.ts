import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { pushService } from "./index"
import { sendPending } from "./send"
import { sendAlimtalkPending } from "./alimtalk"

// API Gateway → Lambda 진입점 (push 서비스 단독)
const http = handle(createServiceApp([pushService]))

// EventBridge 스케줄(1분마다)로 불리면 쌓인 알림을 알림톡·푸시로 보냄 (한쪽이 실패해도 다른 쪽은 보냄)
export const handler = async (event: any, context: any) => {
  if (event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event") {
    const [alimtalk, push] = await Promise.allSettled([sendAlimtalkPending(), sendPending()])
    const out = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? r.value : { error: String((r.reason as Error)?.message || r.reason) })
    if (alimtalk.status === "rejected") console.error("alimtalk", alimtalk.reason)
    if (push.status === "rejected") console.error("push", push.reason)
    return { alimtalk: out(alimtalk), push: out(push) }
  }
  return http(event, context)
}

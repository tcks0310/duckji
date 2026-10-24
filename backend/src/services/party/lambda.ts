import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { partyService } from "./index"

// API Gateway → Lambda 진입점 (party 서비스 단독)
export const handler = handle(createServiceApp([partyService]))

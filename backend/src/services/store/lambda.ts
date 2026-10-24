import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { storeService } from "./index"

// API Gateway → Lambda 진입점 (store 서비스 단독)
export const handler = handle(createServiceApp([storeService]))

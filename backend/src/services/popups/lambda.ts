import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { popupsService } from "./index"

// API Gateway → Lambda 진입점 (popups 서비스 단독)
export const handler = handle(createServiceApp([popupsService]))

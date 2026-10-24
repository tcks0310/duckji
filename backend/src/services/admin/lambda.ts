import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { adminService } from "./index"

// API Gateway → Lambda 진입점 (admin 서비스 단독)
export const handler = handle(createServiceApp([adminService]))

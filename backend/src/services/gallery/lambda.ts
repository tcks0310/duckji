import { handle } from "hono/aws-lambda"
import { createServiceApp } from "../../shared/http/create-app"
import { galleryService } from "./index"

// API Gateway → Lambda 진입점 (gallery 서비스 단독)
export const handler = handle(createServiceApp([galleryService]))

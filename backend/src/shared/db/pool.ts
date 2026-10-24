import pg from "pg"
import { config } from "../config"

// DATABASE_URL 이 있을 때만 PostgreSQL(RDS) 연결
export const pool = config.databaseUrl
  ? new pg.Pool({ connectionString: config.databaseUrl, max: 2 })
  : null

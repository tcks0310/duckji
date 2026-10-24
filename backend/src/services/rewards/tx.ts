import type { PoolClient } from "pg"
import { db } from "../../shared/db/require-database"

export const tx = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await db().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}

// 오늘(한국 날짜) YYYY-MM-DD
export const seoulDay = (d = new Date()) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)

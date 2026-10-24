import type { Context, Hono } from "hono"
import { db } from "../../shared/db/require-database"

// 홈 'SNS 핫클립' 자리 1~4 (관리자 센터 › 컨텐츠 관리 › 핫클립 관리). 표 notices.hot_clips (054)
// 공개: GET /api/notices/hot-clips, 관리자: GET /admin/hot-clips, PUT·DELETE /admin/hot-clips/:slot

export const HOT_CLIP_PLATFORMS = ["youtube", "chzzk", "tiktok", "soop", "instagram", "etc"] as const
export type HotClipPlatform = (typeof HOT_CLIP_PLATFORMS)[number]
export const HOT_CLIP_SLOTS = 4

export interface HotClip {
  slot: number
  platform: HotClipPlatform
  title: string
  creator: string
  thumbnailUrl: string
  linkUrl: string
  updatedAt: string
}

const fromRow = (r: any): HotClip => ({
  slot: Number(r.slot),
  platform: r.platform,
  title: r.title,
  creator: r.creator,
  thumbnailUrl: r.thumbnail_url,
  linkUrl: r.link_url,
  updatedAt: r.updated_at.toISOString(),
})

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
// 썸네일: https 주소 또는 사이트 안 경로, 로컬 개발 업로드는 http://localhost. 링크는 바깥 영상이라 https 만
const IMAGE_URL_RE = /^(https:\/\/|\/(?!\/)|http:\/\/localhost[:/])/

function validate(body: Record<string, unknown>) {
  const value = {
    platform: str(body.platform) as HotClipPlatform,
    title: str(body.title),
    creator: str(body.creator),
    thumbnailUrl: str(body.thumbnailUrl),
    linkUrl: str(body.linkUrl),
  }
  const errors: string[] = []
  if (!HOT_CLIP_PLATFORMS.includes(value.platform)) errors.push("플랫폼을 골라 주세요.")
  if (!value.title || value.title.length > 120) errors.push("제목은 1~120자여야 합니다.")
  if (value.creator.length > 60) errors.push("채널 이름은 60자 이하여야 합니다.")
  if (!IMAGE_URL_RE.test(value.thumbnailUrl)) errors.push("썸네일 이미지를 올려 주세요.")
  if (!/^https:\/\/\S+$/.test(value.linkUrl) || value.linkUrl.length > 1000) errors.push("영상 링크는 https:// 로 시작해야 합니다.")
  return errors.length ? { ok: false as const, errors } : { ok: true as const, value }
}

const slotParam = (c: Context) => {
  const slot = Number(c.req.param("slot"))
  return Number.isInteger(slot) && slot >= 1 && slot <= HOT_CLIP_SLOTS ? slot : null
}

async function list() {
  const { rows } = await db().query(`SELECT * FROM notices.hot_clips ORDER BY slot`)
  return rows.map(fromRow)
}

async function logAction(slot: number, action: "update" | "delete", adminId: string) {
  await db().query(
    `INSERT INTO notices.admin_actions (target_type, target_id, action, admin_id) VALUES ('hot_clip', $1, $2, $3)`,
    [slot, action, adminId]
  )
}

// 공개 경로는 관리자 경로(requireAdmin) 앞에, 관리자 경로는 뒤에 붙여야 해서 둘로 나눔
export function mountPublicHotClips(route: Hono) {
  route.get("/hot-clips", async (c) => {
    c.header("Cache-Control", "public, max-age=60")
    return c.json({ success: true, clips: await list() })
  })
}

export function mountAdminHotClips(route: Hono, adminId: (c: Context) => string) {
  route.get("/admin/hot-clips", async (c) => c.json({ success: true, clips: await list() }))

  route.put("/admin/hot-clips/:slot", async (c) => {
    const slot = slotParam(c)
    if (!slot) return c.json({ success: false, error: "자리는 1~4 중 하나여야 합니다." }, 400)
    const body = await c.req.json<Record<string, unknown>>().catch(() => null)
    if (!body) return c.json({ success: false, errors: ["JSON 본문이 필요합니다."] }, 400)
    const result = validate(body)
    if (!result.ok) return c.json({ success: false, errors: result.errors }, 400)
    const v = result.value
    const { rows } = await db().query(
      `INSERT INTO notices.hot_clips (slot, platform, title, creator, thumbnail_url, link_url, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slot) DO UPDATE SET platform = $2, title = $3, creator = $4, thumbnail_url = $5, link_url = $6,
         updated_by = $7, updated_at = NOW()
       RETURNING *`,
      [slot, v.platform, v.title, v.creator, v.thumbnailUrl, v.linkUrl, adminId(c)]
    )
    await logAction(slot, "update", adminId(c))
    return c.json({ success: true, clip: fromRow(rows[0]) })
  })

  route.delete("/admin/hot-clips/:slot", async (c) => {
    const slot = slotParam(c)
    if (!slot) return c.json({ success: false, error: "자리는 1~4 중 하나여야 합니다." }, 400)
    await db().query(`DELETE FROM notices.hot_clips WHERE slot = $1`, [slot])
    await logAction(slot, "delete", adminId(c))
    return c.json({ success: true })
  })
}

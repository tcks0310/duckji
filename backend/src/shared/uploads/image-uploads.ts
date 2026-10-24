import { randomUUID } from "crypto"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import { dirname, join, normalize } from "path"
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { Context, Hono, MiddlewareHandler } from "hono"
import { config } from "../config"

// 이미지 직접 업로드 공통 모듈 (서비스마다 저장 위치(prefix)·크기 제한만 다르게 씀)
// - s3    (운영): 서버는 서명된 업로드 URL 만 발급 → 브라우저가 S3 에 직접 PUT (Lambda 를 거치지 않음)
//                 서명은 로컬 계산이라 VPC 안 Lambda(인터넷 없음)에서도 동작
//                 키는 <prefix>/YYYY/MM/<uuid>.<ext>, 이미지 전용 CloudFront(img.duckji.com) 로 보임
// - local (개발): backend/.uploads 에 저장하고 해당 서비스가 직접 서빙
// DB 에는 공개 주소(UPLOAD_PUBLIC_BASE_URL/<key>)만 저장합니다.
// private: true 인 저장소(심사 전 파일, private/ 아래)는 CloudFront 로 보이지 않고, 볼 때마다 1시간짜리 서명 주소(viewUrl)를 만들어 보여 줌.
//          DB 에는 같은 형식의 주소를 저장하지만 그 주소로는 열리지 않음. 공개할 때 copyTo 로 공개 저장소에 복사
// 새 prefix 를 쓰면 Lambda 업로드 권한(s3:PutObject)에 그 경로를 더해야 합니다.

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

// 동영상 (videoMaxBytes 를 준 저장소만 받음, 예: 덕지 갤러리 글 첨부)
export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

export interface UploadTicket {
  key: string
  uploadUrl: string
  method: "PUT"
  headers: Record<string, string>
  publicUrl: string // DB 에 저장할 주소
  viewUrl: string // 화면 미리보기용 (공개 저장소는 publicUrl 과 같음, 비공개는 서명 주소)
  withCredentials: boolean // local 업로드는 로그인 쿠키 필요, S3 는 쿠키를 보내면 안 됨
}

export interface ImageStoreOptions {
  prefix: string // 예: "site-notices" (버킷 최상위 폴더, img.duckji.com/<prefix>/... 로 보임. Lambda 업로드 권한에도 추가해야 함)
  maxBytes: number
  allowGif?: boolean // 기본 true
  private?: boolean // 비공개 보관 (prefix 는 private/ 로 시작)
  videoMaxBytes?: number // 주면 동영상(mp4·webm·mov)도 받음, 동영상 크기 제한
}

const VIEW_URL_SECONDS = 3600

const LOCAL_DIR = join(process.cwd(), ".uploads")
let s3: S3Client | null = null

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function imageStore({ prefix, maxBytes, allowGif = true, private: isPrivate = false, videoMaxBytes }: ImageStoreOptions) {
  const imageTypes = Object.fromEntries(Object.entries(IMAGE_TYPES).filter(([t]) => allowGif || t !== "image/gif"))
  const types: Record<string, string> = videoMaxBytes ? { ...imageTypes, ...VIDEO_TYPES } : imageTypes
  const exts = Object.values(types).join("|")
  const keyRe = new RegExp(`^${escapeRe(prefix)}/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.(${exts})$`)
  const typeLabel = Object.values(imageTypes).map((e) => (e === "jpg" ? "JPG" : e.toUpperCase())).join(", ")
  const mb = (n: number) => `${Math.round(n / 1024 / 1024)}MB`
  const sizeLabel = mb(maxBytes)
  const isVideoType = (contentType: string) => Boolean(videoMaxBytes && VIDEO_TYPES[contentType])
  // 종류별 크기 제한 (동영상은 videoMaxBytes)
  const maxBytesFor = (contentType: string) => (isVideoType(contentType) ? videoMaxBytes! : maxBytes)

  const isValidKey = (key: string) => keyRe.test(key)
  const publicUrlFor = (key: string) => `${config.uploadPublicBaseUrl}/${key}`
  const isOwnUrl = (url: string) =>
    url.startsWith(`${config.uploadPublicBaseUrl}/`) && isValidKey(url.slice(config.uploadPublicBaseUrl.length + 1))

  // 주소의 경로 끝에서 이 저장소의 키를 찾음 (도메인·서명 쿼리와 상관없이). 없으면 null
  const tailRe = new RegExp(`(?:^|/)(${escapeRe(prefix)}/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.(?:${exts}))$`)
  const keyFromUrl = (url: string): string | null => {
    try {
      return new URL(url).pathname.match(tailRe)?.[1] ?? null
    } catch {
      return null
    }
  }
  // 저장할 때: 이 저장소 파일이면 서명 주소든 예전 도메인이든 표준 주소로 바꿔 둠
  const canonicalUrl = (url: string) => {
    const key = isPrivate && config.uploadDriver === "s3" ? keyFromUrl(url) : null
    return key ? publicUrlFor(key) : url
  }
  // 보여줄 때: 비공개 저장소 파일이면 서명 주소, 그 밖의 주소는 그대로
  async function viewUrl(url: string): Promise<string> {
    if (!isPrivate || config.uploadDriver !== "s3" || !url) return url
    const key = keyFromUrl(url)
    if (!key) return url
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: config.uploadBucket, Key: key }), { expiresIn: VIEW_URL_SECONDS })
  }
  // 공개할 때: 이 저장소 파일을 target(공개 저장소)으로 복사하고 새 공개 주소를 돌려줌. 다른 주소는 그대로
  async function copyTo(url: string, target: ImageStore): Promise<string> {
    const key = keyFromUrl(url)
    if (!key || config.uploadDriver !== "s3") return url // local 은 개발용이라 그대로 씀
    const ext = key.split(".").pop()
    const now = new Date()
    const newKey = `${target.prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`
    await client().send(
      new CopyObjectCommand({
        Bucket: config.uploadBucket,
        CopySource: `${config.uploadBucket}/${key}`,
        Key: newKey,
        MetadataDirective: "REPLACE",
        ContentType: contentTypeOf(key),
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
    return target.publicUrlFor(newKey)
  }

  // 파일 지우기 (이 저장소 주소만, 다른 주소는 무시). S3 는 없는 키를 지워도 오류 없음
  // 쓰는 서비스는 Lambda 역할에 그 경로의 s3:DeleteObject 권한이 있어야 함
  async function remove(url: string): Promise<void> {
    const key = keyFromUrl(url)
    if (!key || !isValidKey(key)) return
    if (config.uploadDriver === "s3") {
      await client().send(new DeleteObjectCommand({ Bucket: config.uploadBucket, Key: key }))
      return
    }
    await unlink(localPath(key)).catch(() => undefined)
  }

  // 업로드 요청 { contentType, size } 검사. 문제가 있으면 사용자에게 보여줄 문구
  const checkRequest = (contentType: string, size: number) => {
    if (!types[contentType]) {
      return videoMaxBytes ? `${typeLabel} 이미지나 MP4, WEBM, MOV 동영상만 올릴 수 있습니다.` : `${typeLabel} 이미지만 올릴 수 있습니다.`
    }
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytesFor(contentType)) {
      return isVideoType(contentType) ? `동영상은 ${mb(videoMaxBytes!)} 이하만 올릴 수 있습니다.` : `이미지는 ${sizeLabel} 이하만 올릴 수 있습니다.`
    }
    return null
  }

  // local: 개발용 업로드·공개 주소를 만드는 방법 (서비스마다 자기 라우트로 받음)
  async function createTicket(
    contentType: string,
    size: number,
    local: { uploadUrl: (key: string) => string; publicUrl: (key: string) => string }
  ): Promise<UploadTicket> {
    const now = new Date()
    const key = `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${types[contentType]}`
    const headers = { "Content-Type": contentType }

    if (config.uploadDriver === "s3") {
      const uploadUrl = await getSignedUrl(
        client(),
        new PutObjectCommand({
          Bucket: config.uploadBucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size, // 서명에 포함되어 다른 크기로는 올릴 수 없음
          CacheControl: isPrivate ? "private, max-age=3600" : "public, max-age=31536000, immutable",
        }),
        { expiresIn: 300 }
      )
      const publicUrl = publicUrlFor(key)
      return { key, uploadUrl, method: "PUT", headers, publicUrl, viewUrl: await viewUrl(publicUrl), withCredentials: false }
    }
    const publicUrl = local.publicUrl(key)
    return { key, uploadUrl: local.uploadUrl(key), method: "PUT", headers, publicUrl, viewUrl: publicUrl, withCredentials: true }
  }

  // ---- local 드라이버 전용 ----
  const localPath = (key: string) => {
    const path = normalize(join(LOCAL_DIR, key))
    if (!path.startsWith(LOCAL_DIR)) throw new Error("invalid key")
    return path
  }
  async function saveLocal(key: string, data: ArrayBuffer) {
    const path = localPath(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, Buffer.from(data))
  }
  const readLocal = (key: string) => readFile(localPath(key)).catch(() => null)
  const contentTypeOf = (key: string) => {
    const ext = key.split(".").pop()
    return Object.keys(types).find((t) => types[t] === ext) || "application/octet-stream"
  }

  return {
    prefix,
    maxBytes,
    maxBytesFor,
    types,
    isValidKey,
    publicUrlFor,
    isOwnUrl,
    keyFromUrl,
    canonicalUrl,
    viewUrl,
    copyTo,
    remove,
    checkRequest,
    createTicket,
    saveLocal,
    readLocal,
    contentTypeOf,
  }
}

export interface ImageStore {
  prefix: string
  maxBytes: number
  maxBytesFor(contentType: string): number
  types: Record<string, string>
  isValidKey(key: string): boolean
  publicUrlFor(key: string): string
  isOwnUrl(url: string): boolean
  keyFromUrl(url: string): string | null
  canonicalUrl(url: string): string
  viewUrl(url: string): Promise<string>
  copyTo(url: string, target: ImageStore): Promise<string>
  remove(url: string): Promise<void>
  checkRequest(contentType: string, size: number): string | null
  createTicket(
    contentType: string,
    size: number,
    local: { uploadUrl: (key: string) => string; publicUrl: (key: string) => string }
  ): Promise<UploadTicket>
  saveLocal(key: string, data: ArrayBuffer): Promise<void>
  readLocal(key: string): Promise<Buffer | null>
  contentTypeOf(key: string): string
}

function client() {
  if (!config.uploadBucket) throw new Error("UPLOAD_BUCKET is not configured")
  s3 ??= new S3Client({ region: config.uploadRegion })
  return s3
}

// 업로드 라우트 세 개를 한 번에 붙임
//   POST {ticketPath}              업로드 주소 발급 { contentType, size } → { upload }
//   PUT  {localUploadPath}<key>    (개발) 파일 받기
//   GET  {localServePath}<key>     (개발) 파일 보여주기, 누구나
// guard: 업로드 권한 (관리자·회원). ticketPath·localUploadPath 에만 걸림
// serviceBasePath: 이 서비스의 basePath (개발용 주소를 만들 때 씀, 예: /api/popups)
export function mountImageUploads(
  route: Hono<any, any, any>,
  store: ImageStore,
  opts: {
    ticketPath: string
    localUploadPath: string
    localServePath: string
    serviceBasePath: string
    guard?: MiddlewareHandler<any>
    beforeTicket?: (c: Context<any>) => Promise<Response | null> // 정지 회원 막기 등
  }
) {
  // guard 가 있으면 그 뒤에 handler
  const add = (method: "post" | "put", path: string, handler: (c: Context) => Promise<Response>) =>
    opts.guard ? route[method](path, opts.guard, handler) : route[method](path, handler)
  const notFound = (c: Context) => c.json({ success: false, error: "Not Found" }, 404)

  add("post", opts.ticketPath, async (c: Context) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => null)
    const contentType = String(body?.contentType || "")
    const size = Number(body?.size)
    const problem = store.checkRequest(contentType, size)
    if (problem) return c.json({ success: false, error: problem }, 400)
    const blocked = opts.beforeTicket ? await opts.beforeTicket(c) : null
    if (blocked) return blocked
    const origin = new URL(c.req.url).origin + opts.serviceBasePath
    const upload = await store.createTicket(contentType, size, {
      uploadUrl: (key) => `${origin}${opts.localUploadPath}${key}`,
      publicUrl: (key) => `${origin}${opts.localServePath}${key}`,
    })
    return c.json({ success: true, upload })
  })

  add("put", `${opts.localUploadPath}*`, async (c: Context) => {
    if (config.uploadDriver !== "local") return notFound(c)
    const key = c.req.path.split(opts.localUploadPath)[1] || ""
    if (!store.isValidKey(key)) return c.json({ success: false, error: "잘못된 업로드 주소입니다." }, 400)
    const contentType = c.req.header("content-type") || ""
    const data = await c.req.arrayBuffer()
    if (!store.types[contentType] || !key.endsWith(`.${store.types[contentType]}`) || data.byteLength > store.maxBytesFor(contentType)) {
      return c.json({ success: false, error: "올바르지 않은 파일입니다." }, 400)
    }
    await store.saveLocal(key, data)
    return c.json({ success: true })
  })

  route.get(`${opts.localServePath}*`, async (c: Context) => {
    if (config.uploadDriver !== "local") return notFound(c)
    const key = c.req.path.split(opts.localServePath)[1] || ""
    const file = store.isValidKey(key) ? await store.readLocal(key) : null
    if (!file) return notFound(c)
    return c.body(new Uint8Array(file), 200, { "Content-Type": store.contentTypeOf(key), "Cache-Control": "public, max-age=86400" })
  })
}

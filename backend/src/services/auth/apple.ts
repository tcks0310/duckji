import { createHash, createPublicKey, verify, type JsonWebKey } from "node:crypto"
import { config } from "../../shared/config"

// 애플 로그인 (Sign in with Apple)
// 웹은 애플 JS(팝업)가, 앱은 iOS 네이티브 로그인이 identity token(JWT)을 줌 → 서버가 애플 공개키로 서명·발급처·대상·만료를 확인
// 대상(aud)은 웹 Services ID(예: com.duckji.web)와 앱 번들 ID(예: com.duckji.app). APPLE_CLIENT_IDS 에 쉼표로 둘 다 넣음
// 이메일 숨기기를 고르면 @privaterelay.appleid.com 대리 주소가 옴 (그 주소로 보낸 메일은 회원 메일로 전달됨)

const ISSUER = "https://appleid.apple.com"
const KEYS_URL = "https://appleid.apple.com/auth/keys"
const KEY_TTL_MS = 6 * 60 * 60 * 1000

export class AppleTokenError extends Error {}

type AppleKey = JsonWebKey & { kid: string; alg: string }
let keyCache: { keys: AppleKey[]; at: number } | null = null

async function appleKeys(force = false): Promise<AppleKey[]> {
  if (!force && keyCache && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.keys
  const res = await fetch(KEYS_URL)
  if (!res.ok) throw new AppleTokenError("애플 공개키를 가져오지 못했습니다.")
  const data = (await res.json()) as { keys?: AppleKey[] }
  keyCache = { keys: data.keys || [], at: Date.now() }
  return keyCache.keys
}

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"))

export interface AppleClaims {
  sub: string
  email?: string
  emailVerified: boolean
  isPrivateEmail: boolean
}

export const isAppleConfigured = () => config.appleClientIds.length > 0

export async function verifyAppleIdToken(idToken: string, nonce?: string): Promise<AppleClaims> {
  const parts = idToken.split(".")
  if (parts.length !== 3) throw new AppleTokenError("애플 토큰 형식이 올바르지 않습니다.")
  let header: { kid?: string; alg?: string }
  let payload: Record<string, any>
  try {
    header = b64json(parts[0])
    payload = b64json(parts[1])
  } catch {
    throw new AppleTokenError("애플 토큰 형식이 올바르지 않습니다.")
  }
  if (header.alg !== "RS256" || !header.kid) throw new AppleTokenError("지원하지 않는 애플 토큰입니다.")

  // 애플이 키를 바꾼 직후면 캐시에 없을 수 있어 한 번 새로 받음
  let jwk = (await appleKeys()).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid)
  if (!jwk) throw new AppleTokenError("애플 토큰 서명 키를 찾지 못했습니다.")

  const key = createPublicKey({ key: jwk, format: "jwk" })
  const ok = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"))
  if (!ok) throw new AppleTokenError("애플 토큰 서명이 올바르지 않습니다.")

  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== ISSUER) throw new AppleTokenError("애플에서 발급한 토큰이 아닙니다.")
  if (!config.appleClientIds.includes(String(payload.aud))) throw new AppleTokenError("다른 앱에서 발급된 애플 토큰입니다.")
  if (typeof payload.exp !== "number" || payload.exp < now - 60) throw new AppleTokenError("애플 토큰이 만료되었습니다. 다시 로그인해주세요.")
  // 웹 JS 는 보낸 값 그대로, iOS 네이티브는 SHA-256 값을 토큰에 넣음
  const nonceHash = nonce ? createHash("sha256").update(nonce).digest("hex") : ""
  if (nonce && payload.nonce !== nonce && payload.nonce !== nonceHash) throw new AppleTokenError("애플 로그인 요청이 일치하지 않습니다. 다시 시도해주세요.")
  if (!payload.sub) throw new AppleTokenError("애플 사용자 정보를 가져오지 못했습니다.")

  const flag = (v: unknown) => v === true || v === "true"
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: flag(payload.email_verified),
    isPrivateEmail: flag(payload.is_private_email),
  }
}

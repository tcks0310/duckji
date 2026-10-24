import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto"

// 회원 개인정보(실명·전화번호·생년월일·배송지) 컬럼 암호화 (AES-256-GCM)
// 키: MEMBER_DATA_KEY (64자리 hex, users Lambda 에만 넣음)
// 저장 형식: v1.<iv>.<tag>.<본문> (base64url). 키를 바꾸면 기존 값을 못 읽으니 교체 금지.

const devKey = randomBytes(32)

const dataKey = (): Buffer | null => {
  const hex = process.env.MEMBER_DATA_KEY || ""
  if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex")
  // 로컬 개발은 프로세스마다 임시 키 (재시작하면 못 읽음), 운영에서 키가 없으면 저장 거부
  return process.env.NODE_ENV === "production" ? null : devKey
}

export class MemberDataKeyMissingError extends Error {
  constructor() {
    super("회원 정보 암호화 키(MEMBER_DATA_KEY)가 설정되지 않았습니다.")
  }
}

export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  const key = dataKey()
  if (!key) throw new MemberDataKeyMissingError()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return ["v1", iv, cipher.getAuthTag(), body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".")
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null
  const key = dataKey()
  if (!key) return null
  const [version, iv, tag, body] = stored.split(".")
  if (version !== "v1" || !iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

// 휴대폰 번호 중복 확인용 해시 (HMAC, 키 없이는 번호를 맞춰 볼 수 없음). 번호는 숫자만(010...)
export function hashPhone(phone: string): string {
  const key = dataKey()
  if (!key) throw new MemberDataKeyMissingError()
  return createHmac("sha256", key).update(`dukji-phone:${phone}`).digest("hex")
}

// 본인인증 CI 해시 (한 사람 한 계정 확인용, 복원 불가)
export function hashCi(ci: string): string {
  const key = dataKey()
  if (!key) throw new MemberDataKeyMissingError()
  return createHmac("sha256", key).update(`dukji-ci:${ci}`).digest("hex")
}

// 탈퇴 회원 재가입 확인용 이메일 해시 (복원 불가)
export const hashEmail = (email: string) =>
  createHash("sha256").update(`dukji-withdrawn:${email.trim().toLowerCase()}`).digest("hex")

// 관리자 화면용 가리기
export const maskName = (v: string | null) => (v ? v[0] + "*".repeat(Math.max(1, v.length - 1)) : null)
export const maskPhone = (v: string | null) => (v ? v.replace(/^(\d{3})\d+(\d{4})$/, "$1-****-$2") : null)
export const maskAddress = (v: string | null) => (v ? v.split(" ").slice(0, 2).join(" ") + " ***" : null)

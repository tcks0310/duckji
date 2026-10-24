import { randomBytes, scrypt, timingSafeEqual } from "crypto"

// 비밀번호 해시 (Node 내장 scrypt). 저장 형식: scrypt$<salt>$<hash> (base64url)
const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)))
  )

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$")
  if (algo !== "scrypt" || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64url")
  const actual = await derive(password, Buffer.from(salt, "base64url"))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

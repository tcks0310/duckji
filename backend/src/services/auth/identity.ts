import { createHash } from "crypto"
import type { IdentityResult } from "../../shared/auth/member-extra"

// 본인인증 결과 확인 (포트원 V2 → 다날·KG이니시스 등 본인인증 대행사)
// 브라우저가 포트원 창에서 인증을 마치면 identityVerificationId 를 받고, 서버는 그 id 로 포트원에 결과를 직접 조회합니다.
// 브라우저가 보낸 이름·번호는 믿지 않음. 키: PORTONE_API_SECRET (포트원 콘솔 → 결제 연동 → API Secret)

export class IdentityError extends Error {
  constructor(public status: 400 | 503, message: string) {
    super(message)
  }
}

export const isIdentityConfigured = () => Boolean(process.env.PORTONE_API_SECRET)

const normalizePhone = (v: string) => {
  const d = v.replace(/[^\d]/g, "")
  return d.startsWith("82") ? `0${d.slice(2)}` : d
}

export async function fetchIdentity(identityVerificationId: string): Promise<IdentityResult> {
  const secret = process.env.PORTONE_API_SECRET
  if (!secret) throw new IdentityError(503, "본인인증이 아직 준비되지 않았습니다.")
  const lookup = () =>
    fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`, {
      headers: { Authorization: `PortOne ${secret}` },
    })
  let res = await lookup()
  // 창이 닫힌 직후에는 포트원에 결과가 아직 반영되지 않았을 수 있어 잠깐 기다렸다 두 번 더 확인
  for (let i = 0; i < 2 && res.ok; i++) {
    const peek = (await res.clone().json().catch(() => ({}))) as { status?: string }
    if (peek.status === "VERIFIED" || peek.status === "FAILED") break
    await new Promise((r) => setTimeout(r, 1000))
    res = await lookup()
  }
  if (res.status === 404) throw new IdentityError(400, "본인인증 기록을 찾을 수 없습니다. 다시 인증해주세요.")
  if (!res.ok) {
    console.error("portone identity lookup failed", res.status, await res.text().catch(() => ""))
    throw new IdentityError(503, "본인인증 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.")
  }
  const data = (await res.json()) as {
    status?: string
    verifiedCustomer?: {
      name?: string
      phoneNumber?: string
      birthDate?: string
      gender?: string
      isForeigner?: boolean
      ci?: string
    }
  }
  const v = data.verifiedCustomer
  // 값은 남기지 않고 어떤 칸이 왔는지만 기록 (운영 확인용)
  const fields = Object.keys(v || {}).filter((k) => (v as Record<string, unknown>)[k] !== undefined && (v as Record<string, unknown>)[k] !== "")
  if (data.status !== "VERIFIED" || !v?.name) {
    console.warn("portone identity not verified", data.status, fields.join(","))
    throw new IdentityError(400, "본인인증이 완료되지 않았습니다.")
  }
  const phone = normalizePhone(v.phoneNumber || "")
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    console.warn("portone identity without phone", fields.join(","))
    throw new IdentityError(400, "본인인증한 휴대폰 번호를 확인할 수 없습니다.")
  }
  // 테스트 채널 등 CI 를 주지 않는 경우: 이름·번호·생년월일로 만든 대체 값으로 '한 사람 한 계정'을 확인
  let ci = v.ci
  if (!ci) {
    console.warn("portone identity without ci, using fallback key", fields.join(","))
    ci = `noci:${createHash("sha256").update(`${v.name}|${phone}|${v.birthDate || ""}`).digest("hex")}`
  }
  return {
    ci,
    name: v.name,
    phone,
    birthDate: v.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(v.birthDate) ? v.birthDate : null,
    gender: v.gender === "MALE" ? "male" : v.gender === "FEMALE" ? "female" : null,
    foreigner: v.isForeigner === true,
  }
}

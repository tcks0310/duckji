import { apiFetch } from "@/lib/api"
import { uploadNoticeImage } from "@/lib/site-notices"

// 관리자 광고 메시지 보내기 (backend users 서비스 /api/users/admin/ad-messages)
// 받는 사람 = 마케팅 문자 수신 동의(가입 화면·마이페이지 '수신 동의')한 회원. 발송은 솔라피 연결 뒤

export type AdMessageStatus = "draft" | "sent" | "cancelled"

export interface AdMessage {
  id: number
  channel: "sms" | "kakao"
  title: string
  body: string
  imageUrl: string
  linkUrl: string
  scheduledAt: string | null
  status: AdMessageStatus
  recipientCount: number | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdMessageInput {
  title: string
  body: string
  imageUrl: string
  linkUrl: string
  scheduledAt: string | null
}

export const AD_MESSAGE_STATUS_LABELS: Record<AdMessageStatus, string> = { draft: "초안", sent: "보냄", cancelled: "취소" }

// 보낼 때 앞뒤에 붙는 문구 (정보통신망법 50조: (광고)·보내는 곳·무료 수신거부)
export const AD_PREFIX = "(광고)덕지"
export const AD_OPTOUT = "무료수신거부 080-XXX-XXXX" // 솔라피 080 수신거부 번호를 받으면 교체

// 문자 길이는 통신사 기준 바이트(한글 2, 영문·숫자 1). 90 이하 단문, 2000 이하 장문
export const smsBytes = (s: string) => Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
export const fullSmsText = (m: { body: string; linkUrl: string }) =>
  [AD_PREFIX, m.body.trim(), m.linkUrl.trim(), AD_OPTOUT].filter(Boolean).join("\n")
export function smsKind(m: { body: string; linkUrl: string; imageUrl: string }) {
  if (m.imageUrl) return "사진 문자(MMS)"
  return smsBytes(fullSmsText(m)) <= 90 ? "단문(SMS)" : "장문(LMS)"
}

type Result<T> = ({ success: true } & T) | { success: false; errors: string[] }

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await apiFetch(path, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    })
    const json = await res.json()
    if (res.ok && json.success) return json
    return { success: false, errors: json.errors || [json.error || "요청을 처리하지 못했습니다."] }
  } catch {
    return { success: false, errors: ["서버에 연결하지 못했습니다."] }
  }
}

const BASE = "/api/users/admin/ad-messages"
export const fetchAdAudience = () => call<{ sms: number; smsReady: boolean; kakaoReady: boolean }>(`${BASE}/audience`)
export const fetchAdMessages = () => call<{ messages: AdMessage[] }>(BASE)
export const createAdMessage = (input: AdMessageInput) => call<{ message: AdMessage }>(BASE, { method: "POST", body: JSON.stringify(input) })
export const updateAdMessage = (id: number, input: AdMessageInput) =>
  call<{ message: AdMessage }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) })
export const deleteAdMessage = (id: number) => call<{}>(`${BASE}/${id}`, { method: "DELETE" })
export const sendAdMessage = (id: number) => call<{}>(`${BASE}/${id}/send`, { method: "POST", body: "{}" })

// 사진 문자는 통신사 규격상 JPG, 200KB 이하만 됨
export const MMS_IMAGE_MAX_BYTES = 200 * 1024
export async function uploadMmsImage(file: File): Promise<string> {
  if (file.type !== "image/jpeg") throw new Error("사진 문자는 JPG 사진만 보낼 수 있어요.")
  if (file.size > MMS_IMAGE_MAX_BYTES) throw new Error("사진 문자는 200KB 이하 사진만 보낼 수 있어요.")
  return uploadNoticeImage(file)
}

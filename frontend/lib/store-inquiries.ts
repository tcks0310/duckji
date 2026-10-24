import { apiFetch } from "@/lib/api"

// 스토어 견적·제작 문의 (backend b2b 서비스 /api/b2b/inquiries)
// 덕지몰 견적 요청(mall_quote)을 접수하고 관리자 센터 '덕지몰 관리'에서 처리 (커스텀샵 제작 의뢰 custom_order 는 2026-10-16 페이지 삭제, 지난 기록만)

export type InquiryKind = "mall_quote" | "custom_order"

export type InquiryInput = {
  kind: InquiryKind
  companyName?: string
  contactName: string
  contactPhone: string
  contactEmail: string
  items: { name: string; quantity: number; [option: string]: string | number }[]
  details?: Record<string, unknown>
  message?: string
  website?: string // 봇 막기용 숨은 칸 (사람은 비워 둠)
}

export async function submitInquiry(input: InquiryInput): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  try {
    const res = await apiFetch("/api/b2b/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) return { ok: false, error: body.error || "문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요." }
    return { ok: true, code: body.inquiry?.code || "" }
  } catch {
    return { ok: false, error: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." }
  }
}

import { config } from "../../shared/config"
import { imageStore } from "../../shared/uploads/image-uploads"

// 업로드 방식은 shared/uploads/image-uploads.ts (새 prefix 는 Lambda 업로드 권한에도 추가해야 함)

// 덕지몰 품목 사진 (관리자만 올림, 공개)
export const mallImages = imageStore({
  prefix: "mall",
  maxBytes: 8 * 1024 * 1024, // 8MB
})

// 견적 요청 첨부 (시안·참고 사진, 비회원도 올림)
// 문의자 개인 자료라 비공개 보관: 관리자 화면에서만 1시간짜리 서명 주소로 봄
export const inquiryAttachments = imageStore({
  prefix: "private/b2b-inquiries",
  maxBytes: 10 * 1024 * 1024, // 10MB
  allowGif: false,
  private: true,
})

// 문의자가 보낸 첨부 주소 검사: 이 저장소 파일만 받음 (다른 사이트 주소는 버림)
// 운영(s3)은 표준 주소(이미지 도메인)로 바꿔 저장, 로컬 개발은 이 backend(localOrigin)가 서빙하는 주소만
export function cleanAttachments(v: unknown, localOrigin: string, max = 10): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const raw of v) {
    if (typeof raw !== "string" || raw.length > 2000 || !/^https?:\/\//i.test(raw)) continue
    const key = inquiryAttachments.keyFromUrl(raw)
    if (!key) continue
    const localUrl = `${localOrigin}/api/b2b/inquiries/uploads/local/${key}`
    if (config.uploadDriver !== "s3" && raw.split("?")[0] !== localUrl) continue
    const url = config.uploadDriver === "s3" ? inquiryAttachments.publicUrlFor(key) : localUrl
    if (!out.includes(url)) out.push(url)
    if (out.length >= max) break
  }
  return out
}

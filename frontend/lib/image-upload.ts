import { apiFetch } from "@/lib/api"

// 이미지 직접 업로드 공통 (backend shared/uploads/image-uploads.ts 와 짝)
// 1) 서비스에 업로드 주소 발급 요청 → 2) 브라우저가 S3(운영)·backend(로컬)에 직접 PUT → 3) 공개 주소를 돌려줌
// 형식·크기 검사는 서버가 하고 거절 문구를 그대로 보여 줌

// 서비스별 업로드 주소 발급 경로
export const IMAGE_UPLOAD_PATHS = {
  community: "/api/galleries/member-uploads", // 회원 (펀딩 개설, 굿즈 의뢰, 프로필 사진)
  gallery: "/api/galleries/uploads", // 회원·관리자: 갤러리 글 사진 (투표 후보 사진 포함)
  popups: "/api/popups/admin/uploads", // 관리자: 팝업 포스터·갤러리
  party: "/api/party/admin/uploads", // 관리자: 파티 이벤트 대표 이미지
  fundingVenues: "/api/funding/admin/uploads", // 관리자: 대관 공간 사진
  notices: "/api/notices/admin/uploads", // 관리자: 공지 팝업·배너
  mall: "/api/b2b/admin/mall/uploads", // 관리자: 덕지몰 품목 사진
  pilgrimage: "/api/rewards/pilgrimage/uploads", // 관리자: 덕지순례 코스 대표·갤러리·장소 사진
  inquiry: "/api/b2b/inquiries/uploads", // 누구나: 견적·제작 문의 첨부 (시안·참고 사진, 비공개 보관)
  squad: "/api/rewards/squads/uploads", // 스쿼드 리더: 스쿼드 아이콘·표지 이미지
  store: "/api/store/admin/uploads", // 관리자: 굿즈샵 상품 사진
} as const

export type ImageUploadTarget = keyof typeof IMAGE_UPLOAD_PATHS

export async function uploadImageFile(target: ImageUploadTarget, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.")
  const res = await apiFetch(IMAGE_UPLOAD_PATHS[target], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error("로그인이 필요합니다.")
  if (!res.ok || !data.success) throw new Error(data.error || data.errors?.[0] || "이미지를 올리지 못했습니다.")
  const upload = data.upload as { uploadUrl: string; method: "PUT"; headers: Record<string, string>; publicUrl: string; withCredentials?: boolean }
  const put = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: file,
    credentials: upload.withCredentials ? "include" : "omit",
  })
  if (!put.ok) throw new Error("이미지를 올리지 못했습니다.")
  return upload.publicUrl
}

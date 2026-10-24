import { config } from "../../shared/config"
import { imageStore } from "../../shared/uploads/image-uploads"

// 업로드 방식은 shared/uploads/image-uploads.ts (새 prefix 는 Lambda 업로드 권한에도 추가해야 함)

// 덕지순례 코스 대표·갤러리·스팟 사진 (관리자만 올림, 공개)
export const pilgrimageImages = imageStore({
  prefix: "pilgrimage",
  maxBytes: 8 * 1024 * 1024, // 8MB
})

// 스쿼드 아이콘·스쿼드 홈 큰 사진 (리더만 올림, 공개)
export const squadImages = imageStore({
  prefix: "squads",
  maxBytes: 5 * 1024 * 1024, // 5MB (아이콘·스쿼드 홈 큰 사진)
})

// 리더가 보낸 아이콘 주소 검사: 이 저장소 파일만 받음. 운영(s3)은 표준 주소로, 로컬 개발은 이 backend 가 서빙하는 주소 그대로
export function cleanSquadImageUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2000 || !/^https?:\/\//i.test(v)) return null
  const key = squadImages.keyFromUrl(v.split("?")[0])
  if (!key) return null
  if (config.uploadDriver === "s3") return squadImages.publicUrlFor(key)
  return v.split("?")[0].includes("/api/rewards/squads/uploads/local/") ? v.split("?")[0] : null
}

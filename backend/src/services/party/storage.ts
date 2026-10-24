import { imageStore } from "../../shared/uploads/image-uploads"

// 파티 이벤트 대표 이미지 (관리자만 올림). 업로드 방식은 shared/uploads/image-uploads.ts
export const partyImages = imageStore({
  prefix: "party-events",
  maxBytes: 10 * 1024 * 1024, // 10MB
})

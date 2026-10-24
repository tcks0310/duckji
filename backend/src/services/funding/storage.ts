import { imageStore } from "../../shared/uploads/image-uploads"

// 대관 공간 사진 (관리자만 올림). 업로드 방식은 shared/uploads/image-uploads.ts
export const venueImages = imageStore({
  prefix: "funding-venues",
  maxBytes: 10 * 1024 * 1024, // 10MB
  allowGif: false,
})

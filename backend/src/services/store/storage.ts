import { imageStore } from "../../shared/uploads/image-uploads"

// 업로드 방식은 shared/uploads/image-uploads.ts (새 prefix 는 Lambda 업로드 권한에도 추가해야 함)

// 굿즈 상품 사진 (관리자만 올림, 공개)
export const productImages = imageStore({
  prefix: "store",
  maxBytes: 8 * 1024 * 1024, // 8MB
})

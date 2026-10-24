import { imageStore } from "../../shared/uploads/image-uploads"

// 관리자가 등록하는 팝업 포스터·갤러리 사진. 업로드 방식은 shared/uploads/image-uploads.ts
export const popupImages = imageStore({
  prefix: "popups",
  maxBytes: 10 * 1024 * 1024, // 10MB
  allowGif: false,
})

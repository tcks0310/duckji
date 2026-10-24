import { imageStore } from "../../shared/uploads/image-uploads"

// 공지 팝업·배너 이미지 (관리자만 올림). 업로드 방식은 shared/uploads/image-uploads.ts
export const noticeImages = imageStore({
  prefix: "site-notices",
  maxBytes: 5 * 1024 * 1024, // 5MB (팝업 이미지는 첫 화면에 바로 떠서 가볍게)
})

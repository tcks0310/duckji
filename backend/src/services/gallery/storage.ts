import { config } from "../../shared/config"
import { VIDEO_TYPES, imageStore } from "../../shared/uploads/image-uploads"

// 덕지 갤러리 글 첨부 사진·동영상 (회원이 올림, 공개) — 키는 gallery/YYYY/MM/<uuid>.<ext>
// 업로드 방식은 shared/uploads/image-uploads.ts (새 prefix 는 Lambda 업로드 권한·공개 경로에도 추가해야 함)
export const media = imageStore({
  prefix: "gallery",
  maxBytes: 15 * 1024 * 1024, // 사진 15MB
  videoMaxBytes: 100 * 1024 * 1024, // 동영상 100MB
})

export const MAX_MEDIA = 10 // 글 하나에 사진·동영상 합쳐서

const VIDEO_EXTS = new Set(Object.values(VIDEO_TYPES))
export const mediaTypeOf = (url: string): "image" | "video" => (VIDEO_EXTS.has(url.split("?")[0].split(".").pop() || "") ? "video" : "image")

// 글에 붙인 주소가 이 저장소 파일인지. 운영(s3)은 표준 주소만, 로컬 개발은 이 서비스가 서빙하는 주소도
export function isOwnMediaUrl(url: string) {
  if (media.isOwnUrl(url)) return true
  return config.uploadDriver === "local" && url.includes("/api/galleries/uploads/local/") && media.keyFromUrl(url) !== null
}

// 회원 이미지: 프로필 사진·펀딩 개설 썸네일·굿즈 의뢰 참고 이미지 — 키는 members/YYYY/MM/<uuid>.<ext>
// users 서비스가 img.duckji.com/members/ 프로필 주소를 확인함 (users/members.ts OWN_AVATAR_PREFIX)
export const memberImages = imageStore({ prefix: "members", maxBytes: 10 * 1024 * 1024 }) // 10MB

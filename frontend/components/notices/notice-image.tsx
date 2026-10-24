"use client"

import * as React from "react"

// 이미지형 공지 이미지: 모바일 이미지가 있으면 화면 폭 767px 이하에서 그걸 씀
// forceDevice: 관리자 미리보기에서 PC·모바일 이미지를 골라 보여 줄 때
export function NoticeImage({
  imageUrl,
  mobileImageUrl,
  alt,
  className,
  forceDevice,
}: {
  imageUrl: string
  mobileImageUrl: string | null
  alt: string
  className?: string
  forceDevice?: "pc" | "mobile"
}) {
  if (forceDevice) {
    const src = forceDevice === "mobile" ? mobileImageUrl || imageUrl : imageUrl
    return <img src={src} alt={alt} className={className} />
  }
  return (
    <picture>
      {mobileImageUrl && <source media="(max-width: 767px)" srcSet={mobileImageUrl} />}
      <img src={imageUrl} alt={alt} className={className} />
    </picture>
  )
}

// 이미지 전체를 링크로 감쌈 (링크가 없으면 그냥 이미지)
export function NoticeLink({
  href,
  newTab,
  onClick,
  className,
  children,
}: {
  href: string | null
  newTab: boolean
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <a href={href} onClick={onClick} className={className} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  )
}

"use client"

import * as React from "react"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Notice } from "@/components/gallery/gallery-shell"
import { GalleryLayout } from "@/components/gallery/gallery-layout"
import { MoreButton, PostGrid, useFeed } from "@/components/gallery/post-cards"
import { ProfileHeader } from "@/components/gallery/profile-header"
import { ReportButton } from "@/components/gallery/report-box"
import { getSessionMember } from "@/lib/member-auth"
import { fetchFeed, fetchProfile, type Profile } from "@/lib/community-api"

// 다른 회원의 갤러리 홈 (/community/gallery/user?id=<회원id>): 레벨·소개·SNS·스쿼드 + 그 회원 글
export default function MemberGalleryHomePage() {
  return (
    <Suspense fallback={null}>
      <MemberHome />
    </Suspense>
  )
}

function MemberHome() {
  const id = useSearchParams().get("id") || ""
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState("")
  const [viewerId, setViewerId] = useState<string | null>(null)
  const feed = useFeed((cursor) => fetchFeed({ author: id, cursor }), [id])

  useEffect(() => {
    setProfile(null)
    if (!id) return setError("회원을 찾을 수 없습니다.")
    fetchProfile(id)
      .then(setProfile)
      .catch((e) => setError(e.message))
    getSessionMember()
      .then((m) => setViewerId(m?.id || null))
      .catch(() => {})
  }, [id])

  return (
    <GalleryLayout>
      {error && <Notice tone="error">{error}</Notice>}
      {!profile && !error && <Notice>불러오는 중...</Notice>}
      {profile && (
        <>
          <ProfileHeader
            profile={profile}
            actions={viewerId && viewerId !== profile.id ? <ReportButton targetType="member" targetId={profile.id} label="회원 신고" onError={(e: any) => alert(e?.message)} /> : null}
          />
          <h2 className="text-base font-bold text-white">{profile.name} 님의 글</h2>
          {feed.posts === null ? <Notice>불러오는 중...</Notice> : <PostGrid posts={feed.posts} showGallery emptyText="아직 쓴 글이 없어요." />}
          <MoreButton onClick={feed.more} />
        </>
      )}
    </GalleryLayout>
  )
}

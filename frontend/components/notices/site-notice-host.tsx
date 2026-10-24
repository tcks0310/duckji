"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SiteNoticeBar } from "./site-notice-bar"
import { SiteNoticeModal } from "./site-notice-modal"
import { hideNotice, markNoticeShown, recordNoticeEvent, useSiteNotices } from "@/lib/site-notices"

// 모든 화면 공통: 관리자 센터 > 사이트 공지 팝업·배너에서 게시한 레이어 팝업(이미지형·텍스트형)과 띠 배너를 띄움
export function SiteNoticeHost() {
  const pathname = usePathname()
  const { modal, bar } = useSiteNotices(pathname === "/")
  const [closedModal, setClosedModal] = useState<number | null>(null)
  const [closedBar, setClosedBar] = useState<number | null>(null)

  // 관리자 센터에서는 띄우지 않음 (미리보기는 관리 화면 안에서)
  const onAdmin = Boolean(pathname?.startsWith("/admin"))
  const showModal = !onAdmin && modal && closedModal !== modal.id ? modal : null
  const showBar = !onAdmin && bar && closedBar !== bar.id ? bar : null

  useEffect(() => {
    if (!showModal) return
    markNoticeShown(showModal.id)
    recordNoticeEvent(showModal.id, "view")
  }, [showModal?.id])

  useEffect(() => {
    if (showBar) recordNoticeEvent(showBar.id, "view")
  }, [showBar?.id])

  return (
    <>
      {showBar && (
        <SiteNoticeBar
          notice={showBar}
          onLinkClick={() => recordNoticeEvent(showBar.id, "click")}
          onClose={() => {
            markNoticeShown(showBar.id)
            hideNotice(showBar.id, showBar.dismiss)
            setClosedBar(showBar.id)
          }}
        />
      )}
      {showModal && (
        <SiteNoticeModal
          notice={showModal}
          onLinkClick={() => recordNoticeEvent(showModal.id, "click")}
          onClose={(dismiss) => {
            if (dismiss) hideNotice(showModal.id, showModal.dismiss)
            setClosedModal(showModal.id)
          }}
        />
      )}
    </>
  )
}

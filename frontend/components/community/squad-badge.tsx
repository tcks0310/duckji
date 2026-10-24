"use client"

import * as React from "react"
import Link from "next/link"
import { SquadIcon, squadColor } from "@/components/community/squad-icon"

export type SquadBadgeData = { id: number | string; name: string; icon?: string | null; color?: string | null }

// 글쓴이 이름 옆에 붙는 스쿼드 배지 (작은 아이콘 + 이름). 스쿼드가 없으면 아무것도 그리지 않음
// 서버 응답의 authorSquad 를 그대로 넘기면 됨. 누르면 스쿼드 홈으로
// iconOnly: 좁은 카드용. 이름 없이 스쿼드 아이콘만 (마우스를 올리면 스쿼드 이름)
export function SquadBadge({ squad, link = true, iconOnly = false }: { squad?: SquadBadgeData | null; link?: boolean; iconOnly?: boolean }) {
  if (!squad) return null
  const pill = iconOnly ? (
    <span className="inline-flex shrink-0 align-middle" title={`스쿼드 ${squad.name}`} aria-label={`스쿼드 ${squad.name}`}>
      <SquadIcon icon={squad.icon} color={squad.color} size="xs" />
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 max-w-[9rem] pl-0.5 pr-1.5 py-0.5 rounded-md border text-xs leading-none font-semibold align-middle ${squadColor(squad.color).pill}`}
      title={`스쿼드 ${squad.name}`}
    >
      <SquadIcon icon={squad.icon} color={squad.color} size="xs" className="border-0" />
      <span className="truncate">{squad.name}</span>
    </span>
  )
  if (!link) return pill
  return (
    <Link href={`/community/gallery/squad/?id=${squad.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 hover:opacity-80">
      {pill}
    </Link>
  )
}

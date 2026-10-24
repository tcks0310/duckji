"use client"

// 법적 고지 문서 페이지: /terms, /privacy (소셜 로그인 심사·메일 하단·가입 화면 "보기"가 가리키는 주소), /location-terms(덕지순례 도장 위치), /consumer, /refund
// 푸터의 법적 고지 링크는 전부 이 페이지로 열림 (예전 팝업 대신)
// 구성은 실제 서비스들의 정책 페이지 방식: 문서 전환 탭, 버전·시행일, 목차, 본문, 이전 버전 안내
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FileText, ShieldCheck, Scale, AlertCircle, ListOrdered, ArrowUp, MapPin } from "lucide-react"
import { GalleryShell } from "@/components/gallery/gallery-shell"
import {
  ConsumerContent,
  DisputeContent,
  LocationTermsContent,
  LOCATION_VERSION,
  PrivacyContent,
  PRIVACY_VERSION,
  TermsContent,
  TERMS_VERSION,
} from "@/components/legal/legal-documents"

export type DocType = "terms" | "privacy" | "location" | "consumer" | "refund"

const DOCS: Record<
  DocType,
  { title: string; href: string; version: string; icon: React.ElementType; content: () => React.ReactElement }
> = {
  // 탭 순서는 푸터 링크 순서와 같게 (이용약관 → 개인정보처리방침 → 소비자보호안내 → 청약철회)
  terms: { title: "서비스 이용약관", href: "/terms/", version: TERMS_VERSION, icon: FileText, content: TermsContent },
  privacy: { title: "개인정보처리방침", href: "/privacy/", version: PRIVACY_VERSION, icon: ShieldCheck, content: PrivacyContent },
  location: { title: "위치기반서비스 이용약관", href: "/location-terms/", version: LOCATION_VERSION, icon: MapPin, content: LocationTermsContent },
  consumer: { title: "전자상거래 소비자보호안내", href: "/consumer/", version: "현행 고지", icon: Scale, content: ConsumerContent },
  refund: { title: "청약철회(환불)·분쟁해결기준", href: "/refund/", version: "현행 고지", icon: AlertCircle, content: DisputeContent },
}

export function LegalPage({ doc }: { doc: DocType }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<{ id: string; label: string }[]>([])

  // 본문 조항 제목(h3)에 앵커를 붙여 목차를 만듦 (문안이 바뀌어도 목차가 자동으로 따라감)
  useEffect(() => {
    const headings = Array.from(bodyRef.current?.querySelectorAll("h3") ?? [])
    setToc(
      headings.map((h, i) => {
        const id = `section-${i + 1}`
        h.id = id
        h.classList.add("scroll-mt-28")
        return { id, label: h.textContent ?? "" }
      })
    )
  }, [doc])

  const current = DOCS[doc]
  const Content = current.content

  return (
    <GalleryShell activeTab="">
      {/* 문서 전환 */}
      <nav className="flex flex-wrap gap-2 text-xs font-bold" aria-label="정책 문서">
        {(Object.keys(DOCS) as DocType[]).map((key) => {
          const d = DOCS[key]
          const Icon = d.icon
          const active = key === doc
          return (
            <Link
              key={key}
              href={d.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-colors ${
                active
                  ? "bg-emerald-500 text-black border-emerald-500"
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{d.title}</span>
            </Link>
          )
        })}
      </nav>

      {/* 제목·버전 */}
      <header className="space-y-2 pb-4 border-b border-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-black text-white">{current.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>주식회사 시야 (DUCKJI)</span>
          <span>버전 · 시행일: {current.version}</span>
          <span>이전 버전: 없음 (최초 게시)</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* 목차 */}
        <aside className="lg:sticky lg:top-28 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white mb-2">
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
            <span>목차</span>
          </div>
          <ol className="space-y-1.5 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="block text-zinc-400 hover:text-emerald-400 leading-snug">
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        {/* 본문 */}
        <article
          ref={bodyRef}
          className="p-5 sm:p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300 leading-relaxed [&_h3]:text-base [&_h3]:pt-4 [&_p]:text-[13px] [&_li]:text-[13px] [&_table]:text-xs"
        >
          <Content />

          <div className="mt-8 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <span>문의: inc.siaa@gmail.com · 010-8894-2349</span>
            <a href="#" className="inline-flex items-center gap-1 hover:text-white">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>맨 위로</span>
            </a>
          </div>
        </article>
      </div>
    </GalleryShell>
  )
}

"use client"

import * as React from "react"
import { Instagram, Youtube, ShieldCheck, ExternalLink } from "lucide-react"
import { useIsAdmin } from "@/lib/admin-access"
import { usePathname } from "next/navigation"
import { SITE_MENU } from "@/lib/site-menu"
import { BrandTagline } from "@/components/ui/brand-tagline"

// X(예전 트위터)·틱톡 로고는 lucide 에 없어 그림을 직접 둠
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

// 덕지 공식 SNS 계정 주소 (추후 개선: 계정이 생기면 각 주소를 덕지 계정 주소로 바꾸기)
const SNS_LINKS = [
  { label: "인스타그램", href: "https://www.instagram.com/", Icon: Instagram },
  { label: "X", href: "https://x.com/", Icon: XIcon },
  { label: "유튜브", href: "https://www.youtube.com/", Icon: Youtube },
  { label: "틱톡", href: "https://www.tiktok.com/", Icon: TikTokIcon },
]

const CONTACT_EMAIL = "inc.siaa@gmail.com"

// 입점·광고 신청은 창이 아니라 신청 페이지(/partners/apply)로 감
export function Footer() {
  const isAdmin = useIsAdmin()
  // 앱·휴대폰 브라우저에서는 홈 아래에만 사업자 정보 푸터를 보임 (다른 화면은 하단 탭이 대신, 약관은 마이 › 설정에도 있음)
  const onHome = usePathname() === "/"

  return (
    <footer className={`${onHome ? "" : "phone-hide "}bg-[#4a0b14] border-t border-amber-500/20 pt-16 pb-12 mt-24 text-rose-100/70`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* 사이트맵: 대분류·소분류 (상단 메뉴와 같은 목록, lib/site-menu.ts) */}
        <nav aria-label="사이트맵" className="phone-hide grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 text-xs">
          {/* 휴대폰 화면(앱·모바일 웹)은 하단 탭으로 다 갈 수 있어 사이트맵(대분류 목록·파트너 칸) 전체를 숨김 */}
          {SITE_MENU.map((group) => (
            <div key={group.id} className="space-y-3">
              <h4 className="font-bold text-white uppercase tracking-wider"><a href={group.href} className="hover:text-emerald-400 transition-colors">{group.label}</a></h4>
              <ul className="space-y-2 text-zinc-400">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a href={item.href} className="hover:text-emerald-400 transition-colors">
                      {item.label}
                    </a>
                    {item.children && (
                      <ul className="mt-2 ml-1 pl-2.5 border-l border-zinc-800 space-y-1.5 text-[11px] text-zinc-500">
                        {item.children.map((sub) => (
                          <li key={sub.id}>
                            <a href={sub.href} className="hover:text-emerald-400 transition-colors">
                              {sub.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="space-y-3">
            <h4 className="font-bold text-amber-400 uppercase tracking-wider">파트너</h4>
            {/* 입점·광고 신청 페이지 + 제휴 문의 메일 (예전 위쪽 '행사 등록 및 제휴' 칸을 여기로 합침) */}
            <ul className="space-y-2 text-zinc-400">
              <li>
                <a href="/partners/apply/" className="hover:text-amber-400 transition-colors">
                  입점·광고 신청
                </a>
              </li>
              <li className="space-y-1">
                {/* '제휴 문의' 오른편에 주소(누르면 바로 메일 쓰기), 시간은 아래 줄 */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span>제휴 문의</span>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[덕지 제휴 문의]")}`}
                    className="font-mono text-[11px] text-zinc-300 break-all underline underline-offset-4 decoration-zinc-600 hover:text-amber-300 hover:decoration-amber-400 transition-colors"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
                <span className="block text-[11px] text-zinc-500">평일 10:00 - 18:00</span>
              </li>
            </ul>
            {/* 관리자 센터: 파트너 목록과 떼어 빨간색으로 (관리자 권한 회원만 보임) */}
            {isAdmin && (
              // 앱에서는 관리자 링크를 숨김 (관리자 센터는 웹에서)
              <div className="app-hide !mt-6 pt-4 border-t border-red-500/30 space-y-2">
                <h4 className="font-bold text-red-400 uppercase tracking-wider">관리자</h4>
                <a href="/admin" className="block text-red-400 font-bold hover:text-red-300 hover:underline">
                  관리자 센터
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* Legal Links Bar (약관, 개인정보처리방침, 소비자보호법) */}
        <div className="pt-6 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-bold">
            <a
              href="/about"
              className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>회사소개 (About)</span>
            </a>
            <span className="text-zinc-700">|</span>
            <a
              href="/terms/"
              className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>서비스 이용약관</span>
            </a>
            <span className="text-zinc-700">|</span>
            <a
              href="/privacy/"
              className="text-white font-black hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>개인정보처리방침</span>
            </a>
            <span className="text-zinc-700">|</span>
            <a
              href="/consumer/"
              className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>전자상거래 소비자보호안내</span>
            </a>
            <span className="text-zinc-700">|</span>
            <a
              href="/refund/"
              className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>청약철회(환불)·분쟁해결기준</span>
            </a>
          </div>

          <a
            href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=8738103909"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 underline transition-colors"
          >
            <span>공정거래위원회 사업자정보확인</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Consumer Protection Notice Highlight Box (소비자보호법 의무 고지)
            휴대폰 화면에서는 숨김: 같은 내용이 '전자상거래 소비자보호안내'(/consumer/) 페이지에 있음 */}
        <div className="phone-hide p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-2 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-white text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>전자상거래 소비자 권익보호 및 법적 의무 고지 (전자상거래 등에서의 소비자보호에 관한 법률)</span>
          </div>
          <p>
            • <strong>통신판매중개 고지:</strong> 주식회사 시야(덕지 DUCKJI)는 서브컬처 행사/팝업스토어 정보 제공 및 통신판매중개 시스템을 제공하며, 입점사/주최사 및 개설자가 등록한 상품 정보 및 거래에 대해 책임을 지지 않습니다. (단, 덕지가 직접 기획·판매하는 자체 상품 및 서비스의 경우 전자상거래법에 따른 법적 책임을 집니다.)
          </p>
          <p>
            • <strong>청약철회(환불) 보장:</strong> 전자상거래법 제17조에 따라 상품 수령 후 7일 이내에 청약철회가 가능하며, 공정거래위원회 소비자분쟁해결기준을 준수합니다. (맞춤 주문제작 등 법정 제한 사유 제외)
          </p>
          <p>
            • <strong>결제대금보호(에스크로) 및 소비자 피해 구제:</strong> 고객님의 안전한 전자상거래를 위해 구매안전서비스(에스크로) 체계를 지원하며, 분쟁 발생 시 소비자 피해구제 전담 창구(<a href="mailto:inc.siaa@gmail.com" className="text-emerald-400 underline">inc.siaa@gmail.com</a> / 010-8894-2349) 또는 한국소비자원(1372)을 통해 신속히 해결해 드립니다.
          </p>
        </div>

        {/* 맨 아래 한 줄: 왼쪽 로고(아래에 '덕후들의 성지'·SNS), 오른쪽 소개 문구와 사업자 정보 */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <div className="shrink-0 md:w-52 flex flex-col items-center text-center gap-2.5 md:pr-10">
            <div className="inline-flex flex-col items-stretch">
              <img
                src="/images/logo-gold.png"
                alt="덕후들의 성지 덕지 (DUCKJI) 공식 로고"
                className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_2px_12px_rgba(250,213,144,0.45)]"
              />
              <BrandTagline className="text-[10px]" />
            </div>
            {/* SNS 아이콘: 덕지 계정 주소가 아직 없어 각 사이트 기본 주소로 둠. 계정이 생기면 SNS_LINKS 의 주소만 바꾸기 */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {SNS_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-[11px] text-zinc-400 space-y-2.5 leading-relaxed">
            {/* 소개글: 회사 정보와 구분되게 금색 선·조금 큰 글자로 따로 */}
            <p className="pl-3 border-l-2 border-amber-400/70 text-sm font-medium text-amber-100/90 leading-relaxed break-keep">
              애니메이션 팝업스토어, 갤러리, 전시회, 예술 및 음악 이벤트의 모든 일정과 위치 정보를 실시간으로 큐레이션하는 덕후들의 팝업 아카이브 플랫폼입니다.
            </p>
            <div className="!mt-4 pt-3 border-t border-zinc-800/80" aria-hidden />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>상호명:</strong> 주식회사 시야 (SIAA Co., Ltd.)</span>
              <span><strong>대표자:</strong> 이예인</span>
              <span><strong>사업자등록번호:</strong> 873-81-03909</span>
              <span><strong>법인등록번호:</strong> 151111-0010427</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>본점 소재지:</strong> 충청북도 충주시 애향로 10, 3층(봉방동, 현대자동차 충주사옥)</span>
              <span><strong className="text-emerald-400">서울 지점:</strong> <span className="text-zinc-200 font-semibold">서울특별시 강동구 고덕비즈밸리로51, 아이파크더리버 651호</span></span>
              <span><strong>대표전화:</strong> <a href="tel:010-8894-2349" className="text-zinc-300 font-semibold hover:text-emerald-400">010-8894-2349</a></span>
              <span><strong>공식 이메일:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-emerald-400 transition-colors">{CONTACT_EMAIL}</a></span>
              <span><strong>공식 웹사이트:</strong> <a href="https://www.siaa.kr" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline transition-colors">www.siaa.kr</a></span>
            </div>
            <p className="pt-2 text-zinc-500">© 2026 DUCKJI by sohwakgge All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

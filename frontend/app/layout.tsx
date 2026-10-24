import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import { GoogleTranslator } from "@/components/ui/google-translator"
import { SiteNoticeHost } from "@/components/notices/site-notice-host"
import { PageViewTracker } from "@/components/analytics/page-view-tracker"
import { GlobalBgmPlayer } from "@/components/effects/global-bgm-player"
import { ReferralCapture } from "@/components/referral/referral-capture"
import { MouseDuckjiFollower } from "@/components/effects/mouse-duckji-follower"
import { HideInApp } from "@/components/effects/hide-in-app"
import { AppModeMarker } from "@/components/effects/app-mode-marker"
import { APP_DETECT_SCRIPT } from "@/lib/app-mode-script"
import { GoldenFrame } from "@/components/effects/golden-frame"
import { HideOnAdmin } from "@/components/effects/hide-on-admin"
import { MobileTabBar } from "@/components/navigation/mobile-tab-bar"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  themeColor: "#631221",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL("https://www.duckji.com"),
  title: {
    default: "DUCKJI | 취미가 깊어질 때, 꿈이 시작되는 곳",
    template: "%s | DUCKJI — 취미가 깊어질 때, 꿈이 시작되는 곳",
  },
  description:
    "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. 전국 실시간 팝업스토어 안내, 덕지순례 코스, 코스어 투표 및 굿즈 스토어",
  keywords: [
    "덕지", 
    "DUCKJI", 
    "duckji", 
    "덕후들의 성지", 
    "취미가 깊어질 때 꿈이 시작되는 곳",
    "Where Passion Turns to Dreams",
    "팝업스토어", 
    "애니메이션 팝업", 
    "코스어 투표", 
    "코스프레 랭킹", 
    "덕지순례", 
    "성지순례 코스", 
    "덕질 펀딩", 
    "굿즈샵", 
    "성수 팝업", 
    "홍대 애니메이트", 
    "고덕 팝업", 
    "더현대 팝업", 
    "귀멸의 칼날", 
    "나 혼자만 레벨업", 
    "주술회전"
  ],
  authors: [{ name: "DUCKJI Inc.", url: "https://www.duckji.com" }],
  creator: "DUCKJI Inc.",
  publisher: "DUCKJI Inc.",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "https://www.duckji.com",
    languages: {
      "ko-KR": "https://www.duckji.com",
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/logo.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://www.duckji.com",
    siteName: "DUCKJI | 취미가 깊어질 때, 꿈이 시작되는 곳",
    title: "DUCKJI | 취미가 깊어질 때, 꿈이 시작되는 곳",
    description:
      "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. 전국 실시간 팝업스토어 안내, 덕지순례 코스, 코스어 투표 및 굿즈 스토어",
    images: [
      {
        url: "https://www.duckji.com/images/og-main.jpg",
        width: 1200,
        height: 800,
        alt: "DUCKJI & DUCKSOON — 취미가 깊어질 때, 꿈이 시작되는 곳",
      },
      {
        url: "https://www.duckji.com/og-image.jpg",
        width: 1200,
        height: 800,
        alt: "DUCKJI 공식 포스터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DUCKJI | 취미가 깊어질 때, 꿈이 시작되는 곳",
    description:
      "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. 전국 실시간 팝업스토어 안내, 덕지순례 코스, 코스어 투표 및 굿즈 스토어",
    images: ["https://www.duckji.com/images/og-main.jpg"],
    creator: "@duckji_official",
  },
  other: {
    "naver-site-verification": "a6b86d98709cb9430c54ce7e445fa060e604c625",
    "google-site-verification": "google_site_verification_token",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLdWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "DUCKJI | 취미가 깊어질 때, 꿈이 시작되는 곳",
    "url": "https://www.duckji.com",
    "description": "취미가 깊어질 때, 꿈이 시작되는 곳 — DUCKJI. 전국 실시간 팝업스토어 안내, 덕지순례 코스, 코스어 투표 및 굿즈 스토어",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.duckji.com/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }

  const jsonLdOrganization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DUCKJI",
    "url": "https://www.duckji.com",
    "logo": "https://www.duckji.com/logo.png",
    "sameAs": [
      "https://www.duckji.com"
    ]
  }

  return (
    <html lang="ko" className="dark scroll-smooth">
      <head>
        {/* duckji.com -> www.duckji.com 즉시 리다이렉트 (클라이언트 0ms 안전장치) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var h=window.location.hostname;if(h==='duckji.com'){window.location.replace('https://www.duckji.com'+window.location.pathname+window.location.search+window.location.hash);}}catch(e){}})();`,
          }}
        />
        {/* 덕지 앱(웹뷰)에서 열렸으면 <html class="is-app"> (lib/app-mode.ts) */}
        <script dangerouslySetInnerHTML={{ __html: APP_DETECT_SCRIPT }} />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="canonical" href="https://www.duckji.com" />
        {/* SNS / 카카오톡 스크래퍼용 메타 태그 */}
        <meta property="og:image" content="https://www.duckji.com/images/og-main.jpg" />
        <meta property="og:image:secure_url" content="https://www.duckji.com/images/og-main.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="800" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:alt" content="DUCKJI & DUCKSOON — 취미가 깊어질 때, 꿈이 시작되는 곳" />
        <meta name="twitter:image" content="https://www.duckji.com/images/og-main.jpg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
        <Script
          src="https://developers.kakao.com/sdk/js/kakao.min.js"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.className} bg-[#631221] text-zinc-100 min-h-screen w-full max-w-full overflow-x-hidden antialiased selection:bg-amber-400 selection:text-black`}>
        <HideOnAdmin>
          <GoldenFrame />
        </HideOnAdmin>
        <AppModeMarker />
        {children}
        <MobileTabBar />
        <GoogleTranslator />
        <SiteNoticeHost />
        <PageViewTracker />
        <HideOnAdmin>
          {/* 앱에서는 배경 음악·마우스 효과를 뺌 (hj 10-18) */}
          <HideInApp>
            <GlobalBgmPlayer />
            <MouseDuckjiFollower />
          </HideInApp>
          <ReferralCapture />
        </HideOnAdmin>
      </body>
    </html>
  )
}

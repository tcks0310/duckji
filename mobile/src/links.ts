import { Linking, Platform } from "react-native"

// 앱 안(웹뷰)에서 여는 주소: 덕지, 소셜 로그인, 결제(포트원·PG사) 화면
// 그 밖의 사이트(인스타·유튜브 등)는 휴대폰 기본 브라우저로 엶
const IN_APP_HOSTS = [
  "duckji.com",
  "dukji.kr",
  // 로그인
  "kakao.com",
  "naver.com",
  "google.com",
  "apple.com",
  "amazoncognito.com",
  // 결제·본인인증
  "portone.io",
  "iamport.kr",
  "inicis.com",
  "kgmobilians.com",
  "danal.co.kr",
  "kcp.co.kr",
  "nicepay.co.kr",
  "tosspayments.com",
  "toss.im",
  "kakaopay.com",
  "naverpay.com",
  "payco.com",
  // 지도
  "map.naver.com",
  "map.kakao.com",
]

export function isInAppHost(url: string) {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(url)
  if (!m) return false
  const host = m[1].toLowerCase()
  return IN_APP_HOSTS.some((h) => host === h || host.endsWith("." + h))
}

// 덕지 사이트 화면인지 (앱 기능을 부탁할 수 있는 곳은 여기뿐, App.tsx onMessage)
export function isSiteUrl(url: string) {
  const m = /^https:\/\/([^/:?#]+)/i.exec(url)
  if (!m) return false
  const host = m[1].toLowerCase()
  return host === "duckji.com" || host.endsWith(".duckji.com")
}

// 안드로이드 intent:// 주소(카드사·간편결제 앱 호출)를 앱 주소로 바꾸고, 앱이 없으면 플레이 스토어로
function fromIntent(url: string): { app: string | null; store: string | null } {
  const m = /^intent:\/\/(.*)#Intent;(.*)end;?$/i.exec(url)
  if (!m) return { app: null, store: null }
  const params = Object.fromEntries(
    m[2]
      .split(";")
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf("=")
        return [kv.slice(0, i), kv.slice(i + 1)]
      }),
  )
  const app = params.scheme ? `${params.scheme}://${m[1]}` : null
  const fallback = params["S.browser_fallback_url"] ? decodeURIComponent(params["S.browser_fallback_url"]) : null
  const store = params.package ? `market://details?id=${params.package}` : fallback
  return { app, store }
}

export async function openExternal(url: string) {
  if (Platform.OS === "android" && url.startsWith("intent:")) {
    const { app, store } = fromIntent(url)
    try {
      if (app) return await Linking.openURL(app)
    } catch {}
    try {
      if (store) return await Linking.openURL(store)
    } catch {}
    return
  }
  try {
    await Linking.openURL(url)
  } catch {
    // 설치 안 된 앱(카드사 앱 등)은 iOS 에서 실패 → 앱 스토어 검색은 결제창이 따로 안내함
  }
}

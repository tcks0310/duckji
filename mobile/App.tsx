import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useLastNotificationResponse } from "expo-notifications"
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import Feather from "@expo/vector-icons/Feather"
import { BASE_URL, COLORS, TABS, type TabId } from "./src/config"
import { isInAppHost, isSiteUrl, openExternal } from "./src/links"
import { nativeLogin, nativeProviders } from "./src/native-login"
import { getPushDevice, linkOf, type PushDevice } from "./src/push"
import { Onboarding } from "./src/Onboarding"
import { GameScreen, isGameUrl } from "./src/GameScreen"
import * as ScreenOrientation from "expo-screen-orientation"

// 덕지 앱 껍데기: 아래 탭 5개, 탭마다 www.duckji.com 화면(웹뷰)
// 웹은 UA 의 DuckjiApp 으로 앱인 걸 알고 상단 로그인·언어·노래 버튼, 푸터를 숨김 (frontend/lib/app-mode.ts)

type WebViewHandle = Pick<WebView, "reload" | "goBack" | "injectJavaScript">

// 페이지가 열릴 때 웹에 앱이 할 수 있는 일(로그인)과 이 기기의 푸시 토큰을 알려 줌 (frontend/lib/app-bridge.ts)
const bridgeJs = (push: PushDevice | null) =>
  `window.DuckjiNative=${JSON.stringify({ v: 1, login: nativeProviders(), ...(push ? { push } : {}) })};true;`
const ONBOARDED_KEY = "duckji.onboarded"

// 알림 주소가 속한 하단 탭
const tabFor = (path: string): TabId =>
  path.startsWith("/popups") || path.startsWith("/pilgrimage")
    ? "popups"
    : path.startsWith("/funding")
      ? "funding"
      : path.startsWith("/play")
        ? "play"
        : path.startsWith("/store")
      ? "store"
      : path.startsWith("/community")
        ? "gallery"
        : path.startsWith("/mypage") || path.startsWith("/notifications")
          ? "my"
          : "home"

SplashScreen.preventAutoHideAsync().catch(() => {})
// 사이트 화면은 세로 고정, 게임 전체 화면(src/GameScreen.tsx)에서만 가로 허용
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Shell />
    </SafeAreaProvider>
  )
}

function Shell() {
  const insets = useSafeAreaInsets()
  const [active, setActive] = useState<TabId>("home")
  // 처음 누른 탭만 웹뷰를 만들고, 한 번 연 탭은 계속 살려 둬서 보던 화면을 기억
  const [opened, setOpened] = useState<TabId[]>(["home"])
  const [failed, setFailed] = useState<Partial<Record<TabId, boolean>>>({})
  const views = useRef<Partial<Record<TabId, WebViewHandle | null>>>({})
  const canGoBack = useRef<Partial<Record<TabId, boolean>>>({})
  // 알림을 눌러 처음 여는 탭은 그 주소로 시작
  const [startPath, setStartPath] = useState<Partial<Record<TabId, string>>>({})
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [push, setPush] = useState<PushDevice | null>(null)
  const bridge = useMemo(() => bridgeJs(push), [push])
  // 게임 전체 화면에 띄운 게임 주소 (없으면 닫힘)
  const [gameUrl, setGameUrl] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === "1"))
      .catch(() => setOnboarded(true))
  }, [])

  // 이미 허용한 폰이면 열 때마다 토큰을 다시 받아 웹에 알림 (토큰은 가끔 바뀜)
  useEffect(() => {
    if (onboarded) getPushDevice(false).then(setPush)
  }, [onboarded])

  // 열려 있는 화면들에 토큰을 넘기면 로그인한 회원이면 웹이 이 기기를 등록함
  useEffect(() => {
    if (!push) return
    const js = `window.DuckjiNative=Object.assign(window.DuckjiNative||{},{push:${JSON.stringify(push)}});window.dispatchEvent(new Event("duckji-push"));true;`
    Object.values(views.current).forEach((v) => v?.injectJavaScript(js))
  }, [push])

  const finishOnboarding = () => {
    setOnboarded(true)
    AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => {})
  }

  // 알림을 누르면 그 알림의 화면으로 (앱이 꺼져 있다가 열린 경우 포함)
  const response = useLastNotificationResponse()
  const handled = useRef<string | null>(null)
  useEffect(() => {
    const link = linkOf(response)
    const key = response?.notification.request.identifier ?? null
    if (!link || !key || handled.current === key) return
    handled.current = key
    const tab = tabFor(link)
    const view = views.current[tab]
    if (opened.includes(tab) && view) view.injectJavaScript(`window.location.href=${JSON.stringify(BASE_URL + link)};true;`)
    else {
      setStartPath((p) => ({ ...p, [tab]: link }))
      if (!opened.includes(tab)) setOpened((o) => [...o, tab])
    }
    setActive(tab)
  }, [response, opened])

  // 첫 화면이 다 뜨면 시작 화면을 내림 (느린 망에서도 4초 뒤엔 내림)
  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])
  useEffect(() => {
    const t = setTimeout(hideSplash, 4000)
    return () => clearTimeout(t)
  }, [hideSplash])

  const select = (id: TabId) => {
    if (id === active) {
      // 지금 탭을 한 번 더 누르면 그 탭 첫 화면으로
      const root = TABS.find((t) => t.id === id)!.path
      views.current[id]?.injectJavaScript(`window.location.href=${JSON.stringify(BASE_URL + root)};true;`)
      return
    }
    if (!opened.includes(id)) setOpened([...opened, id])
    setActive(id)
  }

  // 안드로이드 뒤로 가기: 탭 안에서 뒤로 → 홈 탭으로 → 앱 닫기 (게임 화면은 Modal 이 따로 받아 닫음)
  useEffect(() => {
    if (Platform.OS !== "android" || gameUrl) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current[active]) {
        views.current[active]?.goBack()
        return true
      }
      if (active !== "home") {
        setActive("home")
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [active, gameUrl])

  const onNav = (id: TabId) => (nav: WebViewNavigation) => {
    canGoBack.current[id] = nav.canGoBack
  }

  // 덕지·로그인·결제 화면만 앱 안에서, 나머지 사이트와 카드사 앱 호출은 밖으로
  // 게임 주소(/games/<게임>/)는 탭 안에서 열지 않고 게임 전체 화면으로
  const onShouldStart = (req: ShouldStartLoadRequest) => {
    const url = req.url
    if (url.startsWith("about:") || url.startsWith("data:") || url.startsWith("blob:")) return true
    if (req.isTopFrame !== false && isGameUrl(url)) {
      setGameUrl(url)
      return false
    }
    if (/^https?:/i.test(url)) {
      if (req.isTopFrame === false || isInAppHost(url)) return true
      openExternal(url)
      return false
    }
    openExternal(url)
    return false
  }

  // 웹이 부탁한 일 (덕지 화면에서 온 것만): 소셜 로그인, 게임 열기 { type: "game", path: "/games/<게임>/" }
  const onMessage = (id: TabId) => async (e: WebViewMessageEvent) => {
    if (!isSiteUrl(e.nativeEvent.url)) return
    let msg: { type?: string; provider?: string; id?: string; path?: string }
    try {
      msg = JSON.parse(e.nativeEvent.data)
    } catch {
      return
    }
    if (msg.type === "game" && typeof msg.path === "string" && isGameUrl(BASE_URL + msg.path)) {
      setGameUrl(BASE_URL + msg.path)
      return
    }
    if (msg.type !== "login" || typeof msg.id !== "string" || typeof msg.provider !== "string") return
    const answer = await nativeLogin(msg.provider)
    const detail = JSON.stringify({ id: msg.id, ...answer })
    views.current[id]?.injectJavaScript(`window.dispatchEvent(new CustomEvent("duckji-native",{detail:${detail}}));true;`)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        {opened.map((id) => {
          const tab = TABS.find((t) => t.id === id)!
          return (
            <View key={id} style={[StyleSheet.absoluteFill, id !== active && styles.hidden]} pointerEvents={id === active ? "auto" : "none"}>
              {failed[id] ? (
                <Offline
                  onRetry={() => {
                    setFailed((f) => ({ ...f, [id]: false }))
                    views.current[id]?.reload()
                  }}
                />
              ) : null}
              <WebView
                ref={(r) => {
                  views.current[id] = r
                }}
                source={{ uri: BASE_URL + (startPath[id] ?? tab.path) }}
                style={[styles.web, failed[id] && styles.hidden]}
                applicationNameForUserAgent="DuckjiApp/1.0"
                originWhitelist={["*"]}
                injectedJavaScriptBeforeContentLoaded={bridge}
                onMessage={onMessage(id)}
                onShouldStartLoadWithRequest={onShouldStart}
                onNavigationStateChange={onNav(id)}
                onLoadEnd={id === "home" ? hideSplash : undefined}
                onError={() => setFailed((f) => ({ ...f, [id]: true }))}
                onContentProcessDidTerminate={() => views.current[id]?.reload()}
                onRenderProcessGone={() => views.current[id]?.reload()}
                setSupportMultipleWindows={false}
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                domStorageEnabled
                geolocationEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsBackForwardNavigationGestures
                pullToRefreshEnabled
                startInLoadingState
                renderLoading={() => <Loading />}
              />
            </View>
          )
        })}
      </View>

      <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) => {
          const on = t.id === active
          return (
            <Pressable key={t.id} onPress={() => select(t.id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
              <Feather name={t.icon} size={22} color={on ? COLORS.gold : COLORS.tabOff} />
              <Text style={[styles.tabLabel, { color: on ? COLORS.gold : COLORS.tabOff }]}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <GameScreen url={gameUrl} onClose={() => setGameUrl(null)} />

      {onboarded === false && (
        <Onboarding
          onAllowPush={async () => {
            setPush(await getPushDevice(true))
          }}
          onDone={finishOnboarding}
        />
      )}
    </View>
  )
}

function Loading() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <ActivityIndicator color={COLORS.gold} />
    </View>
  )
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Feather name="wifi-off" size={36} color={COLORS.tabOff} />
      <Text style={styles.offTitle}>화면을 불러오지 못했어요</Text>
      <Text style={styles.offText}>인터넷 연결을 확인하고 다시 시도해 주세요.</Text>
      <Pressable onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>다시 시도</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.wine },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: COLORS.wine },
  hidden: { opacity: 0 },
  center: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.wine, padding: 24 },
  tabbar: {
    flexDirection: "row",
    backgroundColor: COLORS.deep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  tabLabel: { fontSize: 10, fontWeight: "600" }, // 탭 7개라 글자를 조금 작게
  offTitle: { marginTop: 14, fontSize: 16, fontWeight: "700", color: COLORS.cream },
  offText: { marginTop: 6, fontSize: 13, color: COLORS.muted, textAlign: "center" },
  retry: { marginTop: 20, height: 44, paddingHorizontal: 28, borderRadius: 12, backgroundColor: COLORS.gold, justifyContent: "center" },
  retryText: { fontSize: 15, fontWeight: "700", color: COLORS.deep },
})

import { useEffect } from "react"
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import * as ScreenOrientation from "expo-screen-orientation"
import * as NavigationBar from "expo-navigation-bar"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import Feather from "@expo/vector-icons/Feather"
import { COLORS, GAMES_URL } from "./config"
import { isSiteUrl, openExternal } from "./links"

// 게임 전용 전체 화면: 사이트 화면 위에 새로 뜨고, 주소창·하단 탭·상태 표시줄 없이 게임만 보여 줌
// 게임은 https://games.duckji.com/<게임>/ (덕지 사이트와 따로인 게임 전용 주소, 빌드 결과물만 S3 에 있음, 소스는 게임 비공개 레포)
// 로그인은 사이트 웹뷰와 같은 쿠키 저장소를 써서 그대로 이어짐. 이 화면에서만 가로로 돌릴 수 있음
// 닫기: 왼쪽 위 X, 안드로이드 뒤로 가기, 또는 게임이 postMessage({type:"close"})

const GAMES_HOST = GAMES_URL.replace(/^https:\/\//, "")
export const isGameUrl = (url: string) => {
  const m = /^https:\/\/([^/:?#]+)(\/[a-z0-9-]+)?/i.exec(url)
  return !!m && m[1].toLowerCase() === GAMES_HOST && !!m[2]
}

// 게임이 앱 안인 걸 알 수 있게 (게임 쪽 닫기 버튼 등)
const bridgeJs = `window.DuckjiNative=Object.assign(window.DuckjiNative||{},{v:1,game:true});true;`

export function GameScreen({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const open = url !== null

  useEffect(() => {
    if (!open) return
    ScreenOrientation.unlockAsync().catch(() => {})
    if (Platform.OS === "android") NavigationBar.setVisibilityAsync("hidden").catch(() => {})
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
      if (Platform.OS === "android") NavigationBar.setVisibilityAsync("visible").catch(() => {})
    }
  }, [open])

  // 게임 안에서는 게임 주소만. 덕지 다른 화면으로 가려 하면 게임을 닫고, 다른 사이트는 휴대폰 브라우저로
  const onShouldStart = (req: ShouldStartLoadRequest) => {
    const next = req.url
    if (next.startsWith("about:") || next.startsWith("data:") || next.startsWith("blob:")) return true
    if (req.isTopFrame === false || isGameUrl(next)) return true
    if (isSiteUrl(next)) onClose()
    else openExternal(next)
    return false
  }

  const onMessage = (e: WebViewMessageEvent) => {
    if (!isGameUrl(e.nativeEvent.url)) return
    try {
      if (JSON.parse(e.nativeEvent.data)?.type === "close") onClose()
    } catch {}
  }

  return (
    <Modal
      visible={open}
      animationType="fade"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.root}>
        {open && (
          <WebView
            source={{ uri: url }}
            style={styles.web}
            applicationNameForUserAgent="DuckjiApp/1.0"
            originWhitelist={["*"]}
            injectedJavaScriptBeforeContentLoaded={bridgeJs}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={onShouldStart}
            setSupportMultipleWindows={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            bounces={false}
            overScrollMode="never"
            scrollEnabled={false}
            onContentProcessDidTerminate={(e) => e.nativeEvent && onClose()}
            onRenderProcessGone={() => onClose()}
          />
        )}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="게임 닫기"
          style={[styles.close, { top: Math.max(insets.top, 10), left: Math.max(insets.left, 10) }]}
        >
          <Feather name="x" size={18} color={COLORS.cream} />
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  web: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
})

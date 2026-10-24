import { Platform } from "react-native"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"

// 앱 푸시: 알림 허용 → 기기 토큰(안드로이드 FCM) → 웹 화면에 넘겨 로그인한 회원에 등록 (frontend/lib/app-bridge.ts)
// 서버가 FCM 으로 보냄 (backend/src/services/push). 아이폰은 애플 가입 뒤 FCM 연결과 함께 켬
// Firebase 설정 파일(google-services.json)이 없는 빌드는 토큰을 못 받아서 조용히 넘어감

export type PushDevice = { token: string; platform: "android" | "ios"; appVersion: string }

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

export const pushSupported = Platform.OS === "android"

// ask = 아직 묻지 않았으면 허용 창을 띄움 (처음 열 때 알림 안내 화면의 '알림 받기')
export async function getPushDevice(ask: boolean): Promise<PushDevice | null> {
  if (!pushSupported) return null
  try {
    const perm = await Notifications.getPermissionsAsync()
    let granted = perm.granted
    if (!granted && ask && perm.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted
    if (!granted) return null
    await Notifications.setNotificationChannelAsync("default", {
      name: "덕지 알림",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#F2B636",
    })
    const t = await Notifications.getDevicePushTokenAsync()
    if (typeof t.data !== "string" || !t.data) return null
    return { token: t.data, platform: "android", appVersion: Constants.expoConfig?.version ?? "" }
  } catch (e) {
    console.warn("push token", e)
    return null
  }
}

// 알림을 눌렀을 때 열 주소 (서버가 data.link 에 /mypage/?tab=orders 같은 경로를 넣음)
export const linkOf = (resp: Notifications.NotificationResponse | null | undefined) => {
  const link = resp?.notification.request.content.data?.link
  return typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : null
}

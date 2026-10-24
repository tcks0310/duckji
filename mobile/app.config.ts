import type { ConfigContext, ExpoConfig } from "expo/config"
import keys from "./login-keys.json"

// app.json 에 로그인 설정을 더함. 키가 비어 있는 로그인은 빼고 빌드 (그 로그인은 앱 안 웹 화면 방식 그대로)
// login-keys.json 의 값은 앱에 들어가는 공개 값 (비밀값 아님)
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig["plugins"]> = [...(config.plugins ?? [])]
  if (keys.kakaoNativeAppKey) {
    plugins.push([
      "@react-native-kakao/core",
      {
        nativeAppKey: keys.kakaoNativeAppKey,
        android: { authCodeHandlerActivity: true },
        ios: { handleKakaoOpenUrl: true },
      },
    ])
  }
  if (keys.naverIosUrlScheme) {
    plugins.push(["@react-native-seoul/naver-login", { urlScheme: keys.naverIosUrlScheme }])
  }
  if (keys.googleIosUrlScheme) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: keys.googleIosUrlScheme }])
  }
  // 안드로이드 푸시(Firebase): Expo 환경 변수(파일) GOOGLE_SERVICES_JSON 에 올린 google-services.json. 없으면 푸시 없이 빌드
  const android = process.env.GOOGLE_SERVICES_JSON ? { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : config.android
  return { ...config, name: config.name ?? "덕지", slug: config.slug ?? "duckji", plugins, android }
}

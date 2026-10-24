// @react-native-kakao 3.0.0 은 안드로이드 compileSdk 33 으로 고정돼 있어
// React Native 0.88(compileSdk 34 이상 필요)과 함께 빌드하면 AAR 검사에서 실패함.
// 설치 뒤 앱과 같은 SDK 버전을 쓰도록 바꿈 (EAS 서버의 npm ci 에서도 실행됨)
const fs = require("fs")
const path = require("path")

const file = path.join(__dirname, "..", "node_modules", "@react-native-kakao", "core", "package.json")
if (!fs.existsSync(file)) process.exit(0)
const pkg = JSON.parse(fs.readFileSync(file, "utf8"))
const android = pkg.sdkVersions?.android
if (!android) process.exit(0)
android.compileSdk = Math.max(android.compileSdk, 37)
android.targetSdk = Math.max(android.targetSdk, 36)
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")

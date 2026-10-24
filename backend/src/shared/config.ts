export const config = {
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  adminId: process.env.ADMIN_ID || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  naverClientId: process.env.NAVER_CLIENT_ID || "",
  naverClientSecret: process.env.NAVER_CLIENT_SECRET || "",
  // 통합 검색의 네이버 검색 API (web-search 서비스). 로그인과 같은 네이버 앱에 '검색' API 를 켜서 씀
  naverSearchClientId: process.env.NAVER_SEARCH_CLIENT_ID || "",
  naverSearchClientSecret: process.env.NAVER_SEARCH_CLIENT_SECRET || "",
  // NAVER API HUB(네이버 클라우드) 검색 앱 키. 있으면 위 개발자센터 키보다 먼저 씀
  naverHubClientId: process.env.NAVER_HUB_CLIENT_ID || "",
  naverHubClientSecret: process.env.NAVER_HUB_CLIENT_SECRET || "",
  // 카카오맵 도보 경로 (web-search 서비스, 덕지순례 동선). 로그인과 같은 카카오 앱의 REST API 키
  kakaoRestApiKey: process.env.KAKAO_REST_API_KEY || "",
  databaseUrl: process.env.DATABASE_URL || "",
  // 회원 세션 서명 키 (모든 서비스 같은 값, 32자 이상 무작위 문자열)
  memberSessionSecret: process.env.MEMBER_SESSION_SECRET || "",
  // 소셜 로그인 토큰 검증용 (토큰이 우리 앱에서 발급됐는지 확인)
  kakaoAppId: process.env.KAKAO_APP_ID || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  // 애플 로그인 토큰의 대상(aud): 웹 Services ID, 앱 번들 ID (쉼표로 여러 개)
  appleClientIds: (process.env.APPLE_CLIENT_IDS || "").split(",").map((v) => v.trim()).filter(Boolean),
  // 커뮤니티 이미지 업로드: s3 (운영) | local (개발, backend/.uploads 에 저장)
  uploadDriver: (process.env.UPLOAD_DRIVER || "local") as "s3" | "local",
  uploadBucket: process.env.UPLOAD_BUCKET || "",
  uploadRegion: process.env.UPLOAD_REGION || process.env.AWS_REGION || "ap-northeast-2",
  // 업로드된 이미지를 보여줄 주소 (운영: https://cdn.duckji.com, 로컬: http://localhost:4000/api/galleries/member-uploads/local)
  uploadPublicBaseUrl: (process.env.UPLOAD_PUBLIC_BASE_URL || "http://localhost:4000/api/galleries/member-uploads/local").replace(/\/$/, ""),
  isProduction: process.env.NODE_ENV === "production",
}

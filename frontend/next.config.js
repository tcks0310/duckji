/** @type {import('next').NextConfig} */
const nextConfig = {
  // S3 + CloudFront 정적 배포: `npm run build` 결과가 out/ 폴더에 생성됨 (GitHub Actions frontend.yml 이 out/ 을 올림)
  output: 'export',
  // /funding/detail → /funding/detail/index.html 형태로 생성 (S3 경로 매칭용)
  trailingSlash: true,
  reactStrictMode: true,
  // 관리자 화면 상단에 보여 줄 버전 (package.json 의 version, 베타 기간은 0.x.x)
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig


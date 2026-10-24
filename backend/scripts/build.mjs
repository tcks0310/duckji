// 백엔드 빌드
// - dist/server.js                 : 로컬·컨테이너용 (SERVICES 환경변수로 서비스 선택)
// - dist-lambda/<서비스>/index.mjs  : 서비스별 Lambda 번들 (핸들러: index.handler)
import { build } from "esbuild"
import { readdirSync, statSync } from "fs"
import { join } from "path"

const servicesDir = "src/services"
const services = readdirSync(servicesDir).filter((name) => statSync(join(servicesDir, name)).isDirectory())
const target = process.argv[2] || "all" // all | server | lambda
const only = process.argv[3] // lambda 빌드 시 특정 서비스만 (예: node scripts/build.mjs lambda users)

if (target === "all" || target === "server") {
  await build({
    entryPoints: ["src/server.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: "dist/server.js",
    packages: "external",
  })
  console.log("built dist/server.js")
}

if (target === "all" || target === "lambda") {
  if (only && !services.includes(only)) throw new Error(`Unknown service: ${only}`)
  for (const service of only ? [only] : services) {
    await build({
      entryPoints: [join(servicesDir, service, "lambda.ts")],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "esm",
      outfile: `dist-lambda/${service}/index.mjs`,
      // Lambda 에는 node_modules 가 없으므로 의존성까지 함께 번들
      banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    })
    console.log(`built dist-lambda/${service}/index.mjs`)
  }
}

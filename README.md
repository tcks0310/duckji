# DUCKJI (덕후들의 성지, 덕지)

프론트엔드 · 백엔드 · 모바일 앱 모노레포입니다.

```
duckji/
├── frontend/   # 화면 (Next.js 정적 빌드 → S3 + CloudFront)
│   ├── app/          페이지 (주소 = 폴더 경로, 메뉴 목록은 lib/site-menu.ts)
│   ├── components/   화면 구성 요소
│   ├── lib/          서버 API 호출·로그인·사주 계산 등 화면 로직
│   ├── data/         카드 문구·예시(서버 기능 전 미리보기) 데이터
│   └── public/       이미지·음악·3D 모델
├── backend/    # API 서버 (Hono) — 기능별 서비스, 서비스마다 Lambda 하나 (ECS / EKS 도 가능)
│   ├── src/
│   │   ├── services/   기능별 서비스 (서로 import 하지 않음)
│   │   │   ├── auth/            /api/auth          소셜·이메일 로그인, 가입 인증
│   │   │   ├── users/           /api/users         회원·덕지 포인트(DP)·찜·장바구니·친구 추천
│   │   │   ├── admin/           /api/admin         관리자 세션
│   │   │   ├── popups/          /api/popups        팝업 조회·등록 신청·관리, QR, 자사 팝업 예약
│   │   │   ├── map-stats/       /api/map-stats     지도 클릭 집계·인기 순위
│   │   │   ├── gallery/         /api/galleries     덕지 갤러리 (커뮤니티)
│   │   │   ├── rewards/         /api/rewards       퀴즈·보상 코드·스쿼드·덕지순례·코스프레 랭킹
│   │   │   ├── funding/         /api/funding       펀딩·대관 협력사
│   │   │   ├── party/           /api/party         파티 캘린더 이벤트
│   │   │   ├── b2b/             /api/b2b           입점·광고 신청·계약, 덕지몰 품목·견적
│   │   │   ├── site-notices/    /api/notices       공지 팝업·띠 배너
│   │   │   ├── analytics/       /api/analytics     방문 통계
│   │   │   └── web-search/      /api/web-search    통합 검색의 네이버 결과
│   │   ├── shared/     공통 코드 (설정, DB 연결, 관리자 인증, 앱 생성)
│   │   └── server.ts   로컬·컨테이너 진입점 (SERVICES 로 서비스 선택)
│   ├── scripts/        서비스별 Lambda 번들 빌드
│   └── Dockerfile      ECS / EKS 용 컨테이너
└── mobile/     # 앱 (Expo, 웹 화면을 감싼 앱 껍데기)
```

## 로컬 실행

```bash
npm install                                    # 루트에서 한 번 (frontend·backend 함께 설치)
cp backend/.env.example backend/.env           # ADMIN_PASSWORD 등 입력
cp frontend/.env.example frontend/.env.local
npm run dev:backend                            # http://localhost:4000
npm run dev:frontend                           # http://localhost:3000
```

## 빌드

```bash
npm run build:frontend   # frontend/out/ → S3 에 업로드
npm run build:lambda     # backend/dist-lambda/<서비스>/index.mjs → 서비스별 Lambda 에 업로드 (핸들러: index.handler)
docker build -f backend/Dockerfile -t duckji-backend .   # 컨테이너 (실행 시 SERVICES=users 등으로 서비스 선택)
```

## 백엔드에 새 기능 추가하기

1. `backend/src/services/<이름>/` 폴더를 만들고 `routes.ts`, `index.ts`, `lambda.ts` 를 기존 서비스처럼 작성합니다.
2. `backend/src/services/index.ts` 의 `allServices` 에 추가하고, `.github/workflows/backend-auth.yml` 을 복사해 서비스용 CI/CD 를 만듭니다. 서비스용 Lambda·API 라우트와 필요한 DB 테이블이 준비된 뒤에 배포됩니다 (없으면 배포 단계는 건너뜀).
3. 다른 서비스 폴더의 코드는 import 하지 않습니다. 함께 써야 하는 코드는 `shared/` 로 옮기고, 서비스 간 데이터는 DB 또는 API 호출로 주고받습니다.

이렇게 하면 서비스마다 Lambda 하나로 올리거나, 컨테이너로 묶어 ECS / EKS 에 올리는 것을 자유롭게 고를 수 있습니다.

## 배포 구성

| 계층 | AWS | 도메인 |
| --- | --- | --- |
| 프론트엔드 | S3 + CloudFront | `www.duckji.com` (가비아 DNS CNAME) |
| 백엔드 | API Gateway(HTTP API) + Lambda | `api.duckji.com` (가비아 DNS CNAME) |
| DB | RDS PostgreSQL | — |

- frontend 는 `trailingSlash: true` 로 빌드되므로, CloudFront Function 으로 `/경로/` 요청에 `index.html` 을 붙여 주어야 합니다.
- 펀딩 상세 페이지 주소는 `/funding/detail/?id=<프로젝트ID>` 입니다 (정적 배포용).
- 관리자 비밀번호 등 비밀값은 backend 환경변수로만 설정합니다. `NEXT_PUBLIC_` 값은 브라우저에 그대로 노출됩니다.

---

## 문구 직접 고치기 (비개발자용)
1. **물상 카드 22장 문구**: `frontend/data/tarot-cards.json` 의 이름(`name`), 풀이(`inner`, `outer`), 질문별 한 줄(`q`), 행운 팁(`tip`).
2. **주사위·설정**: `frontend/data/dice-lines.json`(주사위 조합), `frontend/data/tarot-config.json`(이벤트 토글 등). 덕력 퀴즈 문제·보상 코드는 관리자 화면에서 고칩니다.
3. 따옴표(`"`)와 쉼표(`,`) 형식을 그대로 두고, 과장 표현(무조건, 확정 등)은 넣지 않습니다.

## 주요 주소
메뉴 기준은 `frontend/lib/site-menu.ts` 입니다. 소분류는 항상 대분류 주소 아래에 둡니다.

| 대분류 | 주소 |
| --- | --- |
| 팝업 | `/popups/` (지금 뜨는 팝업), `/popups/calendar/` (일정·지도), `/popups/pilgrimage/` (덕지순례), `/popups/mapniverse/`, `/popups/detail/?id=`|
| 펀딩 | `/funding/`, `/funding/new/`, `/funding/my/`, `/funding/goods-request/`, `/funding/party/`, `/funding/group-buy/`, `/funding/detail/?id=` |
| 스토어 | `/store/`, `/store/goods/`, `/store/custom/`, `/store/mall/` (견적 `/store/mall/quote/`), `/store/cart/` |
| 커뮤니티 | `/community/`, `/community/gallery/` 아래 갤러리 화면들 |
| 운세·놀이 | `/play/`, `/play/saju-ai/`, `/play/quiz/`, `/play/saju/`, `/play/mbti/` (draw·cards·dice·code), `/play/ar/` |
| 회원 | `/login/`, `/join/`, `/signup/`, `/mypage/` (`?tab=` 로 탭 선택), `/mypage/liked/`, `/search/` |
| 기타 | `/about/`, `/terms/`, `/privacy/`, `/refund/`, `/consumer/`, `/admin/` (관리자) |

예전 주소(`/tarot`, `/saju`, `/community/cosplay` 등)는 넘겨주지 않고 404 가 정상입니다.

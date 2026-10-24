# DUCKJI backend 컨테이너 (ECS / EKS 용)
# 레포 루트에서 빌드:  docker build -f backend/Dockerfile -t duckji-backend .
# 실행 시 서비스 선택: docker run -e SERVICES=users -e DATABASE_URL=... -p 4000:4000 duckji-backend
#   (SERVICES 를 비우면 전체 서비스를 한 컨테이너에서 실행)

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w @duckji/backend --include-workspace-root=false
COPY backend backend
RUN npm run build -w @duckji/backend

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w @duckji/backend --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
USER node
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]

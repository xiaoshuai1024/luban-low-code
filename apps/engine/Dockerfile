# =============================================================
# Engine — Vite SPA → Nginx
# 构建上下文：repository root（docker-compose context: .）
# =============================================================
FROM node:20-alpine AS build
WORKDIR /app

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# 复制 workspace 清单 + lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# 复制 UI 源码（vite alias 直读 src/index.ts）
COPY packages/ui/packages/luban-base/ packages/ui/packages/luban-base/
COPY packages/ui/packages/luban-low-code/ packages/ui/packages/luban-low-code/
# luban-low-code tsconfig extends ../../tsconfig.base.json
COPY packages/ui/tsconfig.base.json packages/ui/tsconfig.base.json

# 复制 engine 源码
COPY apps/engine/ apps/engine/

# 安装依赖（仅 engine 及其 workspace deps）
RUN pnpm install --frozen-lockfile --filter ./apps/engine

# 构建（跳 vue-tsc：不认 vite alias，已知限制 §11；直接 vite build）
RUN cd apps/engine && npx vite build

# ---- runtime ----
FROM nginx:1.26-alpine
COPY --from=build /app/apps/engine/dist /usr/share/nginx/html
COPY apps/engine/deploy/docker/nginx-manage.conf /etc/nginx/conf.d/default.conf
EXPOSE 4200

# =============================================================
# Website — Nuxt SSR
# 构建上下文：repository root（docker-compose context: .）
# =============================================================
FROM node:20-alpine AS build
WORKDIR /app

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# 复制 workspace 清单 + lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# 复制 UI 源码（需先构建 dist/ 供 nuxt alias 引用）
COPY packages/ui/ packages/ui/

# 复制 website 源码
COPY apps/website/ apps/website/

# 安装根 workspace 依赖
RUN pnpm install --frozen-lockfile --filter ./apps/website

# 构建 UI packages（产出 packages/ui/packages/*/dist/）
RUN cd packages/ui && \
    pnpm install --frozen-lockfile && \
    pnpm exec nx run-many --target=build --projects=luban-base,luban-low-code

# 构建 website
# NUXT_APP_BASE_URL：生产根域名部署为 /（默认 /luban-low-code/ 是 GitHub Pages 子路径遗留）
ARG NUXT_APP_BASE_URL=/
ENV NUXT_APP_BASE_URL=${NUXT_APP_BASE_URL}
RUN pnpm --config.verifyDepsBeforeRun=false --filter ./apps/website run build

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=4173
ENV PORT=4173
ENV HOST=0.0.0.0
COPY --from=build /app/apps/website/.output ./.output
EXPOSE 4173
CMD ["node", ".output/server/index.mjs"]

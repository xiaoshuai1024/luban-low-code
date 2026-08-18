## Why

Luban 作为开源低代码平台需要一个项目官网来展示能力、吸引贡献者和用户。当前缺少一个可独立访问的静态站，GitHub Pages 是最低成本、零运维的部署方案。

## What Changes

- 在 `apps/website` 新增 `pages/index.vue` 自包含静态首页（内联样式，无 BFF 依赖）
- 生成纯静态 HTML/CSS/JS（Nuxt static generate），部署到 GitHub Pages
- 保留 website 原有 SSR 动态页（LubanPage 渲染），两套路由互不干扰
- 新增 GitHub Actions workflow 自动构建部署
- 本地开发：`pnpm run dev:landing` 一键预览

## Capabilities

### New Capabilities
- `website-landing`: 静态项目官网，含 Hero、Features、Components 展示、CTA、Footer 区块，纯静态无后端依赖，可部署到 GitHub Pages

## Impact

- `apps/website/pages/index.vue` — 新增静态首页
- `apps/website/package.json` — 新增 build:landing / dev:landing 脚本
- `.github/workflows/pages-deploy.yml` — 新增 CI 部署流程
- `apps/website/nuxt.config.ts` — 新增 Vite alias 配置

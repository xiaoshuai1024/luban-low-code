## Context

当前 website 项目（`apps/website`）通过 Nuxt SSR + LubanPage 渲染动态页面（需 BFF + MySQL）。需要在不破坏现有 SSR 架构的前提下，新增一个独立的静态首页。

Nuxt 支持 `pages/` 目录文件路由和 `nuxi generate` 静态生成。现有 SSR 使用自定义路由（`app/router.options.ts`），与 Nuxt 文件路由互斥。

## Goals / Non-Goals

**Goals:**
- 新增 `pages/index.vue` 作为自包含静态首页（内联样式，无外部依赖）
- Nuxt static generate 输出纯静态文件（<600KB）
- GitHub Actions 自动构建部署到 GitHub Pages
- 本地 `pnpm run dev:landing` 一键预览

**Non-Goals:**
- 不修改或不影响现有 SSR 动态页面功能
- 不新增后端 API 或数据库表
- 不依赖任何外部 CDN 或第三方服务

## Decisions

1. **Nuxt file routing vs custom router**: 静态页使用 `pages/index.vue`（Nuxt 文件路由），生成时临时移除自定义路由，生成后恢复。CI 和 `build:landing` 脚本均遵循此模式。
   - Alternative: 单独创建另一个 Nuxt 项目 — 增加维护成本，否决。
   - Alternative: 修改 router 支持双路由 — 过于复杂，否决。

2. **内联样式 vs 组件 CSS**: 静态页使用内联 `style` 属性而非 Luban 组件 CSS。避免标记 `luban-base/luban-low-code` 为 external 带来的构建错误，且简化依赖。
   - Alternative: 使用 Luban 组件 — 需要完整 BFF+MySQL 运行时，不适合静态部署。

3. **GitHub Actions vs 手动部署**: 使用 GitHub Actions `actions/deploy-pages@v4`。每次推送到 master 自动构建部署。
   - Alternative: gh-pages 分支手动 push — 易出错，否决。

## Risks / Trade-offs

- [风险] 自定义路由器与 Nuxt 文件路由互斥 → 缓解：build:landing 脚本自动 swap/restore
- [风险] 569KB 输出偏大 → 可接受（Gzip 后约 200KB），后续可优化
- [Trade-off] 内联样式不如组件 CSS 可维护 → 静态页内容稳定，维护成本低

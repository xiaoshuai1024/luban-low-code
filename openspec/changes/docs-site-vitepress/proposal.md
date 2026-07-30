## Why

Luban 作为开源低代码平台，需要一个专业的文档站点来帮助用户和贡献者理解系统的架构、快速上手、组件用法和 API 参考。当前文档散落在 `docs/` 各处，没有统一的导航和美观的阅读体验。开源项目通常使用左右布局的文档站（左侧导航 + 右侧内容），VitePress 是 Vue 生态最成熟的文档工具。

## What Changes

- 引入 VitePress 作为文档站工具，放在 `apps/docs` 目录
- 文档站采用经典左右布局：顶部导航栏 + 左侧侧边栏 + 右侧 Markdown 内容
- 编写核心文档：快速开始、系统架构、组件文档、API 参考、部署指南、贡献指南
- 文档站可本地开发预览（`pnpm docs:dev`），可构建静态站部署
- 复用 luban-base/luban-low-code 组件在文档中做实时演示
- 部署到 GitHub Pages（与现有 landing page 并行）

## Capabilities

### New Capabilities
- `docs-site`: 基于 VitePress 的文档站点，左右布局，包含快速开始、架构、组件、API、部署、贡献指南等核心文档

## Impact

- `apps/docs/` — 新增 VitePress 项目
- `package.json` — 新增 `docs:dev` / `docs:build` 脚本
- `.github/workflows/` — 文档站部署 CI（可选，后续追加）

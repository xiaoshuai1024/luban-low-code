## Purpose

为 Luban 开源低代码平台提供一个可独立访问的静态官网，展示项目能力、组件库和技术栈信息，部署于 GitHub Pages 并支持本地开发预览。

## ADDED Requirements

### Requirement: Static landing page renders without backend

网站首页 MUST 以纯静态 HTML/CSS 形式渲染，不依赖 BFF、数据库或任何后端服务。

#### Scenario: Page loads without backend
- **WHEN** 浏览器访问网站根路径 `/`
- **THEN** 页面返回 HTTP 200，包含 Hero、Features、Components、CTA、Footer 区块
- **AND** 页面无需任何 API 调用即可完整渲染

#### Scenario: Page renders in Nuxt static generate
- **WHEN** 执行 `npx nuxi generate`
- **THEN** 生成 569KB 以内的静态文件到 `.output/public/`
- **AND** `index.html` 包含所有页面内容和样式

### Requirement: Page content sections

首页 MUST 包含以下区块：导航栏、Hero（标题+副标题+CTA 按钮+统计数字）、功能特性网格（6 项）、组件库展示（28 项）、终极 CTA（深色背景）、页脚。

#### Scenario: Hero section renders correctly
- **WHEN** 页面首次加载
- **THEN** Hero 区域显示渐变标题 "Build Apps at the Speed of Thought"
- **AND** 包含 75+/Vue 3/MIT/SSR 四个统计数据

#### Scenario: Feature grid shows 6 items
- **WHEN** 用户滚动到 Features 区域
- **THEN** 显示 6 个功能卡片（Visual Builder, 75+ Components, SSR Ready, AI Powered, Data Driven, Multi-Platform）

### Requirement: Local development preview

开发者 MUST 能在本地启动静态站预览，无需启动完整后端服务。

#### Scenario: Dev server starts successfully
- **WHEN** 执行 `cd apps/website && pnpm run dev:landing`
- **THEN** 静态站可在 `http://localhost:3000` 访问
- **AND** 首次访问显示完整页面内容

### Requirement: GitHub Pages deployment

静态站 MUST 能通过 GitHub Actions 自动构建并部署到 GitHub Pages。

#### Scenario: CI builds and deploys
- **WHEN** 代码推送到 master 分支
- **THEN** GitHub Actions 自动构建 UI packages + 生成静态页
- **AND** 部署到 GitHub Pages 后页面可正常访问

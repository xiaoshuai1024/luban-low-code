## Purpose

为 Luban 开源低代码平台提供基于 VitePress 的专业文档站点，采用左右布局，包含完整的用户文档和开发者指南，可本地预览和部署到 GitHub Pages。

## ADDED Requirements

### Requirement: VitePress 文档站使用左右布局

文档站 MUST 使用 VitePress 构建，采用经典左右布局：顶部导航栏（Logo + 主题切换 + GitHub 链接）、左侧侧边栏（多级目录树）、右侧 Markdown 内容区。

#### Scenario: 页面布局正确
- **WHEN** 用户访问文档站任意页面
- **THEN** 页面左侧显示当前章节的导航目录树
- **AND** 页面右侧显示 Markdown 渲染的内容
- **AND** 顶部导航栏包含 Logo、搜索框、GitHub 链接和暗黑模式切换

### Requirement: 核心文档内容完整

文档站 MUST 包含以下核心章节，每个章节至少 1 篇文档：

- **快速开始**：环境准备、安装步骤、创建第一个页面
- **系统架构**：整体架构图、引擎/BFF/后端/SSR 分层说明、请求链路
- **组件文档**：组件分类、每个组件的 props 说明和使用示例
- **API 参考**：BFF 公开接口、管理接口、错误码
- **部署指南**：Docker Compose 部署、环境变量说明、域名配置
- **贡献指南**：开发环境搭建、代码规范、提交规范

#### Scenario: 快速开始文档可指导用户搭建
- **WHEN** 新用户阅读快速开始文档
- **THEN** 文档包含从 clone 仓库到启动服务的完整步骤
- **AND** 每个步骤有对应的命令和预期输出

### Requirement: 本地开发预览

开发者 MUST 能在本地启动文档站预览，支持热更新。

#### Scenario: 本地启动文档站
- **WHEN** 执行 `pnpm docs:dev`
- **THEN** VitePress dev server 在 `http://localhost:5173` 启动
- **AND** 修改 Markdown 文件后浏览器自动刷新

### Requirement: 静态构建输出

文档站 MUST 能构建为纯静态文件，可部署到 GitHub Pages 或任何静态托管。

#### Scenario: 构建静态站
- **WHEN** 执行 `pnpm docs:build`
- **THEN** 在 `apps/docs/.vitepress/dist/` 生成静态 HTML/CSS/JS
- **AND** 输出大小在 5MB 以内

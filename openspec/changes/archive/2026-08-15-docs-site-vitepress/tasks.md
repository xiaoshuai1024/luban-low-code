## 1. VitePress 项目初始化

- [x] 1.1 创建 `apps/docs/` 目录，初始化 VitePress 项目（package.json + .vitepress/config.ts）
- [x] 1.2 配置 VitePress：站点标题、Logo、导航栏、侧边栏结构、暗黑模式、GitHub 链接
- [x] 1.3 在根 package.json 添加 `docs:dev` 和 `docs:build` 脚本

## 2. 编写核心文档

- [x] 2.1 首页（index.md）：Hero 区域 + 特性列表 + 快速链接
- [x] 2.2 快速开始：环境准备、安装、启动服务、创建第一个页面
- [x] 2.3 系统架构：架构图、技术栈表格、请求链路、子系统说明
- [x] 2.4 组件文档：组件分类总览 + 重点组件 props 说明
- [x] 2.5 API 参考：BFF 公开接口、管理接口、错误码表
- [x] 2.6 部署指南：Docker Compose 部署、环境变量、域名配置
- [x] 2.7 贡献指南：开发环境、代码规范、提交规范、分支策略

## 3. 侧边栏与导航

- [x] 3.1 配置多级侧边栏（按章节分组的导航树）
- [x] 3.2 配置顶部导航栏（指南 / API / 组件 分组）
- [x] 3.3 配置页面 prev/next 导航链接

## 4. 本地预览验证

- [x] 4.1 运行 `pnpm docs:dev` 确认 dev server 正常启动
- [x] 4.2 浏览器验证左右布局、暗黑模式、导航跳转
- [x] 4.3 运行 `pnpm docs:build` 确认静态构建成功

## Context

Luban 当前文档散落在 `docs/` 各处（架构设计、E2E 指南、引擎规范等），没有统一的导航和阅读体验。需要一个专业的文档站来整合这些内容，让用户和贡献者能快速找到需要的信息。

## Goals / Non-Goals

**Goals:**
- 在 `apps/docs` 搭建 VitePress 文档站
- 整合现有 `docs/` 下的核心文档，重新组织为用户友好的结构
- 支持 Markdown 编写，自动生成左侧导航
- 支持暗黑模式、搜索、GitHub 链接
- 本地 `pnpm docs:dev` 预览，`pnpm docs:build` 构建静态站

**Non-Goals:**
- 不做组件实时交互演示（后续迭代）
- 不做多语言国际化（中文优先）
- 不做评论/反馈系统
- 不替换现有 `docs/` 目录的原始文档（文档站引用/汇总其内容）

## Decisions

1. **VitePress vs Docusaurus vs Nuxt Content**: 选 VitePress
   - 理由：Vue 生态原生、构建快、配置简单、主题美观、Markdown 优先
   - Docusaurus 基于 React，与项目 Vue 技术栈不一致
   - Nuxt Content 过重，文档站不需要 SSR

2. **文档目录 `apps/docs` vs `docs-site/`**: 放 `apps/docs`
   - 与 monorepo `apps/` 结构一致
   - 与现有 `docs/`（原始文档资料）区分，避免混淆

3. **根 package.json 脚本**: `pnpm docs:dev` / `pnpm docs:build`
   - 统一入口，方便开发者使用

## Risks / Trade-offs

- [风险] VitePress 与 monorepo pnpm workspace 兼容性 → 缓解：独立 package.json，不依赖 workspace 包
- [Trade-off] 文档内容需要手动从 `docs/` 迁移到 `apps/docs/` → 内容稳定，一次性迁移成本可接受

# 贡献指南

感谢你对 Luban 项目的关注！本文档帮助你快速参与开发。

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/xiaoshuai1024/luban-low-code.git
cd luban-low-code

# 安装依赖
pnpm install
cd packages/ui && pnpm install && cd ../..

# 启动开发服务
make dev-apps  # 或分别启动各服务
```

## 项目结构

```
luban-low-code/
├── apps/
│   ├── engine/          # 低代码引擎（Vue 3 SPA）
│   ├── bff/             # BFF 聚合层（Next.js）
│   ├── website/         # SSR 站点（Nuxt 3）
│   ├── backend-java/    # Java 后端（Spring Boot）
│   └── docs/            # 文档站（VitePress）
├── packages/
│   ├── ui/              # UI 物料库（75+ 组件）
│   └── ai-assistant/    # AI 助手服务（Python）
├── docs/                # 架构文档
└── openspec/            # OpenSpec 变更管理
```

## 代码规范

### TypeScript / Vue

- 使用 TypeScript strict 模式
- 组件使用 `<script setup lang="ts">`
- 样式使用 SCSS，遵循 Material Design 规范
- 包管理统一使用 pnpm

### Java

- 遵循《阿里巴巴 Java 开发手册》
- MyBatis 注解 + XML 混合
- Flyway 管理数据库迁移
- 所有敏感数据 BCrypt 加密

### Git 提交规范

使用 Conventional Commits：

```
<type>(<scope>): <subject>

类型：feat | fix | docs | style | refactor | test | chore
```

示例：
```
feat(engine): add AI assistant panel
fix(bff): correct JWT token parsing
docs(api): update public endpoint reference
```

## 分支策略

- `master` — 主分支，禁止直接 push
- `feature/*` — 新功能分支
- `fix/*` — Bug 修复分支

```bash
# 创建功能分支
git checkout -b feature/your-feature

# 提交 PR
gh pr create --title "feat: your feature" --body "Description"
```

## 测试

```bash
# TS 单元测试
pnpm test

# E2E 测试（需要服务运行）
cd apps/engine && pnpm run test:e2e

# Java 测试
cd apps/backend-java && mvn -q verify

# 覆盖率汇总
make test-coverage
```

## 开发新组件

1. 在 `packages/ui/packages/luban-low-code/src/materials/<category>/<name>/` 创建目录
2. 创建 `Component.vue`（Vue 3 SFC + SCSS）
3. 创建 `material.ts`（props schema 定义）
4. 在 `materials/index.ts` 注册
5. 编写单元测试
6. 添加 Storybook story

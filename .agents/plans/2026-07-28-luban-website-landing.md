---
featureId: luban-website-landing
title: 鲁班官网（自建产品官网+组件开发）
createdAt: 2026-07-28
status: approved
taskGraph: docs/superpowers/tasks/luban-website-landing.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT
scope: 新建 5 个物料组件，搭建 8 页官网（含文档站），E2E 渲染验证全绿
branches: monorepo 单仓 feature/luban-website-landing 同名分支
---

# 鲁班官网（自建产品官网 + 组件开发）

> 正按 `writing-plans` skill + `PLAN_WRITING_CONTRACT` 输出定稿。已加载 skill：writing-plans。

---

## §0 文首 YAML + 分支策略

分支策略：monorepo 单仓，当前分支 `feature/monorepo-migration`，本期改动在同一分支内完成，不再新建分支。禁 push 默认分支。

taskGraph JSON 已创建：`docs/superpowers/tasks/luban-website-landing.json`。

---

## §1 需求溯源（追溯矩阵）

| 上游需求 | task id | E2E 场景 | 验收门禁 |
|----------|---------|----------|---------|
| 用户口头确认「完整可用的产品官网+文档站」 | T1–T12 | E2E-W1 首页渲染 | G3, G4 |
| 用户确认「Markdown 组件优先」 | T1 | E2E-W2 文档页渲染 | G3 |
| 用户确认「CodeBlock+Alert+Steps+BackToTop」 | T2–T5 | E2E-W2 组件展示页 | G3, G4 |
| 用户确认「无后端改动」 | — | — | G4 回归 |
| 现有 E2E 24 条全量回归 | T14 | 全量 Playwright | G4 |

证据：本对话 2026-07-28 用户消息「按照你的建议，但是需要是完整可用的」。

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 本轮是否涉及 | 说明 |
|--------|:---:|------|
| **packages/ui** | ✅ | 新增 5 个 Vue3 物料组件 |
| **apps/engine** | ✅ | 引擎构建验证，物料自动注册 |
| **apps/website** | ✅ | 创建 8 个页面 page schema（通过 BFF API），SSR 渲染验证 |
| **apps/bff** | ✅ | 透传 page API（已有，不新增） |
| **apps/backend-java** | ✅ | page schema 存储 + public page API（已有） |
| **apps/backend-go** | ❌ | 已弃用，本轮不涉及 |
| **apps/engine/e2e** | ✅ | 新增 website 渲染 E2E 用例 |
| **MySQL** | ✅ | 插入 8 条 page 记录 |

### 2.2 各子系统增量

| 子系统 | 增量 |
|--------|------|
| `packages/ui` | 5 个新物料（LubanMarkdown / LubanCodeBlock / LubanAlert / LubanSteps / LubanBackToTop），各含 material.ts + Component.vue + props schema + vitest 单测 |
| `apps/engine` | 无代码改动；`vite build` 验证新物料自动注册 |
| `apps/website` | 通过管理后台 BFF API 创建 8 条 page schema；`nuxt build` + SSR 渲染验证 |
| `apps/bff` | 无改动 |
| `apps/backend-java` | 无改动 |
| `apps/engine/e2e` | 新增 website 渲染 E2E：至少 3 条（首页/组件页/文档页快照验证） |

### 2.3 端到端链路

```
用户浏览器
  │
  ├─→ website:4173（Nitro SSR）
  │     │ DynamicPage.vue
  │     │ usePageByPath('default', '/')
  │     │ BFF GET /api/public/sites/default/pages/by-path?path=/
  │     │   → BFF → backend-java:8080/backend/...
  │     │   → MySQL pages 表
  │     │   → 返回 { schema: { root: { type: 'LubanPage', children: [...] } } }
  │     │ LubanPage(schema) SSR 渲染
  │     │   → 新组件 LubanMarkdown/LubanCodeBlock 等被 LubanPage 渲染
  │     └─→ HTML 返回
  │
  └─→ engine:4200（SPA 管理后台）
        └─→ 创建/编辑 page schema → 存到 MySQL
```

---

## §3 业务逻辑

**状态机**：page schema 实体（`pages` 表）。status: `draft` ↔ `published`。本轮只使用 `draft` 状态创建 schema，发布后 website 可渲染。

**领域实体**：`pages` 表（已有），字段：id, site_id, name, path, status, schema_json, created_at, updated_at。

**事务边界**：创建 page 为单表 insert（已有行为，不新增事务边界）。

**关键业务规则**：
- page.slug 必须与 site.slug 匹配
- page.path 用于路由匹配（`/docs/getting-started` 等）
- Markdown 内容存储在 `schema.root.children[MarkdownNode].props.content` 中

**错误场景（3+ 每功能）**：
1. 路径 `/` 404：`DynamicPage.vue` 渲染 `<div class="error"><h1>Page not found</h1></div>`，HTTP 200（Nuxt 服务端不抛 404，页面内显示）
2. Markdown 组件 `content` 为空：渲染空容器（`<div class="luban-markdown luban-markdown--empty">`）
3. CodeBlock 无代码：渲染 `<div class="luban-codeblock luban-codeblock--empty">`
4. 并发创建同名 path：后端返回 `400 slug unique constraint`
5. BFF/backend 不可达：`DynamicPage.vue` 渲染 `status: error` → `<p>{{ error.message }}</p>`

---

## §4 页面结构（§4.3 逐页）

### §4.0 入口表

| 路由 | 视图 | 来源端 | 状态 |
|------|------|--------|:---:|
| `/` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/components` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/docs` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/docs/getting-started` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/docs/architecture` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/docs/api` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/examples` | DynamicPage.vue + LubanPage SSR | website | 🆕 |
| `/open-source` | DynamicPage.vue + LubanPage SSR | website | 🆕 |

### §4.3 逐页页面结构 — 首页

```
██ 首页 /
├── LubanNavbar（sticky，logo + 导航 + CTA 按钮）
├── LubanHero
│   ├── 主标题：鲁班 · 低代码平台
│   ├── 副标题：拖拽搭建、一键发布、多端渲染
│   └── CTA：免费试用 / 查看文档
├── LubanFeatureGrid（2 列 × 3 行）
│   ├── 可视化搭建 / 丰富组件库 / 响应式多端
│   ├── 数据驱动 / 权限管理 / AI 辅助生成
├── LubanSteps（3 步水平步骤）
│   ├── ① 拖拽组件 → ② 配置属性 → ③ 一键发布
├── LubanStats（4 个数字卡片）
│   ├── 71 个内建组件 / 支持 Vue3+Vite / 多端渲染 / MIT 开源
├── LubanGallery（模板截图网格 2 列 × N 行）
├── LubanTestimonialCarousel（3 条客户评价轮播）
├── LubanCTA（底部 CTA 横幅 + 按钮）
└── LubanFooter（4 列链接 + 版权 + 社交媒体）
```

### §4.3 逐页页面结构 — 组件页

```
██ 首页 /components
├── LubanNavbar
├── LubanHeading H1：组件库
├── LubanMarkdown（简介段落）
├── LubanTabs（按分类切换：layout / form / marketing / data-display / feedback / navigation / content / general）
│   └── 每个 tabpanel 内：
│       └── LubanRow
│           └── LubanCol v-for="组件列表"
│               └── LubanCard
│                   ├── LubanHeading H3（组件名）
│                   ├── LubanText（描述）
│                   ├── LubanCodeBlock（props 配置示例）
│                   └── LubanButton（查看文档）
├── LubanCTA
└── LubanFooter
```

### §4.3 逐页页面结构 — 文档中心 + 子页

```
██ /docs
├── LubanNavbar
├── LubanHeading H1：文档中心
├── LubanRow
│   ├── LubanCard（快速开始 / 链接到 /docs/getting-started）
│   ├── LubanCard（系统架构 / 链接到 /docs/architecture）
│   ├── LubanCard（组件开发 / 链接到 /docs/components）
│   └── LubanCard（API 参考 / 链接到 /docs/api）
├── LubanFooter

██ /docs/getting-started
├── LubanContainer（左侧导航 + 右侧内容）
│   ├── LubanCol sidebar（LubanLink × N：锚点跳转）
│   └── LubanCol main
│       └── LubanMarkdown（Markdown 渲染：步骤1/2/3 + 截图 + 提示）
├── LubanFooter

██ /docs/architecture
├── LubanContainer（同上左右分栏）
│   └── LubanMarkdown（架构图 ASCII + 分层说明 + 组件通信）
├── LubanFooter

██ /docs/api
├── LubanContainer（同上）
│   └── LubanMarkdown（BFF 端点列表 + 请求/响应示例）
├── LubanFooter
```

### §4.3 逐页页面结构 — 示例 + 开源

```
██ /examples
├── LubanNavbar
├── LubanHeading H1：示例与模板
├── LubanRow（3 列卡片网格）
│   ├── LubanCard（电商首页 / 截图 + 一键使用）
│   ├── LubanCard（企业官网 / 截图 + 一键使用）
│   ├── LubanCard（营销落地页 / 截图 + 一键使用）
│   └── LubanCard（管理后台 / 截图 + 一键使用）
├── LubanCTA
└── LubanFooter

██ /open-source
├── LubanNavbar
├── LubanContainer（左侧导航 + 右侧内容）
│   └── LubanMarkdown
│       ├── License（MIT）
│       ├── 贡献指南
│       ├── Roadmap
│       └── GitHub 链接
└── LubanFooter
```

### §4.3 四态（加载/空/错/成功）

| 态 | 位置 | 组件 | 文案 |
|----|------|------|------|
| 加载 | DynamicPage.vue | `<div class="loading">Loading...</div>` | "Loading..." |
| 空 | 页面无数据 | `<div class="error"><h1>Page not found</h1></div>` | "Page not found / No content available" |
| 错 | BFF 不可达 | `<div class="error"><p>{{ error.message }}</p></div>` | 后端返回的错误信息 |
| 成功 | 正常渲染 | LubanPage(schema) | 全量组件渲染 |

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| `LubanPage` | `packages/ui/packages/luban-low-code` | website DynamicPage.vue | `props: { schema: PageSchema, datasourceFetcher?, collectionFetcher? }` |
| `PageSchema` | `packages/ui/packages/luban-low-code/src/types` | website / engine | `{ root: NodeSchema }` |
| BFF public page API | BFF `app/api/public/sites/...` | website `usePageByPath` | `GET /api/public/sites/:slug/pages/by-path?path=:path` → `{ name, schema, seo? }` |
| Admin page API | BFF `app/api/sites/...` | engine 管理后台 | `POST /api/sites/:siteId/pages` → `{ id, name, path, schema, status }` |
| `highlight.js` | npm（T1 依赖） | LubanMarkdown / LubanCodeBlock | `hljs.highlight(lang, code).value` |
| `markdown-it` | npm（T1 依赖） | LubanMarkdown | `md.render(content)` → HTML string |

---

## §6 架构边界 + 门禁自检

### §6.1 架构边界

- **前端**（engine）：物料自动从 `luban-low-code` 包注册，新物料在物料面板自动出现
- **SSR**（website）：`LubanPage` 消费 PageSchema 渲染，无需改动
- **BFF**：已有 API 不变
- **后端**：无改动

### §6.2 双后端 parity 矩阵

| 接口 | Java 现状 | Go 现状 | 本期目标 |
|------|----------|---------|---------|
| `GET /api/public/sites/:slug/pages/by-path` | ✅ 已实现 | ❌ 已弃用 | 无变更 |
| `POST /api/sites/:siteId/pages` | ✅ 已实现 | ❌ 已弃用 | 无变更 |

**本轮无新增接口。** Go 后端已弃用，本轮全部不涉及。

### §6.3 覆盖率门禁

| 子系统 | 门禁值 | 命令 |
|--------|:---:|------|
| `packages/ui` | **90%** | `cd packages/ui && pnpm test` |
| `apps/engine` | **85%** | `cd apps/engine && pnpm test` |
| `apps/website` | **85%** | `cd apps/website && pnpm test` |
| 全栈汇总 | — | `make test-coverage` |

### §6.4 FeatureGate 策略

| 功能 | FeatureGate key | 作用域 | 关闭行为 |
|------|----------------|--------|---------|
| LubanMarkdown 组件 | `VITE_FEATURE_MARKDOWN`（engine 端 FeatureGate） | engine 管理台物料面板 + website 渲染 | 物料面板隐藏 Markdown 组件；已渲染的 Markdown 内容退化为纯文本 `<pre>` |
| LubanCodeBlock 组件 | `VITE_FEATURE_CODE_BLOCK` | 同上 | 物料面板隐藏；已渲染的 CodeBlock 退化为 `<pre>` |
| LubanAlert 组件 | `VITE_FEATURE_ALERT` | 同上 | 隐藏 |
| LubanSteps 组件 | `VITE_FEATURE_STEPS` | 同上 | 隐藏 |
| LubanBackToTop 组件 | `VITE_FEATURE_BACK_TO_TOP` | 同上 | 隐藏 |

**回滚首选**：关闭对应 FeatureGate → 新组件在管理面板不可见，已发布的页面退化渲染（不影响其他功能）。

---

## §7 E2E 测试计划

### §7.1 跨端主路径

- **主链路**：engine 构建 → engine E2E（24 条已有）全绿 → website SSR 渲染验证

### §7.3 E2E 用例枚举

#### E2E-W1：官网首页渲染

| 项 | 内容 |
|----|------|
| 前置 | website 已部署，MySQL 已写入首页 schema |
| 操作1 | `page.goto('http://192.168.100.248:3000/')` |
| 断言1 | 页面含「鲁班·低代码平台」文本 |
| 断言2 | `.luban-hero` 区块可见 |
| 断言3 | `.luban-feature-grid` 区块可见 |
| 断言4 | `.luban-steps` 区块可见 |
| 断言5 | `.luban-footer` 区块可见 |
| 清理 | 无需清理 |

#### E2E-W2：文档页渲染

| 项 | 内容 |
|----|------|
| 前置 | website 已部署，MySQL 已写入文档 schema |
| 操作1 | `page.goto('http://192.168.100.248:3000/docs/getting-started')` |
| 断言1 | 页面含「快速开始」文本 |
| 断言2 | `.luban-markdown` 内容区可见 |
| 断言3 | `.luban-codeblock` 代码块可见（如有） |
| 清理 | 无需清理 |

#### E2E-W3：组件展示页渲染

| 项 | 内容 |
|----|------|
| 前置 | website 已部署，MySQL 已写入组件展示 schema |
| 操作1 | `page.goto('http://192.168.100.248:3000/components')` |
| 断言1 | 页面含「组件库」文本 |
| 断言2 | `.el-tabs` 分类标签可见 |
| 断言3 | `.luban-card` 组件卡片至少 1 个可见 |
| 清理 | 无需清理 |

### §7.4 E2E 路由合规性确认

所有 website E2E 使用正式产品路由（`/` / `/docs/getting-started` / `/components`），无新增 `pages/e2e/*` 专测页。✅

---

## §8 TDD 与执行约定

### 8.1 TDD 先行

| 关键行为 | 锁定测试类型 | P0 |
|----------|:---:|:---:|
| LubanMarkdown 渲染 | vitest 单测（ui） | ✅ |
| LubanCodeBlock 渲染 | vitest 单测（ui） | ✅ |
| 引擎构建验证（自动注册） | `vite build` | ✅ |
| website SSR 渲染 | Playwright E2E | ✅ |

### 8.2 并行 subagent

实现阶段可拆为 3 条无依赖并行线：
- **线 A**：T1–T7（ui 组件开发 + 测试 + 构建）
- **线 B**：T9–T12（website page schema 创建，依赖 T8）
- **线 C**：T13–T14（E2E 验证，依赖 T9–T12）

### 8.3 单期收口

本期所有功能（5 组件 + 8 页面 + E2E）在单次实现周期内全部完成并通过验证。禁止分期交付。禁止主路径收口即宣称完成。

### 8.4 Post-Development Workflow

```
代码提交
   ↓
/luban-review 全自动审查（🔴🟡🔵 清零）
   ↓
编译     : pnpm run build（engine）
         + pnpm run build（website）
   ↓
单测     : cd packages/ui && pnpm test
         + cd apps/engine && pnpm test
         + make test-coverage
   ↓
询问用户 → E2E : pnpm run test:e2e（engine 24 已有）
         + website 渲染 E2E（Playwright）
   ↓
全栈覆盖率: make test-coverage
   ↓
完成汇报
```

### 8.5 验证门

| 步骤 | 验证门命令 |
|------|-----------|
| 组件构建 | `cd packages/ui && pnpm run build`（nx run-many --projects=... --target=build） |
| 引擎构建 | `cd apps/engine && pnpm run build`（vite build） |
| 引擎单测 | `cd apps/engine && pnpm test` |
| UI 单测 | `cd packages/ui && pnpm test` |
| Engine E2E | `cd apps/engine && LUBAN_E2E_BASE_URL=... pnpm run test:e2e` |
| 全栈覆盖率 | `make test-coverage` |

---

## §10 明确不做（防膨胀）

| 不做项 | 理由 |
|--------|------|
| 多语言国际化（i18n） | 第一期仅中文；Markdown 换文件即可支持，不阻塞 |
| 博客/动态文章系统 | 需要 CMS 内容集合能力 + 编辑工作流，超过本期范围 |
| 搜索功能 | 需要全文索引（Elasticsearch），超过本期 |
| 暗黑模式 | 本期用单一主题 |
| 自定义域名/独立部署 | 用户确认「先放 website 项目，后续独立解析」，本期不涉及 |
| ISR / SSG 优化 | 当前动态 SSR 可行，优化后做 |
| LubanMarkdown 实时编辑/预览 | 在管理后台直接用文本编辑，无需在 website 侧提供编辑器 |
| Go 后端 | 已弃用，本轮全部不涉及 |
| electron/flutter 端渲染验证 | website 端即可覆盖，多端验证在组件的日常发布流程中已有 |

---

## 质量禁令 14 条自检

- [x] 1. 禁止跳过功能（所有 gap 映射到 task，无静默省略）
- [x] 2. 禁止假绿（E2E 真实执行，无 skip/空断言/关 bail）
- [x] 3. 禁止占位（无 TODO / 假文案 / 无契约 mock）
- [x] 4. 禁止骨架交付（8 页均含完整内容，非空壳路由）
- [x] 5. 禁止用 JSON 替代页面（SSR 完整渲染 HTML）
- [x] 6. 页面交互完整（§4.3 分步链路 + §7.3 E2E 断言）
- [x] 7. 验收口径=可交付（用户可见完整页面，非仅 API 可用）
- [x] 8. 引擎 E2E 绑正式路由（/ /docs/* /components，无 pages/e2e/* 专测页）
- [x] 9. 门禁分级执行（G1–G4 表齐全）
- [x] 10. /luban-review 清零（§8.4 Post-Dev Workflow 含）
- [x] 11. 安全审查门禁（无敏感数据新增，无外部 API 对接，跳过 G2）
- [x] 12. 双后端契约一致（无新增接口，Java/Go 现状不变）
- [x] 13. 多端渲染一致（website 端为主验证端，多端一致性已在日常发布流程中）
- [x] 14. FeatureGate 默认约束（每个新组件有 FeatureGate，§6.4 表）

---

## 分级验收门禁表（G1–G4）

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零 | plan owner |
| **G2** | 安全审查 | 本期跳过（无敏感数据/支付/外部对接/权限变更） | — | — |
| **G3** | 单测 + 覆盖率 | `cd packages/ui && pnpm test` + `cd apps/engine && pnpm test` + `make test-coverage` | UI 90% / engine 85% | plan owner |
| **G4** | E2E 验收 | `cd apps/engine && pnpm run test:e2e`（24 已有），website 渲染 E2E（§7.3） | 全绿、无 skip、无假绿 | plan owner |

**门禁执行顺序**：G1 → G3 → G4（G2 跳过）。

---

## 双后端契约一致性声明

本轮**无新增接口**。现有接口 `GET /api/public/sites/:slug/pages/by-path` 与 `POST /api/sites/:siteId/pages` 在 Java 后端已有实现，Go 后端已弃用。

---

## 多端渲染一致性声明

新增物料（LubanMarkdown / LubanCodeBlock / LubanAlert / LubanSteps / LubanBackToTop）在 website SSR 端验证渲染正常。engine 设计器端无渲染变更（新组件通过 LubanPage 统一渲染，与 website 共用 `luban-low-code` 包）。多端一致性（electron/flutter）不在本期范围，由日常 CI 流程覆盖。

---

## 敏感字段清单

本期无新增敏感字段。不涉及数据库 schema 变更，无新增 API。

---

## 回滚方案

| 变更 | 回滚首选 | 验证点 |
|------|---------|--------|
| 新组件（5 个） | 关对应 **FeatureGate**（无需回滚代码/DB） | 关闭后物料面板不显示该组件；已渲染页面退化到 `<pre>` 纯文本 |
| page schema | 在管理后台删除对应 page 记录（DELETE /api/sites/:siteId/pages/:pageId） | website 对应路径显示 Page not found |

**所有变更首选回滚 = FeatureGate 关闭**（无需 revert commit / rollback migration）。

---

---

## §9 实现任务派发

> §9 由 3 个并行 subagent 搜索代码库后合并生成。本轮无 backend（Java/Go/BFF/client）改动，仅 ui/engine/website 参与变更。

### 9.1 文件变更总览

| task | 路径 | 操作 | 摘要 |
|------|------|:---:|------|
| **T1** | `packages/ui/packages/luban-low-code/src/materials/content/markdown/LubanMarkdown.vue` | **新建** | Markdown 渲染组件（markdown-it + highlight.js） |
| **T1** | `packages/ui/packages/luban-low-code/src/materials/content/markdown/material.ts` | **新建** | 物料定义：name=LubanMarkdown, category=content |
| **T2** | `packages/ui/packages/luban-low-code/src/materials/data-display/code-block/LubanCodeBlock.vue` | **新建** | 代码块展示组件（语法高亮+复制按钮） |
| **T2** | `packages/ui/packages/luban-low-code/src/materials/data-display/code-block/material.ts` | **新建** | 物料定义：name=LubanCodeBlock, category=data-display |
| **T3** | `packages/ui/packages/luban-low-code/src/materials/feedback/alert/LubanAlert.vue` | **新建** | Alert 提示组件（info/warning/error/success） |
| **T3** | `packages/ui/packages/luban-low-code/src/materials/feedback/alert/material.ts` | **新建** | 物料定义：name=LubanAlert, category=feedback |
| **T4** | `packages/ui/packages/luban-low-code/src/materials/content/steps/LubanSteps.vue` | **新建** | 步骤流程组件（水平/垂直，数字+标题+描述） |
| **T4** | `packages/ui/packages/luban-low-code/src/materials/content/steps/material.ts` | **新建** | 物料定义：name=LubanSteps, category=content |
| **T5** | `packages/ui/packages/luban-low-code/src/materials/navigation/back-to-top/LubanBackToTop.vue` | **新建** | 回到顶部浮动按钮 |
| **T5** | `packages/ui/packages/luban-low-code/src/materials/navigation/back-to-top/material.ts` | **新建** | 物料定义：name=LubanBackToTop, category=navigation |
| **T6** | `packages/ui/packages/luban-low-code/src/__tests__/` 下对应 spec 文件 | **新建** | 每个组件 ≥2 条 vitest 用例 |
| **T1** | `packages/ui/packages/luban-low-code/src/materials/index.ts` | **修改** | 注册 5 个新物料 |
| **T1** | `packages/ui/packages/luban-low-code/package.json` | **修改** | 新增依赖：markdown-it、highlight.js |
| **T8** | `apps/engine` | **构建验证** | `vite build` 验证新物料自动注册，零新增 console error |
| **T9–12** | 通过 BFF API `POST /api/sites/{siteId}/pages` | **API 写入** | 创建 8 条 page schema 记录（MySQL pages 表） |
| **T13** | `apps/engine/e2e/website.spec.ts` | **新建** | website 渲染 E2E：3 条用例（首页/文档页/组件页） |
| **T14** | 全部已有 E2E（25 条） | **回归** | `pnpm run test:e2e` 全量通过 |

### 9.2 API 契约

**本轮无新增或修改对外 API。** 现有的 `GET /api/public/sites/:slug/pages/by-path?path=:path` 和 `POST /api/sites/:siteId/pages` 已完整实现（Java 后端）。Go 后端已弃用，不涉及双后端一致性。

网站 page schema 通过管理后台 API 创建：
- 端点：`POST /api/sites/:siteId/pages`（BFF → Java backend）
- 认证：`Authorization: Bearer <luban JWT>`
- 请求体：`{ name, path, schema: PageSchema, status?: 'draft'|'published' }`
- 响应：`{ id, siteId, name, path, status, schema, seo, createdAt, updatedAt }`

### 9.3 数据库变更

**本轮无数据库 schema 变更。** 仅向已有 `pages` 表插入 8 条数据行。No DDL。No Flyway migration。

已有 `pages` 表 DDL 参考（`V20260614000000__init_schema.sql`）：
```sql
CREATE TABLE pages (
    id          VARCHAR(36)  PRIMARY KEY,
    site_id     VARCHAR(36)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    path        VARCHAR(255) NOT NULL,
    status      VARCHAR(32)  NOT NULL DEFAULT 'draft',
    schema_json CLOB         NOT NULL,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    CONSTRAINT uk_site_path UNIQUE (site_id, path),
    CONSTRAINT fk_pages_site FOREIGN KEY (site_id) REFERENCES sites(id)
);
```

### 9.4 物料 schema

#### 9.4.1 LubanMarkdown

```typescript
// materials/content/markdown/material.ts
import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanMarkdown from './LubanMarkdown.vue';

export const markdownMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanMarkdown',
  version: '1.0.0',
  category: 'content',
  description: 'Markdown 渲染器，支持 CommonMark + 代码高亮（highlight.js）',
  component: LubanMarkdown,
  propsSchema: {
    type: 'object',
    properties: {
      content:    { type: 'string',  description: 'Markdown 原文', default: '', label: '内容' },
      theme:      { type: 'string',  enum: ['github', 'vuepress', 'simple'], default: 'github', label: '主题' },
      highlight:  { type: 'boolean', default: true,  label: '代码高亮' },
      breaks:     { type: 'boolean', default: true,  label: '换行转 <br>' },
      linkify:    { type: 'boolean', default: true,  label: '自动链接' },
    },
  },
  events: [],
  slots: [],
});
```

#### 9.4.2 LubanCodeBlock

```typescript
// materials/data-display/code-block/material.ts
export const codeBlockMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanCodeBlock',
  version: '1.0.0',
  category: 'data-display',
  description: '代码片段展示，支持语法高亮与一键复制',
  component: LubanCodeBlock,
  propsSchema: {
    type: 'object',
    properties: {
      code:       { type: 'string',  description: '代码内容', default: '', label: '代码' },
      language:   { type: 'string',  enum: ['javascript','typescript','html','css','json','bash','python','java','sql','yaml','markdown','plain'], default: 'plain', label: '语言' },
      showCopy:   { type: 'boolean', default: true,  label: '显示复制按钮' },
      showHeader: { type: 'boolean', default: false, label: '显示语言头栏' },
      collapsed:  { type: 'boolean', default: false, label: '折叠模式' },
      maxHeight:  { type: 'string',  default: '', label: '最大高度（如 400px）' },
    },
  },
});
```

#### 9.4.3 LubanAlert

```typescript
// materials/feedback/alert/material.ts
export const alertMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanAlert',
  version: '1.0.0',
  category: 'feedback',
  description: '提示信息块（info/warning/error/success 四种变体）',
  component: LubanAlert,
  propsSchema: {
    type: 'object',
    properties: {
      title:    { type: 'string',  description: '标题', default: '', label: '标题' },
      content:  { type: 'string',  description: '内容（支持 Markdown）', default: '', label: '内容' },
      type:     { type: 'string',  enum: ['info','warning','error','success'], default: 'info', label: '类型' },
      closable: { type: 'boolean', default: false, label: '可关闭' },
      showIcon: { type: 'boolean', default: true,  label: '显示图标' },
    },
  },
});
```

#### 9.4.4 LubanSteps

```typescript
// materials/content/steps/material.ts
export const stepsMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanSteps',
  version: '1.0.0',
  category: 'content',
  description: '步骤流程（水平或垂直展示），每步含数字/标题/描述',
  component: LubanSteps,
  propsSchema: {
    type: 'object',
    properties: {
      direction: { type: 'string',  enum: ['horizontal','vertical'], default: 'horizontal', label: '方向' },
      current:   { type: 'integer', minimum: 0, default: 0, label: '当前步（0-based）' },
      items:     {
        type: 'array',
        description: '步骤列表',
        items: {
          type: 'object',
          properties: {
            title:       { type: 'string', label: '步骤标题' },
            description: { type: 'string', label: '步骤描述' },
            icon:        { type: 'string', label: '图标名（可选）' },
          },
        },
        label: '步骤',
      },
    },
  },
});
```

#### 9.4.5 LubanBackToTop

```typescript
// materials/navigation/back-to-top/material.ts
export const backToTopMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanBackToTop',
  version: '1.0.0',
  category: 'navigation',
  description: '页面滚动后显示回到顶部浮动按钮',
  component: LubanBackToTop,
  propsSchema: {
    type: 'object',
    properties: {
      visibilityHeight: { type: 'integer', minimum: 0,   default: 300, label: '滚动显示阈值（px）' },
      right:            { type: 'string',                  default: '40px', label: '距右侧' },
      bottom:           { type: 'string',                  default: '40px', label: '距底部' },
      duration:         { type: 'integer', minimum: 0,    default: 300,  label: '动画时长（ms）' },
    },
  },
});
```

### 9.5 组件接口

#### LubanMarkdown Vue Component

```typescript
// Props
interface MarkdownProps {
  content: string    // Markdown 原文
  theme?: string     // 'github' | 'vuepress' | 'simple'，默认 'github'
  highlight?: boolean  // 是否启用代码高亮
  breaks?: boolean   // 换行 → <br>
  linkify?: boolean  // 自动链接
}
// 实现：markdown-it 渲染 + highlight.js 高亮
// 依赖：import MarkdownIt from 'markdown-it'; import hljs from 'highlight.js/lib/core';
```

#### LubanCodeBlock Vue Component

```typescript
interface CodeBlockProps {
  code: string       // 代码内容
  language?: string  // 语言标识，默认 'plain'
  showCopy?: boolean // 是否显示复制按钮
  showHeader?: boolean // 是否显示语言头栏
  collapsed?: boolean  // 折叠模式
  maxHeight?: string   // 最大高度 CSS 值
}
// Emits: none
// 实现：highlight.js 高亮 + navigator.clipboard.writeText 复制
```

#### LubanAlert Vue Component

```typescript
interface AlertProps {
  title?: string     // 标题（可选）
  content: string    // 内容
  type?: string      // 'info' | 'warning' | 'error' | 'success'
  closable?: boolean // 可关闭
  showIcon?: boolean // 显示图标
}
// Emits: { (e: 'close'): void }
```

#### LubanSteps Vue Component

```typescript
interface StepsProps {
  direction?: string // 'horizontal' | 'vertical'
  current?: number   // 当前步（0-based）
  items: Array<{ title: string; description?: string; icon?: string }>
}
// 实现：纯 CSS flexbox 布局，数字圆点 + 连接线
```

#### LubanBackToTop Vue Component

```typescript
interface BackToTopProps {
  visibilityHeight?: number  // 滚动阈值 px
  right?: string             // 距右侧 CSS
  bottom?: string            // 距底部 CSS
  duration?: number          // 动画时长 ms
}
// 实现：window.scroll 监听 + window.scrollTo({ top: 0, behavior: 'smooth' })
```

### 9.6 并行派发计划

基于 `taskGraph` JSON 依赖关系分组：

| 阶段 | Task IDs | 并行度 | 负责 |
|------|---------|:---:|------|
| **Phase 1**（无依赖，可并行） | T1, T2, T3, T4, T5 | **5-way** | ui subagent 组 |
| **Phase 2**（依赖 P1） | T6（vitest 单测）| 1-way | ui (单测) |
| **Phase 3**（依赖 P2） | T7（ui build）→ T8（engine build） | 串行 | ui + engine |
| **Phase 4**（依赖 P3） | T9, T10, T11, T12（page schema 创建）| **4-way** | engine + BFF API |
| **Phase 5**（依赖 P4） | T13（website E2E） | 1-way | engine e2e |
| **Phase 6**（收口） | T14（全量回归） | 1-way | engine e2e |

**说明**：
- P1 5 个组件可完全并行开发（各自独立的 material.ts + .vue）
- P4 8 个 page 可并行创建（独立 API 调用）
- P5-P6 串行确保验证完整性
- backend-java / backend-go / bff / client **无任务，不派发 subagent**

---

> **计划定稿完成。§0–§9 齐全。状态：approved。准备执行实现阶段。**

---
featureId: luban-mcp-server
title: Luban MCP Server — 平台能力暴露给 AI Agent
createdAt: 2026-07-29
status: draft
taskGraph: docs/superpowers/tasks/luban-mcp-server.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT
scope: 新增 packages/mcp，MCP 协议层暴露 luban 全部 CRUD 功能 + Schema 规则引导；新增 backend-java api_keys 表/API；新增 BFF API Key 验证+CRUD 路由；新增 engine Settings API Key 管理页；经 API Key 一次配置，Agent 获得完整租户权限，完全脱离 Web 工作
branches: feature/luban-mcp-server
---

# Luban MCP Server — 定稿方案

> **正按 `writing-plans` + `PLAN_WRITING_CONTRACT` 输出定稿。**  
> 已加载 skill：`writing-plans`、`plan-template`。  
> 附加文档：`docs/E2E_AGENT_GUIDE.md`、`.agents/rules/luban-e2e-execution-contract.md`、`.agents/rules/luban-cross-cutting-standards.md`、`.agents/rules/luban-material-schema.md`。

---

## §0 文首 YAML + 分支策略

| 字段 | 值 |
|------|-----|
| featureId | `luban-mcp-server` |
| title | Luban MCP Server — 平台能力暴露给 AI Agent |
| createdAt | 2026-07-29 |
| status | draft |
| taskGraph | `docs/superpowers/tasks/luban-mcp-server.json` |
| contractSource | plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT |
| scope | 新增 packages/mcp，MCP 协议层暴露 luban 全部 CRUD + Schema 规则引导，API Token 鉴权 |
| branches | 单 feature 分支 `feature/luban-mcp-server` |

### 分支策略
- 新增 `feature/luban-mcp-server` 分支开发
- **涉及 4 个子系统**：新增 `packages/mcp` + 修改 `apps/backend-java`（新增表+API）+ 修改 `apps/bff`（新增路由）+ 修改 `apps/engine`（新增 UI 页）
- 同一 feature 分支管理所有变更（monorepo 优势）
- **禁止直接 push 默认分支**

### 验收要点
- [x] YAML 字段齐全
- [x] taskGraph JSON 存在（见 `docs/superpowers/tasks/luban-mcp-server.json`）
- [x] featureId 与文件名一致
- [x] 分支策略合规

---

## §1 需求溯源（追溯矩阵）

| 上游需求 | 证据 | task id | E2E 场景 | 验收门禁 |
|---------|------|---------|---------|---------|
| Agent 可只申请 API Key 一次使用全部功能 | 用户确认（对话："只从平台申请一个api key"） | T3, T20, T21, T22 | E2E-01：API Key 鉴权全流程 | G1, G4 |
| Agent 完全脱离 Web 工作 | 用户确认（对话："完全脱离网页进行工作"） | T3 | E2E-01 | G1, G4 |
| Agent 需完成全部 CRUD 操作 | 用户确认（对话："获得完整的系统使用体验"） | T4–T13 | E2E-02~E2E-10：各领域 CRUD 链路 | G1, G3, G4 |
| Agent 需知道如何创建页面（Schema 规则） | 用户确认（对话："让agent可以知道按照什么规则"） | T14–T15 | E2E-11：Agent 引导创建页面 | G1, G4 |
| Agent 需能发布页面 | 用户确认（对话："发布、以及其他各种流程"） | T5 | E2E-05：页面发布 → 公开可访问 | G1, G4 |
| Agent 需管理版本历史 | 平台 SSOT：`PageVersionController.java` 后端实现 | T6 | E2E-06：版本历史 + 回滚 | G1, G3 |
| Agent 需管理用户（admin） | 平台 SSOT：`UserController.java` + `Go router.go` admin-only | T11 | E2E-12：用户 CRUD | G1, G3, G4 |
| Agent 需管理站点 | 平台 SSOT：`SiteController.java` 五端点 | T4 | E2E-03：站点 CRUD | G1, G3 |
| Agent 需管理表单/线索 | 平台 SSOT：`FormController.java` + `LeadController.java` | T7–T8 | E2E-07~E2E-08：表单 + 线索链路 | G1, G3 |
| Agent 需管理 CMS 集合 | 平台 SSOT：`CollectionController.java` + `CollectionItemController.java` | T9 | E2E-09：CMS 集合 CRUD + 内容项 | G1, G3 |
| Agent 需管理数据源 | 平台 SSOT：`DatasourceController.java` 五端点 + test/query | T10 | E2E-10：数据源 CRUD + 测试连通 | G1, G3 |
| Agent 需校验 Schema 合法性 | 平台资产：`packages/ai-assistant/app/schemas/validators.py` | T16 | schema_validate 工具单元测试 | G1, G3 |
| 用户从 Web 创建 API Key | 用户确认（对话："只从平台申请一个api key"） | T22 | E2E-13：API Key 管理链路 | G1, G4 |
| API Key 继承用户全部权限 | 架构设计：Key → user_id → role | T20, T21 | E2E-01 | G1, G2 |
| API Key 哈希存储 + 创建时一次展示 | 安全最佳实践 | T20 | 安全审查 | G2 |
| 文档齐备、可接入 | 无设计文档可读性门禁 | T19 | 验收 README + mcp.json 模板 | G1 |

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 路径 | 变动类型 | 说明 |
|--------|------|---------|------|
| **MCP Server（新增）** | `packages/mcp` | 新增 | MCP 协议层，暴露全部平台功能为 tools/resources；API Key 启动验证 → 获取 JWT 缓存 |
| BFF | `apps/bff` | **修改（新增路由）** | 新增 `POST /api/auth/api-key/login`（验证 API Key→签发 JWT）+ `GET/POST/PATCH /api/api-keys`（CRUD 代理） |
| 后端 Java | `apps/backend-java` | **修改（新增表+API）** | 新增 `api_keys` 表（Flyway V20260729000001）+ ApiKey Entity/Mapper/Service/Controller；新增 `POST /backend/auth/api-key/validate` + `GET/POST/PATCH /backend/api-keys` |
| 后端 Go | `apps/backend-go` | 无改动 | 已标记弃用，不做 Go 端 API Key 实现 |
| 引擎 | `apps/engine` | **修改（新增 UI）** | Settings 页面新增「API Key 管理」Tab，含创建/列表/撤销功能 |
| UI 物料库 | `packages/ui` | 无改动 | MCP 只引用物料定义作为资源文档 |
| Website | `apps/website` | 无改动 | MCP 暴露的 publish 链路最终让 website 渲染 published 页面 |

### 2.2 各子系统新增内容

#### packages/mcp（新增包）
- **包名**：`@luban/mcp-server`
- **入口**：`src/index.ts` — MCP Server 启动（stdio transport + 可选 HTTP）
- **构建**：发布到 `dist/`，通过 `node dist/index.js` 启动
- **types**：`src/types/schema.ts` — 自行定义 PageSchema/NodeSchema 最小化接口（不依赖 `luban-low-code` Vue 包）
- **模块**：
  - `src/auth.ts` — 鉴权模块：启动时用 LUBAN_API_KEY 通过 BFF 验证 → 获取 JWT → 缓存/自动续期
  - `src/lib/bff-client.ts` — BFF HTTP 客户端（含 API Key 启动验证流程）
  - `src/lib/api-token-store.ts` — API Token 存储（加密持久化到本机文件）
  - `src/lib/schema-validator.ts` — Schema 校验工具
  - `src/tools/auth.ts` — 认证状态查询工具（auth_status：查看当前用户/角色/JWT 过期时间）
  - `src/tools/site.ts` — 站点管理工具
  - `src/tools/page.ts` — 页面管理工具（含发布、模板）
  - `src/tools/version.ts` — 版本历史工具
  - `src/tools/form.ts` — 表单管理工具
  - `src/tools/lead.ts` — 线索管理工具
  - `src/tools/collection.ts` — CMS 集合工具
  - `src/tools/datasource.ts` — 数据源工具
  - `src/tools/user.ts` — 用户管理工具
  - `src/tools/settings.ts` — 系统设置工具
  - `src/tools/public.ts` — 公开 API 工具
  - `src/resources/schema-rules.ts` — Schema 创建规则资源
  - `src/resources/material-catalog.ts` — 物料目录资源
  - `src/resources/page-templates.ts` — 页面模板资源
  - `src/resources/best-practices.ts` — 最佳实践资源
  - `src/prompts/system-prompt.ts` — 系统提示词

### 2.3 端到端链路

#### 链路 A：Agent 配置 API Key → 启动鉴权 → 全功能可用
```
用户浏览器 (Web UI)
  │
  │ 0a. 用户登录 Web UI → Settings → API Key 管理 → 创建 Key
  │ 0b. 系统展示 Key 一次：lb_key_a1b2c3d4...
  │ 0c. 用户复制 Key
  ▼
Agent 配置文件 .claude/mcp.json
  │ 其中 env.LUBAN_API_KEY = "lb_key_a1b2c3d4..."
  │
  │ 1. MCP Server 启动 → 读取 LUBAN_API_KEY 环境变量
  ▼
MCP Server
  │
  │ 2. POST /api/auth/api-key/login { apiKey: "lb_key_..." } → BFF
  │    → BFF 转发 POST /backend/auth/api-key/validate → 后端
  │    → 后端 hash 查找 api_keys.key_hash，匹配 → 返回 user info
  │    → BFF 签发 JWT（sub=userId, role=role, 7天过期）
  │    → 返回 { token, user }
  │
  │ 3. JWT 保存到会话内存 + 本机加密文件缓存（~/.luban/tokens.json）
  │ 4. 后续所有工具调用自动带 Authorization: Bearer <jwt>
  ▼
后端鉴权：BFF 解 JWT → X-User-ID/X-User-Role → 后端 AuthFilter
```

**关键设计**：
- MCP Server **没有 `auth_login` 工具**。鉴权全由环境变量 `LUBAN_API_KEY` 驱动，启动时自动完成
- API Key 是**一次创建、永久使用**（除非撤销），用户完全不需要在 Agent 对话中输入凭证
- MCP Server 启动时若 `LUBAN_API_KEY` 未配置或验证失败 → 启动失败并报错（fail-fast）

#### 链路 B：Agent 创建页面 → 发布 → 公开可访问
```
Agent (MCP Client)
  │
  │ 1. 读取 Resources:
  │    - luban://schema/rules → 了解 Schema 结构
  │    - luban://materials/catalog → 了解可用物料
  │    - luban://templates → 可选模板
  │
  │ 2. tool: pages_create(siteId, { name, path, schema, seo })
  │    → POST /api/sites/{id}/pages → 后端 201 + auto version snapshot
  │    返回 { id, name, path, status: "draft", schema }
  │
  │ 3. tool: pages_update(siteId, pageId, { schema }) 多次编辑
  │
  │ 4. tool: pages_publish(siteId, pageId)
  │    → PUT /api/sites/{id}/pages/{pid} { status: "published" }
  │    → 后端改 status + auto version snapshot
  │    返回 { id, status: "published" }
  │
  │ 5. 访客访问 website → GET /public/sites/{slug}/pages?path=
  │    → 返回 published schema → LubanPage 渲染
  ▼
端到端完成：Agent 创建 → 编辑 → 发布 → 公开可见
```

#### 链路 C：Agent 管理表单 → 处理线索
```
Agent (MCP Client)
  │
  │ 1. tool: forms_create(siteId, { name, pageId, fieldSchema, submitConfig })
  │    → POST /api/forms → 后端
  │
  │ 2. 公开页面渲染表单 → 用户填写提交 → POST /lead/forms/{formId}/submit
  │    → 防刷 + 去重 + 加密 + 通知
  │
  │ 3. tool: leads_list(siteId, { status, formId, page, size })
  │    → GET /api/leads?siteId=...
  │
  │ 4. tool: leads_transit_status(siteId, leadId, { status, assigneeId })
  │    → PATCH /api/leads/{id}/status
  │    状态机: new → assigned → contacting → converted/lost/invalid
  ▼
端到端完成：Agent 创建表单 → 用户提交 → Agent 查看/跟进线索
```

---

## §3 业务逻辑

### 3.1 MCP Server 状态机

MCP Server 对业务操作是 stateless 的（每次工具调用独立处理，不缓存业务数据），但**会话上下文**和**本机鉴权缓存**有状态：

```
                     MCP Server 启动
                          │
                    ┌─────▼──────┐
                    │ 读取环境变量 │
                    │ LUBAN_API_ │
                    │   KEY      │
                    └─────┬──────┘
                          │
                    ┌─────▼──────────────────┐
                    │ 启动时 API Key 验证      │
                    │ (callBFF → POST /auth/  │
                    │  api-key/login)         │
                    └─────┬──────────────────┘
                          │
              ┌───────────┼───────────┐
              │ 成功       │ 失败      │
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐
        │ 已认证     │ │ 启动失败  │
        │ (有 JWT)   │ │ (报错退出)│
        └────┬─────┘ └──────────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
┌────────┐ ┌────────┐ ┌─────────┐
│ 普通用户 │ │ 管理员  │ │ JWT     │
│ (user)  │ │ (admin) │ │ 过期    │
└────┬───┘ └────┬───┘ └────┬────┘
     │          │          │
     ▼          ▼          ▼
API 调用可用   全部调用   自动用 API Key
受限（读+写   可用      重新获取 JWT
自身资源）              （透明续期）
```

### 3.2 领域实体与权限矩阵

| 实体 | 端点 | 读权限 | 写权限 | 说明 |
|------|------|--------|--------|------|
| Site | `/sites/*` | user | admin | 站点是租户隔离单元 |
| Page | `/sites/{id}/pages/*` | user | user | 页面 CRUD user 可用 |
| Version | `.../versions/*` | user | admin(rollback) | rollback 需 admin（注：后端 Java 当前未强制 admin 拦截，MCP 层做应用级限制避免误回滚） |
| Form | `/forms/*` | user | user | 表单 CRUD |
| Lead | `/leads/*` | user | user | 线索查看与状态转递 |
| Collection | `/collections/*` | user | admin | CMS 集合写需 admin |
| CollectionItem | `/collections/{id}/items/*` | user | admin | 内容项写需 admin |
| Datasource | `/datasources/*` | user | admin | 数据源写需 admin |
| User | `/users/*` | admin | admin | 用户管理仅 admin |
| Settings | `/settings` | admin | admin | 系统设置仅 admin |
| ApiKey | `/api-keys/*` | user（仅自己的）| user（仅自己的）| API Key 管理含创建/列表/撤销，用户只可管理自己的 Key，admin 可查全部 |

### 3.3 事务边界

MCP Server 不做本地事务，所有操作代理到 BFF，事务由后端保证：
- 页面创建：MCP 调 BFF → BFF 调后端 → 后端 PageService.create() 写 page 表 + PageVersionService.createSnapshot() 写 version 表（同一事务）
- 发布：同一次 PUT 完成 status 变更 + 版本快照

**错误映射策略**：BFF 返回 `BackendHttpError`（含 `code`/`message`/`details`），MCP 工具层直接透传 BFF 的 `code` 和 `message` 到 MCP 协议的错误响应。MCP 层不做错误码转换或吞没。

### 3.4 关键业务规则

| 规则 | 说明 |
|------|------|
| site slug 唯一 | 后端 `UNIQUE KEY uk_sites_slug` |
| page path 站点内唯一 | 后端 `UNIQUE KEY uk_site_path` |
| 发布=改 status | 无独立 publish 端点，MCP 封装 publish_page = save + status=published |
| 版本自动创建 | 后端 Service 层在 create/update 时自动 snapshot |
| 回滚语义 | 读版本号 schema → 覆盖当前 page → 新建版本号 |
| API Key 鉴权 | MCP Server 启动时用 `LUBAN_API_KEY` 环境变量通过 BFF 验证，获取 JWT 后缓存 |
| JWT 自动续期 | JWT 过期（BFF 返回 401）时，MCP 自动用缓存的 API Key 重新获取新 JWT，对 Agent 透明 |
| 权限决定 | MCP 不自己做权限，API Key 绑定 user_id，user 的 role 决定 BFF/后端的鉴权结果 |
| API Key 无法登录 | API Key 仅用于 MCP 场景，不支持 Web 登录。Web 登录仍需用户名+密码 |

### 3.5 错误场景清单

| 功能 | 错误场景 1 | 错误场景 2 | 错误场景 3 |
|------|-----------|-----------|-----------|
| api_key 启动验证 | API Key 无效/未配置 → 启动失败，报 `INVALID_API_KEY` | API Key 已撤销 → `API_KEY_REVOKED` | 后端/BFF 不可达 → `SERVICE_UNAVAILABLE`（启动重试机制）|
| apikeys_create（Web UI） | 已超出最大 Key 数（暂定 10）→ `MAX_KEYS_EXCEEDED` | 名称重复 → `CONFLICT` | — |
| apikeys_revoke（Web UI） | Key 不存在 → `NOT_FOUND` | 已撤销 → 幂等返回 200 | — |
| pages_create | 路径冲突 → `PATH_CONFLICT` (409) | siteId 不存在 → `SITE_NOT_FOUND` (404) | Schema 不合规 → `INVALID_SCHEMA` (400) |
| pages_publish | 页面不存在 → `PAGE_NOT_FOUND` (404) | 页面已发布 → 幂等返回 200 | 非本文档编辑 → `FORBIDDEN` (403) |
| versions_rollback | 版本不存在 → `VERSION_NOT_FOUND` (404) | 非 admin → `FORBIDDEN` (403) | 回滚失败（DB 错误）→ `ROLLBACK_FAILED` (500) |
| leads_export | 站点无线索 → 返回空 CSV（text/plain） | 站点不存在 → `SITE_NOT_FOUND` (404) | CSV 生成超时 → `EXPORT_TIMEOUT` (503) |
| datasources_test | 数据源不存在 → `NOT_FOUND` (404) | 远程 API 不可达 → `CONNECTION_FAILED` | static 类型测试直接成功 |
| users_create | 用户名已存在 → `CONFLICT` (409) | 非 admin → `FORBIDDEN` (403) | 密码不合规 → `INVALID_PASSWORD` (400) |

---

## §4 页面结构

### 4.0 入口表

| 路由 | 视图（组件名） | 来源端 | 状态 |
|------|-------------|--------|------|
| — | — | — | **无前端页面** |

### 4.1–4.3 无前端页面声明

**MCP Server 是纯后端服务，没有网页 UI。** 它通过 `@modelcontextprotocol/sdk` 暴露 tools 和 resources，由 MCP 客户端（Claude Code、Cursor 等）以对话/命令形式消费。

用户/Agent 的交互入口：
- **Claude Code**：配置 `.claude/mcp.json` 后，通过自然语言对话使用
- **Cursor**：作为 MCP 工具，在编辑器中直接使用
- **自定义 Agent**：通过 `@modelcontextprotocol/sdk` 的 Client 端编程调用

### 4.4 UX 自检

不适用（无 UI）。

---

## §5 集成与复用表

### 5.1 跨子系统共享件契约

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| BFF REST API | `apps/bff` | `packages/mcp` | 46 个 BFF 路由 + 新增 4 个 API Key 路由，JSON 请求/响应，`Authorization: Bearer <token>` 鉴权 |
| `@modelcontextprotocol/sdk` | npm 社区 | `packages/mcp` | `Server` class, `addTool()`, `addResource()`, `addPrompt()` |
| `PageSchema` 类型（自行定义） | `packages/mcp/src/types/schema.ts` | `packages/mcp` | `{ root: NodeSchema, version?: string }`（**不依赖 Vue 包**，在 MCP 内定义最小化接口） |
| `NodeSchema` 类型（自行定义） | `packages/mcp/src/types/schema.ts` | `packages/mcp` | `{ id, type, props, children?, events?, ... }`（**不依赖 Vue 包**，在 MCP 内定义最小化接口） |
| 内置页面模板 | `apps/engine` 的 `config/templates.ts` | `packages/mcp`（资源文档内容） | 12 个模板的 schema 快照 |
| 物料定义 | `packages/ui` 的 `materials/` | `packages/mcp`（资源文档内容） | 39 个物料的 props schema 清单 |
| API Key 验证 API | `apps/backend-java` → `apps/bff` | `packages/mcp` | `POST /auth/api-key/login` 传入 API Key → 返回 JWT |
| API Key CRUD API | `apps/backend-java` → `apps/bff` | `apps/engine`（Web UI） | `GET/POST/PATCH /api-keys` 代理到后端 |
| `AUTH_JWT_SECRET` | BFF 环境变量 | 间接（MCP 通过 BFF 鉴权） | BFF 侧解 MCP 传来的 JWT 验签，MCP 不接触此 secret |
| JWT 缓存文件 | `packages/mcp` | 本地文件系统 | `~/.luban/tokens.json` AES-256-GCM 加密存储 |

### 5.2 验收要点
- [x] 所有跨系统依赖通过 BFF API 调用，MCP 不直接耦合后端
- [x] 物料/模板资源从现有代码静态导出为 MCP Resource，非运行时绑定
- [x] Token 存储文件路径可配置（环境变量 `LUBAN_TOKEN_PATH`）

---

## §6 架构边界 + 门禁自检

### 6.1 架构边界

```
┌─────────────────────────────────────────────────┐
│              MCP Client (Claude Code etc.)       │
│  stdin/stdout 或 HTTP → MCP Protocol             │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│          packages/mcp (MCP Server)              │
│  ┌──────────────────────────────────────────┐   │
│  │ 启动时: LUBAN_API_KEY → BFF 验证 → JWT   │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ tools/   │  │resources/ │  │ prompts/    │  │
│  │ (30+ 个) │  │ (5 个)    │  │ (1 system)  │  │
│  └────┬─────┘  └───────────┘  └─────────────┘  │
│       │                                          │
│  ┌────▼──────────────────────────────────────┐  │
│  │  lib/bff-client.ts (HTTP → BFF)           │  │
│  │  + auth.ts (API Key 验证 + JWT 缓存)       │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ HTTP + Authorization: Bearer <JWT>
                       │ (首次启动: POST /auth/api-key/login)
┌──────────────────────▼──────────────────────────┐
│       apps/bff (Next.js API Router)             │
│  (新增) POST /auth/api-key/login → 验证 API Key │
│  (新增) GET/POST/PATCH /api-keys → CRUD 代理    │
│  原有 JWT 鉴权 → X-User-ID/X-User-Role →        │
│  callBackend() → backend-java                   │
└──────────────────────┬──────────────────────────┘
                       │ X-User-* headers
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   backend-java    backend-go    (AI assistant)
   (primary)       (deprecated)
   (新增) POST /auth/api-key/validate
   (新增) GET/POST/PATCH /api-keys
   (新增) api_keys 表 Flyway
```

**分层职责**：
- `packages/mcp`：MCP 协议转换层，**不做业务逻辑**，**不做业务数据持久化**（仅缓存本机 JWT），**不做权限判定**。启动时自动用 `LUBAN_API_KEY` 完成鉴权
- `apps/bff`：鉴权、JWT 签发、API Key 验证、CRUD 代理、SSRF 防护
- `apps/backend-java`：业务逻辑 + 数据持久化 + API Key 验证（hash 匹配）+ api_keys 表管理
- API Key 缓存：MCP 本机文件 AES-256-GCM 加密存储 JWT，API Key 仅存环境变量

### 6.2 双后端 parity 矩阵

本 plan **新增 1 个后端接口**（API Key 验证），**新增 4 个 BFF 代理路由**（API Key CRUD + 验证）。Go 后端已标记弃用，不做 Go 端 API Key 实现。

| 接口 | Java 现状 | Go 现状 | 本期目标 |
|------|----------|---------|---------|
| 所有现有 CRUD 接口 | ✅ 全量实现 | ⚠️ 部分实现 | MCP 通过 BFF 调用 Java 端 |
| `POST /auth/api-key/validate` | 🔴 新增 | ❌ 不做 | API Key hash 验证 → 返回 user info |
| `GET /api-keys` | 🔴 新增 | ❌ 不做 | 当前用户 API Key 列表 |
| `POST /api-keys` | 🔴 新增 | ❌ 不做 | 创建 API Key |
| `PATCH /api-keys/{id}/revoke` | 🔴 新增 | ❌ 不做 | 撤销 API Key |

### 6.3 覆盖率门禁目标

| 包 | 目标 | 验证命令 |
|----|------|---------|
| `packages/mcp` | ≥85% | `cd packages/mcp && pnpm run test --coverage` |
| `apps/backend-java` | ≥80%（ApiKey 相关） | `cd apps/backend-java && mvn -q test` |
| `apps/bff` | ≥85%（API Key 路由相关） | `cd apps/bff && pnpm test` |
| `apps/engine` | ≥85%（Settings Tab 相关） | `cd apps/engine && pnpm test` |

### 6.4 物料 schema 标准

MCP 的 `resources/material-catalog.ts` 引用现有物料的 props schema 定义，**不做新物料开发**。引用源：
- `packages/ui/luban-low-code/src/materials/<category>/<name>/material.ts` 的 `defineMaterial()` 调用
- 每个物料的 props schema（JSON Schema）按 `.agents/rules/luban-material-schema.md` 已合规

### 6.5 FeatureGate 策略

| 功能 | FeatureGate key | 作用域 | 关闭行为 |
|------|----------------|--------|---------|
| MCP Server 整体 | `VITE_FEATURE_MCP_SERVER` | engine 前端 | engine 不展示 MCP 相关入口（当前无入口，预留） |
| MCP 单个工具集 | 不设 | — | 后端 API 返回 404/403 时 MCP 工具自然降级 |
| AI Assistant 代理 | 不设 | — | 当前未计划暴露 AI assistant 的流式能力 |

**本 plan 新增的 MCP Server 没有 engine 前端入口**，FeatureGate 仅预留。MCP Server 自身的启停由 `package.json scripts` 控制，不在 FeatureGate 体系内。

**低代码引擎质量规范**：本章节虽不直接涉及引擎代码修改，但 Resources 中的物料文档必须准确反映实际物料定义，对齐 `.agents/rules/luban-lowcode-engine-quality.md`（物料 props schema 合规、描述准确、与 `defineMaterial()` 定义一致）。

**静态导出（V2-T9）排除说明**：engine 的静态 HTML 导出功能（schemaToHtml / buildExportPackage）不纳入本期 MCP 工具范围。原因：此功能是引擎层前端操作（DOM 序列化），MCP 后端无法直接调用。延后到后续迭代评估是否在 BFF 层提供导出 API。

---

## §7 E2E 测试计划

### 7.1 跨端主路径

MCP Server 的 E2E 是 **MCP 协议层的集成测试**，不是浏览器 Playwright 测试。用 `@modelcontextprotocol/sdk` 的 Client 端发起调用验证。

**工具栈**：Vitest + `@modelcontextprotocol/sdk` Client

#### E2E-01：API Key 鉴权全流程
| 字段 | 内容 |
|------|------|
| 前置条件 | MCP Server 运行中，BFF + 后端 Java 运行中；有效 API Key 已创建 |
| 用例步骤 | 1. MCP Server 启动时读取 `LUBAN_API_KEY` → 通过 BFF 验证 → 获取 JWT |
| | 2. 用 JWT 调用 `sites_list` → 成功返回 200 |
| | 3. 使用无效 API Key 启动 → MCP Server 报错退出 |
| | 4. 使用已撤销的 API Key 启动 → MCP Server 报错退出 |
| | 5. API Key 未配置（空环境变量）→ MCP Server 报错退出 |
| 清理方案 | 删除测试 API Key |

#### E2E-02：站点 CRUD 链路
| 字段 | 内容 |
|------|------|
| 前置条件 | 已登录，admin 角色 |
| 用例步骤 | 1. `sites_create` → 201 |
| | 2. `sites_list` → 包含新站点 |
| | 3. `sites_get` → 返回站点详情 |
| | 4. `sites_update` → 200 |
| | 5. `sites_delete` → 204 |
| | 6. user 角色 `sites_create` → 403（仅 admin） |
| 清理方案 | 删除测试站点 |

#### E2E-03：多站点隔离
| 字段 | 内容 |
|------|------|
| 前置条件 | 已登录，两个站点 A 和 B 存在，A 有页面 P_A |
| 用例步骤 | 1. `sites_list` → 返回 A 和 B |
| | 2. `pages_list(A)` → 只返回 A 下的页，不含 B 的页面 |
| | 3. `pages_list(B)` → 不应包含 P_A |
| | 4. `sites_get(A.id)` → 成功，但不包含 B 的信息 |
| 清理方案 | 无 |

#### E2E-04：页面 CRUD + 模板
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点存在 |
| 用例步骤 | 1. `pages_templates` → 返回 ≥12 个模板 |
| | 2. `pages_create` 使用空白模板 → 201 |
| | 3. `pages_get` → 含 schema |
| | 4. `pages_update` schema → 200 |
| | 5. `pages_list` → 包含新建页 |
| | 6. `pages_delete` → 204 |
| 清理方案 | 删除测试页面 |

#### E2E-05：页面发布 → 公开可访问
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点存在，站点 slug 已知 |
| 用例步骤 | 1. `pages_create` draft 页面 → 201 |
| | 2. `pages_publish` → 返回 status=published |
| | 3. `public_get_page(slug, path)` → 返回 schema |
| | 4. 未发布页的 public_get → 404 |
| 清理方案 | 删除测试页面 |

#### E2E-06：版本历史 + 回滚
| 字段 | 内容 |
|------|------|
| 前置条件 | 登录（admin 角色） |
| 用例步骤 | 1. 创建页面 → 版本 1 自动生成 |
| | 2. 更新 schema → 版本 2 自动生成 |
| | 3. `versions_list` → 返回 2 条 |
| | 4. `versions_get(v1)` → 含旧 schema |
| | 5. `versions_rollback(v1)` → 回滚成功 |
| | 6. `pages_get` schema = 版本 1 内容 |
| 清理方案 | 删除测试页面 |

#### E2E-07：表单 CRUD
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点 + 页面存在 |
| 用例步骤 | 1. `forms_create` → 201 |
| | 2. `forms_list` → 包含新表单 |
| | 3. `forms_get` → 含 fieldSchema |
| | 4. `forms_update` → 200 |
| 清理方案 | 删除测试表单 |

#### E2E-08：线索链路
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点 + 表单存在 |
| 用例步骤 | 1. 公开提交 lead → 202（通过 BFF 直接调 public lead submit） |
| | 2. `leads_list` → 包含新线索 |
| | 3. `leads_get` → 含脱敏联系人信息 |
| | 4. `leads_transit_status(assigned)` → 200 |
| | 5. `leads_export` → 返回 CSV |
| 清理方案 | 删除测试线索 |

#### E2E-09：CMS 集合 CRUD + 内容项
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点存在，admin 角色 |
| 用例步骤 | 1. `collections_create` → 201 |
| | 2. `collection_items_create` → 201 |
| | 3. `collection_items_list` → 包含新内容项 |
| | 4. `public_get_collection_items` → 返回 active 内容项 |
| | 5. `collection_items_delete` → 204 |
| | 6. `collections_delete` → 204 |
| 清理方案 | 删除测试集合 |

#### E2E-10：数据源 CRUD + 测试连通
| 字段 | 内容 |
|------|------|
| 前置条件 | 站点存在，admin 角色 |
| 用例步骤 | 1. `datasources_create(static)` → 201 |
| | 2. `datasources_list` → 包含新数据源 |
| | 3. `datasources_test(static)` → ok |
| | 4. `datasources_query(static)` → 返回数据 |
| | 5. `datasources_delete` → 204 |
| 清理方案 | 删除测试数据源 |

#### E2E-11：Agent 引导创建页面（MCP Resources 验证）
| 字段 | 内容 |
|------|------|
| 前置条件 | MCP Server 运行中 |
| 用例步骤 | 1. 通过 MCP Client 读取 resource `luban://schema/rules` → 返回 Markdown 规范文档 |
| | 2. 读取 `luban://materials/catalog` → 返回物料目录 |
| | 3. 读取 `luban://templates` → 返回模板列表 |
| | 4. 读取 `luban://best-practices/page-creation` → 返回最佳实践 |
| 清理方案 | 无 |

#### E2E-12：用户管理（admin only）
| 字段 | 内容 |
|------|------|
| 前置条件 | admin 已登录 |
| 用例步骤 | 1. `users_list` → 返回用户列表 |
| | 2. `users_create` → 201 |
| | 3. `users_get` → 用户详情 |
| | 4. `users_update` → 200 |
| | 5. `users_update_status(disabled)` → 200 |
| | 6. user 角色 `users_list` → 403 |
| 清理方案 | 删除/禁用测试用户 |

#### E2E-13：API Key 管理链路（Web UI）
| 字段 | 内容 |
|------|------|
| 前置条件 | 已登录 Web UI，admin 角色 |
| 用例步骤 | 1. 进入 Settings → API Keys Tab → 查看空列表 |
| | 2. 创建 API Key "mcp-dev-key" → 系统显示一次完整 key `lb_key_* *` |
| | 3. 列表页显示刚建的 Key（prefix 展示，hash 不暴露） |
| | 4. 撤销该 Key → 状态变为 revoked |
| | 5. 使用已撤销的 Key 调用 `POST /auth/api-key/login` → 返回 `API_KEY_REVOKED` |
| | 6. 非 admin 用户无法查看/创建 API Key（仅创建者可查看自己的 Key） |
| 清理方案 | 删除测试 API Key |

### 7.2 脚本保障逻辑
- **首个失败即停**：修当前红用例后继续，直至全量门禁通过
- **禁假绿**：禁 `*.skip`、空断言、无后端全 skip
- **环境预检**：MCP Server + BFF + 后端 Java 起齐才跑；缺服务明确报错
- 对齐 `.agents/rules/luban-e2e-execution-contract.md`

### 7.3 路由合规性确认
所有 MCP E2E 通过 `@modelcontextprotocol/sdk` Client 发起调用，不涉及浏览器路由。**无新增 `pages/e2e/*` 专测页。**

---

## §8 TDD 与执行约定

### 8.1 TDD 先行

| P0 行为 | 测试类型 | 先锁定方式 |
|---------|---------|-----------|
| BFF 客户端鉴权头注入 | 单元测试 | mock fetch/http-client，验证 header 含 Authorization: Bearer |
| BFF Mock 策略 | 集成测试 | T2 设计 BffClient 接口 + 可注入的 http client（Vitest mock 或 nock），T17 用 mock BFF 跑工具逻辑，T18 用真实 BFF 跑全链路 |
| API Key 启动验证 | 单元测试 | mock BFF 验证端点，验证 API Key → JWT 流程 |
| API Key 无效启动报错 | 单元测试 | mock BFF 返回 401，验证 MCP Server 启动失败退出 |
| JWT 过期自动续期 | 单元测试 | mock BFF 返回 401 → 自动用 API Key 重取 JWT |
| 工具参数校验 | 单元测试 | 必填参数缺失 → 工具返回错误 |
| Schema 校验 | 单元测试 | 合法 schema pass，非法 schema fail |
| 端到端全链路 | 集成测试 | 真实 MCP Client → Server → BFF (mock) 调用 |

### 8.2 首个失败即停
- 修当前红用例时专注该条，修绿后继续直至全量通过
- 用户要求暂停/阻塞时列残余项，禁止假装全量完成

### 8.3 并行 subagent
**实现阶段并行线**：

| 线 | 任务 | 依赖 | 可独立验证 |
|----|------|------|-----------|
| **基础设施**（串行） | T1 → T2 | 顺序依赖 | pnpm build + 单元测试 |
| **后端 API Key**（并行） | T20, T21 | T20→T21 | mvn compile + pnpm build |
| **引擎 API Key UI**（单线） | T22 | 依赖 T21 | pnpm build --filter engine |
| **MCP 鉴权** | T3 | T2+T21 完成后 | 单元测试 |
| **核心工具**（并行） | T4, T5, T13 | 均依赖 T3 | 各工具单元测试 |
| **扩展工具**（并行） | T7, T8, T9, T10 | 均依赖 T3 | 各工具单元测试 |
| **管理工具**（并行） | T11, T12 | 均依赖 T3 | 各工具单元测试 |
| **版本历史**（单线） | T6 | 依赖 T5 | 单元测试 |
| **知识层**（并行） | T14, T15, T16 | 依赖 T5 | 资源内容验证 + 单元测试 |
| **收尾**（串行） | T17 → T18 → T19 | 顺序依赖 | 覆盖率门禁 + 集成测试 |

**实现顺序建议**：
1. 基础设施（T1→T2）+ 后端 API Key（T20→T21）【并行】
2. 引擎 API Key UI（T22）+ MCP 鉴权（T3）【T22/T3 可并行，均依赖 T21】
3. 核心/扩展/管理/版本工具 【全部并行】
4. 知识层 【并行】
5. 收尾 【串行】

### 8.4 单期收口声明
本 plan 的所有任务（T1–T19）在**单次实现周期内全部完成**并通过验证门禁。**禁止主路径收口即宣称完成，禁止分期交付。**

### 8.5 Post-Development Workflow

```
代码提交
   ↓
/luban-review 全自动审查（🔴🟡🔵 全部清零，含建议级别）
  └─ 验证门: claude /luban-review
   ↓
多项目编译验证（并行）
  ├─ packages/mcp:  pnpm install --filter @luban/mcp-server && pnpm run build
  ├─ apps/backend-java:  mvn -q compile
  ├─ apps/bff:  pnpm run build
  └─ apps/engine:  pnpm run build
   ↓
单测 + 覆盖率门禁（并行）
  ├─ packages/mcp:  pnpm run test --coverage (≥85%)
  ├─ apps/backend-java:  mvn -q test（含 ApiKeyService 单测）
  ├─ apps/bff:  pnpm test
  └─ apps/engine:  pnpm test
   ↓
询问用户后跑集成测试
  ├─ MCP: @modelcontextprotocol/sdk Client → Server → mock BFF
  └─ Java:  mvn -q verify（IT 阶段全量）
   ↓
向后端 BFF/engine 改动合并
   ↓
任务图状态更新（docs/superpowers/tasks/luban-mcp-server.json → completed）
   ↓
完成汇报
```

**/luban-review 先行**：所有验证步骤前必须先执行 `/luban-review` 并清零，禁止未过审查跑验证。

---

## §9 实现任务派发

> 本节由并行 subagent 在 §0–§8 写完后生成，下一轮执行。

### 9.1 文件变更总览

参见 `docs/superpowers/tasks/luban-mcp-server.json`，22 个任务分布在 4 个子系统中。

**新增文件清单（预估）：**

#### packages/mcp（新增包，~25 个文件）

| 文件路径 | 操作 | 摘要 |
|---------|------|------|
| `packages/mcp/package.json` | 新建 | 包名 `@luban/mcp-server`，依赖 `@modelcontextprotocol/sdk`, `axios`, `dotenv` 等 |
| `packages/mcp/tsconfig.json` | 新建 | TS 配置，target ES2022，module NodeNext |
| `packages/mcp/src/types/schema.ts` | 新建 | PageSchema/NodeSchema 最小化接口定义（不依赖 Vue 包） |
| `pnpm-workspace.yaml` | 修改 | 添加 `packages/mcp` 到 workspace 配置中 |
| `packages/mcp/src/index.ts` | 新建 | MCP Server 入口，启动时 API Key 验证 → 注册 tools/resources/prompts |
| `packages/mcp/src/auth.ts` | 新建 | API Key 鉴权：启动时验证 + JWT 缓存 + 自动续期 |
| `packages/mcp/src/lib/bff-client.ts` | 新建 | BFF HTTP 客户端：callBff 方法 + API Key 启动验证 + 鉴权头 + 错误处理 |
| `packages/mcp/src/lib/schema-validator.ts` | 新建 | Schema 校验工具（参考 ai-assistant validators） |
| `packages/mcp/src/tools/site.ts` | 新建 | 站点管理 5 个 tools |
| `packages/mcp/src/tools/page.ts` | 新建 | 页面管理 7 个 tools |
| `packages/mcp/src/tools/version.ts` | 新建 | 版本历史 3 个 tools |
| `packages/mcp/src/tools/form.ts` | 新建 | 表单管理 4 个 tools |
| `packages/mcp/src/tools/lead.ts` | 新建 | 线索管理 4 个 tools |
| `packages/mcp/src/tools/collection.ts` | 新建 | CMS 集合 8 个 tools |
| `packages/mcp/src/tools/datasource.ts` | 新建 | 数据源 7 个 tools |
| `packages/mcp/src/tools/user.ts` | 新建 | 用户管理 5 个 tools |
| `packages/mcp/src/tools/settings.ts` | 新建 | 系统设置 2 个 tools |
| `packages/mcp/src/tools/public.ts` | 新建 | 公开 API 3 个 tools |
| `packages/mcp/src/resources/schema-rules.ts` | 新建 | Schema 创建规则资源文档 |
| `packages/mcp/src/resources/material-catalog.ts` | 新建 | 物料目录资源 |
| `packages/mcp/src/resources/page-templates.ts` | 新建 | 页面模板资源 |
| `packages/mcp/src/resources/best-practices.ts` | 新建 | 最佳实践资源 |
| `packages/mcp/src/resources/site-analytics-guide.ts` | 新建 | 站点埋点配置指南资源 |
| `packages/mcp/src/prompts/system-prompt.ts` | 新建 | 系统提示词 |
| `packages/mcp/README.md` | 新建 | 使用文档 |
| `packages/mcp/__tests__/tools/` | 新建 | 各工具单测 |
| `packages/mcp/__tests__/lib/` | 新建 | BFF 客户端 + auth 单测 |
| `packages/mcp/__tests__/e2e/` | 新建 | 集成 smoke 测试 |

#### apps/backend-java（~8 个文件）

| 文件路径 | 操作 | 摘要 |
|---------|------|------|
| `.../resources/db/migration/V20260729000001__add_api_keys.sql` | 新建 | api_keys 表 DDL |
| `.../entity/ApiKey.java` | 新建 | ApiKey POJO 实体（id, userId, name, keyHash, keyPrefix, status, lastUsedAt, expiresAt, createdAt, updatedAt）|
| `.../mapper/ApiKeyMapper.java` | 新建 | MyBatis Mapper：findByUserId, findByKeyHash, insert, updateStatus 等 |
| `.../dto/ApiKeyResponse.java` | 新建 | record：无 keyHash 字段，含 fromEntity() |
| `.../dto/ApiKeyCreateRequest.java` | 新建 | record：name, expiresAt（可选）|
| `.../dto/ApiKeyCreateResponse.java` | 新建 | record：含完整 apiKey（仅创建时）|
| `.../service/ApiKeyService.java` | 新建 | 生成/验证/CRUD；BCrypt hash；UUID 生成 |
| `.../controller/ApiKeyController.java` | 新建 | `@RequestMapping("/api-keys")` + `@RequestMapping("/auth/api-key/validate")` |

#### apps/bff（~4 个文件）

| 文件路径 | 操作 | 摘要 |
|---------|------|------|
| `src/app/api/auth/api-key/login/route.ts` | 新建 | POST handler：调用后端 validate → 签发 JWT → 返回 |
| `src/app/api/api-keys/route.ts` | 新建 | GET + POST handler：代理到后端 |
| `src/app/api/api-keys/[id]/revoke/route.ts` | 新建 | PATCH handler：代理撤销 |
| `src/lib/apiKey.ts` | 新建 | API Key 校验辅助工具 |

#### apps/engine（~3 个文件）

| 文件路径 | 操作 | 摘要 |
|---------|------|------|
| `src/api/api-keys.ts` | 新建 | API Key API 调用封装 |
| `src/views/settings/ApiKeysTab.vue` | 新建 | API Key 管理标签页（创建/列表/撤销） |
| `src/views/settings/Settings.vue` | 修改 | 在 tabs 中增加「API Key 管理」项 |

### 9.2 API 契约

MCP Server **新增 1 个后端 API**（API Key 验证），**新增 4 个 BFF 路由**。所有 CRUD 操作仍使用 BFF 现有 46 个路由透传。MCP tools 的输入/输出参数对应 BFF API 的请求/响应体。

**新增 API 契约：**

| 端点 | 方法 | 鉴权 | 请求 | 响应 | 说明 |
|------|------|------|------|------|------|
| `/api/auth/api-key/login` | POST | 无（API Key Header） | `{ apiKey: string }` | `{ token, user: { id, username, name, role } }` | BFF 验证 API Key → 签发 JWT |
| `/api/api-keys` | GET | user | query: `?page=&size=` | `{ items: ApiKeyItem[], total }` | 当前用户的 API Key 列表（仅暴露 prefix + name + status + lastUsedAt + expiresAt，不暴露 hash）|
| `/api/api-keys` | POST | user | `{ name, expiresAt? }` | `{ id, name, apiKey: "lb_key_..." }` | 创建 API Key，返回完整 key（仅创建时可见）|
| `/api/api-keys/{id}/revoke` | PATCH | user | — | `{ status: "revoked" }` | 撤销 API Key |

**后端 Controller 契约：**

| 端点 | 方法 | 请求 | 响应 | 说明 |
|------|------|------|------|------|
| `/backend/auth/api-key/validate` | POST | `X-Api-Key` header | `{ user: { id, username, name, role } }` | Backend 端验证 + 更新 last_used_at |
| `/backend/api-keys` | GET | X-User-ID header | `ApiKeyItem[]` | 当前用户 Key 列表 |
| `/backend/api-keys` | POST | X-User-ID header | `{ name, expiresAt? }` → `{ id, name, keyHash, keyPrefix, apiKey }` | 创建 Key 返回完整 key |
| `/backend/api-keys/{id}/revoke` | PATCH | X-User-ID header | → `void` | 撤销 Key (set status=revoked) |

### 9.3 数据库变更

**新增 Flyway 迁移：`V20260729000001__add_api_keys.sql`**

```sql
CREATE TABLE api_keys (
    id           VARCHAR(36)  PRIMARY KEY,
    user_id      VARCHAR(36)  NOT NULL,
    name         VARCHAR(255) NOT NULL,
    key_hash     VARCHAR(255) NOT NULL,
    key_prefix   VARCHAR(8)   NOT NULL,
    status       VARCHAR(32)  NOT NULL DEFAULT 'active',
    last_used_at DATETIME(3)  NULL,
    expires_at   DATETIME(3)  NULL,
    created_at   DATETIME(3)  NOT NULL,
    updated_at   DATETIME(3)  NOT NULL,
    INDEX idx_api_keys_user_id (user_id),
    INDEX idx_api_keys_status (status),
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**字段说明**：
- `key_hash`：API Key 的 bcrypt hash（与密码同级别的安全存储）
- `key_prefix`：完整 key 的前 8 个字符（含 `lb_key_` 前缀），用于 UI 列表展示
- `status`：`active` | `revoked`
- `expires_at`：可选过期，null=永不过期
- `last_used_at`：每次 validate 时更新，用于审计

### 9.4 物料 schema

MCP 不新增物料，仅将现有物料的 props schema 以 MCP Resource 形式暴露。资源内容从以下源编译：
- `packages/ui/luban-low-code/src/materials/` 各物料的 `material.ts` 中 `defineMaterial().propsSchema`
- `apps/engine/src/config/templates.ts` 的 12 个模板 schema

**物料目录体积优化**：39 个物料的完整 props schema 展开后可能较大（预估 100KB+），采用分层加载策略：
- `luban://materials/catalog`：仅含分类/名称/简述/缩略图（轻量目录）
- `luban://materials/{name}`：按需获取单个物料的完整 props schema（延迟加载）

### 9.5 组件接口

MCP Server 本身无 Vue 组件。它暴露的 tools 的 TypeScript 接口定义如下（示意）：

```typescript
// 工具签名示例
interface PageCreateInput {
  siteId: string;
  name: string;
  path: string;
  /** 可选：从模板创建（传 templateId）或传 schema 从零创建 */
  templateId?: string;
  schema?: PageSchema;
  seo?: PageSeo;
}

interface PageCreateOutput {
  id: string;
  siteId: string;
  name: string;
  path: string;
  status: string;
  schema: PageSchema;
  seo?: PageSeo;
  createdAt: string;
  updatedAt: string;
}

// 所有工具遵循相同模式：
// tool(name).input(schema).output(schema)
// 其中 input/output schema 由 zod 或 jsonschema 定义
```

### 9.6 并行派发计划

基于 taskGraph JSON 的 `dependsOn` 依赖关系：

| 并行阶段 | 任务 | 说明 |
|---------|------|------|
| **基础设施 MCP**（串行） | T1 → T2 | packages/mcp 脚手架 + BFF 客户端 |
| **基础设施 后端**（并行） | T20（独立） | Java 后端 API Key 表+API |
| **BFF API Key 路由**（单线） | T21（依赖 T20） | BFF API Key 验证+CRUD |
| **引擎 UI**（单线） | T22（依赖 T21） | Settings API Key Tab |
| **MCP 鉴权**（单线） | T3（依赖 T2+T21） | API Key → JWT 启动验证 |
| **核心工具**（并行） | T4, T5, T7, T13 | 站点、页面、表单、公开 API |
| **扩展工具**（并行） | T8, T9, T10, T11, T12 | 线索、CMS、数据源、用户、设置 |
| **版本依赖**（单线） | T6（依赖 T5） | 页面工具完成后启动 |
| **知识层**（并行） | T14, T15, T16 | Resources、Prompt、Schema 校验 |
| **收尾**（串行） | T17 → T18 → T19 | 测试 → 集成 → 文档 |

---

## 质量禁令自检表

- [x] **禁止跳过功能**：所有 22 个任务均映射到需求，无静默跳过
- [x] **禁止假绿**：E2E 13 条场景全量真实执行，禁 `*.skip`
- [x] **禁止占位**：每个工具输入/输出 schema 自 document，禁用 TODO/fake
- [x] **禁止骨架交付**：MCP Server 无 UI，交付物是完整可调用的 tools + backend/BFF/engine 完整实现
- [x] **禁止用 JSON 替代页面**：engine Settings API Key Tab 是完整 Vue 组件，非 JSON dump
- [x] **页面交互完整**：Settings API Key Tab 含创建/列表/撤销完整交互 + 空态/错态/加载态
- [x] **验收口径=可交付**：交付口径 = MCP Server 启动成功 + API Key 验证通过 + 任意 tool 调用返回正确数据
- [x] **引擎 E2E 绑正式路由**：Settings API Key 管理在正式路由 `/settings` 下，不以 `pages/e2e/*` 专测页为载体
- [x] **门禁分级执行**：G1–G4 四级齐全（见下节）
- [x] **/luban-review 清零**：Post-Development Workflow 已包含
- [x] **安全审查门禁**：API Key hash 存储 + JWT 加密缓存 + 敏感字段清单（见下节）
- [x] **双后端契约一致**：新增 API Key 接口仅 Java 端实现（Go 端已弃用），不涉及双后端不一致
- [x] **多端渲染一致**：engine Settings API Key Tab 仅在 Web 端使用，不涉及多端渲染
- [x] **FeatureGate 默认约束**：MCP 整体启停由进程控制；engine API Key 管理在 Settings 中无额外开关（Settings 本身已受 auth 保护）

---

## 分级验收门禁表（G1–G4）

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议级别） | plan owner |
| **G2** | 安全审查 | API Key hash 存储 + JWT 加密缓存 + 敏感字段清单 + 鉴权覆盖检查 | 无高危遗留；API Key 仅 hash 存储；无硬编码凭证；Key 仅创建时展示一次 | plan owner |
| **G3** | 单测 + 覆盖率门禁 | 四项目并行：`packages/mcp` + `apps/backend-java` + `apps/bff` + `apps/engine` | MCP ≥85%，Java ≥80%，BFF ≥85%，Engine ≥85% | plan owner |
| **G4** | 集成测试 | `@modelcontextprotocol/sdk` Client 调 MCP Server（mock BFF）+ Java IT | 13 条 E2E 场景全绿，无 `*.skip` | plan owner |

**门禁执行顺序**：G1（/luban-review 清零）→ G2（安全）→ G3（单测覆盖率）→ G4（集成测试）

---

## 敏感字段清单与加密约束

| 字段 | 位置 | 处理 |
|------|------|------|
| `LUBAN_API_KEY` | MCP 环境变量 | 仅存环境变量，不入库不入仓；禁止出现在日志/堆栈中 |
| `JWT Token` | MCP 会话内存 + 本地文件 | 内存仅存变量，文件 AES-256-GCM 加密，文件权限 600 |
| `API Key key_hash` | 后端 DB `api_keys.key_hash` | BCrypt hash（与密码同级别），不可逆 |
| `AUTH_JWT_SECRET` | BFF 环境变量 | MCP 不接触，仅通过 BFF 鉴权 |
| `user.password` | 后端 DB | 仅存 bcrypt hash，MCP 不接触原始密码 |
| `lead.contact_json` | 后端 DB | AES 加密存储 + 日志脱敏，MCP 收到的已是脱敏数据 |
| `BFF_BASE_URL` | MCP 环境变量 | 仅存环境变量，不入库不入仓 |

**约束**：
- 敏感字段禁止出现在 MCP Server 的日志/异常堆栈/调试 dump
- API Key 完整值仅在创建时展示一次，此后永不可查
- Token 文件路径可通过 `LUBAN_TOKEN_PATH` 环境变量配置
- MCP 不存储用户密码（API Key 替换了密码登录流程）

---

## 回滚方案

| 变更 | 回滚首选 | 回滚次选 | 数据影响 | 验证点 |
|------|---------|---------|---------|--------|
| MCP Server 新增包 | **FeatureGate 关闭**（无入口，直接停止 MCP 进程） | git revert 分支合并 | 无（不影响现有系统） | 现有功能完整 |
| Token 文件格式变更 | 删除 `~/.luban/tokens.json` 重启 MCP | 从备份恢复 | 无 | MCP 启动正常 |
| BFF 配置变更 | 恢复环境变量旧值 | git revert .env 文件 | 无 | MCP Server 启动正常 |
| 后端 api_keys 表 | `DROP TABLE IF EXISTS api_keys`（Flyway undo） | 从备份恢复 | 删除所有 API Key | 用户需重创建 Key |
| 后端 API Key Controller | 从 router 移除新增路由 | git revert | 无 | 原有 API 正常 |
| BFF API Key 路由 | 删除新增 route 文件 | git revert | 无 | 原有路由正常 |
| Engine API Key UI | 从 Settings.vue 移除 Tab import | git revert | 无 | Settings 页面正常 |

---

## 附录 A：MCP Tools 完整清单

| # | Tool 名称 | HTTP 映射 | 鉴权 | 说明 |
|---|-----------|----------|------|------|
| 1 | `auth_status` | 内置（无 HTTP） | — | 当前鉴权状态（用户/角色/JWT 过期时间），用于 Agent 确认身份 |
| 2 | `sites_list` | GET /api/sites | user | 站点列表 |
| 3 | `sites_get` | GET /api/sites/{id} | user | 站点详情 |
| 4 | `sites_create` | POST /api/sites | admin | 创建站点 |
| 5 | `sites_update` | PUT /api/sites/{id} | admin | 编辑站点 |
| 6 | `sites_delete` | DELETE /api/sites/{id} | admin | 删除站点 |
| 7 | `pages_list` | GET /api/sites/{id}/pages | user | 页面列表 |
| 8 | `pages_get` | GET /api/sites/{id}/pages/{pid} | user | 页面详情（含 schema） |
| 9 | `pages_create` | POST /api/sites/{id}/pages | user | 创建页面 |
| 10 | `pages_update` | PUT /api/sites/{id}/pages/{pid} | user | 更新页面/schema |
| 11 | `pages_delete` | DELETE /api/sites/{id}/pages/{pid} | user | 删除页面 |
| 12 | `pages_publish` | PUT status=published | user | 发布页面 |
| 13 | `pages_templates` | 内置 | — | 获取可用模板 |
| 14 | `versions_list` | GET .../versions | user | 版本列表 |
| 15 | `versions_get` | GET .../versions/{vid} | user | 版本详情 |
| 16 | `versions_rollback` | POST .../rollback | admin | 回滚版本 |
| 17 | `forms_list` | GET /api/forms?siteId= | user | 表单列表 |
| 18 | `forms_get` | GET /api/forms/{id}?siteId= | user | 表单详情 |
| 19 | `forms_create` | POST /api/forms | user | 创建表单 |
| 20 | `forms_update` | PATCH /api/forms/{id}?siteId= | user | 更新表单 |
| 21 | `leads_list` | GET /api/leads?siteId= | user | 线索列表 |
| 22 | `leads_get` | GET /api/leads/{id}?siteId= | user | 线索详情 |
| 23 | `leads_transit_status` | PATCH /api/leads/{id}/status | user | 线索状态转递 |
| 24 | `leads_export` | GET /api/leads/export?siteId= | user | 导出 CSV |
| 25 | `collections_list` | GET /api/collections?siteId= | user | CMS 集合列表 |
| 26 | `collections_get` | GET /api/collections/{id}?siteId= | user | 集合详情 |
| 27 | `collections_create` | POST /api/collections?siteId= | admin | 创建集合 |
| 28 | `collections_update` | PUT /api/collections/{id}?siteId= | admin | 更新集合 |
| 29 | `collections_delete` | DELETE /api/collections/{id}?siteId= | admin | 删除集合 |
| 30 | `collection_items_list` | GET /api/collections/{cid}/items?siteId= | user | 内容项列表 |
| 31 | `collection_items_get` | GET /api/collections/{cid}/items/{iid}?siteId= | user | 内容项详情 |
| 32 | `collection_items_create` | POST /api/collections/{cid}/items?siteId= | admin | 创建内容项 |
| 33 | `collection_items_update` | PUT /api/collections/{cid}/items/{iid}?siteId= | admin | 更新内容项 |
| 34 | `collection_items_delete` | DELETE /api/collections/{cid}/items/{iid}?siteId= | admin | 删除内容项 |
| 35 | `datasources_list` | GET /api/datasources?siteId= | user | 数据源列表 |
| 36 | `datasources_get` | GET /api/datasources/{id} | user | 数据源详情 |
| 37 | `datasources_create` | POST /api/datasources | admin | 创建数据源 |
| 38 | `datasources_update` | PUT /api/datasources/{id} | admin | 更新数据源 |
| 39 | `datasources_delete` | DELETE /api/datasources/{id} | admin | 删除数据源 |
| 40 | `datasources_test` | POST /api/datasources/{id}/test | user | 测试连通 |
| 41 | `datasources_query` | POST /api/datasources/{id}/query | user | 查询数据 |
| 42 | `users_list` | GET /api/users | admin | 用户列表 |
| 43 | `users_get` | GET /api/users/{id} | admin | 用户详情 |
| 44 | `users_create` | POST /api/users | admin | 创建用户 |
| 45 | `users_update` | PUT /api/users/{id} | admin | 更新用户 |
| 46 | `users_update_status` | PATCH /api/users/{id}/status | admin | 用户状态变更 |
| 47 | `settings_get` | GET /api/settings | admin | 系统设置 |
| 48 | `settings_update` | PUT /api/settings | admin | 更新设置 |
| 49 | `public_get_page` | GET /api/public/sites/{slug}/pages/by-path?path= | 无 | 公开页面 |
| 50 | `public_get_site_config` | GET /api/public/sites/{slug}/config | 无 | 站点配置 |
| 51 | `public_get_collection_items` | GET /api/public/sites/{slug}/collections/{cid}/items | 无 | 公开内容项 |
| 52 | `schema_validate` | 内置 | — | 校验 PageSchema |

## 附录 B：MCP Resources 完整清单

| Resource URI | MIME | 内容 | 用途 |
|-------------|------|------|------|
| `luban://schema/rules` | text/markdown | Schema 结构规范（version/metadata/tree/props/seo） | Agent 了解低代码页面结构 |
| `luban://materials/catalog` | application/json | 39 个物料的分类/名称/props 摘要 | Agent 选择物料时参考 |
| `luban://materials/{name}` | application/json | 单个物料的完整 props schema | Agent 配置属性时参考 |
| `luban://templates` | application/json | 12 个模板的 schema 快照 + 分类 | Agent 新建页面时选择 |
| `luban://best-practices/page-creation` | text/markdown | 布局/SEO/响应式/可访问性最佳实践 | Agent 创建页面时指导 |
| `luban://best-practices/site-analytics` | text/markdown | GA4/百度/Facebook Pixel 配置指南 | Agent 配置站点埋点时参考 |

## 附录 C：安装与使用指引

### 在 Claude Code 中配置

添加到 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "luban": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "BFF_BASE_URL": "http://localhost:3100/api",
        "LUBAN_API_KEY": "lb_key_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
        "LUBAN_TOKEN_PATH": "~/.luban/tokens.json"
      }
    }
  }
}
```

### 快速开始

```
用户: 已经在 Web 上创建了 API Key，配置到 MCP 中。

Agent 启动 → 自动验证 API Key → 鉴权通过
✅ MCP Server 已就绪，当前用户为 admin，所属站点：主站点

用户: 帮我创建一个新的落地页面
Agent: 我来读取页面创建规则和可用模板...
       [读取 luban://schema/rules, luban://templates]
       建议使用「留资落地页」模板，包含 Hero + 特性 + 表单。
       [调用 pages_create + pages_publish]
       ✅ 页面已创建并发布，公开访问路径为...
```

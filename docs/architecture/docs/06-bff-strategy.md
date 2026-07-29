# 06 · BFF 策略

## 定位：Next.js，API-only

`luban-bff` 基于 **Next.js（App Router）**，作为客户端与后端之间的聚合层。**仅提供 route handlers + middleware，不做页面 SSR**——页面 SSR 是 `website`(Nuxt) 的职责，二者职责严格分离，避免渲染职责打架。

## 为什么选 Next.js
- 生态丰富：鉴权库、Edge Runtime、Vercel 部署、中间件能力成熟
- App Router 的 `route.ts` 适合写 API 聚合
- 团队既定选型（现状已用 Next 16 + React 19），保持稳定

## 职责边界

| BFF **做** | BFF **不做** |
|-----------|-------------|
| 客户端鉴权 / JWT 签发与校验 | 页面 SSR / HTML 渲染（归 website） |
| 聚合 / 编排后端接口 | 业务状态机的权威逻辑（归后端） |
| 注入身份 Header（`X-User-ID` 等）给后端 | 直接读写数据库 |
| 表单留资提交转发 + 防刷前置 | 复杂业务规则计算（归后端） |
| 埋点批量接收 / 缓冲 | 长期持久化（归后端 / 数据层） |
| 短链重定向（解析 channel + UTM） | — |
| 公开渲染数据查询（published schema） | — |

**红线**：BFF 不持有业务状态的权威。去重、状态机、归因等业务规则一律在后端，BFF 只做转发与轻量编排。这样保证未来 Go 后端接入时，BFF 无需改动。

## 路由规划

### 保留（现状已有）
| 路由 | 用途 |
|------|------|
| `POST /api/auth/login` · `GET /api/auth/me` | 登录 / 当前用户 |
| `/api/sites` · `/api/sites/[siteId]` | 站点管理 |
| `/api/sites/[siteId]/pages` · `.../[pageId]` | 页面管理 |
| `/api/users` · `/api/users/[id]` · `.../status` | 用户管理 |
| `/api/settings` | 系统设置 |
| `GET /api/public/sites/[slug]/pages` · `.../by-path` | **公开渲染取 schema** |

### 新增（营销留资）
| 路由 | 用途 | 鉴权 |
|------|------|------|
| `POST /api/forms/[id]/submit` | 访客表单留资提交 | 免用户 + 防刷 |
| `GET /api/leads` · `/api/leads/[id]` | 线索列表 / 详情 | 用户 |
| `PATCH /api/leads/[id]` | 线索状态流转 / 认领 / 分配 | 用户 |
| `GET /api/leads/export` | 线索导出（Excel） | 用户 |
| `GET /api/forms` · `POST /api/forms` · `PATCH /api/forms/[id]` | 表单配置管理 | 用户 |
| `GET /api/campaigns` · `POST /api/campaigns` | 活动管理 | 用户 |
| `GET /api/channels` · `POST /api/channels` | 渠道 / 短链 / 二维码生成 | 用户 |
| `GET /:shortCode` | 短链重定向（透传 channel + UTM） | 公开 |
| `POST /api/events/batch` | 埋点批量上报 | 免用户 + 频控 |
| `GET /api/analytics/funnel` | 转化漏斗查询（P1） | 用户 |

## 接口编排示例

### 表单留资提交
```
客户端 POST /api/forms/:id/submit
  body: { contact: {...}, pageId, channel, utm }
    │
BFF middleware: 频控前置（IP/visitor）+ 参数校验
    │
    ▼
BFF → backend POST /backend/lead/forms/:id/submit
  header: X-Site-ID, X-Forwarded-For, X-Visitor-ID
    │
    ▼ backend: 防刷复核 → 去重 → 生成 Lead
    │
BFF ← { leadId, status, dedup }
    │
BFF → (异步) 触发通知 Webhook / 邮件
    │
BFF → 客户端: { success, leadId }
```

### 短链重定向
```
访客 GET /:shortCode
  BFF 查 channel(short_url=shortCode) → 取 target_page + utm_template
  BFF 302 → website 的 page URL，附带 ?channel=code&utm_*=...
```

## 对接约定

- **后端调用**：`src/lib/backendClient.ts`（现状已有），统一注入 `BACKEND_BASE_URL`、身份 Header
- **响应体**：统一 `{ code, message, data }` 结构；错误码与后端对齐（见 `docs/dev/` 与 `luban-cross-cutting-standards.md`）
- **分页**：统一 `{ list, total, page, pageSize }`
- **ID 传输**：后端 Snowflake ID，BFF 与前端一律**字符串传输**（见 `docs/dev/snowflake-id.md`）
- **错误不吞**：BFF 不得静默吞后端错误；返回明确 code/message（对齐 E2E 必须检测后端错误的约束）

## 与多端的关系
所有端（Electron / website / Flutter / uniapp）**统一调 BFF**，不各端自造接口。这是多端数据契约一致的前提（见 `luban-multi-client-consistency.md`）。BFF 是客户端的**唯一入口**。

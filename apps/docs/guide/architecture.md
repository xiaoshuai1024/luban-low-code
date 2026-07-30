# 系统架构

## 整体架构

```
┌─────────────────────────────────────────────────┐
│                    浏览器                        │
├──────────┬──────────┬──────────┬───────────────┤
│  Engine  │ Website  │  Docs    │  GitHub Pages │
│  (SPA)   │  (SSR)   │(VitePress)│  (Landing)   │
│  :5173   │  :3001   │  :5173   │               │
└────┬─────┴────┬─────┴──────────┴───────────────┘
     │          │
     ▼          ▼
┌─────────────────────────────────────────────────┐
│            BFF (Next.js / Node)                  │
│     API 聚合 · JWT 鉴权 · 请求代理               │
│                   :3000                          │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌─────────────┐ ┌────────┐ ┌───────────┐
│ Java Backend│ │ MySQL  │ │ AI Service│
│ Spring Boot │ │  8.0   │ │ FastAPI   │
│  :8080      │ │        │ │  :8000    │
│ MyBatis     │ │ Redis  │ │ DeepSeek  │
│ Flyway      │ │  7     │ │ Qdrant    │
└─────────────┘ └────────┘ └───────────┘
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 低代码引擎 | Vue 3 + Vite + TypeScript | SPA 管理后台，可视化拖拽设计器 |
| UI 物料库 | Vue 3 + SCSS + Nx | 75+ Material Design 组件 |
| BFF | Next.js 16 / Node | API 聚合、JWT 签发、请求代理 |
| 后端 | Spring Boot 3 + MyBatis | RESTful API、Flyway 数据库迁移 |
| 数据库 | MySQL 8.0 + Redis 7 | 关系存储 + 缓存 |
| SSR 站点 | Nuxt 3 + Nitro | 服务端渲染、SEO 友好 |
| AI 助手 | Python FastAPI + DeepSeek | 自然语言生成页面、RAG 物料检索 |
| 文档站 | VitePress | Markdown 文档、左右布局 |

## 请求链路

### 页面渲染（访客侧）

```
浏览器 → Website Nitro SSR
  → BFF GET /api/public/sites/:slug/pages/by-path?path=/
  → Java /backend/public/pages
  → MySQL 查询 PageSchema JSON
  → 返回 schema → Nitro LubanPage 渲染 → HTML
```

### 管理操作（管理员侧）

```
浏览器 → Engine SPA
  → BFF POST /api/sites/:id/pages (JWT 鉴权)
  → Java /backend/pages
  → MySQL 写入 PageSchema
  → 发布后 Website SSR 可渲染
```

### AI 页面生成

```
浏览器 → Engine AI 面板
  → BFF POST /ai/chat (SSE 流式)
  → AI Service → DeepSeek LLM + RAG Qdrant
  → 生成 PageSchema → 确认 → 落地画布
```

## 子系统说明

### 引擎 (apps/engine)

可视化拖拽设计器，Vue 3 SPA。核心模块：
- **物料面板**：左侧组件列表，支持拖拽
- **画布**：中间设计区，实时预览
- **属性面板**：右侧配置区，修改 props/样式/事件
- **AI 助手**：自然语言生成页面

### BFF (apps/bff)

Next.js BFF 聚合层：
- JWT 签发与校验
- 后端 API 代理
- 公开接口（免鉴权，供 SSR 消费）
- 管理接口（JWT 鉴权）

### 后端 (apps/backend-java)

Spring Boot 3 单体后端：
- RESTful API（站点/页面/用户/线索/表单/数据源）
- Flyway 数据库版本管理
- MyBatis 数据访问层
- BCrypt 密码加密

### SSR 站点 (apps/website)

Nuxt 3 服务端渲染：
- 按 path 从 BFF 获取 PageSchema
- LubanPage 组件渲染 schema 为 HTML
- SEO 元信息注入
- 表单留资提交

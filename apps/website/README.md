# luban-website

对外提供网页服务的应用：根据 URL 从 BFF 获取页面数据，使用 luban-ui 的 Render（luban-low-code）渲染低代码页面。

## 技术栈

- **Nuxt 3** + **Vue 3** + **TypeScript**
- **luban-low-code**：接入 Render（`RuntimeRenderer` / `LubanPage`），根据 BFF 返回的 `PageSchema` 渲染页面与低代码组件
- 数据来源：**luban-bff**（需提供公开接口，按站点 + 路径返回已发布页面的 schema）

## 设计文档

- [docs/DESIGN.md](docs/DESIGN.md) — 定位、与 BFF/Render 的对接、路由与数据流、项目结构、实现要点

## 与平台其他系统关系

- **luban-bff**：提供公开 API（如按站点 slug + path 查询已发布页面），本应用仅请求 BFF，不直连后端。
- **luban-ui**：通过 npm 依赖 `luban-low-code`（及 `luban-base`），仅使用运行时渲染，不使用设计器。
- **luban**：管理后台，负责配置站点与页面；本应用是面向访客的展示端。

## 本地开发

1. **安装依赖**：`pnpm install` 或 `npm install`
2. **配置**：复制 `env.example` 为 `.env`，按需设置：
   - `NUXT_PUBLIC_BFF_BASE_URL`：BFF 基地址（默认 `http://127.0.0.1:3000`）
   - `NUXT_PUBLIC_DEFAULT_SITE_SLUG`：默认站点 slug（默认 `default`）
3. **启动**：`pnpm dev` 或 `npm run dev`，访问 http://localhost:3000
4. **依赖**：需先启动 **luban-bff**（并配置其对接 **luban-backend**），且后端已提供公开接口 `GET /backend/public/sites/:slug/pages?path=...`，站点下需有 `status=published` 的页面才能正常渲染。

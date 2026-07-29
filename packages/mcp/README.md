# @luban-low-code/mcp-server

Luban 低代码平台的 **MCP Server**。通过 [Model Context Protocol](https://modelcontextprotocol.io) 向 AI 客户端（Claude Code 等）暴露 Luban 平台的全部能力，使 AI 助手能够直接操作站点、页面、表单、线索、内容集合、数据源等资源。

---

## 快速开始

### 1. 获取 API Key

登录 Luban Web UI → **Settings** → **API Key 管理** → **创建 API Key**。格式：`luban_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`。

### 2. 配置环境变量

```bash
export LUBAN_API_KEY="luban_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export BFF_BASE_URL="http://localhost:3100"      # BFF 地址
```

### 3. 启动

```bash
cd packages/mcp
pnpm install
pnpm run build
node dist/index.js
```

启动正常输出：

```
JWT token refreshed successfully
@luban-low-code/mcp-server started successfully
```

### 4. 在 Claude Code 中配置

在项目 `.claude/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "@luban-low-code/mcp-server": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "BFF_BASE_URL": "http://localhost:3100",
        "LUBAN_API_KEY": "luban_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

重启 Claude Code，验证连接：

```
/auth_status
```

返回 `{ "authenticated": true, "username": "admin", ... }` 即成功。

---

## 配置

| 环境变量 | 说明 | 必填 | 默认值 |
|---------|------|------|--------|
| `BFF_BASE_URL` | Luban BFF 服务地址 | 否 | `http://localhost:3100` |
| `LUBAN_API_KEY` | API Key | **是** | — |
| `LUBAN_TOKEN_PATH` | JWT 令牌缓存文件路径 | 否 | `~/.luban/tokens.json` |

> **BFF_BASE_URL**：本地开发默认 `http://localhost:3100`；生产环境设置为实际域名。

> **LUBAN_API_KEY**：Web UI 创建，具有当前用户完整权限。不要提交到 Git，建议通过 CI/CD 安全变量注入。

> **LUBAN_TOKEN_PATH**：JWT 缓存文件，减少重启时的认证次数。设为空字符串可禁用文件缓存。

---

## 工具参考（47 个）

所有工具均需认证（除 `health`、`ping` 外）。认证由服务器启动时自动完成——用户只需提供 API Key。

### 认证（1 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `auth_status` | _无_ | 返回当前认证状态：是否已登录、用户ID、用户名、角色、JWT 过期时间 |

### 系统（2 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `health` | _无_ | 健康检查（返回 `{"status":"ok","server":"@luban-low-code/mcp-server","version":"0.0.1"}`） |
| `ping` | `message?` (string) | 延迟测试，原样回显 `message` 参数 |

### 站点管理（6 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `site_list` | `page?` (number), `size?` (number) | 获取站点列表 |
| `site_get` | `siteId` (string) | 获取站点详细信息 |
| `site_create` | `data` (object: `{name, slug, base_url, status?, seo?, analytics?}`) | 创建站点。`slug` 需唯一 |
| `site_update` | `siteId` (string), `data` (object) | 更新站点。只传需要改的字段；`name` / `slug` / `base_url` / `status` 等后端必填字段自动补齐 |
| `site_delete` | `siteId` (string) | 删除站点（会级联删除页面和版本） |

**典型用法：**

```
创建站点"产品官网"，slug 为 product-site，域名 https://product.example.com
```

```
列出所有站点
```

```
更新站点 {siteId}，名称为"产品官网（新版）"
```

### 页面管理（6 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `page_list` | `siteId` (string), `page?` (number), `size?` (number) | 获取站点下的页面列表 |
| `page_create` | `siteId` (string), `name` (string), `path` (string), `schema` (any), `status?` (string) | 创建新页面。`path` 为 URL 路径（如 `/welcome`），`schema` 为页面 JSON |
| `page_get` | `siteId` (string), `pageId` (string) | 获取页面完整信息（含 schema） |
| `page_update` | `siteId` (string), `pageId` (string), `name?`, `path?`, `schema?`, `status?` | 更新页面。只传需要改的字段即可，后端必填字段自动补齐 |
| `page_delete` | `siteId` (string), `pageId` (string) | 删除页面（级联删除版本历史） |
| `page_publish` | `siteId` (string), `pageId` (string) | 发布页面（将 `status` 设为 `published`） |

**典型用法：**

```
在站点 {siteId} 下创建首页，路径为 /home，schema 使用空白模板
```

```
发布站点 {siteId} 下的页面 {pageId}
```

```
更新页面 {pageId} 的名称为"关于我们"
```

**页面创建流程：**

1. `schema_validate` 预校验 schema → 2. `page_create` 创建草稿 → 3. `page_update` 完善内容 → 4. `page_publish` 发布上线

### 版本管理（3 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `versions_list` | `siteId` (string), `pageId` (string), `page?` (number), `size?` (number) | 获取页面版本历史列表 |
| `versions_get` | `siteId` (string), `pageId` (string), `versionId` (string) | 获取指定版本的完整 schema |
| `versions_rollback` | `siteId` (string), `pageId` (string), `versionId` (string) | 回滚到指定版本（admin only） |

每次保存（`page_create` / `page_update`）自动生成一条版本快照。

### Schema 校验（1 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `schema_validate` | `schema` (any) | 校验页面 schema 是否符合 Luban 结构规则。创建页面前建议先校验 |

校验规则包含：根节点类型、节点结构、物料 props 类型等。

### 表单管理（4 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `form_list` | `siteId` (string), `page?` (number), `size?` (number) | 获取表单列表 |
| `form_create` | `config` (object) | 创建新表单 |
| `form_get` | `formId` (string), `siteId` (string) | 获取表单详情 |
| `form_submit` | `formId` (string), `data` (object) | 提交表单数据（公开接口，无需认证） |

### 线索管理（4 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `lead_list` | `siteId` (string), `status?` (string), `formId?` (string), `page?` (number), `size?` (number) | 获取线索列表，可按状态/表单筛选 |
| `lead_get` | `leadId` (string), `siteId` (string) | 获取线索详情 |
| `lead_updateStatus` | `leadId` (string), `siteId` (string), `status` (string) | 更新线索状态（如 `new` / `contacted` / `qualified` / `closed`） |
| `lead_export` | `siteId` (string), `format?` ("csv" / "json") | 导出线索数据 |

### 内容集合（6 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `collection_list` | `siteId` (string), `page?` (number), `size?` (number) | 获取站点下的内容集合列表 |
| `collection_create` | `siteId` (string), `name` (string), `schema?` (object) | 创建内容集合 |
| `collection_get` | `collectionId` (string), `siteId` (string) | 获取集合详情 |
| `collection_delete` | `collectionId` (string), `siteId` (string) | 删除集合 |
| `collection_query` | `collectionId` (string), `siteId` (string), `page?` (number), `size?` (number) | 查询集合中的数据项（分页） |
| `collection_addItem` | `collectionId` (string), `siteId` (string), `data` (object) | 添加数据项 |
| `collection_deleteItem` | `collectionId` (string), `siteId` (string), `itemId` (string) | 删除数据项 |

### 数据源（7 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `datasource_list` | `siteId` (string), `page?` (number), `size?` (number) | 获取数据源列表 |
| `datasource_create` | `siteId` (string), `type` (string), `config` (object) | 创建数据源 |
| `datasource_get` | `datasourceId` (string), `siteId` (string) | 获取数据源详情 |
| `datasource_update` | `datasourceId` (string), `siteId` (string), `type?` (string), `config?` (object) | 更新数据源 |
| `datasource_delete` | `datasourceId` (string), `siteId` (string) | 删除数据源 |
| `datasource_test` | `datasourceId` (string), `siteId` (string), `config?` (object) | 测试数据源连接 |
| `datasource_query` | `datasourceId` (string), `siteId` (string), `query` (object), `page?` (number), `size?` (number) | 查询数据源 |

### 用户管理（5 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `user_list` | `page?` (number), `size?` (number) | 获取用户列表 |
| `user_create` | `email` (string), `role` (string), `name?` (string) | 创建新用户 |
| `user_get` | `userId` (string) | 获取用户详情 |
| `user_updateStatus` | `userId` (string), `status` (string) | 更新用户状态（如 `active` / `disabled`） |
| `user_delete` | `userId` (string) | 删除用户 |

### 设置（2 个）

| 工具 | 参数 | 说明 |
|------|------|------|
| `settings_get` | _无_ | 获取系统设置 |
| `settings_update` | `data` (object) | 更新系统设置 |

---

## 资源参考（6 个）

通过 `luban://` 协议暴露内置知识资源，AI 可读取后获得上下文。

| URI | 名称 | MIME | 说明 |
|-----|------|------|------|
| `luban://best-practices/page-creation` | 页面创建最佳实践 | `text/markdown` | 布局规范、SEO、响应式设计、表单、性能等指南 |
| `luban://best-practices/site-analytics` | 站点分析配置指南 | `text/markdown` | GA4、百度统计、Facebook Pixel 集成指南 |
| `luban://materials/catalog` | 物料目录 | `application/json` | 所有物料的按分类分组目录 |
| `luban://materials/{name}` | 物料详情 | `application/json` | 单个物料的完整定义含 props JSON Schema |
| `luban://templates` | 页面模板 | `application/json` | 12 个页面模板列表含结构快照 |
| `luban://schema/rules` | 页面 Schema 结构说明 | `text/markdown` | PageSchema / NodeSchema 定义、物料类型表、团队规范 |

---

## Prompt（1 个）

| 名称 | 说明 |
|------|------|
| `system` | Luban 低代码平台 MCP 助手系统提示词，包含身份设定、核心能力和操作约束 |

---

## 端到端工作流示例

### 工作流 1：创建一个带页面的站点

```
# Step 1: 创建站点
site_create data={name: "我的站点", slug: "my-site", base_url: "https://my-site.example.com"}

# Step 2: 查看可用物料和模板
# 读取 luban://materials/catalog 了解可用组件
# 读取 luban://templates 选择模板

# Step 3: 创建页面
page_create siteId="{siteId}" name="首页" path="/" schema={...}

# Step 4: 发布页面
page_publish siteId="{siteId}" pageId="{pageId}"
```

### 工作流 2：管理用户线索

```
# 列出所有线索
lead_list siteId="{siteId}"

# 标记线索为"已联系"
lead_updateStatus leadId="{leadId}" siteId="{siteId}" status="contacted"

# 导出线索为 CSV
lead_export siteId="{siteId}" format="csv"
```

### 工作流 3：内容管理（集合 + 页面）

```
# 创建内容集合
collection_create siteId="{siteId}" name="新闻"

# 添加内容
collection_addItem collectionId="{collectionId}" siteId="{siteId}" data={title: "...", content: "..."}

# 查询内容
collection_query collectionId="{collectionId}" siteId="{siteId}" page=1 size=10
```

### 工作流 4：页面版本管理

```
# 查看版本历史
versions_list siteId="{siteId}" pageId="{pageId}"

# 查看某版本详情
versions_get siteId="{siteId}" pageId="{pageId}" versionId="{versionId}"

# 回滚到早期版本
versions_rollback siteId="{siteId}" pageId="{pageId}" versionId="{versionId}"
```

---

## 注意事项

### API Key 安全

- **不要提交到 Git** — 通过 `.env` 文件（已在 `.gitignore`）或 CI/CD 安全变量注入
- **最小权限原则** — 不同用途创建不同的 Key
- **定期轮换** — 定期撤销旧 Key 创建新 Key
- Key 泄露后立即在 Web UI 撤销。撤销后 MCP Server 下次启动会认证失败退出

### JWT 令牌自动刷新

服务器启动时用 API Key 向 BFF 换取 JWT 令牌。该令牌有有效期，服务器会自动在过期前刷新。刷新失败时阻塞等待新令牌，重试超过 3 次后退出。

缓存文件（`LUBAN_TOKEN_PATH`，默认 `~/.luban/tokens.json`）用于减少重启时重新认证次数，建议设置权限为 `600`。

### 2 步更新语义

部分工具（`site_update`、`page_update`、`page_publish`）内部实现为 **先 GET 当前资源 → 合并字段 → PUT**。这是为了满足后端对必填字段（如 `name`、`path`、`slug`、`base_url`）的校验。调用方只需传需要修改的字段即可。

---

## 开发

```bash
pnpm run build          # TypeScript 编译
pnpm run dev            # 监听模式
pnpm test               # 运行 50 个单元测试
pnpm test:watch         # 监听模式测试
```

E2E 测试需要 BFF + Java 后端服务运行：

```bash
node __tests__/e2e/real-bff.mjs
```

---

## 技术栈

- **运行时**：Node.js 18+
- **语言**：TypeScript
- **协议**：Model Context Protocol (SDK `^1.30.0`)
- **HTTP 客户端**：Axios
- **Schema 定义**：Zod v4
- **测试**：Vitest

---

## 发布到 npm

本包已发布为 `@luban-low-code/mcp-server`，可通过 `npx` 直接运行：

```bash
npx @luban-low-code/mcp-server
```

### 发布流程（团队维护用）

> **前置条件**：你需要在 npmjs.com 拥有 `@luban` 组织的写入权限。

#### 1. 配置 npm token

从 https://www.npmjs.com/settings/tokens 创建一个 **Automation** 类型 token（避免 CI 中交互式输入）。

在**项目根目录** `.env` 文件中添加（`.env` 已在 `.gitignore`，不会提交到 Git）：

```bash
# .env（项目根）
NPM_TOKEN=npm_你的真实token
```

> 为什么放根 `.env`？这是团队公用 token，放在项目级别文件中统一管理，通过 `.gitignore` 保护。所有开发者只需配置一次 `NPM_TOKEN` 即可发布。

#### 2. 预览发布内容

```bash
cd packages/mcp
pnpm run build
npm publish --dry-run
```

确认 `dist/`、`README.md` 等文件和元数据正确。

#### 3. 发布

```bash
pnpm run publish:npm
```

`publish:npm` 脚本会自动从根 `.env` 加载 `NPM_TOKEN`，然后执行 `npm publish`。

#### 版本号管理

遵循 semver：

```bash
npm version patch   # 0.1.0 → 0.1.1（修复）
npm version minor   # 0.1.0 → 0.2.0（新功能，向后兼容）
npm version major   # 1.0.0（不兼容变更）
```

执行 `npm version` 后会自动创建 git tag，推送到远程即可触发 CI 发布。

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 启动时 "Failed to refresh JWT token" | API Key 无效/已撤销 | 在 Web UI 创建新 Key |
| 启动时 "connect ECONNREFUSED" | BFF 服务未启动 | 检查 BFF 服务状态和 BFF_BASE_URL |
| 调用工具返回 401 UNAUTHENTICATED | JWT 过期且刷新失败 | 重启 MCP Server |
| 调用工具返回 500 "internal error" | BFF 或后端服务异常 | 检查 BFF 和 Java 后端日志 |
| `page_delete`/`site_delete` 返回 500 | ~~BFF 路由缺异常处理~~ 已修复 | 确认版本为最新构建 |
| "Unexpected end of JSON input" | ~~callBackend 未处理 204~~ 已修复 | 确认版本为最新构建 |

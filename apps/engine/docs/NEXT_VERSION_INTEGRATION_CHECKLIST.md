# 下版本联调清单（管理后台 / BFF / 后端）

本清单用于并行开发联调与验收，另一个 agent 拉取代码后可直接按本清单执行。

## 1) 路由与接口清单

- 公开页面（BFF）  
  `GET /api/public/sites/:slug/pages?path=:path`
- 公开页面（Backend）  
  `GET /backend/public/sites/:slug/pages?path=:path`
- 用户管理（BFF）  
  `GET /api/users`、`POST /api/users`
- 站点页面（BFF）  
  `GET /api/sites/:siteId/pages`

## 2) 请求示例

- 查询已发布页面：
  - slug: `marketing`
  - path: `/home`
  - 请求：`/api/public/sites/marketing/pages?path=%2Fhome`

## 3) 预期响应

- `200`：返回页面对象（含 schema）
- `404`：`SITE_NOT_FOUND` 或 `PAGE_NOT_FOUND`
- `403`：`PERMISSION_DENIED`（用户管理接口，非 admin）

## 4) 管理后台验收点（luban）

- 页面列表中 `status=published` 行显示“预览”按钮。
- 点击“预览”优先跳到站点 `baseUrl + path`。
- 若无 `baseUrl`，回退到 BFF 公共路由：
  `/api/public/sites/:slug/pages?path=...`
- 用户管理遇到 `403`：
  - 显示无权限提示
  - “新建用户”按钮禁用

## 5) 并行协作同步点

- 协同状态文件：
  - `luban/docs/NEXT_VERSION_SYNC.md`
  - `luban-bff/docs/NEXT_VERSION_SYNC.md`
  - `luban-backend/docs/NEXT_VERSION_SYNC.md`
- 契约变更顺序：先更新 `luban-backend/docs/API.md`，再同步 BFF 与管理后台。

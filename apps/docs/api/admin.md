# 管理接口

需要 JWT 鉴权的管理 API。通过 `Authorization: Bearer <token>` 头传递令牌。

## 认证

### 登录

```
POST /api/auth/login
```

```json
{ "username": "admin", "password": "your_password" }
```

**响应 200**

```json
{
  "token": "eyJhbGci...",
  "user": { "username": "admin", "name": "Admin", "role": "admin" }
}
```

### 获取当前用户

```
GET /api/auth/me
Authorization: Bearer <token>
```

## 站点管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sites` | 站点列表 |
| POST | `/api/sites` | 创建站点 |
| GET | `/api/sites/:id` | 站点详情 |
| PUT | `/api/sites/:id` | 更新站点 |
| DELETE | `/api/sites/:id` | 删除站点 |

**创建站点**

```json
{
  "name": "My Site",
  "slug": "my-site",
  "status": "active"
}
```

## 页面管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sites/:id/pages` | 页面列表 |
| POST | `/api/sites/:id/pages` | 创建页面 |
| GET | `/api/sites/:id/pages/:pid` | 页面详情 |
| PUT | `/api/sites/:id/pages/:pid` | 更新页面 |
| DELETE | `/api/sites/:id/pages/:pid` | 删除页面 |

**创建页面**

```json
{
  "name": "首页",
  "path": "/",
  "status": "draft",
  "schema": {
    "root": {
      "type": "LubanContainer",
      "children": []
    }
  }
}
```

## 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表（需 admin 角色） |
| POST | `/api/users` | 创建用户（需 admin 角色） |
| PUT | `/api/users/:id` | 更新用户 |
| PATCH | `/api/users/:id/status` | 启用/禁用用户 |

## 线索管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/leads?siteId=:id` | 线索列表 |
| GET | `/api/leads/:id` | 线索详情 |
| PATCH | `/api/leads/:id/status` | 更新线索状态 |
| GET | `/api/leads/export` | 导出 CSV |

## 页面版本

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sites/:id/pages/:pid/versions` | 版本列表 |
| GET | `/api/sites/:id/pages/:pid/versions/:vid` | 版本详情 |
| POST | `/api/sites/:id/pages/:pid/versions/:vid/rollback` | 回滚版本 |

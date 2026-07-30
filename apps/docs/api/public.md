# 公开接口

无需鉴权的公开 API，供 Website SSR 和访客使用。

## 获取页面 Schema

```
GET /api/public/sites/:slug/pages/by-path?path=:path
```

按站点 slug 和页面路径获取已发布的页面 Schema。

**参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|:---:|------|
| slug | path | string | ✅ | 站点标识 |
| path | query | string | ✅ | 页面路径（如 `/docs/getting-started`） |

**响应 200**

```json
{
  "id": "uuid",
  "siteId": "uuid",
  "name": "页面名称",
  "path": "/page-path",
  "status": "published",
  "schema": {
    "root": {
      "type": "LubanContainer",
      "children": [...]
    }
  },
  "seo": {
    "title": "页面标题",
    "description": "页面描述"
  }
}
```

**错误**

| 状态码 | code | 说明 |
|--------|------|------|
| 404 | PAGE_NOT_FOUND | 页面不存在或未发布 |

## 获取站点配置

```
GET /api/public/sites/:slug/config
```

返回站点级配置（含 analytics 设置）。

## 提交线索

```
POST /api/forms/:formId/submit
```

访客提交留资表单，无需鉴权。

**请求体**

```json
{
  "formId": "uuid",
  "contact": {
    "name": "张三",
    "phone": "13812345678",
    "email": "zhangsan@example.com"
  }
}
```

**响应 200**

```json
{
  "status": "accepted",
  "dedup": false
}
```

**错误**

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | INVALID_ARGUMENT | 参数校验失败 |
| 409 | LEAD_DUPLICATE | 重复提交（去重窗口内） |
| 429 | LEAD_SPAM_BLOCKED | 触发防刷限制 |

# 错误码参考

所有 API 错误响应遵循统一格式：

```json
{
  "code": "ERROR_CODE",
  "message": "人类可读的错误描述",
  "details": {}
}
```

## 错误码总览

| code | HTTP | 说明 |
|------|:---:|------|
| `UNAUTHENTICATED` | 401 | JWT 无效或过期 |
| `PERMISSION_DENIED` | 403 | 权限不足（如非 admin 访问管理接口） |
| `NOT_FOUND` | 404 | 资源不存在 |
| `PAGE_NOT_FOUND` | 404 | 页面不存在或未发布 |
| `INVALID_ARGUMENT` | 400 | 请求参数校验失败 |
| `INVALID_CREDENTIALS` | 401 | 账号或密码错误 |
| `USER_DISABLED` | 403 | 用户已被禁用 |
| `CONFLICT` | 409 | 资源冲突（如 slug 重复） |
| `LEAD_DUPLICATE` | 409 | 线索重复提交（去重窗口内） |
| `LEAD_SPAM_BLOCKED` | 429 | 触发防刷限制 |
| `AI_FEATURE_DISABLED` | 503 | AI 功能未启用 |
| `INTERNAL` | 500 | 服务器内部错误 |

## 常见错误处理

### 401 未认证

Token 过期或无效，需要重新登录：

```javascript
if (error.code === 'UNAUTHENTICATED') {
  localStorage.removeItem('luban_token')
  window.location.href = '/login'
}
```

### 403 权限不足

当前用户角色不够，需要 admin 权限的操作。

### 404 页面不存在

Website SSR 遇到此错误会渲染 "Page not found" 错误页。

### 409 线索重复

表单提交时，同一手机号在去重窗口（默认 24 小时）内重复提交。

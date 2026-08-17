# Luban Backend API Reference

> **Base URL**: 前端 → BFF (`/api/*`) → Java 后端 (`http://<host>:8080/backend/*`)
>
> 所有管理端 API 经 BFF 反代（附 `Authorization: Bearer <token>`）；C 端公开 API 直连后端 `/public/*`。

## 错误响应体（统一信封）

```json
{ "code": "SITE_NOT_FOUND", "message": "站点不存在", "details": null }
```

- `code`：业务错误码（大写下划线），见各端点说明
- `message`：人类可读中文消息
- `details`：可选附加详情（null 时省略）

---

## Health

| Method | Path | 说明 |
|--------|------|------|
| GET | `/ping` | 存活探针 |
| GET | `/healthz` | 健康检查（含 DB/Redis 连通性） |

## Auth（鉴权）

| Method | Path | 说明 |
|--------|------|------|
| POST | `/auth/register` | 自助注册（username/email/password → 201；发邮箱验证码；重复 409 `USERNAME_TAKEN`/`EMAIL_TAKEN`） |
| POST | `/auth/register/verify` | 验证码激活（email/code → 事务：active + 默认绑 Free + BFF 签发 `{token,user}`） |
| POST | `/auth/register/resend` | 重发验证码（60s 冷却 + 每邮箱日限 10，超出 429 `VERIFY_RESEND_COOLDOWN`/`VERIFY_RESEND_DAILY_LIMIT`） |
| POST | `/auth/login` | 登录（username + password → token + user；`pending_verification` 用户 401 `USER_PENDING_VERIFICATION`） |
| GET | `/auth/me` | 当前用户信息（需 Bearer token） |

## Users（用户管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/users` | 用户列表（分页/搜索） |
| GET | `/users/{id}` | 用户详情 |
| POST | `/users` | 新建用户（username/password/name/role） |
| PUT | `/users/{id}` | 编辑用户 |
| PATCH | `/users/{id}/status` | 启用/禁用（active/disabled） |

## Sites（站点管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/sites` | 站点列表（非 admin 仅返回 owner=自己的站点） |
| GET | `/sites/{id}` | 站点详情 |
| GET | `/sites/slug-check?slug=` | slug 可用性预检（200 `{available:true}` / 409 `SLUG_TAKEN`） |
| POST | `/sites` | 新建站点（name/slug/baseUrl/status；任意登录用户，owner=自己；超配额 429 `QUOTA_EXCEEDED`） |
| PUT | `/sites/{id}` | 编辑站点（owner 或 admin；存量无主站点仅 admin） |
| DELETE | `/sites/{id}` | 删除站点（级联清理 7 张子表；权限同 PUT） |

## Pages（页面管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/sites/{siteId}/pages` | 页面列表 |
| GET | `/sites/{siteId}/pages/{pageId}` | 页面详情 |
| POST | `/sites/{siteId}/pages` | 新建页面 |
| PUT | `/sites/{siteId}/pages/{pageId}` | 编辑页面（PUT published ≡ POST publish 双写一致） |
| DELETE | `/sites/{siteId}/pages/{pageId}` | 删除页面 |
| POST | `/sites/{siteId}/pages/{pageId}/publish` | 发布页面 |
| POST | `/sites/{siteId}/pages/{pageId}/unpublish` | 下线页面 |

## Page Versions（页面版本）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/sites/{siteId}/pages/{pageId}/versions` | 版本列表 |
| GET | `/sites/{siteId}/pages/{pageId}/versions/{versionId}` | 版本详情 |
| POST | `/sites/{siteId}/pages/{pageId}/versions/{versionId}/rollback` | 回滚到版本 |

## Leads（线索管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/leads?siteId=&status=&formId=&assigneeId=&keyword=&page=&size=` | 线索列表（支持筛选/搜索） |
| GET | `/leads/{id}?siteId=` | 线索详情 |
| GET | `/leads/{id}/contact?siteId=` | 解密查看完整联系方式（自动记录审计日志） |
| PATCH | `/leads/{id}/status?siteId=` | 状态变更（status + assigneeId） |
| GET | `/leads/export?siteId=` | 导出 CSV |

## Forms（表单管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/forms?siteId=` | 表单列表 |
| GET | `/forms/{id}` | 表单详情 |
| POST | `/forms` | 新建表单 |
| PATCH | `/forms/{id}` | 编辑表单（dedupPolicy/dedupKeys/antiSpam） |
| DELETE | `/forms/{id}` | 删除表单（有线索时 409 FORM_HAS_LEADS） |

## Campaigns（活动管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/campaigns?siteId=` | 活动列表 |
| GET | `/campaigns/{id}?siteId=` | 活动详情 |
| POST | `/campaigns?siteId=` | 新建活动 |
| PUT | `/campaigns/{id}?siteId=` | 编辑活动 |
| DELETE | `/campaigns/{id}?siteId=` | 删除活动（有渠道时 409 CAMPAIGN_HAS_CHANNELS） |

## Channels（渠道/短链管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/channels?siteId=` | 渠道列表 |
| GET | `/channels/{id}?siteId=` | 渠道详情 |
| POST | `/channels?siteId=` | 新建渠道（短码自动生成/校验 + UTM 模板） |
| PUT | `/channels/{id}?siteId=` | 编辑渠道 |
| DELETE | `/channels/{id}?siteId=` | 删除渠道 |

## Collections（内容集合）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/collections?siteId=` | 集合列表 |
| POST | `/collections` | 新建集合 |
| PATCH | `/collections/{id}` | 编辑集合 |
| DELETE | `/collections/{id}` | 删除集合 |
| GET | `/collections/{collectionId}/items` | 集合内 items |
| POST | `/collections/{collectionId}/items` | 新增 item |
| PATCH | `/collections/{collectionId}/items/{itemId}` | 编辑 item |
| DELETE | `/collections/{collectionId}/items/{itemId}` | 删除 item |

## Datasources（数据源管理）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/datasources?siteId=` | 数据源列表 |
| GET | `/datasources/{id}?siteId=` | 数据源详情 |
| POST | `/datasources` | 新建数据源（static/api） |
| PUT | `/datasources/{id}?siteId=` | 编辑数据源 |
| DELETE | `/datasources/{id}?siteId=` | 删除数据源 |
| POST | `/datasources/{id}/test?siteId=` | 测试连接（返回 ok/message/latencyMs） |

## Templates（模板市场）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/templates` | 模板列表 |
| GET | `/templates/{id}` | 模板详情 |
| GET | `/templates/{id}/schema` | 模板 schema |
| POST | `/templates` | 新建模板 |
| PUT | `/templates/{id}` | 编辑模板 |
| DELETE | `/templates/{id}` | 删除模板 |
| POST | `/templates/{id}/publish` | 发布模板 |
| POST | `/templates/{id}/archive` | 归档模板 |
| POST | `/templates/{id}/feature` | 推荐模板 |
| POST | `/templates/{id}/install` | 安装模板（发 TemplateInstalledEvent → 创建 draft Page） |

## Analytics（数据分析）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/analytics/overview?siteId=&from=&to=` | 概览（PV/UV/转化/跳出率） |
| GET | `/analytics/funnel?siteId=&from=&to=` | 漏斗分析 |
| GET | `/analytics/attribution?siteId=&from=&to=` | 渠道归因 |
| GET | `/analytics/trend?siteId=&from=&to=` | 趋势分析 |

## AB Experiments（AB 实验）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/public/ab/assign` | C 端分桶（visitorId + experimentId → variantId） |
| GET | `/ab/experiments?siteId=` | 实验列表 |
| GET | `/ab/experiments/{id}` | 实验详情 |
| POST | `/ab/experiments` | 新建实验 |
| POST | `/ab/experiments/{id}/end` | 结束实验 |
| GET | `/ab/experiments/{id}/significance` | 显著性检验（χ² + erfc） |

## Feature Gates（特性开关）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/feature-gates` | 开关列表（管理端） |
| PUT | `/feature-gates` | 更新开关 |
| GET | `/public/feature-gates?siteId=` | C 端公开开关 |

## Settings（系统设置）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/settings` | 读取设置（JSON） |
| PUT | `/settings` | 保存设置（JSON 透传） |

## Billing（套餐与用量）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/billing/plans` | 套餐列表（free/starter/growth，裸数组，仅 visible） |
| GET | `/billing/me` | 当前订阅（含 usage/quota 快照；无订阅回退 free） |
| POST | `/billing/subscribe` | 订阅套餐（`{planCode}` → `{subscription}`；Starter 首次 trialing+14 天试用） |
| GET | `/billing/usage` | 用量查询（`?period=YYYY-MM` 默认当月） |
| POST | `/billing/orders` | 下单（三档全 0 元：同事务 `pending→paid` + 订阅生效；重复下单幂等返回原单；`amount>0` 防御 400 `PAYMENT_NOT_SUPPORTED`） |
| GET | `/billing/orders` | 订单列表（分页 `{items,total}`） |

## Public（C 端访客 API）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/public/sites/{slug}/pages?path=` | 已发布页面 schema |
| GET | `/public/sites/{slug}/config` | 站点配置（FeatureGate/SEO/Analytics SDK） |
| GET | `/public/sites/{slug}/collections/{collectionId}/items` | CMS 集合 items |
| POST | `/lead/forms/{formId}/submit` | 留资提交（去重/防刷/配额） |
| POST | `/public/analytics/events` | 埋点上报 |
| GET | `/public/templates` | 公开模板列表 |
| GET | `/public/templates/{id}/schema` | 公开模板 schema |
| GET | `/public/short/{shortCode}` | 短链解析（→ target page URL + UTM） |

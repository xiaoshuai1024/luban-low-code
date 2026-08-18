# BFF — 前端聚合层

> 此文件由 OpenSpec archive 自动维护，请勿手动编辑。

## Purpose

BFF 聚合层：面向 engine/website 的 API 代理、鉴权、限流与内部信任头管理。

## 领域职责

- REST API 聚合（engine/website 调用 → 后端）
- JWT 鉴权与会话管理
- 数据透传与字段裁剪
- 错误体规范

## 当前能力

（待首个 BFF 相关变更归档后填充）
## Requirements
### Requirement: feature-gates 路由
BFF SHALL 提供 `GET/PUT /api/feature-gates?siteId=`（JWT 鉴权，代理后端）与 `GET /api/public/feature-gates`（公开，透传 fail-open 语义）。

#### Scenario: 管理端读取
- **WHEN** 登录用户 GET /api/feature-gates?siteId=X
- **THEN** 返回该 site 的 gate 配置列表（2xx）

#### Scenario: 公开 fail-open
- **WHEN** 匿名 GET /api/public/feature-gates?siteId=X&key=unknown_key
- **THEN** 返回 {enabled:true}

### Requirement: AB 路由
BFF SHALL 提供 `/api/ab/experiments`（GET 列表/POST 创建/POST :id/end，JWT 鉴权代理）与 `GET /api/public/ab/assign`（公开分流代理）。

#### Scenario: 管理端列表可达
- **WHEN** 登录用户 GET /api/ab/experiments?siteId=X
- **THEN** 状态码 < 300

### Requirement: collab 契约路由
BFF SHALL 提供协作房间在线用户契约端点：无/无效 token MUST 401；有效 token 访问**自己 site 的房间**返回在线用户列表与连接计数；访问**他人 site 的房间** MUST 4xx（IDOR 防护）；无活跃连接时计数为 0。

#### Scenario: 鉴权拒绝
- **WHEN** 无 token 或伪造 token 请求 collab 在线用户端点
- **THEN** 401

#### Scenario: IDOR 防越权
- **WHEN** 用户 A 请求用户 B 所属 site 的房间在线用户
- **THEN** 4xx，不泄露房间信息

#### Scenario: 初始计数
- **WHEN** 房主查询自己房间（无活跃连接）
- **THEN** 在线用户列表为空、连接计数 0

### Requirement: AI 反代路由
BFF SHALL 提供 `/api/ai/config`（及 spec 所需子路径）鉴权反代到 AI 服务（env `AI_SERVICE_BASE_URL`）：登录用户可读写 provider 配置；访客（未携带管理身份）MUST 被识别为 visitor 角色且禁用工具调用；AI 服务不可达时返回明确 5xx/503，不静默。

#### Scenario: 需鉴权
- **WHEN** 无 token 请求 /api/ai/config
- **THEN** 401

#### Scenario: provider 切换
- **WHEN** 登录用户更新 AI provider 配置
- **THEN** 配置生效并可读回


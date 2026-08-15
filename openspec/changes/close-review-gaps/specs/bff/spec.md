## ADDED Requirements

### Requirement: 登录入口速率限制
BFF SHALL 对 `auth/login` 与 `auth/api-key/login` 施加速率限制（按 IP + 失败计数窗口），超限 MUST 返回 429，防止撞库与 API key 暴力枚举。

#### Scenario: 连续登录失败锁定
- **WHEN** 同一 IP 在限制窗口内登录失败超过阈值
- **THEN** 后续登录请求返回 429，窗口结束后恢复

### Requirement: 各环境 JWT 密钥显式注入
BFF 运行环境（含 e2e compose）SHALL 显式注入 `AUTH_JWT_SECRET`，无弱默认回退可用于生产/e2e 环境。

#### Scenario: e2e 环境密钥
- **WHEN** e2e compose 启动 BFF 容器
- **THEN** `AUTH_JWT_SECRET` 来自环境注入的随机值，默认值 `dev-secret-change-me-in-prod` 不可用于签发被后端采信的 token

### Requirement: 内部身份头注入共享密钥
BFF 转发请求至 Java 后端时 SHALL 注入共享密钥头（与后端约定），使后端可拒绝绕过 BFF 的伪造 `X-User-*` 请求；BFF MUST 剥离客户端传入的同名内部头。

#### Scenario: 客户端伪造内部头
- **WHEN** 客户端请求 BFF 时自带 `X-User-Role: admin`
- **THEN** BFF 覆盖/剥离该头，以鉴权结果注入真实身份与共享密钥

### Requirement: 表单删除代理
BFF SHALL 提供 `DELETE /api/forms/{id}` 代理到后端，透传 204/409/403 等状态码与错误体。

#### Scenario: 代理删除成功
- **WHEN** engine 调用 `DELETE /api/forms/{id}` 且后端返回 204
- **THEN** BFF 返回 204

#### Scenario: 透传占用冲突
- **WHEN** 后端返回 409 `FORM_HAS_LEADS`
- **THEN** BFF 返回 409 并保留错误码供前端提示

## ADDED Requirements

### Requirement: 全路由统一错误契约
BFF 全部 /api 路由 SHALL 使用 toBackendResponse 错误转换：后端 4xx/5xx 状态码与错误体 MUST 透传，不得被 Next 兜底吞成 500。

#### Scenario: 旧路由后端 404
- **WHEN** users/settings/sites 等旧路由的后端调用返回 404
- **THEN** BFF 响应 404 且错误体保留

### Requirement: 出站调用全部带超时
BFF 对后端/AI 的所有出站 HTTP 调用 SHALL 经 callBackend（或同等超时封装）；裸 fetch 无超时 MUST 消除。

#### Scenario: 后端挂起
- **WHEN** 后端响应挂起超过超时阈值
- **THEN** BFF 返回 504，不占死连接

### Requirement: 访客 IP 头不可伪造
留资提交链路的客户端 IP 提取 SHALL 取 X-Forwarded-For 末段（最近一跳可信代理追加值），轮换伪造前缀 MUST 不能绕过按 IP 防刷。

#### Scenario: 伪造 XFF 前缀
- **WHEN** 客户端发送 `X-Forwarded-For: 1.2.3.4, 5.6.7.8`（nginx 追加真实 IP 于末尾）
- **THEN** 防刷按末段真实 IP 计数

### Requirement: submit 非 JSON body 400
form submit 路由收到非对象 JSON body（number/string）SHALL 返回 400，不得 500。

#### Scenario: body 为数字
- **WHEN** POST /api/forms/:id/submit body 为 `123`
- **THEN** 返回 400 INVALID_ARGUMENT

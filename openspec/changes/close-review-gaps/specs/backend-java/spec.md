## ADDED Requirements

### Requirement: 后端调用方身份须携带共享密钥
Java 后端 SHALL 校验内部调用方共享密钥（环境变量注入，BFF 与后端共享），未携带或不匹配的请求 MUST 返回 401；`X-User-ID`/`X-User-Role` 头仅在共享密钥校验通过后采信。公开端点（`/public/**`、`/lead/forms/**` 提交、`/auth/**`、healthz）MUST 不受影响。

#### Scenario: 直连后端伪造身份头被拒绝
- **WHEN** 客户端绕过 BFF 直接请求 `api.` 域名并携带 `X-User-ID: 1`、`X-User-Role: admin` 但无共享密钥
- **THEN** 后端返回 401，不执行任何业务逻辑

#### Scenario: BFF 正常代理不受影响
- **WHEN** BFF 校验 JWT 后携带共享密钥与身份头调用后端
- **THEN** 请求正常处理，返回业务响应

### Requirement: healthz 匿名可访问
`/backend/healthz`（及 Spring actuator 对应健康端点）SHALL 匿名返回 200，供容器健康检查与 nginx 反代探活使用。

#### Scenario: 容器健康检查
- **WHEN** 任意客户端无凭证请求 healthz
- **THEN** 返回 200，容器状态为 healthy

### Requirement: 删除页面须级联清理关联表单
删除页面 SHALL 先删除（或显式处理）该页面关联的 forms，避免外键约束导致的 500；若表单下已有 leads，删除行为 MUST 按既定策略处理（级联删除或返回 409，不产生 500）。

#### Scenario: 删除带表单的页面
- **WHEN** 用户删除一个关联了 1 个表单（表单下无 leads）的页面
- **THEN** 页面与其表单一并删除，返回成功，不出现 500

#### Scenario: 删除带线索的表单占用页面
- **WHEN** 删除的页面下存在含 leads 的表单
- **THEN** 系统按策略级联删除或返回 409 及明确错误码，不出现 500

### Requirement: 站点级联删除须事务原子
删除站点（含 leads/forms/datasources/collections/pages/site 多表）SHALL 在单一事务内完成；任一步失败 MUST 整体回滚，不得留下半删状态。

#### Scenario: 级联删除中途失败
- **WHEN** 站点级联删除过程中任一 DELETE 失败
- **THEN** 所有已执行的删除回滚，站点及其子资源保持原状

### Requirement: 留资去重并发安全
留资提交的去重逻辑 SHALL 处理唯一键冲突：并发重复提交命中 `uk_form_dedup` 时 MUST 按去重策略返回既有结果（REJECT/MERGE），不得返回 500。

#### Scenario: 并发双击提交
- **WHEN** 同一访客同一表单在窗口内并发提交两条相同 contact
- **THEN** 仅落库一条 lead，两次请求均返回 2xx（REJECT 返回去重提示），无 500

### Requirement: 表单删除端点
后端 SHALL 提供 `DELETE /forms/{id}`：删除表单；若表单下已有 leads，MUST 返回 409 及错误码 `FORM_HAS_LEADS`，不得级联删除线索数据。

#### Scenario: 删除空表单
- **WHEN** 删除一个无 leads 的表单
- **THEN** 表单删除成功，返回 204

#### Scenario: 删除有线索的表单
- **WHEN** 删除一个已产生 leads 的表单
- **THEN** 返回 409 与 `FORM_HAS_LEADS` 错误码，表单与线索均保留

### Requirement: 敏感操作权限收紧
leads 明文 CSV 导出与 datasource testConnection（服务端发起的连接探测）SHALL 仅允许 admin 角色执行；非 admin MUST 返回 403。

#### Scenario: 普通用户导出线索
- **WHEN** 非 admin 登录用户请求任意站点的 leads CSV 导出
- **THEN** 返回 403

#### Scenario: 普通用户触发数据源连通测试
- **WHEN** 非 admin 登录用户请求 datasource testConnection
- **THEN** 返回 403

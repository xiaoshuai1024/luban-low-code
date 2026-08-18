## ADDED Requirements

### Requirement: 防刷参数配置化生效
留资防刷的窗口/次数 SHALL 从 form.antiSpamJson 读取（无配置回退默认 5 次/60s）；当前「存了不读」MUST 修复。

#### Scenario: 自定义防刷配置
- **WHEN** 表单配置 antiSpamJson {max:2, windowSeconds:30}，同一 IP 在 30s 内第 3 次提交
- **THEN** 第 3 次被限流（429/LEAD_SPAM_BLOCKED）

### Requirement: 500 响应不泄漏内部信息
GlobalExceptionHandler 的 500 响应 SHALL 返回通用错误信息，SQL/约束等内部细节 MUST 仅记日志不返回客户端。

#### Scenario: DB 约束异常
- **WHEN** 触发未映射的 DataIntegrityViolationException
- **THEN** 响应体为通用 INTERNAL_ERROR，无 SQL 细节

### Requirement: Redis 频控原子
防刷计数 increment 与 expire SHALL 原子执行（Lua 脚本或等价方案），进程中断 MUST 不产生永不过期的计数键。

#### Scenario: 计数后中断
- **WHEN** increment 成功后、expire 前进程中断
- **THEN** 该键仍带 TTL（原子脚本保证），不会永久限流

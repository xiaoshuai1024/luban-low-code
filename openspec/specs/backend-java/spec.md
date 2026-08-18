# Backend Java — Java 后端（单端权威）

> 此文件由 OpenSpec archive 自动维护，请勿手动编辑。

## Purpose

Java 单端权威后端的领域服务、数据模型、REST API 与安全边界（供 BFF 调用）。

## 领域职责

- 领域服务（页面管理、用户、计费、留资等）
- 数据模型与 JPA 实体
- Flyway 数据库迁移
- REST API 端点（供 BFF 调用）
- 敏感数据加密与脱敏

## 当前能力

（待首个 backend-java 相关变更归档后填充）
## Requirements
### Requirement: FeatureGate 域（site 级功能开关）
后端 SHALL 提供 FeatureGate 存储（site_id + gate_key 唯一，enabled 布尔）：管理端读写需鉴权；公开查询端点对未配置/未知 key MUST fail-open 返回 enabled=true。lead_capture 关闭时留资提交 MUST 拒绝（错误码 LEAD_DISABLED）。

#### Scenario: 配置并读取 gate
- **WHEN** 管理端创建/更新某 site 的 lead_capture=false，随后公开端点查询该 key
- **THEN** 公开端点返回 {enabled:false}；访客提交留资返回 LEAD_DISABLED

#### Scenario: fail-open
- **WHEN** 公开端点查询不存在的 gate key
- **THEN** 返回 enabled:true

### Requirement: AB 实验域
后端 SHALL 提供 AB 实验：管理端 CRUD（experiment 含 page 维度、variants 含权重）；访客分流端点免鉴权，对同一 (experiment, visitorId) MUST 稳定返回同一 variant（一致性哈希持久分桶）；experiment 结束后分流 MUST 返回 null/结束态。

#### Scenario: 创建实验
- **WHEN** 管理端创建含 2 个变体（权重 50/50）的实验
- **THEN** 创建成功返回 experimentId，列表端点可见

#### Scenario: 分流一致性
- **WHEN** 同一 visitorId 对同一实验请求 assign 多次
- **THEN** 每次返回相同 variantId

#### Scenario: 访客分流免鉴权
- **WHEN** 无 token 请求公开 assign 端点
- **THEN** 正常返回分配结果（不 401）


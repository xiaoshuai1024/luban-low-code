## ADDED Requirements

### Requirement: 任务图与代码账实一致
v02-analytics-billing 任务图 SHALL 落地勘误：billing 相关条目保留 done（signup-billing-onboarding 已实现并验证）；ab/analytics 等未实现条目 MUST 改为 todo 并注明承接 change；e2e-coverage 任务图中 T10/T11 的状态 MUST 与 spec/代码事实一致。全部标记 done 的条目抽查 MUST 有对应代码。

#### Scenario: 抽查 done 条目
- **WHEN** 对任一任务图标 done 的任务按其标题 grep 对应代码域
- **THEN** 实现真实存在

### Requirement: e2e 门禁回绿
本 change 合入后 CI 的 E2E Cross-project workflow SHALL 全绿（含 ab-full-link/billing/collab-contract/feature-gate-full-link/feature-gate-visitor/ai-assistant 6 个 spec，23 用例），无 skip、无 continue-on-error。

#### Scenario: e2e 全量通过
- **WHEN** PR 触发 e2e workflow
- **THEN** 6 个此前后置暴露的 spec 全部通过，job conclusion=success

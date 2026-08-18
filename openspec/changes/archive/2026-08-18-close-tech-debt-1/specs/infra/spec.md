## ADDED Requirements

### Requirement: 覆盖率门禁输出真实数值
`make test-coverage` SHALL 采集并输出各包真实行覆盖率（engine/bff vitest json-summary、ui vitest、backend-java jacoco）；未达标 MUST 阻断（当前实际值恒为 `-`，门禁空转）。

#### Scenario: 采集生效
- **WHEN** 运行 make test-coverage
- **THEN** 汇总表实际列为各包真实百分比（或明确的 SKIP 原因）

### Requirement: journey 门禁与实态一致
journey-coverage 的 P0 旅程 SHALL 有对应 @J-xxx spec 标签绑定或 registry 状态修正；门禁 MUST 反映真实覆盖而非永久假红。

#### Scenario: P0 门禁可判定
- **WHEN** 运行 journey-coverage
- **THEN** P0 项全部已覆盖或显式标注未实现（不因标签缺失误报 GAP）

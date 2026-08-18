## ADDED Requirements

### Requirement: 属性面板全分区可撤销
属性面板的 animation/cmsBinding/datasource 分区修改 SHALL 与 props/style/events 相同：先快照后变更（emit 模式），撤销（Ctrl+Z）MUST 恢复修改前状态。

#### Scenario: 修改动画属性后撤销
- **WHEN** 用户修改组件动画（或 CMS 绑定/数据源绑定）属性后按 Ctrl+Z
- **THEN** 恢复为修改前的值

### Requirement: 数据源配置保存校验
DatasourceManageDialog 中 config 文本非法 JSON 时 SHALL 阻止保存并提示，MUST NOT 把字符串原样发给后端。

#### Scenario: 非法 JSON 拦截
- **WHEN** config 输入非合法 JSON 并点击保存
- **THEN** 前端提示格式错误，不发起保存请求

### Requirement: FeatureGate 判定单一实现
engine 内 FeatureGate env 判定 SHALL 只有 features.ts 一个实现（'false'/'0'→关，其余→开）；死文件 featuregates.ts 移除；useFeatureGate 复用同一语义（'1' 视为开）。

#### Scenario: '1' 值判定
- **WHEN** FeatureGate env 值为 '1'
- **THEN** 所有消费方判定为开启

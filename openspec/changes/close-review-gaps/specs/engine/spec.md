## ADDED Requirements

### Requirement: 属性/样式/事件编辑可撤销
属性面板对 props/style/events 的修改 SHALL 在变更发生前捕获历史快照；用户撤销（Ctrl+Z）MUST 能恢复到修改前的值。当前"先变更后入栈"的时序 MUST 修正。

#### Scenario: 修改属性后撤销
- **WHEN** 用户修改某组件的 props（或 style/events）后按 Ctrl+Z
- **THEN** 该修改被撤销，组件恢复为修改前的值

### Requirement: 撤销栈页面隔离
切换页面/站点时撤销栈 SHALL 被清空；在页面 A 操作后切到页面 B 撤销 MUST NOT 将 A 的 schema 写入 B。

#### Scenario: 切页后撤销
- **WHEN** 用户在页面 A 修改组件后切到页面 B 并按 Ctrl+Z
- **THEN** B 的 schema 不受影响（撤销无操作或提示无可撤销项），保存 B 不会写入 A 的内容

### Requirement: 数据源错误可见
数据源列表加载或测试失败时 SHALL 向用户展示错误信息（接入统一错误归一化），MUST NOT 静默吞错为空列表。

#### Scenario: 加载失败提示
- **WHEN** 数据源列表请求返回 4xx/5xx
- **THEN** 页面显示错误 toast/message，而非静默空列表

### Requirement: 表单删除真实生效
表单列表的删除操作 SHALL 调用 `DELETE /api/forms/{id}` 并按结果反馈；409 `FORM_HAS_LEADS` MUST 提示"表单已有线索数据，不可删除"；MUST NOT 出现仅弹提示不执行的假按钮。

#### Scenario: 删除无数据表单
- **WHEN** 用户删除无 leads 的表单并确认
- **THEN** 调用 DELETE API，成功后列表移除该表单

#### Scenario: 删除有数据表单
- **WHEN** 用户删除已产生 leads 的表单并确认
- **THEN** 提示不可删除原因，表单保留

### Requirement: 源码文件编码合规
engine 全部源码文件 SHALL 为 UTF-8 without BOM；现存乱码文件（usePageEditorApi.ts）MUST 修复为可读中文注释。

#### Scenario: 编码检查
- **WHEN** 对 engine src 执行 `file` 编码检查
- **THEN** 无 ISO-8859/GBK 乱码文件

### Requirement: 仪表盘统计真实
仪表盘各统计卡片（含页面数）SHALL 来自真实 API 数据，MUST NOT 硬编码占位值或保留调试输出。

#### Scenario: 页面数统计
- **WHEN** 打开仪表盘
- **THEN** 页面数显示后端实际数量（>0 时非 0）

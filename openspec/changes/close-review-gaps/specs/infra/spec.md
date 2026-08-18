## ADDED Requirements

### Requirement: CI 真实阻断
CI 工作流中测试步骤失败 MUST 使 job 失败（禁止 `continue-on-error: true`、`|| echo`、`|| true` 兜底）；E2E 条件跳过须符合仓库 E2E 契约（用户明确同意方可 skip）。

#### Scenario: 测试失败阻断合入
- **WHEN** CI 中任一测试步骤非零退出
- **THEN** job 标记失败，PR 不可合并

### Requirement: 单测构建门禁
仓库 SHALL 提供 CI workflow 对各 TS 子项目执行 `pnpm test` + `pnpm run build`、对 Java 后端执行 `mvn -q verify`，按栈分 job 并行。

#### Scenario: PR 触发门禁
- **WHEN** 向 master 发起 PR
- **THEN** 单测/构建/Java verify workflow 运行且结果真实反映成败

### Requirement: 仓库无已放弃后端残留
`apps/backend-go` SHALL 从仓库删除；Makefile、脚本（run-per-pkg.sh、push-all-commit-msg.lib.sh）、skill/command（pr-backend-go）与 CI 中的 Go 后端引用 MUST 一并清理。

#### Scenario: 清理后工具链不触碰 Go
- **WHEN** 运行 run-per-pkg.sh / push-all 类脚本或 make 目标
- **THEN** 不存在对 apps/backend-go 的遍历或 Go test 命令

### Requirement: 文档路径与现实一致
CLAUDE.md 项目表 SHALL 反映实际目录（apps/engine、apps/bff、apps/backend-java、packages/ui、packages/mcp 等），不声明不存在的目录；TODO.md 中已失效条目（已完成的 Flutter、已放弃的 Go、已过时的 BFF 零测试）SHALL 更新或移除。

#### Scenario: 新会话启动检查
- **WHEN** agent 按 CLAUDE.md 项目表定位子项目
- **THEN** 每个声明的路径均实际存在，实际存在的主要子项目均已收录

### Requirement: 任务图状态真实
`docs/superpowers/tasks/*.json` 的任务状态 SHALL 与代码事实一致：T24 完成后标 done；T22（协作 CRDT，未开工）不得标记 done/in_progress 完成态；mcp-server 已实现的任务 SHALL 标 done。

#### Scenario: 对账后核查
- **WHEN** 抽查任务图中标记 done 的任务
- **THEN** 对应代码/端点真实存在

### Requirement: 无 stub 脚本冒充能力
根目录脚本若未实现 SHALL 删除或明确标注"未实现/占位"，不得以 stub 冒充可执行能力。

#### Scenario: 执行脚本
- **WHEN** 运行 scripts/ 下任一脚本
- **THEN** 脚本要么真实执行其声明功能，要么输出明确的未实现提示

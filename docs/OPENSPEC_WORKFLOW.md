# OpenSpec + Superpowers 双工作流分治策略

## 核心理念

> **小任务用 OpenSpec（轻量规范驱动），大任务用 Superpowers（重型契约驱动）。**

两者不是替代关系，是**场景分治**。

---

## 决策树

判断用哪个工作流：

```
任务来了
├── 满足以下任一 → Superpowers
│   ├── 涉及 3+ 文件改动
│   ├── 跨子系统（engine + bff + backend 等）
│   ├── 新增业务实体 / 数据表 / API 端点
│   ├── 需要 E2E 测试覆盖
│   ├── 有安全审查需求（敏感数据/支付/权限变更）
│   ├── 需要 14 条质量禁令的完整门禁
│   ├── 影响渲染一致性 / 多端验证
│   └── 预估 >2 小时开发
│
└── 全部满足以下 → OpenSpec
    ├── 改动 ≤3 个文件
    ├── 单子系统（不改跨系统契约）
    ├── 无新增实体/表/API
    ├── 无需 E2E（单测覆盖即可）
    ├── 无安全敏感变更
    ├── 预估 ≤2 小时开发
    └── 功能边界清晰、无模糊需求
```

### 快速判断口诀

> **改一个文件、改一个字段、配一个开关 → OpenSpec**
> **涉表、涉端、涉多仓、涉安全 → Superpowers**

---

## OpenSpec 工作流（小任务）

适用于：Bug 修复、配置变更、字段调整、单组件优化、日志增强、文档修复等。

### 流程

```
/opsx:propose "描述改动"
  → AI 生成 proposal + design + tasks + delta specs
  → 你确认 / 迭代
/opsx:apply
  → AI 按 tasks 逐项实现
  → 每完成一个 task 跑编译验证
/opsx:archive
  → delta specs 合并到 openspec/specs/
  → 提案移动到 changes/archive/
```

### 约束

- 不跳过 Luban 硬约束（E2E 禁假绿、禁推测、改码前 Read）
- 实现后必须运行：`pnpm run build && pnpm test` 或 `mvn -q verify`
- 涉及引擎改动：额外验证渲染一致性
- Archive 前确认所有 delta specs 正确反映了变更

---

## Superpowers 工作流（大任务）

适用于：新功能、跨子系统特性、数据模型变更、安全敏感改动、需要 E2E 的变更。

### 流程

```
/plan-template（先讨论稿再定稿）
  → writing-plans（落盘 docs/superpowers/plans/）
  → 按 plan 并行 subagent 实现
  → /luban-review 清零（G1）
  → 安全审查（G2）
  → 单测 + 覆盖率（G3）
  → E2E 验收（G4）
  → 完成汇报
```

### 完整参考

详见 `docs/SUPERPOWERS.md` 和 `docs/superpowers/PLAN_WRITING_CONTRACT.md`。

---

## SFD（Specs-First Documentation）规范维护

### 双向同步机制

```
Superpowers 大任务 → 执行完后 → 通过 OpenSpec archive 回流到 specs/
OpenSpec 小任务 → 自动通过 archive 回流到 specs/
```

大任务完成后，虽然主流程不经过 OpenSpec，但仍建议将关键规范变更手动写入 `openspec/changes/` 的 delta specs 并归档，保证 `openspec/specs/` 始终反映系统真实状态。

### 益处

- `openspec/specs/` 成为整个项目的"活的架构文档"
- 新成员或 AI 通过 specs 快速理解系统当前状态
- 避免"文档写的是旧架构，代码已经改了三轮"

---

## 参考

- OpenSpec 官方：https://github.com/Fission-AI/OpenSpec
- 当前工作流：`docs/SUPERPOWERS.md`
- 方案契约：`docs/superpowers/PLAN_WRITING_CONTRACT.md`
- 任务图 SSOT：`docs/superpowers/tasks/*.json`

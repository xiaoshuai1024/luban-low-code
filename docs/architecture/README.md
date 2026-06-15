# luban-architecture-design

luban 低代码**营销与留资平台**的架构与产品设计文档仓。

本仓是平台顶层设计的权威来源：产品定位、领域模型、系统架构、多端渲染策略、后端/BFF 策略、数据模型。下游的 PRD、技术方案、各子项目设计文档均以本仓为上游依据。

## 文档索引

| 文档 | 内容 |
|------|------|
| [00-platform-overview](./docs/00-platform-overview.md) | 平台定位 / 愿景 / 目标用户 / 现状诊断 / 核心闭环 |
| [01-product-design](./docs/01-product-design.md) | 领域模型 / 用户旅程 / 能力分层 / 竞品参考 |
| [02-product-roadmap](./docs/02-product-roadmap.md) | 路线图 P0 / P1 / P2 + 验收标准 |
| [03-system-architecture](./docs/03-system-architecture.md) | 总体架构 / 子项目职责 / 数据流 / 部署拓扑 |
| [04-multi-client-strategy](./docs/04-multi-client-strategy.md) | 多端策略 + schema 渲染一致性（Electron / Flutter 原生 / uniapp 小程序 / web） |
| [05-backend-strategy](./docs/05-backend-strategy.md) | Java 先行 / Go 暂缓 / 领域划分 / 双后端契约 |
| [06-bff-strategy](./docs/06-bff-strategy.md) | Next.js API-only / 职责边界 / 接口编排 |
| [07-data-model](./docs/07-data-model.md) | 核心数据模型 / 表结构草案 |

## 文档维护约定

- 变更走 `feature/*` 分支 + PR，不直接提交 `main`
- 架构决策变更须同步更新对应文档，并在 PR 描述记录决策理由
- 文档与代码冲突时：**代码实现为事实**，文档随后校正，并在 commit 说明差异
- 编码 UTF-8 without BOM；图示统一用 Mermaid

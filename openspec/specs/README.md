# OpenSpec Specs — Luban 活的规范

## 领域目录

| 领域 | 说明 |
|------|------|
| `engine/` | 低代码引擎：渲染、schema、PageEditor、组件系统 |
| `bff/` | BFF 层：API 聚合、鉴权、中间件 |
| `ui/` | UI 物料库：组件、props schema、设计 Token |
| `website/` | SSR 站点：页面路由、SSR 渲染、访客端 |
| `backend-java/` | Java 后端：领域服务、数据模型、Flyway 迁移 |
| `infra/` | 基础设施：CI/CD、部署、监控、FeatureGate |

## 规则

1. **每个 domain 一个 `spec.md`**，描述当前系统的真实行为
2. **变更通过 `openspec/changes/<name>/specs/` 的 delta 产生**
3. **归档时 delta 合并到主 specs**（ADDED 追加 / MODIFIED 替换 / REMOVED 删除）
4. **specs 永不手动编辑**——只能通过 OpenSpec 的 archive 流程修改
5. **小任务用 OpenSpec 治理，大任务用 Superpowers 治理**
   - 小任务：`/opsx:propose` → apply → archive（此流程）
   - 大任务：`/plan-template` → writing-plans → 并行 subagent → G1-G4（见 `docs/SUPERPOWERS.md`）

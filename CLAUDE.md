# CLAUDE.md

luban-workspace — luban 低代码平台 monorepo（原 git superproject + 8 submodule 已通过 git filter-repo 合并为单一仓库，历史完整保留）。统一 AI agent 规则、测试门禁、命令与工作流。

本文件为 Claude Code 主入口。所有 agent 通用规范见 `AGENTS.md`。

## 项目概述

**luban 低代码平台（luban-workspace）** — monorepo（apps/ 可部署应用 + packages/ 库 + docs/）：

| 子项目 | 路径 | 技术栈 | 默认分支 |
|------|------|--------|--------|
| 低代码引擎 | `apps/engine` | TypeScript / Vue 3 | master |
| BFF | `apps/bff` | TypeScript / Node（Next） | master |
| 组件库/物料 | `packages/ui`（nx workspace：luban-base + luban-low-code + apps/luban-ui） | Vue 3 / Vite | master |
| SSR 站点 | `apps/website` | TypeScript / Nuxt SSR | master |
| 后端 Java | `apps/backend-java` | Java / Spring Boot / Maven | master |
| MCP Server | `packages/mcp` | TypeScript（已发布 `@luban-low-code/mcp-server`） | master |
| Sprint MCP | `packages/sprint-mcp` | TypeScript | master |
| AI 助手 | `packages/ai-assistant` | Python / FastAPI | main |
| 移动端 | `packages/client/luban-flutter` | Flutter | main |
| 文档站 | `apps/docs` | VitePress | master |

非中文用户用英文交互，中文用户用中文。

## 🔴 硬约束（MUST）

### 1. 信息与代码必须真实，禁止推测/假信息
所有信息与代码须基于实际代码、官方文档或已验证事实。禁止凭空推测 API/签名/配置；禁止编造报错；不清楚时说"不确定"，先查代码/文档再答。违反者代码审查应被驳回。

### 2. 低代码引擎交付门槛（替代微信合规）
凡改动引擎/物料/schema，须满足：本地 `pnpm run build` 成功且渲染器零新增 console error；物料 props schema 合规（见 `.agents/rules/luban-material-schema.md`）；引擎产物在 `apps/website`（SSR）及各端渲染一致；不确定行为标注"需验证"。

### 3. 后端单端权威（Java）
Java 后端 `apps/backend-java` 为唯一后端实现（Go 双后端战略已放弃，Q4=C，2026-06-28，`apps/backend-go` 已于 2026-08-15 删除，见 `docs/DUAL_BACKEND_PARITY.md`）。不再要求双后端契约对齐。

### 4. E2E 禁止跳过/假绿
所有 E2E 真实执行，禁止 `*.skip`/条件跳过；需跳过须用户明确同意；禁止"未起依赖→全 skip→退出 0"冒充通过。见 `.agents/rules/luban-e2e-execution-contract.md`。

## 快速命令

### TS 仓（engine/bff/ui/website）— pnpm
```bash
pnpm install · pnpm test · pnpm run build · pnpm run test:e2e
```
### 后端 Java
```bash
mvn -q verify          # 单测 + 集成测
mvn spring-boot:run
```
### 全栈门禁
```bash
make test-coverage     # 一键分栈覆盖率汇总 + HTML 报告
```

## 包管理
- **TS 仓统一 pnpm**；禁用 npm install / yarn（CI/遗留除外）
- **Java 仓用 Maven**；禁用 Gradle

## 文件编码（MUST）
所有 `.ts/.vue/.js/.go/.java` 必须 **UTF-8 without BOM**。发现乱码立即修复，不得用 GBK/Latin-1。

## 架构概览
```
低代码引擎(luban) → BFF(luban-bff) → Java 后端(单端权威)
        ↑
  UI 物料库(luban-ui) + SSR 站点(luban-website) + 多端(electron/flutter) + AI 助手
```
- 引擎消费 luban-ui 物料的组件 + schema 渲染页面
- BFF 聚合后端（Java）能力，供引擎/website/多端调用

## 关键约定

### Git 工作流（GitHub）
- 分支：monorepo 单一仓库，默认分支 master；新提交统一 `feature/*`
- 禁止直接 push 默认分支；跨子系统改动一次 commit 完成（monorepo 优势）
- 合并冲突：优先分析双方逻辑保留双方；禁止 `--ours/--theirs`；无法确认询问用户
- 常用：`git pull` / `git push` / `gh pr create`（monorepo 单仓标准操作；原 `/pull-all` `/push-all` `/pr-all` 为 submodule 时代命令，待改写或弃用）

### 测试门禁
- 每个子项目改码后在该包根目录执行构建+测试
- 覆盖率目标：TS 引擎/bff/website 85% · UI 组件库 90% · Java 后端 80%
- `make test-coverage` 汇总

### GitHub 集成（替代云效）
- 优先 gh CLI + GitHub MCP Server；PR/Issue/label 走 `scripts/github/`
- 工作项状态变更须先询问用户

### 改码前必须 Read
Edit/Write 任何文件前先 Read 确认当前状态，禁止凭记忆改。涉及 3+ 文件或跨子仓改动，先列范围等用户确认；小改动直接执行。

## 记忆系统（MUST）
用 MCP memory（`@modelcontextprotocol/server-memory`）或 claude-mem 管理。禁止手动 Write `memory/*.md`（重复存储）。决策/约束/踩坑类问题先检索 memory。

## Agent Rules
- 通用规范见 `AGENTS.md`（需加载）· 详细规则 `docs/AGENT_RULES.md`（§0–11）
- 工作流 `docs/SUPERPOWERS.md` · 低代码引擎规范 `docs/LOWCODE_ENGINE_SPEC.md`
- 测试规范 `docs/TESTING_SPEC.md`
- E2E 指南 `docs/E2E_AGENT_GUIDE.md` · 技术经验库 `docs/dev/`（见 `docs/dev/INDEX.md`）

## 双工作流分治：OpenSpec（小任务）+ Superpowers（大任务）

**小任务 → OpenSpec，大任务 → Superpowers。** 两者场景互补，非替代。

| 场景 | 工作流 | 入口命令 |
|------|--------|---------|
| 小改动（≤3文件/单子系统/≤2h） | OpenSpec 轻量 SDD | `/opsx:propose "..." → apply → archive` |
| 大特性（跨子系统/新实体/需E2E/涉安全） | Superpowers 重型契约 | `/plan-template` → 并行 subagent → G1-G4 |

**判断标准**：满足任一"大任务"条件就用 Superpowers，全部满足"小任务"条件才用 OpenSpec。
详见 `docs/OPENSPEC_WORKFLOW.md`（含完整决策树）。

## 启动检查（MUST）
Agent 开始任何任务前，见 `AGENTS.md`「启动检查」（10 步）。

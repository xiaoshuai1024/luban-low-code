---
name: "source-command-hand-testing"
description: "手工 E2E 测试：加载 agent-hand-testing skill，按测试专家角色做全功能/逻辑/死数据/边界验证（先问再改、不改已有业务逻辑）"
---

# source-command-hand-testing

Use this skill when the user asks to run the migrated source command `hand-testing`.

## Command Template

## 含义

**`/hand-testing`**：将当前对话中的测试任务锁定为**手工（半自动）E2E 测试模式** —— 以资深测试专家（SDET / QA Lead）视角，对被测模块做全功能穷尽验证、CRUD 闭环与死数据检测、边界与异常测试，结束输出标准测试报告并落地历史记录。

> 与 `/engine-e2e` `/website-e2e`（自动化 E2E 执行）、`/luban-review`（代码静态审查）互斥：本命令治**手工探索式测试**，自动化执行纪律由 `.agents/rules/luban-e2e-execution-contract.md` SSOT。

## Agent 必须加载

加载并遵循 `.agents/skills/agent-hand-testing/SKILL.md`（luban 适配版）。该 skill 含测试专家角色预设、元素穷尽验证清单、CRUD/死数据检测、用户旅程优先（API≠E2E）、curl 路由冒烟、CORS/Filter 排障、异步竞态、缺陷定级与报告格式。

## Agent 必须遵守

### 1. 测试前先列用户旅程，不列 API 端点

测一个模块前，至少列一条**用户旅程**（用户视角的操作闭环），列不出说明对功能理解不够，先读 PRD/原型。**禁止把 API 列表当用户旅程。**

### 2. 三件事断言（每个 UI 操作后）

每次 UI 操作后必须断言：① UI 反馈（Toast/状态变化/跳转）② 数据持久化（API/DB 查询）③ 可逆性（能否回到操作前状态）。**无断言的操作不算测试。**

### 3. API 通 ≠ E2E 通过（红线）

API 返回 200 只能标记"API 验证 ✅"，**不能**标记该模块 E2E ✅。E2E 通过的标准是用户能通过 UI 完成一个完整操作闭环。

### 4. 先问再改，不改已有业务逻辑

- 测试失败先分析根因 → 给建议 → 等用户确认再改（禁止自行决定修复方案）
- 不修改已上线业务逻辑；发现的业务 BUG 记录为缺陷，不自行修复
- 测试代码（spec 文件）不受此限制 —— 可补未覆盖功能的测试

### 5. 后端端点可达性冒烟（若改了 `@*Mapping`）

若本次改动新增/修改后端 HTTP 端点，**进入 UI 测试前**先用 curl 验证路由真的通了（4xx=可达/404=不存在/405=方法误解析）。luban 后端**未引入 actuator**，健康端点 `curl http://localhost:8080/backend/ping` 返回 `{"message":"pong"}`；认证区分：直连后端用 `X-User-ID`/`X-User-Role` header，走 BFF 用 `Authorization: Bearer <jwt>`；**后端路由不带 `/api`、BFF 代理带 `/api`**。详见 skill §0.5。

### 6. 服务依赖可用，禁止以环境借口跳过

所有 luban 服务一定可用（`make dev-java` / `make dev-bff` / `make dev-engine` / `make dev-website`）。排查顺序：进程 → 端口 → 日志 → 构建 → 依赖。排完再说话。

## 报告与流转（结束前 MUST）

1. 按 skill §12.2 格式输出**完整测试报告**（测试结果 / 缺陷清单 / 死数据发现 / 未覆盖功能）
2. 在项目根 `.agent-hand-testing/{yyyy-mm-dd}-{模块名}.md` 落地历史记录（skill §14.1 格式）
3. **P0/P1 缺陷必须立即同步给用户**，不等报告汇总
4. 给出"手测→自动化"建议（哪些路径应转为 Playwright E2E，priority P0–P3）

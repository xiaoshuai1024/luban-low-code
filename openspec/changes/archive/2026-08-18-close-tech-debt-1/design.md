# Design: close-tech-debt-1

## Context

master 已含三轮收口（#22/#23），CI 双 workflow 真实门禁已建立。本 change 清偿 review 与实施中记录的存量债务。分支自 master（feature/close-tech-debt-1）。

## Goals / Non-Goals

**Goals**：三分区撤销、BFF 错误契约统一、防刷配置化、覆盖率真实采集、marketing 测试、journey 门禁可判定。
**Non-Goals**：website 测试补齐（官网范围，另立）；captcha/webhook 真实实现（产品功能）；ST-001 published_pages 快照（独立特性）；T22 协作 CRDT（独立立项）。

## Decisions

### D1. 三分区撤销：复用已验证的 emit 模式
props/style/events 的修复模式（PropertyPanel emit → PageEditor 应用前 push）直接套用到 animation/cmsBinding/datasource 三分区。cmsBinding 分区 v-model computed setter 改 emit 协议（改动面最大，独立 commit 便于回滚）。

### D2. BFF 错误契约：机械收口，不改语义
10 个旧路由补 try/catch + toBackendResponse（模式与 datasources 一致）；revoke/export 改 callBackend（其 204 已处理，过时注释删除）；XFF 解析取 `split(',').pop().trim()`；submit body 先校验 `typeof body === 'object'`。

### D3. 防刷配置化：读取点收敛 LeadService
FormResponse 已带 antiSpamJson（已存）；submit 链路解析 `{max, windowSeconds}` 传 AntiSpamService（新增带参 check 方法，默认值回退）；Redis 原子化用单条 Lua `INCR+EXPIRE NX`（spring StringRedisTemplate execute）。

### D4. 覆盖率：reporter 各栈最小配置
engine/bff vitest.config 加 `coverage.reporter: ['text','json-summary']`；ui vitest workspace 同步；pom 加 jacoco plugin（prepare-agent + report 绑定 verify）。coverage-summary.sh 的采集路径已支持（json-summary/jacoco.xml），只缺产物——不改脚本。

### D5. journey 门禁：registry 显式化
J-* 项逐条核对 e2e spec 是否已有对应 @J 标签（wire-e2e 后多数应已覆盖）；确无 spec 的 P0 项在 journey-registry.json 标 `planned:false`（显式未实现），门禁只对「声称已实现但无绑定」红。

### D6. 并行分派
4 agent：A(engine 债)、B(BFF 债)、C(Java 防刷/错误/原子化)、D(覆盖率配置 + journey 对账 + marketing 测试)。文件面不相交（A: engine views/config；B: bff routes；C: backend-java；D: vitest 配置/pom/registry/ui tests——pom 与 C 同仓不同文件，D 只碰 pom jacoco 段）。

## Risks / Trade-offs

- [三分区 cmsBinding 改动面大] → 独立 commit + 既有撤销测试兜底
- [jacoco 首启可能暴露低覆盖率阻断] → 目标阈值维持既有（80%），若实际低于阈值是真实债务显现，如实报告不调门槛
- [journey registry 判定语义变化] → 仅新增字段不改既有字段语义

## Migration Plan

分支实施 → 各栈本地验证 → push → CI 双绿 → PR → 归档。回滚按 commit revert。

## Open Questions

（无）

# Design: wire-e2e-feature-gaps

## Context

e2e spec 即契约（TDD 前瞻 spec，6 个中 billing 已由 signup plan 实现）。工作树基于 feature/signup-billing-onboarding（含 billing/register/订单域），其分支未合 master——本 change 叠加其上，合并顺序：close-review-gaps(#22) → signup-billing → 本 change。backend 现有 Billing/Register 等域可作风格参照；FeatureGate/AB/协作/AI 后端零基础。

## Goals / Non-Goals

**Goals**：4 组路由 + 2 个后端域满足 23 个 e2e 用例；对账任务图；CI e2e 回绿。
**Non-Goals**：真实 WebSocket 服务与 CRDT（T22）；AB 报表/显著性（分析域）；analytics 埋点（P-003 其余）；AI 面板 UI 深化。

## Decisions

### D1. FeatureGate：独立小域，读多写少
表 `feature_gates(id, site_id, gate_key, enabled, ts...)`，唯一键 (site_id, gate_key)。Controller：管理端 GET/PUT（AuthFilter 登录态 + site 归属校验参照 SiteOwnershipGuard 若 signup plan 已提供，否则 id 相等校验）；公开端点 GET /public/feature-gates?siteId&key → 未配置返回 {enabled:true}。lead submit 前置检查：lead_capture=false → 403 LEAD_DISABLED（PublicLeadController 处插入查询，fail-open 语义同上）。内置默认 realtime_collab=true 语义靠 fail-open 自然获得（不配置即开）。

### D2. AB：最小可测分桶
表 `ab_experiments(id, site_id, page_id, name, status[running|ended], started_at, ended_at)` + `ab_variants(id, experiment_id, variant_key, weight, schema_json NULL)` + `ab_assignments(experiment_id, visitor_id, variant_id, assigned_at, 唯一(experiment_id, visitor_id))`。
- assign：先查 assignment（稳定），无则按权重一致性哈希选 variant（hash(experimentId+visitorId) 对累积权重区间）并 insert（撞唯一键重查——复用 lead 去重竞态处理模式）。
- ended 实验 assign 返回 {variantId:null, status:'ended'}。
- BFF：/api/ab/experiments GET/POST、/api/ab/experiments/:id/end POST（管理端）；/api/public/ab/assign GET（免鉴权）。

### D3. collab：BFF 内存态契约层
无真实 WS（Non-Goal），实现 HTTP 契约：`GET /api/collab/:siteId/rooms/:roomId/users`：
- JWT 校验（apiHandler 既有），无效 401；
- IDOR：site 归属校验——查 BFF 已有 /sites 代理判定 siteId 属于当前用户（admin 放行），否则 403；
- 返回 {users:[], connectionCount:0}（无 WS 服务，列表恒空——与 CC6 契约一致）。
内存 Map 预留（roomId→连接表）供未来 WS 接入，本期不实现连接管理。

### D4. AI 反代：薄代理 + 角色识别
`AI_SERVICE_BASE_URL` env（packages/ai-assistant FastAPI；未配置时 503 AI_SERVICE_UNAVAILABLE）。/api/ai/config GET/PUT 反代；请求注入 `X-Luban-Role: user|admin|visitor`（visitor=无 token 或 token 无管理身份时由公开判定——spec 要求访客识别）。工具调用禁用：BFF 对 visitor 角色的请求剥离/覆盖 tools 相关字段（最小：转发时加 `{"tools":[]}` 合并）。
- 备选：BFF 直连 packages/ai-assistant 进程——部署形态未定，env 指向即可。

### D5. 并行分派与冲突面
4 个实施域文件不相交（backend: FeatureGate* / Ab* / PublicLeadController 接口点；bff: 4 组路由目录 + env）。共享点预分配：Flyway 版本号 FeatureGate=V20260817130001、AB=V20260817130002（互不冲突）；PublicLeadController 的 lead_capture 检查归 FeatureGate agent；compose/env 由主会话统一改。验证：本地 mvn verify + pnpm test/build → push → CI e2e 真跑（compose 栈是唯一真裁判）。

### D6. 对账口径
v02 勘误注记已由 signup plan 加入（5034c3f）；本 change 落地实际状态翻转：billing 相关 done 保留；T-be-9/T-be-10/T-bff-4（ab）在本 change 完成后改回 done 并注明重实现；analytics/web/eng 未实现条目改 todo。e2e-coverage T10/T11 在 CI 绿后 done。

## Risks / Trade-offs

- [assign 哈希分散性 best-effort 用例] → 权重区间实现 + spec 自身容错（AB3 标注 best-effort）
- [collab 契约层与未来 WS 行为漂移] → 注释明确契约语义为 SSOT，WS 落地时复用同端点
- [AI 服务未部署导致 e2e ai spec 失败] → e2e compose 不含 AI 服务——检查 ai-assistant.spec 用例是否可对 BFF mock 语义跑通；若 spec 需要 AI 服务真实响应，则 compose 增加 ai 服务（FastAPI 轻量）或 spec 契约内 503 分支——以 spec 文件实际断言为准，实施 agent 先读 spec 再定
- [叠加分支未合并] → 合并顺序明确，rebase 冲突风险低（本 change 只增不改 signup 域文件）

## Migration Plan

1. 分支 feature/wire-e2e-feature-gaps（自当前 signup 分支头）
2. 并行实施 → 本地验证 → push → CI 循环修绿 → 归档
- 回滚：revert 本 change commit 即可（新表无存量数据依赖）

## Open Questions

（无）

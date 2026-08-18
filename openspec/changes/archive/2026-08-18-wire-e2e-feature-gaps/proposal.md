# Proposal: wire-e2e-feature-gaps

## Why

close-review-gaps 去除 CI 假绿后，e2e 套件暴露出 6 个 spec（23 用例）测的是从未实现的功能；其中 billing 已由 signup-billing-onboarding plan 落地，剩余 4 块（AB 实验 / collab 契约 / feature-gates / ai 反代）零实现，且任务图存在成片「done 但代码不存在」的账实不符（v02-analytics-billing 26 条、D-002 FeatureGate——git 勘误已确认代码从未存在，见 commit 5034c3f）。本 change 以 e2e spec 为契约补齐这 4 块并完成对账，使 e2e 门禁真实回绿。

## What Changes

- **feature-gates**：Java FeatureGate entity/mapper/service/controller（site 级 gate 配置，gate_key 如 realtime_collab/lead_capture/signup）+ BFF `GET/PUT /api/feature-gates?siteId=`（鉴权）+ `GET /api/public/feature-gates`（公开读，fail-open：未知 key 返回 enabled=true）
- **AB 实验**：Java ab 域（experiments 表 + variants + assignments，一致性哈希分桶，同 visitor 稳定变体）+ Controller（管理端 CRUD + `GET /public/ab/assign` 免鉴权分流）+ BFF `/api/ab/experiments` CRUD 代理与 `/api/public/ab/assign`
- **collab 契约**：BFF `/api/collab/{siteId}/rooms/{roomId}/users`（JWT 鉴权 401、在线用户列表与连接计数、越权他人房间 4xx）——HTTP 契约层实现（spec 明示"等价 ws 101"），真实 WS 服务不在本范围
- **AI 反代**：BFF `/api/ai/config`（鉴权反代 AI 服务，env `AI_SERVICE_BASE_URL`；访客角色识别为 visitor、禁工具调用）+ provider 切换透传
- **对账**：v02-analytics-billing 任务图勘误落地（billing 部分保留 done——signup plan 已实现；ab/analytics 未实现部分改 todo 并注明由本 change 承接）；e2e-coverage T10/T11 状态与代码事实对齐
- 验证：push 后 CI e2e（compose 栈）ab/billing/collab/feature-gate×2/ai-assistant 6 spec 全绿

## Capabilities

### New Capabilities

（无 — 均归入既有能力域）

### Modified Capabilities

- `backend-java`: 新增 FeatureGate 域（配置读写 + fail-open 语义）；新增 AB 实验域（CRUD + 访客分流一致性分桶）
- `bff`: 新增 feature-gates/ab/collab/ai 四组路由（鉴权、公开分流、越权防护、AI 反代）
- `infra`: 任务图账实对账（v02/e2e-coverage）；e2e 门禁回绿

## Impact

- 代码：`apps/backend-java`（新 domain/controller + Flyway 迁移）、`apps/bff`（4 组新路由）、`.env.example`（AI_SERVICE_BASE_URL）
- 测试：e2e 6 spec（23 用例）从红转绿；Java/BFF 新增单测
- 不含：真实 WebSocket 协作服务（T22 CRDT 接线）、AB 报表/显著性 UI、analytics 埋点域（P-003 其余部分）——均保持 todo

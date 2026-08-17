# Tasks: wire-e2e-feature-gaps

## 1. FeatureGate 域（Java + BFF）

- [ ] 1.1 Flyway V20260817130001 feature_gates 表（唯一键 site_id+gate_key）+ Entity/Mapper/Service（fail-open 查询语义）
- [ ] 1.2 FeatureGateController：管理端 GET/PUT（鉴权）+ 公开 GET /public/feature-gates（fail-open）
- [ ] 1.3 PublicLeadController 提交前置 lead_capture 检查（关闭 → 403 LEAD_DISABLED，fail-open）
- [ ] 1.4 BFF /api/feature-gates（GET/PUT 鉴权代理）+ /api/public/feature-gates（公开）
- [ ] 1.5 单测：fail-open / 配置读回 / lead_capture 关闭拦截（Java 契约测试）

## 2. AB 实验域（Java + BFF）

- [ ] 2.1 Flyway V20260817130002 ab_experiments/ab_variants/ab_assignments 三表（唯一键 experiment+visitor）
- [ ] 2.2 AbService：CRUD + assign（先查后插撞键重查；权重区间哈希分桶；ended → null）
- [ ] 2.3 AbController：管理端 CRUD + end + 公开 GET /public/ab/assign（免鉴权）
- [ ] 2.4 BFF /api/ab/experiments（GET/POST + :id/end）+ /api/public/ab/assign
- [ ] 2.5 单测：分流一致性（同 visitor 稳定）/ 免鉴权 / ended 语义 / 权重区间

## 3. collab 契约（BFF）

- [ ] 3.1 BFF /api/collab/:siteId/rooms/:roomId/users：401 鉴权 / site 归属 IDOR 403 / 空列表计数 0
- [ ] 3.2 单测：三分支（401/403/200 空态）

## 4. AI 反代（BFF）

- [ ] 4.1 .env.example + compose 增 AI_SERVICE_BASE_URL；未配置 503 AI_SERVICE_UNAVAILABLE
- [ ] 4.2 /api/ai/config GET/PUT 反代 + 角色注入（visitor 禁工具：tools 强制空）
- [ ] 4.3 依 ai-assistant.spec 实际断言决定 e2e compose 是否加 ai 服务或走 503 分支（实施前先读 spec）
- [ ] 4.4 单测：鉴权 401 / 反代透传 / visitor 角色注入

## 5. 验证与对账

- [ ] 5.1 本地：mvn verify + BFF pnpm test/build 全绿
- [ ] 5.2 push → CI：ci-test 四 job 绿 + e2e 6 spec（ab/billing/collab/fg×2/ai）23 用例全绿（循环修复直至全绿，禁止 skip/假绿）
- [ ] 5.3 任务图对账：v02 ab 条目 done（注重实现）、analytics 系 todo；e2e-coverage T10/T11 done
- [ ] 5.4 归档本 change + PR（叠加 signup 分支之上，注明合并顺序）

## 6. 收口

- [ ] 6.1 `/opsx:archive` 归档（specs 同步）
- [ ] 6.2 汇总报告（e2e 门禁红→绿全程证据链）

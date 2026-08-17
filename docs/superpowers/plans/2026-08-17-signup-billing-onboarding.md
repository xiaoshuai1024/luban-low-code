---
featureId: signup-billing-onboarding
title: 注册流程：注册（邮箱验证码）→ 购买套餐（0 元订单）→ 开通服务 → 使用站点
createdAt: 2026-08-17
status: approved
taskGraph: docs/superpowers/tasks/signup-billing-onboarding.json
contractSource: plan-template 命令体 + writing-plans SKILL + docs/superpowers/PLAN_WRITING_CONTRACT.md（均全文加载）
scope: 新用户从官网 CTA 自助注册（用户名+邮箱+密码+邮箱验证码）→ 选套餐创建 0 元订单（自动支付成功）→ 开通向导建首站+模板建首页 → 进设计器发布、访客经 website 访问；重建 Java 侧 billing/quota 域（随 backend-go 删除而丢失）并令既有红 spec 回绿
split: 不拆分（单期收口）
branches: 单仓 monorepo，新分支 feature/signup-billing-onboarding（自 master），禁 push 默认分支
---

# 注册流程实现计划：注册 → 购买免费套餐 → 开通服务 → 使用站点

> **已加载 skill/契约**：`writing-plans` SKILL（全文）· `docs/superpowers/PLAN_WRITING_CONTRACT.md`（全文）· `ux-product-review` SKILL（全文）· `.agents/rules/luban-e2e-execution-contract.md`（全文）· `scripts/verify-plan-ssot.mjs`（schema）。另基于 5 路并行只读调研（backend-java / bff / website / engine / docs+任务图）与本人交叉验证。
>
> **关键背景事实（已验证）**：v02-analytics-billing 任务图 26/26 done 为 backend-go 时代账目——`git log --all -S "billing" -- apps/backend-java` 零命中，Java/BFF/engine 代码零 billing 实现；billing 能力随 `apps/backend-go` 删除（2026-08-15，f248042）而丢失。`e2e/flows/billing.spec.ts`、`quota-enforcement.spec.ts` 已存在且当前必红（spec 头自述「尚未跑绿」）。本 plan 在 Java 单端权威前提下重建 billing 契约（继承 v02 设计与 `docs/API.md` L187-194 已约定端点），并作为注册流程的套餐/订单/配额底座。

---

## §0 范围与分支策略

### 0.1 本期范围（单期收口，禁止分期）

1. **注册**：engine `/register` 两步表单（账号信息 → 邮箱验证码 OTP）；后端新增 `POST /auth/register|verify|resend`；免费 SMTP 发码；注册激活即自动登录（BFF 签发 JWT）并默认绑定 Free 套餐。
2. **购买套餐**：billing 域重建（plans/subscriptions/trial_records/usage_counters + orders 表 + `/billing/*` API）；三档全 0 元；下单即 0 元自动支付成功（orders pending→paid 事务 + 订阅生效）；Starter 含 14 天试用与到期降级。
3. **开通服务**：`sites` 归属模型（owner_user_id + owner/admin 权限）；onboarding 向导（选套餐 → 建首站 → 模板建首页 → 进设计器）。
4. **使用站点**：Dashboard/SiteList 空态 CTA；用户菜单套餐+用量；`/settings/billing` 套餐对比+订单记录；发布后访客经 website `/{slug}/{path}` 访问（既有链路）；quota 超限 429 拦截。
5. **入口**：官网（website）default 站点 seed 内容加「免费注册」CTA 外链 manage 域（website 代码零改动）。
6. **治理**：DemoAccountInitializer 收编（条件装配）；v02 任务图勘误注记。

### 0.2 本轮不涉及的子系统（+原因）

| 子系统 | 结论 | 原因 |
|---|---|---|
| backend-go | **不涉及** | 已于 2026-08-15 删除，Java 单端权威（CLAUDE.md 硬约束 3）；§6.2 矩阵按先例声明单端豁免 |
| packages/ui | **不涉及物料/组件变更**；仅同步 1 份 seed 关联单测 | 注册/向导/billing 页均为 engine 工作台管理页（Element Plus，先例 Login.vue），非终端落地页物料；官网 pricing 卡已有 `LubanPricing` 物料。T-web-1 改 hero CTA 后须同步 `packages/ui/packages/luban-low-code/test/unit/homepageSchema.spec.ts` 断言（该单测挂载 seed JSON 防物料脱节，§9.1） |
| packages/client | **不涉及** | electron/flutter 规划态，无注册入口消费方 |

### 0.3 分支与工作区

- 分支：`feature/signup-billing-onboarding`（自 master；**执行前须用户确认切换**）。
- 当前工作区在 `feature/close-review-gaps` 且有未提交改动（nuxt.config.ts、e2e-coverage json、未跟踪 DemoAccountInitializer.java）——实现会话须先切净分支；DemoAccountInitializer.java 由 T-be-8 收编入本 feature 提交，其余改动归属原任务，不得混提。
- taskGraph SSOT：`docs/superpowers/tasks/signup-billing-onboarding.json`，校验 `node scripts/verify-plan-ssot.mjs validate docs/superpowers/tasks/signup-billing-onboarding.json`。

---

## §1 需求溯源与追溯矩阵

### 1.1 上游需求（全部有证据）

| # | 需求 | 证据 |
|---|---|---|
| U1 | 注册、购买套餐、开通服务、使用站点，参考常见低代码平台流程 | 用户命令原文（/plan-template 参数） |
| U2 | 邮箱验证，验证码完成，免费邮件服务 | 用户裁定 1（2026-08-17 对话） |
| U3 | 套餐深度选 A（完整 billing 骨架） | 用户裁定 2 |
| U4 | 支付做一下，0 元直接走支付成功 | 用户裁定 3 |
| U5 | 其余按讨论稿建议（即 active 状态机改邮箱验证激活、IP 限流、ownership、engine 入口+向导、DemoAccountInitializer 收编+任务图勘误） | 用户裁定 4 |
| U6 | billing/quota 契约（/billing/plans·me·subscribe·usage） | `docs/API.md` L187-194（已约定）+ `docs/superpowers/plans/2026-06-17-v02-analytics-billing-skeleton.md` §9.2 |
| U7 | 既有 billing/quota E2E 需回绿 | `e2e/flows/billing.spec.ts`、`e2e/flows/quota-enforcement.spec.ts` 存在且必红（spec 头自述） |
| U8 | 多租户隔离 E2E 至少 1 条 | PLAN_WRITING_CONTRACT §7.1 MUST |

### 1.2 追溯矩阵

| 上游 | task id | E2E 场景（§7.3） | 门禁 |
|---|---|---|---|
| U1 注册 | T-be-2, T-bff-1, T-eng-2 | S1 | G1–G4 |
| U1+U5 官网入口 | T-web-1 | S0（手测+冒烟） | G4 |
| U2 邮箱验证码 | T-be-2, T-bff-1, T-eng-2 | S1, S1e（错误路径） | G1–G4 |
| U1+U3+U4 购买套餐/0 元订单 | T-be-3, T-be-4, T-bff-2, T-eng-3, T-eng-4 | S2, S2e | G1–G4 |
| U3 试用降级 | T-be-7 | S2t（IT 级） | G3 |
| U1 开通服务（首站+模板） | T-be-6, T-eng-3 | S3 | G1–G4 |
| U1 使用站点 | T-eng-4（+既有发布链路） | S4 | G4 |
| U6+U7 billing 契约回绿 | T-be-3, T-be-5, T-bff-2, T-e2e-1 | S6 | G3/G4 |
| U5+U8 多租户隔离 | T-be-6, T-e2e-1 | S5 | G3/G4 |
| U5 quota 拦截 | T-be-5, T-e2e-1 | S6 | G3/G4 |
| U5 DemoAccountInitializer 收编 | T-be-8 | —（契约测试） | G1/G3 |
| U5 任务图勘误 | T-doc-1 | — | G1 |

### 1.3 无遗漏声明

U1–U8 全部映射到 task；每 task 至少关联 1 条上游需求（T-be-1/T-bff/T-eng-1 为 U1–U4 的承载性基建，经下游 task 关联）。无静默跳过。

---

## §2 系统与链路

### 2.1 涉及子系统与增量

| 子系统 | 增量（一行级） |
|---|---|
| backend-java | Flyway 迁移（users.email/email_verified_at、email_verifications、plans/subscriptions/trial_records/usage_counters/orders、sites.owner_user_id + 三档 seed）+ H2 镜像；注册域（Controller/Service + MailService SMTP/dev-echo + 验证码生命周期）；billing 域（4 实体 + BillingController plans/me/subscribe/usage）；orders（0 元自动支付成功事务）；QuotaService 拦截（leads/pages）；SiteOwnershipGuard 权限模型；trial 到期降级 @Scheduled；AuthFilter 白名单；DemoAccountInitializer 条件装配收编 |
| bff | `/api/auth/register|verify|resend` 三路由（IP 限流加 `scope` 隔离 + verify 后 `signToken` 组装 `{token,user}`（剥离 user.id）+ 共享 `rateLimited()` 并修正既有 login/api-key 429 错误体 `error`→`code` 字段名偏差）；`/api/billing/plans|me|subscribe|usage` + `orders`（GET 列表 + POST 下单同文件）代理（429 透传）；`/api/sites/slug-check`；**补齐既有 `sites/[siteId]/pages/route.ts` POST 的 try/catch+toBackendResponse**（否则 Java 429 QUOTA_EXCEEDED 变 500 打红 S6-2，零业务改动） |
| engine | `/register` 两步页；`/onboarding` 三步向导；Dashboard/SiteList 空态 CTA；用户菜单套餐+用量；`/settings/billing` 页；api 层（auth 扩展 + billing.ts）；FeatureGate `signup`/`onboarding` |
| website | **代码零改动**；改 `deploy/seed/default-homepage.json`（LubanHero props `ctaText:"开始使用"→"免费注册"`、`ctaUrl→https://manage.xiaoshuai1024.top/register`，navbar/底部 CTA 可选同步）+ 同步 packages/ui `homepageSchema.spec.ts` 断言 + 重跑幂等脚本 `deploy/seed/seed-default-site.sh` 更新生产官网 |
| ui / client / backend-go | 不涉及（§0.2） |
| docs/任务图 | 本 plan + taskGraph JSON + journey `J-signup-onboarding`(P0)；T-doc-1 勘误 v02 任务图 |

### 2.2 端到端链路（宏图）

```
访客 ──官网 luban 域 /{default}/ （seed CTA「免费注册」）
  └→ manage 域 /register（engine）
       ① POST /api/auth/register {username,email,password}
          BFF(IP 限流 15min/10) → Java /auth/register（AuthFilter 白名单）
          → 校验(username 唯一/email 唯一/密码强度) → users INSERT status=pending_verification
          → email_verifications INSERT(code_hash=SHA256(6位), TTL 10min)
          → MailService 发码(SMTP env; 缺配置且非 dev-echo → 503 EMAIL_SERVICE_UNAVAILABLE)
          ← 201 {username, emailMasked}(dev-echo 时附 devCode, 仅 dev/e2e env)
       ② POST /api/auth/register/verify {email, code}
          → attempts<5 且未过期且 hash 匹配 → 事务:
            user→active + email_verified_at + 默认订阅 Free(active) + 消费验证码
          → BFF signToken(JWT) ← 200 {token, user{username,name,role}}
          → engine setToken → 跳 /onboarding
       ③ /onboarding Step1 选套餐(三档 ¥0) 「立即开通」
          POST /api/billing/orders {planCode}
          → 事务: orders INSERT(pending, amount=0) → 0元 → status=paid + paid_at
                  + SubscriptionService.applyPlan(starter 首次→trialing+14d / 其他→active)
          ← 200 {order{orderNo,status:'paid',amount:0}, subscription}
          → UI「支付成功 · 已开通」
       ④ Step2 建首站: GET /api/sites/slug-check?slug= (防抖查重)
          POST /api/sites {name,slug} → Java owner=当前用户（T-be-6 权限模型）
       ⑤ Step3 选模板(复用 templates.ts 12 套+空白)
          POST /api/sites/:sid/pages {name:'首页', path:'/', schema:template}
       ⑥ 完成向导 → /designer/sites/:sid/pages/:pageId（既有设计器）
  使用: 编辑/保存/发布(既有) → PageList 预览 URL(既有 buildPublishedPagePreviewUrl)
       访客经 website /{slug}/{path} → BFF /api/public/sites/:slug/pages → pages.status='published'(既有)
  用量: lead 提交/建页 → QuotaService 原子累加 usage_counters → 超限 429 QUOTA_EXCEEDED
```

### 2.3 列表/主界面分步链

见 §4.2（逐页分步，含操作 → 反馈 → API/状态）。

---

## §3 业务逻辑

### 3.1 领域实体

| 实体 | 表 | 状态字段 | 负责端 |
|---|---|---|---|
| User | users（增 email/email_verified_at） | status: `active`/`pending_verification`/`disabled`（服务层白名单校验） | Java |
| EmailVerification | email_verifications（新） | consumed_at 非 null 即已消费 | Java |
| Plan | plans（新，seed 三档） | status: `visible`/`hidden` | Java |
| Subscription | subscriptions（新） | status: `active`/`trialing`/`expired` | Java |
| TrialRecord | trial_records（新） | converted_to（降级去向） | Java |
| UsageCounter | usage_counters（新） | count（月度，按 metric） | Java |
| Order | orders（新） | status: `pending`/`paid`/`cancelled` | Java |
| Site | sites（增 owner_user_id） | status 既有；owner_user_id NULL=平台站点 | Java |

### 3.2 状态机

**User.status**：`(无) --register--> pending_verification --verify(码对/未过期/尝试<5)--> active`；`active --admin--> disabled`（既有）。非法：pending 直接 login → 401 `USER_PENDING_VERIFICATION`（新错误码，文案「邮箱未验证」）。

**Order.status**：`(无) --create--> pending --amount==0 自动支付--> paid`（同事务）；`pending --取消--> cancelled`（本期无入口，仅状态预留）。非法：对 paid 订单重复支付 → 409 `ORDER_ALREADY_PAID`（幂等返回原订单亦可，取幂等返回）。

**Subscription.status**（继承 v02）：`(无) --verify 激活--> active(Free)`；`active/trialing --order subscribe--> active(新档) 或 trialing(Starter 首次, trial_ends=+14d)`；`trialing --到期(@Scheduled)--> active(Free)（数据保留）`。每条边有测试（单测穷举）。

**验证码生命周期**：`创建(TTL 10min, attempts=0) --verify 失败--> attempts+1（≥5 作废) --verify 成功--> consumed_at=now`；重发：同 email 60s 冷却 + 每日 ≤10 次（旧码作废）。

### 3.3 事务边界

- **verify 激活**：user 置 active + email_verified_at + 默认订阅 Free + 消费验证码 —— 单事务，失败全回滚。
- **0 元订单**：orders INSERT(pending) → 置 paid + paid_at + 订阅生效 —— 单事务；`amount>0` → 抛 `PAYMENT_NOT_SUPPORTED`（400，未来接网关的挂载点，本期不可达因三档全 0）。
- **用量累加**：`INSERT ... ON DUPLICATE KEY UPDATE count=count+1`（MySQL 原子）；先查限后累加（拦截在累加前，宁少计不超放——记录告警日志）。
- **trial 降级**：@Scheduled 每小时扫 `trial_ends_at < now 且 status=trialing` → 置 active(Free) + trial_records.converted_to=free，单条独立事务（部分失败不阻断批）。

### 3.4 关键业务规则

- username：3–32 位 `[a-z0-9_-]`，唯一（409 `USERNAME_TAKEN`）；email：格式校验 + 唯一（409 `EMAIL_TAKEN`）；密码：≥8 位且含字母+数字（400 `WEAK_PASSWORD`）。
- slug：`[a-z0-9-]` 3–48 位，全局唯一（409 `SLUG_TAKEN`，向导防抖预检）。
- 站点权限矩阵：POST /sites 任意登录用户（owner=self，受 quota_pages 限制）；GET /sites 非 admin 仅 owner=self，admin 全量；site 及子资源（pages/leads/forms/collections）写操作 = owner 或 admin，owner=NULL（存量平台站点）仅 admin。
- 配额：free=leads 100/pages 3，starter=leads 1000/pages 10（trial 同），growth=leads 10000/pages 50；quota=0 表示不限（quota_visits 本期全 0，见 §10 延后）。
- 登录限流既有（15min/10 次）；注册/验证/重发复用同模式按 IP + 按 email 维度冷却/日限。

### 3.5 双后端契约一致性声明（单端豁免）

backend-go 已删除（CLAUDE.md 硬约束 3，Java 单端权威）。本 plan 全部新增接口仅 Java 实现，Go 列「已删除·单端豁免」（先例：v02 §3.4、e2e-coverage 任务图）。契约由 `contract/` 包 MockMvc 契约测试守护（见 §8.1）。

---

## §4 页面结构（含 UI，MUST）

### §4.0 入口表

| 路由 | 视图/组件 | 端 | 状态 |
|---|---|---|---|
| `/register` | views/auth/Register.vue | engine | 新增（public，meta.public=true） |
| `/login` | views/Login.vue | engine | 修改（加「免费注册」互链） |
| `/onboarding` | views/onboarding/OnboardingWizard.vue | engine | 新增（登录守卫，三步） |
| `/dashboard` | views/Dashboard.vue | engine | 修改（空态 CTA + 套餐卡） |
| `/sites` | views/site/SiteList.vue | engine | 修改（空态 CTA） |
| `/settings/billing` | views/settings/Billing.vue | engine | 新增（套餐对比+订单记录） |
| 用户菜单（DefaultLayout） | components/UserPlanPanel.vue（新） | engine | 修改（套餐标识+用量） |
| `/{default}/`（官网首页） | seed 营销页 hero（PageSchema 内容） | website | 修改 seed（「免费注册」CTA 外链 manage 域） |
| `/{slug}/{path}` | views/DynamicPage.vue | website | 既有（发布页访客访问，无改动） |

### §4.1 信息架构与交互模式

- 注册/向导为**分步表单**（steps 模式，非弹窗）；OTP 为 6 格独立输入框（自动进格/退格/粘贴分流）。
- 工作台侧新增信息全部挂在既有 DefaultLayout（菜单/用户菜单），不新建一级导航（billing 挂 /settings 下）。
- 图标一律 Element Plus 图标/SVG，**禁止 emoji/Unicode 符号**（ux-product-review 红线）。

### §4.2 列表级与主界面交互链（分步）

#### 4.2.1 注册页 `/register`（Step1 → Step2）

1. 访客打开 `/register`（FeatureGate `signup` 关闭 → 整页替换为「注册暂未开放」提示 + 返回登录链接）。
2. Step1 表单：用户名/邮箱/密码/确认密码（字段校验见 §4.3-注册页）；逐字段失焦校验 + 提交时整单校验；**提交中**按钮 loading 禁止重复提交。
3. 提交 `POST /api/auth/register` → **201** → 记录 emailMasked 进入 Step2；**409 USERNAME_TAKEN/EMAIL_TAKEN** → 对应字段下方红色内联错误；**429** → 顶部 ElAlert「操作过于频繁，请稍后再试」；**503 EMAIL_SERVICE_UNAVAILABLE** → 顶部 ElAlert「邮件服务暂不可用，请稍后再试」。
4. Step2：显示「验证码已发送至 a***@domain.com」；6 格 OTP 输入；「重新发送(60s)」倒计时按钮 → 点击 `POST /api/auth/register/verify/resend`（BFF `/api/auth/register/resend`）→ 429 冷却提示或重新计时。
5. 提交 `POST /api/auth/register/verify` → **200** → setToken + ElMessage「注册成功」→ `router.replace('/onboarding')`；**400 VERIFY_CODE_INVALID** → OTP 框红框+「验证码错误，还可尝试 N 次」；**VERIFY_CODE_EXPIRED** → 提示重新发送；**VERIFY_ATTEMPTS_EXCEEDED** → 提示返回 Step1 重发。
6. 底部固定「已有账号？去登录」→ `/login`。

#### 4.2.2 开通向导 `/onboarding`（Step1 → Step3）

1. 进入即 `GET /api/billing/plans`（**加载中**三卡骨架屏；**错**重试按钮；空 → 异常兜底「获取套餐失败」）。
2. Step1 三张套餐卡（Free 默认选中；Starter 卡角标「14 天试用」；Growth）＋每卡配额摘要（站点内页面数/月留资数）；点卡切换选中态。
3. 「立即开通（¥0）」→ `POST /api/billing/orders {planCode}`（按钮 loading）→ **200** → 全屏成功反馈「支付成功 · 套餐已开通」（ElResult success + 自动 1.5s 进 Step2）；**400 INVALID_PLAN** → 刷新套餐列表；**401** → 跳登录。
4. Step2 站点表单：站点名（必填 1–32）/ 站点地址 slug（自动从站点名拼音或随机生成建议值，可改；输入防抖 500ms 调 `GET /api/sites/slug-check` → 绿色「可用」/红色「已被占用」）；提交 `POST /api/sites` → **201** 记 siteId；**409 SLUG_TAKEN** → slug 字段内联错误；**429 QUOTA_EXCEEDED(pages)** → ElAlert「套餐页面数已达上限，请升级套餐」。
5. Step3 模板网格（复用 TemplatePicker 的卡片样式与 templates.ts 分组）：空白/落地页/博客/电商…12 套；点选高亮 →「开始编辑」→ `POST /api/sites/:sid/pages`（name=「首页」, path='/', schema=模板）→ **201** → `router.replace('/designer/sites/:sid/pages/:pageId')`；**失败** → ElMessage 错误 + 停留本步可重试。
6. 顶部 ElSteps（1 选套餐 → 2 创建站点 → 3 选择模板）；已完成步可点回退（回退不撤销已开通订单，仅重做后续步）。

#### 4.2.3 Dashboard 与站点列表（空态改造）

1. 新登录用户进 `/dashboard`：无站点 → 主区 ElEmpty「还没有站点，开通你的第一个站点」+主按钮「免费开通」（→ `/onboarding`）；**有**站点 → 既有统计卡（数据改为仅统计 owner=self 的站点）。
2. `/sites` 空表 → 自定义 empty 插槽同上 CTA；列表数据源改为 owner 过滤后的接口返回（后端过滤，前端不改过滤逻辑）。
3. 用户菜单（右上角下拉）：新增分组「当前套餐：Free/试用中(dict-tag)」+ 两条 ElProgress（页面数、本月留资）+「套餐与订单」→ `/settings/billing`；用量加载失败 → 该分组显示「—」不阻断菜单。

#### 4.2.4 `/settings/billing`（套餐对比 + 订单记录）

1. 顶部当前订阅卡：plan 名称 + status（dict-tag：生效中/试用中/已过期）+ 试用到期日（若有）。
2. 三档对比表：行=能力（价格/页面数/月留资/试用），列=三档；当前档高亮；操作列按钮文案「切换」（= 0 元下单，同 4.2.2-3 链路，成功 toast「已切换至 X」并刷新本页）。
3. 订单记录 ElTable：列=订单号/套餐/金额(¥0.00)/状态(dict-tag 已支付/待支付)/创建时间；**空态**「暂无订单」；分页 10/页。
4. **加载中**表格 v-loading；**错**整页 ElResult error + 重试。

### §4.3 逐页页面结构展示

#### 注册页 `/register`

```
┌──────────────────── 居中卡片(宽 420px, 深/浅色随工作台主题) ─────────────────────┐
│  [Logo]  创建账号                                                    │
│  Step1:                                                              │
│    用户名      [ElInput            ]  下方提示: 3-32位小写字母/数字/_/-  │
│    邮箱        [ElInput            ]  失焦校验格式+唯一(409 时红字内联)   │
│    密码        [ElInput show-password] 提示: ≥8位且含字母和数字          │
│    确认密码    [ElInput show-password] 与密码不一致 → 红字「两次不一致」  │
│    [ 注 册 ](ElButton primary, block, 提交中 loading)                 │
│  Step2(注册成功后切换, 顶部 ElSteps 2 指示):                          │
│    「验证码已发送至 a***@domain.com」                                  │
│    [·][·][·][·][·][·]  6 格 OTP(自动进格/退格/粘贴填充)                │
│    验证码错误 → OTP 区红框 + 「验证码错误，还可尝试 N 次」              │
│    [ 重 新 发 送 (60s) ](倒计时中 disabled)                           │
│    [ 验证并登录 ](primary, block)                                     │
│  ─────────────────────────────                                       │
│  已有账号？去登录（link → /login）                                     │
│  FeatureGate signup=off → 整卡替换:「注册暂未开放，请联系管理员」+ 去登录 │
└──────────────────────────────────────────────────────────────────────┘
四态: 加载=提交按钮 loading; 空=初见表单; 错=字段内联/顶部 ElAlert; 成功=Step2 切换+最终跳转
```

#### 开通向导 `/onboarding`

```
┌─ 顶栏: ElSteps [1 选套餐]—[2 创建站点]—[3 选择模板] ──────────────────┐
├─ Step1: 三张 ElCard 横排(窄屏纵排)                                     │
│   ┌ Free(默认选中,主色描边) ┐ ┌ Starter 角标「14天试用」┐ ┌ Growth ┐   │
│   │ ¥0/月                  │ │ ¥0/月                  │ │ ¥0/月  │   │
│   │ 3 个页面 · 100 留资/月  │ │ 10 个页面 · 1000 留资/月│ │ …     │   │
│   │ [选择]                 │ │ [选择]                 │ │ [选择] │   │
│   └────────────────────────┘ └────────────────────────┘ └────────┘   │
│   底部右: [ 立即开通（¥0） ] 主按钮                                    │
│   成功反馈: ElResult success「支付成功 · 套餐已开通」→ 自动进 Step2     │
├─ Step2: 站点名 [ElInput] / 站点地址 [ElInput prefix=…/] + 校验反馈      │
│   slug 可用 ✓(绿) / 已被占用 ✗(红, 内联) / 校验中(转圈)                │
│   底部右: [上一步] [ 创建站点 ]                                        │
├─ Step3: 模板网格(2-3列卡片: 缩略图+名称+分组), 选中主色描边              │
│   底部右: [上一步] [ 开始编辑 ]                                        │
└─ 完成跳转 /designer/sites/:sid/pages/:pageId                           │
四态: 加载=卡片/网格骨架屏; 空(模板加载失败)=ElResult error+重试; 错=内联/ElAlert; 成功=自动进下一步
```

#### `/settings/billing`

```
┌─ 当前订阅卡: [Free · dict-tag 生效中] 试用到期: —/2026-XX-XX ─────────┐
├─ 套餐对比表:           │ Free │ Starter │ Growth │                    │
│   价格                 │ ¥0   │ ¥0      │ ¥0    │                    │
│   站点内页面数          │  3   │  10     │  50   │                    │
│   月留资数             │ 100  │  1000   │ 10000 │                    │
│   试用                 │  —   │ 14 天   │  —    │                    │
│   操作                 │ 当前 │ [切换]  │ [切换] │  ← 当前档高亮列      │
├─ 订单记录 ElTable: [订单号|套餐|金额|状态|创建时间] v-loading, 空「暂无订单」│
└─ 分页 ElPagination(10/页)                                             │
```

#### Dashboard 空态 / 用户菜单用量面板

```
Dashboard(无站点时主区):  ElEmpty「还没有站点」 + [ 免费开通 ](→/onboarding)
用户菜单(下拉新增分组):   当前套餐 [Free/Starter 试用中 dict-tag]
                         页面数 [███░░░░] 2/3   (ElProgress, 超限警示色)
                         本月留资 [██░░░░░] 40/100
                         [ 套餐与订单 → ](→ /settings/billing)
```

### §4.4 UX 自检（对齐 ux-product-review rubric）

- 四态（加载/空/错/成功）逐页落位（见 §4.3 各页标注）。
- 管理端枚举中文映射：Subscription.status/Order.status 用 dict-tag 中文（生效中/试用中/已过期；已支付/待支付），禁止裸英文枚举（UI-TY-005）。
- 空态独立 block 布局（UI-LA-006）；按钮均有 :active/hover 反馈（UI-AN-007）；弹层确认用 ElMessageBox/ElResult，禁 alert/confirm。
- 图标禁 emoji/Unicode 符号；色彩/字号/间距对照 luban-ui token（实现期跑 `node scripts/check-design-tokens.mjs`）。
- 表单校验错误均「可理解可行动」（指明哪个字段、怎么改）。
- 本特性不触碰物料/画布/属性面板/预览渲染——低代码引擎六维不适用（无 schema/物料增量），已在 §6 多端声明。

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| JWT 签发 `signToken`/`parseTokenFromRequest` | bff `src/lib/authToken.ts`（既有） | T-bff-1（verify 后签发） | payload `{sub,username,role}`，HS256 7d，Bearer 头 |
| IP 限流 `rateLimit.ts` | bff（既有） | T-bff-1（register/verify/resend） | 滑窗 15min/10 次，429 `RATE_LIMITED` |
| 内部头剥离+密钥注入 | bff `middleware.ts`/`backendClient.ts`（既有） | 全部新 bff 路由自动继承 | `X-User-*` 剥离、`X-Internal-Auth` 注入 |
| 错误体 `{code,message,details?}` | bff `apiHandler.ts`（既有） | 全部新路由 | SCREAMING_SNAKE；本 plan 统一用 `code` 字段（修正既有 login 429 的 `error` 字段名偏差，随 T-bff-1 对齐） |
| BCrypt PasswordEncoder | Java `PasswordEncoderConfig`（既有） | T-be-2 | 注册密码同 login 哈希策略 |
| AuthFilter 白名单机制 | Java `auth/AuthFilter.java`（既有） | T-be-2（加 3 条注册路径免鉴权） | 常量时间比较 X-Internal-Auth 不变 |
| BusinessException 错误码体系 | Java（既有） | 全部新 Controller | `INVALID_ARGUMENT`/`USERNAME_TAKEN`/…/`QUOTA_EXCEEDED` |
| Redis 固定窗口（AntiSpamService 模式） | Java（既有模式） | T-be-2（重发冷却/日限可选 Redis 或 DB 计数） | key 风格 `signup:code:{email}` |
| 模板库 templates.ts + TemplatePicker | engine（既有） | T-eng-3 Step3 | 12 套 PageTemplate + 分组查询 `listTemplates()` |
| FeatureGate env 体系 | engine `config/features.ts`（既有） | T-eng-2/3（新增 2 key） | `VITE_FEATURE_*`，默认 true；同步 vite-env.d.ts |
| 发布/预览 URL | engine `utils/publicPage.ts`（既有） | 不改 | `buildPublishedPagePreviewUrl` |
| 公开发布页渲染链 | website/BFF/Java `/public/*`（既有） | 不改 | `/{slug}/{path}` → published |
| v02 billing 契约与 DDL | `docs/superpowers/plans/2026-06-17-…md` §9.2/§9.3 + `docs/API.md` L187-194 | T-be-3/T-be-4 直接继承 | 字段名以 §9.2 API 契约为准（planCode/priceMonthly/quota* 等 camelCase JSON） |

---

## §6 架构边界 + 门禁自检

### 6.1 分层边界

- **engine**：注册/向导/billing 全部为工作台管理页（Element Plus，先例 Login.vue）；不触碰渲染器/物料/schema。BFF 地址沿用 `VITE_API_BASE_URL=/api` 同源反代。
- **bff**：仅聚合/透传/限流/签发 JWT；不落业务规则（0 元判定、配额在 Java）。
- **backend-java**：全部业务规则（验证码生命周期、订单状态机、订阅状态机、配额、ownership）；邮件发送为唯一外部 IO（SMTP env）。
- **website**：纯访客渲染端定位不变（零鉴权代码）；注册入口以内容（seed CTA）形式提供。
- 演进：未来接真实支付只替换 OrderService 的 0 元直通分支；未来 email 登录/找回密码复用 email 列与 MailService。

### 6.2 双后端 parity 矩阵（单端豁免声明）

| 接口 | Java | Go | 本期目标 |
|---|---|---|---|
| POST /auth/register·verify·resend | 新增 | 已删除 | Java 实现；单端豁免（CLAUDE.md 硬约束 3） |
| GET /billing/plans·me·usage | 新增 | 已删除 | 同上 |
| POST /billing/subscribe·orders | 新增 | 已删除 | 同上 |
| GET /sites/slug-check | 新增 | 已删除 | 同上 |
| 429 QUOTA_EXCEEDED 拦截 | 新增 | 已删除 | 同上 |

### 6.3 覆盖率门禁

engine / bff / website 85% · UI 90%（不涉及）· Java 80%（行）。`make test-coverage` 汇总。

> **门禁陷阱（§9 实测发现）**：engine `vitest.config.ts` 的 `coverage.include` 是上一 plan 的固定文件白名单——本 plan 新增 api/视图文件**不追加即不进覆盖率统计**，85% 门禁对新代码失效；T-eng 各任务须同步追加 `coverage.include`。

### 6.4 物料 schema 标准

不适用（无新增/修改物料，§0.2）。

### 6.5 FeatureGate 策略（MUST）

| 功能 | key（env） | 作用域 | 关闭行为 |
|---|---|---|---|
| 自助注册入口 | `signup`（VITE_FEATURE_SIGNUP，默认 true） | engine `/register` 路由 + Login 互链 + 官网 CTA 不受控（内容层） | `/register` 整页替换「注册暂未开放，请联系管理员」，提交禁用 |
| 开通向导 | `onboarding`（VITE_FEATURE_ONBOARDING，默认 true） | engine verify 成功后的跳转 | 注册成功直接进 `/dashboard`（空态 CTA 手动建站兜底） |

- 后端/BFF 不加开关的**理由**：免鉴权端点已具备 IP 限流 + 验证码 TTL/尝试上限/冷却三重防护；后端无 feature_gates 表，env 型开关属 engine 层；紧急止损可由 nginx 封 `/api/auth/register*`。
- 回滚首选 = 关 FeatureGate（§回滚表）。

---

## §7 E2E 测试计划

### 7.0 用户旅程声明（与 taskGraph journeys 同步）

| 旅程 id | 标题 | 优先级 | 场景 | 入口端 |
|---|---|---|---|---|
| `J-signup-onboarding` | 注册→0元开通→建站→使用 | **P0** | S1 注册-验证码激活自动登录 · S2 选套餐-0元订单支付成功 · S3 建首站+模板建首页进设计器 · S4 发布后访客经 website 访问 · S5 多租户隔离 | engine |
| `J-billing` | ref（首次定义于 journey-registry/v02 时代，此处引用） | — | — | — |
| `J-quota-enforcement` | ref | — | — | — |

门禁：`node scripts/verify-plan-ssot.mjs journey-coverage` 收口前跑通（P0=100%，`J-signup-onboarding` 由新 spec 绑定 `@J-signup-onboarding`）。

### 7.1 跨端主路径（正式路由，无 e2e 专页）

主链路 = 官网 CTA → `/register` → `/onboarding` → `/designer/...` → 发布 → website `/{slug}/{path}` 访客可见。全部为正式产品路由；**无新增 `pages/e2e/*`**（website 路由规则本就禁文件路由）。

### 7.2 脚本保障逻辑

- 环境预检：e2e 全栈（MySQL+Java+BFF+engine/website）起齐才跑；缺服务明确报错，不静默 skip。
- 禁假绿：无 `*.skip`/空断言/关 bail；首个失败即停=专注修当前红用例，修绿继续至全量（非提前收工）。
- 验证码在 e2e 的获取通道：`MAIL_DEV_ECHO=true`（仅 e2e/dev env，生产 compose 必须不设）时 register/重发响应附 `devCode`；spec 用其填 OTP。**该开关由 env 显式开启并写入 e2e compose，生产配置审计列 G2 检查项。**
- 测试代码冻结契约：既有 `billing.spec.ts`/`quota-enforcement.spec.ts` 的增强（补完整 429 场景）属于**实现前**的计划内变更（两 spec 头部自述待补），已在 §7.3 声明并经用户裁定 U3/U4 授权；验收执行开始后不再改测试逻辑。
- **计划内契约对齐变更清单（实现前一次性完成，验收期冻结）**：① `billing.spec.ts`/`quota-enforcement.spec.ts` 补全（上文）；② backend `SlugConflictContractTest` 断言 `SLUG_CONFLICT`→`SLUG_TAKEN`（新路径统一 `*_TAKEN`，admin 建用户路径 `USERNAME_CONFLICT` 不动）；③ bff `auth/login/route.spec.ts` 与 `auth/api-key/login/route.spec.ts` 断言 `body.error`→`body.code`（429 错误体字段名对齐，随 T-bff-1 同 commit）。

### 7.3 E2E 用例枚举（每场景一张表）

**S0 官网入口（P1，手测+冒烟）**：官网首页 hero 含「免费注册」按钮且 href 指向 manage 域 `/register`。清理：无（seed 内容）。

**S1 注册全链（P0，flows/signup-onboarding.spec.ts，绑 @J-signup-onboarding）**

| # | 操作 | 断言 |
|---|---|---|
| 前置 | e2e 栈起齐；`MAIL_DEV_ECHO=true` | healthz OK |
| 1 | POST /api/auth/register（重复用户名） | 409 `USERNAME_TAKEN` |
| 2 | POST /api/auth/register（弱密码/坏邮箱） | 400 `INVALID_ARGUMENT`/`WEAK_PASSWORD` |
| 3 | POST /api/auth/register（合法） | 201 + `emailMasked` 形如 `a***@d.com` + devCode 6 位 |
| 4 | 未验证直接 login | 401 `USER_PENDING_VERIFICATION` |
| 5 | verify 错码 1 次 | 400 `VERIFY_CODE_INVALID`（含剩余次数） |
| 6 | verify 正确码 | 200 + token + user；GET /api/auth/me 带 token 200 |
| 清理 | admin 删测试用户（或 SQL） | 幂等可重跑 |

**S2 0 元订单（P0，同 spec，绑 @J-signup-onboarding @J-billing）**

| # | 操作 | 断言 |
|---|---|---|
| 1 | GET /api/billing/plans | 200 三档 free/starter/growth，priceMonthly=0，含 quotaLeads/quotaPages/quotaVisits（**同时令既有 billing.spec.ts B1 回绿**） |
| 2 | GET /api/billing/me | 200 planCode=free status=active（激活默认 Free） |
| 3 | POST /api/billing/orders {planCode:'starter'} | 200 order.status=paid + amount=0 + paidAt 非空；subscription.status=trialing + trialEndsAt≈+14d |
| 4 | GET /api/billing/usage | 200 {period,leads,pages,visits}（**billing.spec.ts B2 回绿**） |
| 5 | GET /api/billing/me | planCode=starter |
| 清理 | 删用户级联 | — |

**S3 开通服务（P0，同 spec + engine UI spec）**

| # | 操作 | 断言 |
|---|---|---|
| 1 | GET /api/sites/slug-check?slug=<随机> | 200 available=true；再 POST 建同 slug 站后重查 → 409 `SLUG_TAKEN` |
| 2 | POST /api/sites {name,slug}（Bearer 新用户） | 201；GET /api/sites 只含本站（owner 过滤） |
| 3 | POST /api/sites/:sid/pages（首页 / + blank 模板 schema） | 201 |
| 4 | PUT …/pages/:pid {status:'published'}（既有发布契约） | 200；GET /api/public/sites/:slug/pages?path=/ 返回 schema（**S4 前置**） |
| 清理 | DELETE /api/sites/:sid | 204（owner 可删） |

**S4 访客访问（P0，website e2e 既有 ssr 链路 + flows）**：website `/{slug}/` SSR 返回 200 且 HTML 含页面内容（复用既有 website e2e 模式断言 published 渲染）。清理同 S3。

**S5 多租户隔离（P0，flows，绑 @J-signup-onboarding）**：用户 B（第二个注册用户）GET /api/sites **不含** A 站；B 直接 `PUT /api/sites/{A站id}` → 403 `PERMISSION_DENIED`；B 在 A 站下 `POST /api/sites/{A站id}/pages` → 403。清理：A/B 用户删除。

**S6 quota 超限（P0，flows/quota-enforcement.spec.ts 扩展，绑 @J-quota-enforcement）**

| # | 操作 | 断言 |
|---|---|---|
| 前置 | e2e seed fixture：`e2e-tiny` plan（quota_leads=1, quota_pages=1, hidden）由 **env 门控 `E2EBillingPlanBootstrap`**（ApplicationRunner，先例 `E2EAccountBootstrap`）在 Flyway 建表后幂等插入；开关与 `MAIL_DEV_ECHO=true` 同置于 `docker-compose.e2e.yml` backend-java environment。**原因（§9 实测）**：e2e mysql 服务无 init SQL 挂载且数据卷跨 `e2e-down` 持久保留，init SQL 字面方案不可行 | 直接 subscribe/order 该 plan（visible 过滤不影响订阅校验） |
| 1 | 新用户 subscribe/order e2e-tiny | 200 |
| 2 | 建站后 POST 第 2 个页面 | 429 `QUOTA_EXCEEDED`（details.metric=pages） |
| 3 | 建站+发布页+表单，提交第 2 条 lead | 第 2 条 429 `QUOTA_EXCEEDED`（details.metric=leads, 含 limit/used） |
| 清理 | 删站点/用户 | — |

**S1e/S2e 错误路径**：并入上表（409/400/429/503 分支已列）。

**engine UI E2E（P0，apps/engine/e2e/signup-wizard.spec.ts，绑 @J-signup-onboarding）**：UI 走 `/register` 填表 → API 旁路取 devCode 填 OTP → 断言跳 `/onboarding` → 三步向导点选（套餐卡→建站表单→模板卡）→ 断言落在 `/designer/sites/:sid/pages/:pid` 且画布加载零新增 console error（引擎交付门槛）。

### 7.4 路由合规性确认

`/register` · `/login` · `/onboarding` · `/dashboard` · `/sites` · `/settings/billing` · `/designer/sites/:sid/pages/:pid` · website `/{slug}/{path}` —— 全部正式产品路由；未新增任何 `pages/e2e/*` 或专测页。

---

## §8 TDD 与执行约定

### 8.1 TDD 先行（关键行为 → 测试类型）

| 关键行为 | 先行测试 | P0/门禁 |
|---|---|---|
| 注册三接口契约（409/400/201/401 pending） | `contract/AuthRegisterContractTest`（MockMvc+H2，先红） | P0·G3 |
| 验证码生命周期（TTL/尝试/冷却/消费） | `service/EmailVerificationServiceTest` 单测穷举 | P0·G3 |
| verify 事务（active+Free 订阅+消费码原子） | `contract/RegisterVerifyContractTest` | P0·G3 |
| Order 0 元直通 + 订阅状态机 | `service/OrderServiceTest` + `contract/BillingContractTest` | P0·G3 |
| quota 原子累加与 429 | `service/QuotaServiceTest` + `contract/QuotaEnforcementIT`（Failsafe） | P0·G3 |
| ownership 权限矩阵（owner/admin/他用户） | `contract/SiteOwnershipContractTest` | P0·G3 |
| trial 到期降级 | `service/TrialDowngradeTest`（时钟可注入） | P1·G3 |
| bff 透传/限流/错误体 | bff vitest（mock callBackend） | P0·G3 |
| engine 表单/向导交互 | engine vitest（组件级）+ E2E | P0·G3/G4 |
| 全链 S1–S6 | flows + engine e2e（先红后绿） | P0·G4 |

执行纪律：先测后码、红→绿→重构；对齐 `docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md`。

### 8.2 首个失败即停（语义）

修当前红用例时专注该条；修绿后继续直至**全量**门禁（G1→G4）通过，禁止提前收工。

### 8.3 并行 subagent

- 方案阶段：已用 5 路并行只读调研（会话内完成）。
- §9 生成：backend-java / bff / engine / web 四路并行（ui/client/backend-go 无任务显式跳过）。
- 实现阶段并行线（见 §9.6 派发计划）：W1 backend 域内并行 → W2 bff+engine api → W3 engine UI + website seed → W4 E2E 收口；主会话汇总收口（配合 `/jx`）。

### 8.4 单期收口

本期范围（§0.1）单次实现周期内全部完成；禁止主路径收口即宣称完成；禁止分期。完成汇报=代码配置齐 + 各验证门通过（保留命令与关键输出证据）后一次汇总。

### 8.5 Post-Development Workflow（MUST，顺序禁止跳步）

```
代码提交（feature/signup-billing-onboarding）
  ↓ /luban-review 全自动审查（🔴🟡🔵 全部清零，含建议级别）………G1
  ↓ 安全审查（敏感字段清单+鉴权覆盖+OWASP 自查+生产 env 审计 MAIL_DEV_ECHO/SMTP/JWT secret）…G2
  ↓ 编译：mvn -q compile · bff/engine pnpm run build · website pnpm build
  ↓ 单测+覆盖率门禁 ……………………………………………………G3（分栈命令见下）
  ↓ 询问用户后跑 E2E …………………………………………………G4
  ↓ 全栈覆盖率汇总 make test-coverage
  ↓ 完成汇报（一次汇总+证据）
```

**验证门（每模块）**：
- backend-java：`验证门: cd apps/backend-java && mvn -q verify`
- bff：`验证门: cd apps/bff && pnpm test && pnpm run build`
- engine：`验证门: cd apps/engine && pnpm test && pnpm run build`
- website：`验证门: cd apps/website && pnpm run build`
- 跨端 flows：`验证门: cd e2e && pnpm test`
- engine e2e：`验证门: cd apps/engine && pnpm run test:e2e`
- 任务图：`验证门: node scripts/verify-plan-ssot.mjs validate docs/superpowers/tasks/signup-billing-onboarding.json && node scripts/verify-plan-ssot.mjs journey-coverage`
- 全栈：`验证门: make test-coverage`

---

## §9 实现任务派发（四路并行 subagent 产出，主会话合并）

> 生成方式：backend-java / bff / engine / web 四路 subagent 并行扫描代码库（codegraph MCP 本会话不可用，以 Grep/Read 实地验证替代），主会话合并去重并做一致性裁定；ui / client / backend-go 无任务显式跳过。所有路径已实地验证，无编造。
>
> **前置事实（实测锚点）**：`users.id`/`sites.id` = `VARCHAR(36)`（应用侧 UUID 字符串）；时间列惯例 `DATETIME(3)`（应用侧 Instant 写入，不用 DB DEFAULT）；Controller 构造注入无 Lombok、DTO 为 record、Mapper 为 MyBatis 注解 SQL；context-path `/backend`；契约测试 `@SpringBootTest+@AutoConfigureMockMvc+@ActiveProfiles("test")` + H2，MockMvc 需 `.contextPath("/backend")`；全仓现无 `@EnableScheduling`、pom 无 mail 依赖。

### 9.0 一致性裁定记录（合并冲突 → 单一结论）

| # | 冲突/缺口 | 裁定 |
|---|---|---|
| 1 | resend 冷却错误码：bff 组建议 `RESEND_COOLDOWN`/`EMAIL_DAILY_LIMIT` vs backend 组 `VERIFY_RESEND_COOLDOWN`/`VERIFY_RESEND_DAILY_LIMIT` | 采用 **backend 版**（错误码 owner 在 Java） |
| 2 | engine `Plan` DTO 字段 `code` vs 契约 `planCode`；多出 `status` | 统一 **`planCode`**（v02 契约）；DTO 去掉 `status`（服务端已滤 visible） |
| 3 | `getOrders` 分页返回：engine 组 `{list,total}` vs backend `{items,total}` | **`{items,total}`**（AGENT_RULES §4 分页规范） |
| 4 | `subscribe` 响应形态 | **`{subscription:{...}}`**；engine 向导/切换主路径走 `createOrder`（返回 `{order,subscription}`），`subscribe` 为 v02 契约别名保留 |
| 5 | e2e-tiny fixture 注入方式 | **方案 A：`E2EBillingPlanBootstrap`**（env 门控 ApplicationRunner，先例 `E2EAccountBootstrap`）；init SQL 字面方案不可行（§7.3 S6 已修正） |
| 6 | 测试用户清理：engine/BFF 均无 `DELETE /users` API | flows teardown 以 **docker exec SQL 删除**（仅 e2e 环境；创建仍走 API，遵 e2e-test-style-guide）；不新增 admin DELETE /users（防膨胀，记 §10.2 延后） |
| 7 | bff `api-key/login` 的 `error`→`code` 修正超出 plan 字面（原只点名 login） | **随 T-bff-1 同 commit**（同仓不允许两种错误体字段名并存） |
| 8 | W1 缝隙：T-be-2 verify 事务需 `SubscriptionService.bindDefaultFree`（属 T-be-3） | T-be-2 先落调用点/接口签名，T-be-3 实装后同 wave 收口前接线并跑 `RegisterVerifyContractTest` 回绿 |

### 9.1 文件变更总览

#### backend-java（前缀 `apps/backend-java/`，完整路径）

| task | 文件 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-be-1 | `src/main/resources/db/migration/V20260817120000__signup_billing_onboarding.sql` | 新建 | DDL+seed（§9.3） |
| T-be-1 | `src/test/resources/db/h2-migration/V20260817120000__signup_billing_onboarding.sql` | 新建 | H2 镜像（§9.3 要点） |
| T-be-2 | `src/main/java/com/luban/backend/controller/RegisterController.java` | 新建 | POST `/auth/register`、`/auth/register/verify`、`/auth/register/resend`（对齐 AuthController） |
| T-be-2 | `service/RegisterService.java` | 新建 | 注册编排：校验→users INSERT(pending_verification)；verify 事务（active+email_verified_at+默认 Free+消费码） |
| T-be-2 | `service/EmailVerificationService.java` | 新建 | 验证码生命周期：SHA-256 hash、TTL 10min、attempts<5、重发 60s 冷却+日限 10、旧码作废 |
| T-be-2 | `service/MailService.java` | 新建 | SMTP env 发码；`MAIL_DEV_ECHO=true` 返 devCode 不外发；缺 SMTP 且非 echo → 503（fail-closed） |
| T-be-2 | `dto/RegisterRequest.java` 等 5 record（Register/RegisterVerify/RegisterResend 请求响应） | 新建 | 对齐 LoginRequest；verify 响应回 user 载荷（BFF 签 token） |
| T-be-2 | `auth/AuthFilter.java` | 修改 | `NO_AUTH_PATHS` 增 3 条注册路径（L39） |
| T-be-2 | `service/AuthService.java` | 修改 | login：pending_verification → 401 `USER_PENDING_VERIFICATION` |
| T-be-2 | `entity/User.java`、`mapper/UserMapper.java` | 修改 | 加 `email`/`emailVerifiedAt`；SELECT 补列 + `findByEmail` + verify 更新 |
| T-be-2 | `pom.xml`、`application.yml` | 修改 | 加 `spring-boot-starter-mail`；`spring.mail.*`（SMTP_* env）+ `app.demo-account.enabled` |
| T-be-2/3/4/5 | `exception/BusinessException.java` | 修改 | 新静态工厂：`USERNAME_TAKEN`/`EMAIL_TAKEN`/`WEAK_PASSWORD`/`USER_PENDING_VERIFICATION`/`VERIFY_CODE_*`/`VERIFY_RESEND_*`/`EMAIL_SERVICE_UNAVAILABLE`/`INVALID_PLAN`/`PAYMENT_NOT_SUPPORTED`/`ORDER_ALREADY_PAID`/`QUOTA_EXCEEDED`(429)/`SLUG_TAKEN` |
| T-be-2 | `src/test/java/com/luban/backend/contract/AuthRegisterContractTest.java`、`RegisterVerifyContractTest.java`、`service/EmailVerificationServiceTest.java` | 新建 | 先红（§8.1） |
| T-be-3 | `entity/{Plan,Subscription,TrialRecord,UsageCounter}.java`、`mapper/` 同名 4 个 | 新建 | billing 4 实体+注解 SQL mapper |
| T-be-3 | `service/PlanService.java`、`service/SubscriptionService.java` | 新建 | plans 查询（visible）；`applyPlan`（starter 首次→trialing+14d+trial_records）/`bindDefaultFree` |
| T-be-3 | `controller/BillingController.java`、`dto/{PlanResponse,SubscriptionResponse,UsageResponse,SubscribeRequest}.java` | 新建 | GET plans/me/usage、POST subscribe（orders 两端点 T-be-4 并入同文件） |
| T-be-3 | `contract/BillingContractTest.java` | 新建 | 先红 |
| T-be-4 | `entity/Order.java`、`mapper/OrderMapper.java`、`service/OrderService.java` | 新建 | 0 元直通单事务；order_no 幂等；`PAYMENT_NOT_SUPPORTED` 防御 |
| T-be-4 | `dto/{OrderCreateRequest,OrderResponse}.java`；`controller/BillingController.java` 加 POST/GET `/billing/orders` | 新建/修改 | 下单 + 订单分页列表（§4.2.4） |
| T-be-4 | `service/OrderServiceTest.java` | 新建 | 状态机穷举（先红） |
| T-be-5 | `service/QuotaService.java` | 新建 | 先查限后累加；`ON DUPLICATE KEY UPDATE` 原子；quota=0 不限 |
| T-be-5 | `service/PageService.java`（create L49）、`service/LeadService.java`（submit L62） | 修改 | 前置 pages/leads 配额校验（按 site owner） |
| T-be-5 | `service/QuotaServiceTest.java`、`contract/QuotaEnforcementIT.java` | 新建 | 单测 + Failsafe IT（先红） |
| T-be-6 | `service/SiteOwnershipGuard.java` | 新建 | `assertCanWrite(siteId)`=owner 或 admin（NULL 仅 admin）；`assertVisible` |
| T-be-6 | `controller/SiteController.java`（加 GET `/sites/slug-check`）、`service/SiteService.java` | 修改 | create owner=self；list 非 admin 仅 owner=self；get/update/delete 走 guard；`isUniqueViolation`→`SLUG_TAKEN` |
| T-be-6 | `entity/Site.java`、`mapper/SiteMapper.java` | 修改 | `ownerUserId` 补列 + `listByOwner` |
| T-be-6 | `auth/AuthFilter.java` | 修改 | 收窄 `ADMIN_SITES`（L40）：POST /sites 放开登录用户，PUT/DELETE admin 前置下沉 guard（否则 owner 非 admin 被 filter 403） |
| T-be-6 | `service/FormService.java`、`CollectionService.java`（pages/leads 写入口与 T-be-5 同文件） | 修改 | 子资源写入口 `assertCanWrite(siteId)` |
| T-be-6 | `contract/SiteOwnershipContractTest.java` | 新建 | owner/admin/他用户矩阵 + slug-check（先红；同步改 `SlugConflictContractTest` 断言为 `SLUG_TAKEN`） |
| T-be-7 | `config/SchedulingConfig.java`（@EnableScheduling + Clock bean）、`service/TrialDowngradeJob.java` | 新建 | 每小时扫过期 trialing→active(Free)+converted_to，单条独立事务，时钟注入 |
| T-be-7 | `service/TrialDowngradeTest.java` | 新建 | 先红 |
| T-be-8 | `config/DemoAccountInitializer.java`（现未跟踪） | 修改 | `@ConditionalOnProperty(name="app.demo-account.enabled", havingValue="true", matchIfMissing=true)`；纳入本 feature 首次提交 |
| T-be-8 | `docker-compose.prod.yml`（根目录 backend.environment L69-83） | 修改 | 加 `APP_DEMO_ACCOUNT_ENABLED: "false"`（G2 审计项：生产无 demo 账号） |
| T-be-8 | `contract/DemoAccountInitializerConditionalTest.java` | 新建 | 条件装配行为锁定 |
| T-e2e-1 | `config/E2EBillingPlanBootstrap.java` | 新建 | env 门控幂等插 `e2e-tiny` plan（hidden，先例 E2EAccountBootstrap；生产零暴露） |

#### bff（前缀 `apps/bff/`）

| task | 文件 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-bff-1 | `src/app/api/auth/register/route.ts`、`register/verify/route.ts`、`register/resend/route.ts` | 新建 | IP 限流（scope 隔离，仅失败计窗）→ callBackend 透传；verify 在 BFF 组装 `{token,user{username,name,role}}`（signToken，剥离 id，engine 零适配） |
| T-bff-1 | `src/lib/rateLimit.ts` | 修改 | `isRateLimited`/`recordFailure` 加可选 `scope`（默认 "login"，既有测试零改动）；Map 键 `${scope}:${ip}` |
| T-bff-1 | `src/lib/apiHandler.ts` | 修改 | 新增导出 `rateLimited()`（429 `{code:"RATE_LIMITED"}` 共享构造器） |
| T-bff-1 | `src/app/api/auth/login/route.ts`、`auth/api-key/login/route.ts`（+ 各自 route.spec.ts 断言 `error`→`code`） | 修改 | 删局部 rateLimited 改共享；修正 429 错误体字段名（裁定 #7） |
| T-bff-1 | `register/route.spec.ts` ×3（register/verify/resend） | 新建 | vitest：限流/错误体/响应形态 |
| T-bff-2 | `src/app/api/billing/plans|me|subscribe|usage/route.ts`、`billing/orders/route.ts`（GET+POST 同文件） | 新建 | leads/route.ts 范式代理；plans 裸数组（billing.spec B1 断言 `Array.isArray`）；429 透传 |
| T-bff-2 | `src/app/api/sites/slug-check/route.ts` | 新建 | GET 代理（静态段优先于 [siteId] 动态段，无冲突） |
| T-bff-2 | `src/app/api/sites/[siteId]/pages/route.ts` | 修改 | POST 补 try/catch+toBackendResponse（否则 429 变 500）；GET 同步补齐 |
| T-bff-2 | `billing/*.spec.ts` ×5 + `sites/slug-check/route.spec.ts` | 新建 | vitest：401/200/429 透传/409 |

#### engine（前缀 `apps/engine/`）

| task | 文件 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-eng-2/3 | `src/router/index.ts` | 修改 | 顶层 `/register`（public）、`/onboarding`（token 守卫）；DefaultLayout children 加 `settings/billing`；守卫加「已登录访问 /register → /dashboard」 |
| T-eng-2/3 | `src/config/features.ts`、`src/vite-env.d.ts`、`src/config/__tests__/features.spec.ts`、`src/__tests__/router.spec.ts` | 修改 | 2 个新 gate key 登记+类型+断言；3 条新路由断言。**注意 engine 有三套并存开关（config/features.ts、featuregates.ts、useFeatureGate.ts），只动 config/features.ts** |
| T-eng-1 | `src/api/auth.ts` | 修改 | 增 `register`/`verifyCode`/`resendCode` + DTO（verifyCode 返回既有 `LoginResult`） |
| T-eng-1 | `src/api/billing.ts` | 新建 | `getPlans`/`getMyPlan`/`getUsage`/`subscribe`/`createOrder`/`getOrders` + 4 DTO（§9.5） |
| T-eng-1 | `src/api/site.ts` | 修改 | 增 `checkSlug` |
| T-eng-1 | `src/api/request.ts` | 修改 | 增 `extractApiError(e)` 错误体归一（字段级内联错误依赖） |
| T-eng-1 | `src/api/__tests__/billing.spec.ts`、`auth.spec.ts` | 新建 | URL/参数契约单测（先例 api/__tests__/form.spec.ts） |
| T-eng-2 | `src/views/auth/Register.vue`、`views/auth/__tests__/Register.spec.ts` | 新建 | 两步注册（§4.3）；复刻 Login.vue 卡片样式；四态+门禁关闭分支 |
| T-eng-2 | `src/views/Login.vue` | 修改 | 底部「免费注册」互链（v-if signup gate）；既有演示卡不动 |
| T-eng-3 | `src/views/onboarding/OnboardingWizard.vue` + `components/{PlanPicker,SiteForm,TemplateSelect}.vue` + `__tests__/OnboardingWizard.spec.ts` | 新建 | 三步向导（§4.3）；TemplateSelect 复用 templates.ts 与 TemplatePicker 卡片样式 |
| T-eng-4 | `src/views/Dashboard.vue`、`views/site/SiteList.vue` | 修改 | 空态 ElEmpty + CTA（#empty 插槽） |
| T-eng-4 | `src/components/UserPlanPanel.vue`（该目录首个组件；或实现期裁定 colocate 到 layouts/components，`[待确认-实现期]`） | 新建 | 套餐 dict-tag + ElProgress 用量 + 入口 |
| T-eng-4 | `src/layouts/DefaultLayout.vue` | 修改 | 用户菜单插 UserPlanPanel 分组 + billing 跳转 |
| T-eng-4 | `src/views/settings/Billing.vue`、`settings/__tests__/Billing.spec.ts` | 新建 | 当前订阅卡+对比表+订单表（§4.3） |
| 门禁配套 | `vitest.config.ts` | 修改 | `coverage.include` 追加本 plan 新文件（§6.3 陷阱） |
| T-e2e-2 | `e2e/signup-wizard.spec.ts` | 新建 | describe 绑 `@J-signup-onboarding`；不用 storageState（全新用户流，先例 login.spec.ts）；devCode 经 `page.waitForResponse` 监听 register/resend 响应体获取，缺失即显式报错（禁 skip）；断言落 `/designer/...` 且零新增 console error |

#### web（website + ui 测试 + e2e fixture）

| task | 文件 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-web-1 | `deploy/seed/default-homepage.json` | 修改 | hero `ctaText:"开始使用"→"免费注册"`、`ctaUrl→…/register`（LubanHero props L33-36，主按钮仅两者均非空才渲染）；navbar/底部 CTA 可选同步 |
| T-web-1 | `packages/ui/packages/luban-low-code/test/unit/homepageSchema.spec.ts` | 修改 | 追加断言：hero 渲染「免费注册」且 href 含 `/register` |
| T-web-1 | `deploy/seed/seed-default-site.sh` | 不改 | 幂等（先删后插），改 JSON 后重跑即更新生产官网 |
| T-e2e-1 | `docker-compose.e2e.yml`（backend-java environment L47-60） | 修改 | 加 `MAIL_DEV_ECHO: "true"` 与 `E2E_BILLING_BOOTSTRAP: "true"`（E2EBillingPlanBootstrap 开关；`docker-compose.prod.yml` 已核实无此二变量，G2 审计保持缺席） |

### 9.2 API 契约（合并 Java ↔ BFF ↔ engine 三方；错误体统一 `{code,message,details?}`，JSON camelCase）

| 方法 | 路径（Java /backend 前缀 · BFF /api 前缀） | 鉴权 | 请求 | 成功响应 | 错误码 | task |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | 无（BFF IP 限流 scope=register） | `{username,email,password}` | 201 `{username,emailMasked,devCode?}`（devCode 仅 MAIL_DEV_ECHO env） | 400 `INVALID_ARGUMENT`/`WEAK_PASSWORD`；409 `USERNAME_TAKEN`/`EMAIL_TAKEN`；429；503 `EMAIL_SERVICE_UNAVAILABLE` | T-be-2/T-bff-1 |
| POST | `/auth/register/verify` | 无（scope=verify） | `{email,code}` | Java 200 `{user:{id,username,name,role,status}}` → **BFF 组装** `{token,user{username,name,role}}`（signToken，剥 id） | 400 `VERIFY_CODE_INVALID`(details.remainingAttempts)/`VERIFY_CODE_EXPIRED`/`VERIFY_ATTEMPTS_EXCEEDED`（email 无记录同回 INVALID 防枚举） | 同上 |
| POST | `/auth/register/resend` | 无（scope=resend） | `{email}` | 200 `{emailMasked,devCode?}`（旧码作废 TTL 重置） | 429 `VERIFY_RESEND_COOLDOWN`/`VERIFY_RESEND_DAILY_LIMIT`；503 | 同上 |
| GET | `/billing/plans` | 用户 | — | **裸数组** `[{planCode,name,priceMonthly,quotaLeads,quotaPages,quotaVisits,gates,trialDays}]`（priceMonthly 分；仅 visible） | 401 | T-be-3/T-bff-2 |
| GET | `/billing/me` | 用户 | — | `{planCode,planName,status,trialEndsAt?,usage{leads,pages,visits},quota{leads,pages,visits}}`（无订阅回退 free+0） | 401 | 同上 |
| POST | `/billing/subscribe` | 用户 | `{planCode}` | `{subscription:{planCode,planName,status,startedAt,trialEndsAt?}}` | 400 `INVALID_PLAN` | 同上 |
| GET | `/billing/usage?period=` | 用户 | query（默认当月） | `{period,leads,pages,visits}` | 401 | 同上 |
| POST | `/billing/orders` | 用户 | `{planCode}` | `{order:{orderNo,planCode,amount,status:'paid',paidAt,createdAt},subscription:{...}}`（0 元同事务；重复下单幂等返回原单） | 400 `INVALID_PLAN`/`PAYMENT_NOT_SUPPORTED`（不可达防御） | T-be-4/T-bff-2 |
| GET | `/billing/orders?page=&size=` | 用户 | query | `{items:[order],total}` | 401 | 同上 |
| GET | `/sites/slug-check?slug=` | 用户 | query（`[a-z0-9-]` 3-48） | 200 `{available:true,slug}` | 409 `SLUG_TAKEN`(details.slug)；400 `INVALID_ARGUMENT` | T-be-6/T-bff-2 |
| 横切 | `POST /sites/{sid}/pages`、`POST /lead/forms/{formId}/submit` | — | — | 正常响应不变 | **429 `QUOTA_EXCEEDED`(details:{metric,limit,used})**（quota=0 不限） | T-be-5 |

既有端点行为变更：`POST /auth/login` → pending 用户 401 `USER_PENDING_VERIFICATION`；`GET /sites` → 非 admin 仅 owner=self；`POST /sites` → 放开给登录用户；BFF login/api-key 429 错误体 `error`→`code`。

### 9.3 数据库变更（Flyway `V20260817120000__signup_billing_onboarding.sql`，MySQL）

```sql
-- 1) users：注册域新列（存量行 email=NULL，唯一键允许多 NULL，登录不受影响）
ALTER TABLE users
    ADD COLUMN email VARCHAR(255) NULL AFTER username,
    ADD COLUMN email_verified_at DATETIME(3) NULL AFTER email,
    ADD UNIQUE KEY uk_users_email (email);

-- 2) 验证码（重发=插新行旧行自然作废）
CREATE TABLE email_verifications (
    id          VARCHAR(36)  PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code_hash   VARCHAR(64)  NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    expires_at  DATETIME(3)  NOT NULL,
    consumed_at DATETIME(3)  NULL,
    created_at  DATETIME(3)  NOT NULL,
    INDEX idx_ev_email_created (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 套餐（status 供 e2e hidden fixture；gates 预留）
CREATE TABLE plans (
    plan_code     VARCHAR(32) PRIMARY KEY,
    name          VARCHAR(64) NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'visible',
    price_monthly BIGINT      NOT NULL DEFAULT 0,
    quota_leads   INT         NOT NULL DEFAULT 0,
    quota_pages   INT         NOT NULL DEFAULT 0,
    quota_visits  INT         NOT NULL DEFAULT 0,
    gates         JSON        NULL,
    trial_days    INT         NOT NULL DEFAULT 0,
    sort_order    INT         NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) 订阅（一人一条；verify 激活即插 free/active）
CREATE TABLE subscriptions (
    user_id          VARCHAR(36) PRIMARY KEY,
    plan_code        VARCHAR(32) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'active',
    started_at       DATETIME(3) NOT NULL,
    expires_at       DATETIME(3) NULL,
    trial_started_at DATETIME(3) NULL,
    trial_ends_at    DATETIME(3) NULL,
    created_at       DATETIME(3) NOT NULL,
    updated_at       DATETIME(3) NOT NULL,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) 试用记录（uk(user,plan) 支撑「Starter 首次」判定）
CREATE TABLE trial_records (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    plan_code    VARCHAR(32) NOT NULL,
    started_at   DATETIME(3) NOT NULL,
    ends_at      DATETIME(3) NOT NULL,
    converted_to VARCHAR(32) NULL,
    created_at   DATETIME(3) NOT NULL,
    CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_trial_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    UNIQUE KEY uk_trial_user_plan (user_id, plan_code),
    INDEX idx_trial_ends (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) 用量计数（uk_usage 支撑原子累加）
CREATE TABLE usage_counters (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    period_month CHAR(7)     NOT NULL,
    metric       VARCHAR(32) NOT NULL,
    count        BIGINT      NOT NULL DEFAULT 0,
    created_at   DATETIME(3) NOT NULL,
    updated_at   DATETIME(3) NOT NULL,
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_usage (user_id, period_month, metric)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) 订单（orders 非 MySQL/H2 保留字）
CREATE TABLE orders (
    id         VARCHAR(36) PRIMARY KEY,
    order_no   VARCHAR(64) NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    plan_code  VARCHAR(32) NOT NULL,
    amount     BIGINT      NOT NULL DEFAULT 0,
    status     VARCHAR(16) NOT NULL DEFAULT 'pending',
    paid_at    DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_orders_order_no (order_no),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    INDEX idx_orders_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) sites 归属（存量 NULL=平台站点仅 admin；站点不随用户删除，故无 ON DELETE）
ALTER TABLE sites
    ADD COLUMN owner_user_id VARCHAR(36) NULL AFTER base_url,
    ADD INDEX idx_sites_owner (owner_user_id),
    ADD CONSTRAINT fk_sites_owner FOREIGN KEY (owner_user_id) REFERENCES users(id);

-- 9) 三档 seed（全 0 元；quota_visits=0=不限 §10.2）
INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) VALUES
    ('free',    'Free',    'visible', 0,   100,  3, 0, NULL,  0, 1),
    ('starter', 'Starter', 'visible', 0,  1000, 10, 0, NULL, 14, 2),
    ('growth',  'Growth',  'visible', 0, 10000, 50, 0, NULL,  0, 3);
```

与 v02 §9.3 的刻意差异：`user_id` VARCHAR(64)→**36**（对齐真实 users.id）；`TIMESTAMP DEFAULT`→`DATETIME(3)` 应用侧写入（本仓惯例）；plans 增 `status`；补 user 侧 FK CASCADE（支撑 §7.3 S2/S6「删用户级联」清理）。

**H2 镜像要点**（`src/test/resources/db/h2-migration/` 同名文件）：`DATETIME(3)`→`TIMESTAMP`；`JSON`→`CLOB`；删 `ENGINE/CHARSET/AFTER`；内联 `INDEX`→独立 `CREATE INDEX`；`ADD UNIQUE KEY`→`ADD CONSTRAINT … UNIQUE`；seed 保留。`ON DUPLICATE KEY UPDATE` 在 H2 MODE=MySQL 以 `QuotaEnforcementIT` 实测为准，不等价则退「insert 冲突捕获唯一异常转 update」两步（复用 `SiteService.isUniqueViolation` 模式）。`uk_users_email` 多 NULL 两库均允许（契约测试加 NULL 不冲突断言）。e2e-tiny 不入生产迁移，由 `E2EBillingPlanBootstrap` 注入（裁定 #5）。

### 9.4 物料 schema

**不适用**——无新增/修改物料（§0.2）；官网 pricing 卡复用既有 `LubanPricing`，向导模板复用 `templates.ts` 既有 PageTemplate。

### 9.5 组件/工具接口（关键签名）

**bff**：`rateLimit.ts` — `isRateLimited(ip, now?, scope?: "login"|"register"|"verify"|"resend")` / `recordFailure(ip, now?, scope?)`（默认 "login"，既有测试零改动）；`apiHandler.ts` — 新增 `rateLimited(): NextResponse`（429 `{code:"RATE_LIMITED"}`）。

**engine api**（均直返 `request.post/get<T>()`，与既有 login 同风格）：

```ts
// api/auth.ts 扩展
register(p: {username,email,password}): AxiosPromise<{username,emailMasked,devCode?}>
verifyCode(p: {email,code}): AxiosPromise<LoginResult>          // 复用既有 LoginResult，setAuth 直接可用
resendCode(p: {email}): AxiosPromise<{username,emailMasked,devCode?}>

// api/billing.ts（新建）
interface Plan { planCode; name; priceMonthly; quotaLeads; quotaPages; quotaVisits; trialDays? }
interface Subscription { planCode; planName?; status:'active'|'trialing'|'expired'; startedAt?; trialEndsAt? }
interface Usage { period; leads; pages; visits }
interface Order { orderNo; planCode; amount; status:'pending'|'paid'|'cancelled'; createdAt; paidAt? }
getPlans(): AxiosPromise<Plan[]>            // 裸数组（billing.spec B1）
getMyPlan(): AxiosPromise<Subscription>
getUsage(): AxiosPromise<Usage>
subscribe(planCode): AxiosPromise<{subscription: Subscription}>          // v02 契约别名
createOrder(planCode): AxiosPromise<{order: Order; subscription: Subscription}>  // 向导/billing 页主路径
getOrders(params?: {page?;size?}): AxiosPromise<{items: Order[]; total: number}>

// api/site.ts 扩展 / api/request.ts 扩展
checkSlug(slug): AxiosPromise<{available: boolean}>
extractApiError(e): {code?; message; details?}     // BFF/Java 错误体归一（字段级内联错误依赖）
```

**engine 组件**：`Register.vue` 内部状态机 `step:'form'|'otp'`（含 fieldErrors/topError/otpError/countdown/submitting；submitVerify 成功后 `router.replace(isFeatureEnabled('onboarding') ? '/onboarding' : '/dashboard')`）；`OnboardingWizard.vue`（loadPlans/confirmPlan/createSite/createHomePage/goBack；Step1 成功 ElResult 1.5s 自动进 Step2）；`PlanPicker.vue`（props `{plans,modelValue,loading?}`）；`SiteForm.vue`（props `{modelValue,submitting?}`，slug 防抖 500ms → `slugState:'idle'|'checking'|'available'|'taken'`）；`TemplateSelect.vue`（props `{modelValue}`，复用 `TEMPLATES/groupTemplatesByCategory/getTemplate`）；`UserPlanPanel.vue`（props `{plan?,usage?,loading?}`，未传自取、独立失败显「—」不阻断菜单）；`stores/user.ts` **不扩展**（订阅由面板/Billing 页自取，避免注册早期多余状态）。

### 9.6 并行派发计划（与 taskGraph JSON `dependsOn`+`waves` 完全一致）

| wave | 并行组 | tasks | 前置 |
|---|---|---|---|
| W1 | backend 基础+注册/billing/ownership 域（域内按 dependsOn 串行；T-be-8 独立） | T-be-1 → {T-be-2, T-be-3, T-be-6}；T-be-8 | T-be-1 无依赖；裁定 #8 缝隙在 W1 内收口 |
| W2 | orders/quota/trial + BFF 注册路由 | T-be-4, T-be-5, T-be-7 ∥ T-bff-1 | T-be-4←T-be-3；T-bff-1←T-be-2 |
| W3 | BFF billing 代理 + engine api 层 + website seed | T-bff-2 ∥ T-eng-1 ∥ T-web-1 | T-bff-2←T-be-3/4/6；T-eng-1←T-bff-1/2 |
| W4 | engine UI（三线并行，文件不相交） | T-eng-2 ∥ T-eng-3 ∥ T-eng-4 | T-eng-3 另需 T-be-6 |
| W5 | E2E 收口 + 文档勘误 | T-e2e-1, T-e2e-2, T-doc-1 | T-e2e-1←T-bff-1/2+T-be-5/6；T-e2e-2←T-eng-2/3 |

> 门禁值：Java 行 80% · engine/bff/website 行 85% · UI 90%（本期不涉及）。多端渲染一致：无物料/schema 变更，不适用（§14-13 已声明理由）。

---

## §10 明确不做（防膨胀）与显式延后

### 10.1 明确不做（用户已确认）

| 不做项 | 理由 | 出处 |
|---|---|---|
| 真实支付网关（支付宝/微信/Stripe）对接 | 三档全 0 元，0 元订单直通；网关为未来挂载点（PAYMENT_NOT_SUPPORTED 防御） | 用户裁定 3 + v02「不收费」先例 |
| 短信验证码 / 手机号注册 | 无短信通道且用户裁定用免费邮箱验证 | 用户裁定 1 |
| 找回密码 / 邮箱登录 / 改密自助 | 无邮件正文模板体系外的产品需求，非本期目标 | 讨论稿共识（U5「其余按建议」） |
| JWT 刷新/吊销改造 | 沿用 7d Bearer 既有契约；列为已知债务（§10.3） | 讨论稿共识 |
| 团队/席位/多用户协作 | ownership 单人模型即满足本期 | 讨论稿共识 |
| 自定义域名绑定 | baseUrl 既有字段+预览兜底已够 | 讨论稿共识 |
| website 端 auth 体系 | website 保持纯访客渲染端（docs/DESIGN.md 定位） | 讨论稿共识 |
| quota_visits 访问量计量与拦截 | 依赖 analytics 域（v02 已随 Go 丢失，范围失控）；字段保留默认 0=不限 | §10.2 延后 |
| 发票/账单 PDF | 无付费 | v02 先例 |

### 10.2 显式延后（有去向）

| 项 | 延后到 | 理由 |
|---|---|---|
| quota_visits 计量与超限 | analytics 域重建的独立 plan | 访问量数据源（埋点/预聚合）不存在 |
| 图形验证码 | 后续安全迭代 | IP 限流+验证码 TTL/尝试上限已达标 |
| 订阅升降级差价/退款/续费 | 接真实支付时 | 0 元无差异 |

### 10.3 已知债务（不顺手修，仅登记）

- JWT 7 天无刷新/吊销（auth-security-policy 的 30 天 TTL/改密吊销条款与现状不符——存量债务，非本 plan 引入）。
- BFF 内存限流单实例有效（当前部署形态单实例，可接受）。
- `pages.status` 服务端无枚举白名单（存量，本 plan 不扩大使用面）。

---

## §11 分级验收门禁表（G1–G4）

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|---|---|---|---|---|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议级别） | plan owner |
| **G2** | 安全审查（**必选**：涉支付/凭证/权限变更/外部 SMTP） | OWASP Top 10 自查 + 敏感字段清单核对 + 鉴权覆盖矩阵 + 生产 env 审计（MAIL_DEV_ECHO 必须缺席生产、AUTH_JWT_SECRET 非默认弱值、INTERNAL_AUTH_SECRET 已配置、SMTP 凭证仅 env） | 无高中危遗留；免鉴权面最小（仅 3 注册端点+既有公开端点）；验证码/密码/邮箱日志零泄露 | plan owner |
| **G3** | 单测+覆盖率 | 分栈命令（§8.5 验证门） | Java 80% · bff/engine 85% 行覆盖；全部契约测试绿 | plan owner |
| **G4** | E2E 验收 | flows + engine e2e + website 冒烟（§7.3 全场景，正式路由） | 全绿、无 skip、无假绿；引擎画布零新增 console error | plan owner（询问用户后跑） |

执行顺序：G1 → G2 → G3 → G4（/luban-review 先行，禁止未过审查跑验证）。

---

## §12 敏感字段清单与分级约束（MUST）

| 字段 | 位置 | 加密/脱敏策略 | 日志规则 | 前端展示 |
|---|---|---|---|---|
| user.password | users（注册写入） | BCrypt hash | 禁明文/禁日志 | 不展示 |
| 邮箱 email | users.email（PII） | 明文存储（登录凭证主体，非高敏）；响应中外发仅掩码 `emailMasked`（`a***@domain.com`） | 日志打印必须掩码；完整邮箱禁 INFO 级输出 | 注册 Step2/订单页仅掩码展示 |
| 验证码 code | 内存/邮件正文；库存 SHA-256(code_hash) | 禁明文入库 | 禁日志 | devCode 仅 dev/e2e env 响应体，生产缺席（G2 审计项） |
| SMTP 凭证 | SMTP_HOST/PORT/USERNAME/PASSWORD/FROM（env） | 仅环境变量，禁入仓禁入库 | 禁任何日志 | 不展示 |
| AUTH_JWT_SECRET / INTERNAL_AUTH_SECRET | env | 仅环境变量 | 禁日志（既有约定） | 不展示 |
| X-User-* / X-Internal-Auth 头 | BFF→Java | 中间件剥离+注入（既有） | 禁外泄到响应 | 不展示 |

OWASP 自查重点：A02 失效认证（验证码暴力/TTL/限流）、A01 访问控制（ownership 矩阵+契约测试）、A04 注入（MyBatis 参数化，既有）、A09 日志监控（敏感字段零打印）。

---

## §13 回滚方案（FeatureGate 首选）

| 变更 | 回滚首选 | 次选 | 数据影响 | 验证点 |
|---|---|---|---|---|
| 注册入口 | 关 `VITE_FEATURE_SIGNUP`（重发 engine） | nginx 封 `/api/auth/register*`；revert commit | 无 | /register 显示「暂未开放」；既有登录不受影响 |
| 开通向导 | 关 `VITE_FEATURE_ONBOARDING` | revert | 无 | 注册成功直进 Dashboard |
| billing/quota 拦截 | （后端无 gate）回滚 = revert commit（拦截代码独立提交） | 临时将 plans quota 调 0（=不限，seed UPDATE） | 无 | 建站/留资恢复不限 |
| Flyway 迁移 | 新表 DROP + users 新列可保留（可空，无破坏）；sites.owner_user_id 可保留（NULL=平台站点，行为回退 admin-only 由代码 revert 决定） | 手动回滚 SQL（先 staging 验证） | billing/orders 为新数据可弃；**保留列不回填删除** | 旧登录/建站（admin）链路回归绿 |
| SMTP 配置 | env 移除 SMTP_* | — | 注册 503（fail-closed，符合 auth-security-policy） | 登录不受影响 |
| 官网 seed CTA | 还原 seed 内容 | revert | 无 | 官网首页回归 |

---

## §14 质量禁令自检表（14 条逐条）

- [x] 1 禁止跳过功能：U1–U8 全映射 task（§1.2），无静默省略
- [x] 2 禁止假绿：§7.2 禁 skip/环境预检/测试冻结契约；既有红 spec 不许「未跑宣称绿」
- [x] 3 禁止占位：无 TODO 冒充；devCode 仅 env 显式开启（非 mock 凭证——SMTP 真发，dev-echo 是 e2e 通道且 G2 审计）
- [x] 4 禁止骨架交付：每用户可见流程有 §4.2 分步链 + E2E 断言
- [x] 5 禁止 JSON 替代页面：§4.3 逐页结构 + 真实 UI 组件
- [x] 6 页面交互完整：§4.2.1–4.2.4 分步到 API/状态
- [x] 7 验收口径=可交付：G4 以真实页面完整链路（注册→开通→设计器→访客访问）为准
- [x] 8 引擎 E2E 绑正式路由：§7.4 全正式路由，无 pages/e2e/*
- [x] 9 门禁分级：§11 G1–G4 + 顺序约束
- [x] 10 /luban-review 清零：§8.5 步骤 2（先行）
- [x] 11 安全审查门禁：§11 G2 必选 + §12 敏感清单（涉支付/凭证/权限/SMTP）
- [x] 12 双后端契约一致：§3.5/§6.2 单端豁免声明（backend-go 已删除，Java 单端权威=CLAUDE.md 硬约束 3）
- [x] 13 多端渲染一致：本特性无物料/schema/渲染器变更，engine 增量为工作台管理页——多端渲染约束不适用（声明理由；website 渲染链零改动）
- [x] 14 FeatureGate 默认约束：§6.5 两开关 + 不用开关处写理由 + §13 回滚首选

---

## §15 For agentic workers

> **REQUIRED SUB-SKILL**：`subagent-driven-development`（推荐）或 `executing-plans`；按本 plan checkbox 与 `docs/superpowers/tasks/signup-billing-onboarding.json` 推进；执行纪律见 `docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md`；实现会话进入前先与用户确认切 `feature/signup-billing-onboarding` 分支；每步验证门见 §8.5；单期收口（§8.4）。

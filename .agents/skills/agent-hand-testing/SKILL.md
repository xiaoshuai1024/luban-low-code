---
name: agent-hand-testing
description: "手工 E2E 测试经验规则：测试专家角色/全功能穷尽验证/CRUD闭环与死数据检测/用户旅程优先(API≠E2E)/后端端点可达性冒烟/CORS与Filter排障/异步竞态/缺陷定级与报告格式（luban 适配版）"
origin: migrated-from-kangdou
---

# Agent Hand Testing（luban 适配版）

手工（手动 / 半自动）E2E 测试的经验规则，适用于 luban 全栈：
**Spring Boot 后端（context-path `/backend`，default profile）+ TS/pnpm 前端（engine/ui/bff/website）+ Vue3+Vite 物料库 + 跨工程 Playwright E2E**。

> **与既有自动化 E2E 文档的关系**：本 skill 治**手工探索式测试的 craft**；自动化执行纪律、覆盖率门禁、假绿禁止等由下列文档 SSOT，本 skill 只引用不重写：
> - `docs/E2E_AGENT_GUIDE.md` §2.5（E2E 执行契约）、§3（Console→Network→backend-log 排障顺序）
> - `.agents/rules/luban-e2e-execution-contract.md`（禁假绿 / 禁降级 / 会话内冻结）
> - `.agents/rules/luban-testing-coverage.md`（分层覆盖率 + 旅程覆盖率门禁）
> - `.agents/skills/e2e-testing/SKILL.md`（Page Object / config / flaky / artifacts 通用模式）
> - `.agents/commands/engine-e2e.md` `.agents/commands/website-e2e.md`（自动化 E2E 命令）

---

## 🔴 0. 角色预设：测试专家

你是一个**资深测试专家（SDET / QA Lead）**，拥有以下信条和行事方式。

### 0.1 核心信条

| 信条 | 含义 |
|------|------|
| **用户不会按你预期的方式操作** | 每个按钮都可能被乱点，每个输入框都可能被输入非法值 |
| **表面的通过不代表功能正常** | 后端可能静默失败、数据可能没有持久化、边界 case 可能没覆盖 |
| **数据和代码一样需要"垃圾回收"** | 不被任何路径引用的数据就是死数据，会随时间累积拖垮系统 |
| **可测试性不是装饰，是架构属性** | 如果一个功能不方便测试，那它本身就是设计缺陷 |
| **E2E 的核心价值是覆盖 user journey，不是 code path** | 单元测试覆盖代码分支，E2E 覆盖用户真实操作路径 |
| **API 返回 200 ≠ 功能测试通过** | API 通只证明后端不报错，不等于 UI 能渲染、数据能持久化、用户能走完旅程 |

### 0.2 测试策略分层

```
全功能覆盖（所有可交互元素）
  └─ 功能逻辑验证（CRUD 闭环、状态流转）
      └─ 数据健康检查（死数据、孤立数据、数据一致性）
          └─ 边界 & 异常测试（空值、超长、非法输入）
```

- **全功能覆盖是基石**：只有确定每个按钮/输入框/下拉都可用，才能谈逻辑验证
- **逻辑验证依赖全功能覆盖**：一个不可用的「提交」按钮不可能验证 CRUD 闭环
- **数据健康检查贯穿始终**：每次操作后都检查数据状态

### 0.3 执行优先级：Agent 行为决策树

当多个规则同时适用时，按以下优先级裁决：

```
P0 — 用户安全与数据完整性
  ├─ 发现数据泄露、权限越级、金额错误 → 立即停止测试，报告用户
  └─ 涉及不可逆操作（删除/下线/审批） → 必须验证二次确认

P1 — 测试覆盖完整性
  ├─ 被测模块有未覆盖功能 → 优先补全测试（打破"不改已有逻辑"）
  ├─ 现有测试缺少断言 → 补充断言
  └─ 现有 spec 不适合扩展 → 允许新建 spec 文件

P2 — 规则遵守
  ├─ 能用已有 fixture 就用，不能用就新建
  ├─ 先分析根因，给建议，等确认再改
  └─ 见 §1.6 的四层阶梯（web → SSR → engine → client）

P3 — 代码风格与重构
  └─ 不重构、不重命名、不改现有测试风格
```

**核心原则**：覆盖完整性 > 规则遵守 > 代码风格。不要因为"不改已有逻辑"而放过未覆盖的功能。

### 0.4 测试执行者的行动准则

1. **穷尽交互**：被测模块的每个可点击、可输入、可选择的元素都必须被实际操作一遍
2. **数据追踪**：每次 UI 操作后，通过 API 或 DB 验证数据是否正确持久化
3. **状态枚举**：任何有状态的元素（开关、下拉、Tab）都必须遍历所有状态
4. **边界试探**：输入框必须测试空值、超长值、特殊字符
5. **结果闭环**：每次操作都要断言结果 —— 要么 UI 变化，要么数据变更，不能无断言的操作
6. **不可逆操作确认**：删除、下线、关闭等操作必须验证二次确认弹窗存在

---

## 🔴 0.5. 前置步骤：后端端点可达性冒烟测试（先验证"路通不通"，再做 UI）

**何时执行**：进入 UI 点击测试（§2）**之前**，若本次改动新增或修改了后端 HTTP 端点（`@*Mapping`），**必须先做这一步**。每个端点 <10 秒，但能抓住所有路由级 BUG，避免"UI 怎么点都没反应、查半天才发现端点 405"的浪费。

### 0.5.1 为什么需要这一步

静态代码审查（读 diff、看注解）**无法发现路由运行时不可达**类问题。典型事故（来自 kangdou 2026-07-04 经验，已泛化）：
- 后端写 `@PostMapping("/orders/{orderNo}:hide")`，代码语法合法、权限校验齐全、`mvn compile` 通过
- 但 Spring MVC 把 `:hide` 当**矩阵变量**解析，该端点返回 405「请求方法不支持」，**永远不可达**
- 静态审查通过、编译通过 —— 只有真正发一次 HTTP 请求才暴露
- UI 测试时表现为"点删除按钮无反应/报错"，排查成本高

**结论**：编译通过 ≠ 端点可达。新增端点必须用 curl 验证路由真的通了。

### 0.5.2 执行方法

1. **提取端点清单**：`git diff` 命中后端 Controller 文件，grep 本次新增的 `@*Mapping` 行，得到 `(HTTP方法, 路径)` 清单
2. **确认后端启动**（luban context-path = `/backend`；后端**未引入 spring-boot-actuator**，健康端点是 PingController 的 `/ping`）：
   ```bash
   curl -s http://localhost:8080/backend/ping
   # 返回 {"message":"pong"} 才继续；未启动按 §1.6 / Makefile `make dev-java` 启动
   # 注意：actuator 默认未启用（pom.xml 无 spring-boot-actuator 依赖），/actuator/* 返回 404
   ```
3. **逐个端点发最小请求**（带缺省参数即可，目的是验证路由可达，非业务正确性）。
   **认证方式区分**：直连后端用 `X-User-ID`/`X-User-Role` header（AuthFilter 读取）；走 BFF 用 `Authorization: Bearer <jwt>`（BFF 解 JWT 后转 `X-User-*` 给后端）。**注意后端 controller 路由不带 `/api` 前缀，但 BFF 代理路径带 `/api`**——所以直连后端 `POST /backend/sites/...`，走 BFF `POST /api/sites/...`：
   ```bash
   # 直连后端（推荐用于路由冒烟，跳过 BFF JWT 层）：
   curl -s -o /dev/null -w "%{http_code}\n" \
     -X POST http://localhost:8080/backend/sites/<some-id>/pages \
     -H "X-User-ID: <uuid>" -H "X-User-Role: admin" \
     -H "Content-Type: application/json" -d '{"name":"t","path":"/t","schema":{}}'

   # 走 BFF（更接近真实用户旅程，需先登录拿 JWT）：
   curl -s -o /dev/null -w "%{http_code}\n" \
     -H "Authorization: Bearer <jwt>" \
     "http://localhost:3100/api/sites/<some-id>/pages"
   ```
4. **判定**：
   - **4xx（400/401/403）= 端点可达** ✅（缺认证/参数，但路由本身通了）
   - **404 = 路由不存在** 🔴 阻断
   - **405 = 方法不支持 / 路径被框架误解析** 🔴 阻断（常见于冒号路径）
5. **记录证据**：每个端点的 HTTP code 写入测试报告（与 UI 截图同等重要）

### 0.5.3 常见不可达根因与修复

| 根因 | 现象 | 修复 |
|------|------|------|
| **冒号路径** `/x/{id}:action` | 405 | Spring 把 `:action` 当矩阵变量；改 `/x/{id}/action` |
| 路径变量名不匹配 `/x/{id}` vs `/x/{orderId}` | 404 | 统一变量名 |
| HTTP 方法不一致 `@PostMapping` 但前端用 GET | 405 | 对齐方法 |
| Filter / 拦截器拦截（CORS / 认证 / 租户） | 401/403 | 正常可达，非 BUG；但要确认不是被错误拦截（见 §6） |

> luban 目前**无自定义 Filter / 拦截器**（grep `OncePerRequestFilter`/`@WebFilter`/`HandlerInterceptor` 为空）。若未来引入，应在此处补充具化的 error code 对照表。

---

## 🔴 1. 代理工作流规则

约束 agent 在手工测试过程中如何与用户交互。

### 1.1 出现问题先给建议，用户确认后再改

遇到测试失败或代码问题时：
1. **先分析根因** —— 截图、curl、查日志，定位问题来源
2. **给出建议** —— 向用户说明问题是什么、为什么、建议怎么改
3. **等用户确认** —— 用户说「改」再动手，禁止自行决定修复方案直接改代码

### 1.2 不改已有业务逻辑

- 不修改已上线的业务逻辑代码
- 测试发现业务逻辑 BUG，记录为缺陷，不自行修复
- **测试代码（spec 文件）不受此限制** —— 可以为未覆盖的功能补测试

### 1.3 先读现有测试，再决定扩展方式

写测试前必须先读：
- 同目录/同模块下已有的 spec 文件
- 了解数据创建方式、fixture 使用模式、auth.setup storageState 模式（见 `e2e-testing/SKILL.md` POM 段）
- 现有 spec 有对应 describe 块 → 在其中扩展
- 被测功能完全没有 spec 覆盖 → **允许新建 spec 文件**

### 1.4 优先扩展现有 spec，必要时新建

```
✅ 优先：在现有 describe 中扩展
  在 xxx.spec.ts 中追加 → test.describe("模块03 — ...") 下加 test()
✅ 允许：功能无覆盖时新建 spec 文件
  创建 xxx-interact.spec.ts → 全新的功能模块
```

### 1.5 服务依赖始终可用 —— 禁止以环境问题跳过测试

**🔴 硬约束：所有 luban 服务和依赖一定可用。** 排查顺序：进程 → 端口 → 日志 → 构建 → 依赖。排完再说话。

| 禁止的借口 | 正确的做法 |
|-----------|-----------|
| "后端未启动" | `make dev-java`（mac/linux 走 `scripts/dev/start-java.sh`，Windows 走 `start-mvn.bat`），健康检查 `curl http://localhost:8080/backend/ping` 返回 `{"message":"pong"}`（actuator 默认未启用） |
| "BFF 未启动" | `make dev-bff`（端口 3100） |
| "engine 未启动" | `make dev-engine`（端口 5173，Vite） |
| "website 未启动" | `make dev-website`（端口 3000，**URL 必须用 `localhost` 不能用 `127.0.0.1`**，否则 Nuxt dev 返回 426） |
| "MySQL/Redis 不可达" | 连接信息以 `application.yml` / `.env` 为 SSOT；按 SSOT 中的 host/port 排查 |
| "Playwright 未装" | `pnpm exec playwright --version` 确认；缺失则 `pnpm exec playwright install chromium` |
| "数据库表不存在" | 检查 Flyway 迁移是否执行（`spring.flyway.enabled=true`）；补执行或手动建表 |
| "环境配置问题" | `.env` / `application.yml` 是 SSOT；任何组件连不上就排查那个组件的状态 |

> 注：luban **禁止本地 Docker**（见 `.agents/rules/luban-no-local-docker.md`），所有依赖走远程或本地原生进程。

### 1.6 测试流程四层阶梯（luban 适配）

```
web（engine 渲染 / luban-ui 物料） → SSR（website） → 跨工程 Playwright（e2e/） → client（electron/flutter）
```

| 层 | 适用场景 | 命令 / 配置 |
|----|---------|------------|
| **engine 渲染** | 物料渲染、画布交互、属性配置 | `packages/engine/luban/playwright.config.ts` + `.agents/commands/engine-e2e.md` |
| **website SSR** | SSR 渲染、SEO meta、`window.__INITIAL_STATE__` | `packages/web/luban-website/playwright.config.ts` + `.agents/commands/website-e2e.md` |
| **跨工程流程** | publish / lead-capture / 双端一致性 | `e2e/playwright.config.ts` + `make e2e-cross` |
| **client** | electron / flutter 业务一致性 | 各 client 包内 E2E（见 `docs/E2E_AGENT_GUIDE.md` §6） |

**禁止跳过 web 层直接跑 client** —— client 启动慢、调试难；web 先过一遍可过滤 90% 显性问题。

> 详见 `docs/E2E_AGENT_GUIDE.md` §1（E2E 类型与目录表）+ `.agents/rules/luban-e2e-agent-guide.md`。

---

## 🔴 2. 全功能可用性验证

测试一个模块时，**必须逐元素穷尽验证**，不能只验证主流程。

### 2.1 验证清单（按元素类型）

#### 输入类元素

| 元素 | 必须验证 |
|------|---------|
| 文本框 / textarea | 正常文本、空值提交、超长文本（边界）、特殊字符（`<>"'&`）、前后空格是否 trim |
| 数字输入框 | 负数、零、极大值、小数、非数字字符、空值 |
| 下拉框（select / picker） | 每个选项都选一次、选择后回显、清空/重置恢复默认 |
| 日期选择器 | 今天、跨月、跨年、未来、过去、空值 |
| 开关 / toggle | 开→关→开 完整来回、默认状态 |
| 复选框（多选） | 全选、取消全选、单选、全部取消、提交后回显 |
| 单选框 | 每个选项选中后提交、切换选中、取消选中（如允许） |
| 文件上传 | 图片/文档、超大文件、非法格式、取消上传、删除已上传 |

> **Vue3 + Element Plus 怪癖**（luban 物料库栈）：`<el-input type="textarea">` 的 v-model 不响应 Playwright 的 `fill()`，需用 `page.evaluate` 调用 `nativeInputValueSetter` + `dispatchEvent(new Event('input'))`，或直接在浏览器上下文发起请求。详见 `docs/E2E_AGENT_GUIDE.md` §3.x 已有经验段。

#### 操作类元素

| 元素 | 必须验证 |
|------|---------|
| 按钮 | 点击响应、loading 状态、连点是否重复提交、disabled 是否不可点击 |
| 链接 / 导航 | 跳转正确、返回后状态保持、新开页/当前页跳转 |
| Tab / 标签页 | 每个 Tab 切换、切换后内容渲染、回到之前 Tab 内容不变 |
| 分页 | 每页点一次、跳转指定页、每页条数切换、超出总页数处理 |
| 排序 | 正序、倒序、多字段排序、排序后数据正确 |
| 搜索 / 筛选 | 关键词、组合筛选、筛选后清除、空结果展示 |

#### 弹窗 / 浮层类元素

| 元素 | 必须验证 |
|------|---------|
| 弹窗（modal / dialog） | 打开、关闭（× / 遮罩 / ESC）、提交后关闭、提交失败保持打开 |
| 确认框（confirm） | 确认和取消都测、二次确认文案正确 |
| 下拉菜单（dropdown） | 展开、选择、收起、点击外部关闭 |
| Tooltip / popover | 悬停显示、移出隐藏、内容正确 |
| Toast / 消息提示 | 出现、自动消失、多条叠加 |

> **`getByText("确定")` 模糊匹配陷阱**：`ElMessageBox.confirm` 弹窗文案也含「确定」，需用 `getByRole("button", { name: "确定" })` 精确定位。

### 2.2 状态覆盖原则

对任何有状态的 UI 元素，必须验证其**所有可能状态**：

```
初始 → 操作 → 中间状态 → 操作 → 最终状态
                                ↓
                       回到初始状态（完整闭环）
```

**示例 - 按钮三状态**：可用（可点击+响应正确）/ 禁用（不可点击+`aria-disabled`）/ 加载（spinner+文字变"提交中..."+不可重复点击）

**示例 - Tab 四验证**：
1. 点 Tab 1 → 内容 1 显示
2. 点 Tab 2 → 内容 2 显示（内容 1 隐藏）
3. 点 Tab 1 → 内容 1 仍正确渲染（非缓存失效）
4. 刷新 → 选中 Tab 保持（或恢复默认）

### 2.3 遍历规则

测试列表/表格页面，必须验证：空态 / 单条数据 / 多条数据（滚动/分页/加载更多）/ 边界条数（正好一页满、跨页、超最大展示）。

### 2.4 操作闭环验证

每步操作后必须断言**三件事**：
```
1. UI 反馈 → Toast / 状态变化 / 跳转（用户看到了什么？）
2. 数据持久化 → API / DB 查询（数据真的存了吗？）
3. 可逆性 → 能否回到操作前状态（取消 / 编辑 / 删除）
```

**示例 - 创建记录后的验证链**：
```
1. 点「保存」→ Toast "创建成功" ✅
2. 列表页 → 新记录出现在第一行 ✅
3. 点详情 → 所有字段与创建时一致 ✅
4. 编辑保存 → 更新后字段正确 ✅
5. 删除 → 二次确认弹窗 ✅ → 确认 → 列表不再显示 ✅ → 可恢复/可永久删除
```

---

## 🔴 3. 逻辑与死数据检测

### 3.1 CRUD 闭环验证

每个实体（订单、商品、用户、配置等）必须验证完整 CRUD 生命周期：

```
Create → Read → Update → Delete
  │         │         │         │
  ├ UI 创建  ├ 详情渲染  ├ 编辑预填  ├ 二次确认
  ├ DB 有记录 ├ 列表展示  ├ 保存后更新 ├ 列表不再显示
  └ 字段正确  └ 搜索能查  └ 回显正确  └ 不可对已删除操作
```

#### 状态流转验证

| 检查项 | 说明 |
|--------|------|
| **状态可达性** | A→B→C 每条路径都可达吗？是否存在只有通过 SQL 才能变更的状态？ |
| **状态不可逆** | 已删除/已完成是否不应再允许编辑？UI 是否反映（按钮禁用/隐藏）？ |
| **状态幂等** | 重复提交相同操作（重复审批"通过"）是否返回一致结果而非抛异常？ |
| **状态回滚** | 操作失败时状态是否回滚？有无处于"中间状态"的记录？ |

### 3.2 死数据检测清单

死数据 = 不被任何用户/业务路径引用的数据，会污染查询、占用存储、导致索引失效。

| 检测项 | 验证方法 | 判断标准 |
|--------|---------|---------|
| **孤立记录** | 检查外键关联：A 表引用 B 表 ID，但 B 表记录已删 | 每个外键值在父表都有对应记录 |
| **悬挂状态** | 记录状态为 PROCESSING 但 30+ 分钟未变 | 无长时间卡在中间状态的记录 |
| **幽灵数据** | 软删除的记录（`deleted=1` / `delete_time>0`）是否仍被 API 返回/UI 展示 | 软删除记录不应出现在任何业务查询 |
| **重复数据** | 同一唯一约束下多条记录（缺唯一索引或并发插入） | 唯一键约束阻止重复 |
| **过期数据** | 有时效的数据（优惠券、活动、待办）过期后是否仍在 API 响应中 | 过期数据应被过滤或标记失效 |
| **无效引用** | 图片 URL 指向已删 OSS 文件，或关联 ID 指向不存在的记录 | 所有外键关联能正确 JOIN |
| **配置残留** | 租户关闭某功能后，该功能的配置数据是否仍在表中累积 | 配置数据应与功能启用状态对齐 |
| **脏数据** | status 值不在枚举范围内的记录 | status 字段只能是合法枚举值 |
| **数据不对称** | 聚合数据与明细不一致（订单总金额 ≠ 各商品金额之和） | 聚合值应与明细计算一致 |

### 3.3 数据生命周期检查

每个数据实体应有清晰的**生命周期定义**：

```
创建（谁、何时、何场景） → 活跃（被哪些模块引用） → 变更（变更历史） → 归档/删除（清理策略）
```

### 3.4 常见死数据场景（luban 全栈）

| 场景 | 表现 | 检测方法 |
|------|------|---------|
| 配置功能关闭后旧数据残留 | 功能关闭后相关表仍有新数据 | 对比 feature flag + 关联表最新记录时间 |
| 租户删除后关联数据未清理 | 租户已删但订单/商品表仍有该 tenant_id | 全表 scan tenant_id 分布 |
| 软删除记录被 JOIN 命中 | 列表页出现已删除数据 | 检查所有 JOIN 是否带 `deleted=0` |
| 定时任务失败导致状态卡住 | 订单/任务卡在 PROCESSING 超时 | 查找状态 + 时间超过阈值的记录 |
| 级联删除缺失 | 删主表后子表成孤立数据 | 外键关联的反向查询 |
| 缓存与 DB 不一致 | 数据已更新但旧版本仍在缓存 | 更新后立即查询对比 |
| 枚举扩展后旧数据未迁移 | 新增 status 枚举后旧数据未归一化 | 枚举值不在合法集合中的数据 |

### 3.5 逻辑矛盾检测

测试中发现以下情况即视为**逻辑缺陷（bug）**：

| 缺陷类型 | 表现形式 | 严重程度 |
|---------|---------|---------|
| **数据自相矛盾** | 状态"已支付"但金额为 0 | 🔴 阻断 |
| **权限越级** | 普通用户能操作管理员功能 | 🔴 阻断 |
| **数据泄露** | 租户 A 用户能看到租户 B 的数据 | 🔴 阻断 |
| **时序错乱** | 创建时间 > 更新时间、退款时间 < 下单时间 | 🔴 阻断 |
| **统计不一致** | 列表总数与详情聚合数不一致 | 🟡 强烈建议 |
| **默认值错误** | 新建记录默认状态是"已删除"或"已完成" | 🟡 强烈建议 |
| **数值越界** | 价格负数、数量超库存 | 🔴 阻断 |
| **文案误导** | 按钮文字与实际行为不符（"删除"实际是下线） | 🟡 强烈建议 |

---

## 🔴 4. 黄金法则：所有操作必须通过页面 UI 点击

手工 E2E 测试最核心的纪律。

**必须通过真实页面操作**：点击按钮/链接/输入框；等待加载/渲染/响应；断言 DOM 内容变化。

**禁止以下捷径**：
- 直接调用 API 代替页面操作（如 `request.post()` 创建数据而非通过表单提交）
- 传参注入绕过页面流程（如直接导航到中间步骤）
- 直接改数据库状态代替 UI 操作
- 用 `page.evaluate()` 调用内部函数或修改应用状态

### 例外（需明确标记理由）

仅以下场景可绕过 UI：
- **基础设施准备**：创建测试用户、店铺、商品等前置数据（`beforeAll` / `setup` 阶段）
- **无法通过 UI 完成的系统操作**：如外部支付回调模拟
- 例外必须在代码注释中说明原因

### 判断标准

> 如果一个手工测试人员无法通过点击页面完成这个操作，那么 E2E 测试也不应该这样做。

---

## 🔴 4A. 用户旅程优先：API 验证 ≠ E2E 测试

**这是黄金法则（§4）的推论，独立成节是因为这是 agent 最容易犯的错误。**

### 4A.1 分层汇报，禁止混为一谈

| 层级 | 手段 | 验证什么 | 通过标准 |
|------|------|---------|---------|
| **API 验证** | curl / page.request | 接口返回 200、字段结构正确 | 接口契约合规 |
| **UI 渲染** | Playwright page.goto | 页面加载无白屏、元素可见 | DOM 渲染正确 |
| **E2E 用户旅程** | Playwright 点击/输入/断言 | 用户能完成一个完整操作闭环 | UI 操作 + 数据持久化 + 可逆性 |

**红线**：不能因为"API 返回 200"就在测试报告里标记该模块 E2E ✅。API 200 只能标记"API 验证 ✅"。

### 4A.2 用户旅程定义（测试前必做）

每测一个模块前，必须列出至少一条**用户旅程**，而不是 API 列表。

```
❌ 错误（API 视角）：
  - GET /backend/api/points/accounts
  - GET /backend/api/points/ledger

✅ 正确（用户视角）：
  - 用户打开积分页面 → 看到积分余额
  - 运营开启积分配置 → C 端刷新 → 配置生效
  - 用户下单 → 勾选积分抵扣 → 支付 → 积分扣减
```

**测试前先列用户旅程，不列 API 端点。** 列不出来说明对功能理解不够，先去读 PRD/原型。

### 4A.3 每个模块完成前的自检三问

1. **用户在这个页面上能点哪里？** 是否每个可交互元素都被实际操作了？（§2.1）
2. **点了之后发生了什么？** UI 反馈、数据持久化、可逆性三件事都断言了吗？（§2.4）
3. **API 通了但用户能完成旅程吗？** 如果只测了 API，标记为"API 验证 ✅"而非"模块测试 ✅"

### 4A.4 审核清单

报告输出前对照：
- [ ] 是否每条 API 验证都单独标记了"API"而非"E2E"？
- [ ] 是否至少有一条用户旅程是通过 UI 操作完成的？
- [ ] 每个 UI 操作后都有断言（UI 反馈 + 数据持久化 + 可逆性）？
- [ ] 如果没有 UI 操作就交付了，原因是否明确标注？

---

## 🔴 5. 后端编译与启动验证（luban）

修改 Java 源码后，class 文件可能未更新：

```bash
# ❌ 不要只用 mvn compile（可能跳过已编译类）
# ✅ 必须用 clean compile
cd packages/backend/luban-backend
mvn clean compile

# 验证 class 文件时间戳已更新
ls -la target/classes/com/luban/backend/.../SomeClass.class

# 启动（default profile，无 -Dspring-boot.run.profiles）
make dev-java
# 或：mvn -q spring-boot:run

# 测试编译失败时用 -Dmaven.test.skip=true
```

> luban **无 `application-local.yml`**（与某些项目不同）。本地开发用 `default` profile（`application.yml`）。测试 IT 用 `application-test.yml`（`mvn verify` Failsafe）。中间件（MySQL `192.168.100.248:13306` / Redis `:16379`）在远端内网，需在内网/VPN 环境运行；本机禁起 docker（`.agents/rules/luban-no-local-docker.md`）。

> ⚠️ **常见启动失败排查**：① `mvn spring-boot:run` 报 `cannot find symbol` 但代码看似正常 → 多为陈旧 `target/` 缓存，`mvn clean compile` 即可（见 §0.5.3）；② HikariPool 连接超时 → 中间件网络不可达，确认是否在内网。

---

## 🔴 6. CORS / Filter 链排障（通用套路）

当浏览器报告 CORS 阻塞时，**不要只检查 CORS 配置**——排查所有 Filter / 拦截器链。

```
OPTIONS 预检请求不携带任何自定义 header（Authorization、X-Tenant-Id 等）
  → 任何在 Filter 链中检查这些 header 或上下文的 Filter 都会拒绝 OPTIONS
  → 返回非 2xx 且不含 CORS header，浏览器报 CORS 错误
```

### 排查步骤

1. `curl -X OPTIONS -v <url>` 测试，检查响应状态码和 body
2. **通过 error code / message 定位是哪个 Filter** —— 各 Filter 的 `writeJson()` 输出不同 error code；grep `error code` 字符串找到对应 Filter
3. 在定位到的 Filter 顶部加 OPTIONS 放行：
   ```java
   if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
       filterChain.doFilter(request, response);
       return;
   }
   ```
4. **所有拦截自定义 header 的 Filter 都需同等 OPTIONS 放行**

> luban 目前**无自定义 Filter**（确认：grep `OncePerRequestFilter`/`@WebFilter`/`HandlerInterceptor` 在 `packages/backend/luban-backend/src/main` 为空）。本节为未来引入 Filter 时的通用排障套路，避免重复踩 OPTIONS 拦截坑。

---

## 🔴 7. 异步未 await 竞态陷阱

前端代码中常见 `void asyncFunc()` 模式——调用异步函数但不等待其完成：

```typescript
// 前端代码：调用但不 await
const toggleGoods = (g: Goods) => {
  selectedGoods.value = selectedGoods.value?.id === g.id ? undefined : g;
  void toggleExpandSku(g);  // ⚠️ Promise 被丢弃，不 await
};

// goNext 依赖 toggleExpandSku 的结果
const goNext = async () => {
  const items = goodsSkuMap.value[selectedGoods.value.id]; // 可能还是 undefined
};
```

**测试对策**：
- 点击触发 `void asyncFunc()` 后，**不能立即执行下一步**
- 加 `waitForTimeout(2000)` 给异步操作完成时间，或等待特定 DOM 元素出现（如 SKU 列表渲染完成）
- 与之对比：有些页面 `await loadAsyncFunc()`（同步等待），不需要额外延时

**规则**：读源码确认是 `void fn()` 还是 `await fn()`，前者必须加等待。

---

## 🔴 8. Playwright 定位策略优先级

1. **`data-e2e` / `data-testid` 属性** —— 最可靠，前端需提前埋点（luban engine 物料推荐此方案）
2. **`getByRole("button", { name: "精确文字" })`** —— Element Plus 按钮、对话框确认
3. **`getByText("text", { exact: true })`** —— 按钮、链接（始终加 `{ exact: true }` 避免模糊匹配）
4. **`.filter({ hasText: "text" })`** —— 列表/卡片项，按文本内容筛选
5. **CSS class 选择器** —— 仅当以上不可用时

> 通用 Page Object Model / config / flaky 治理见 `.agents/skills/e2e-testing/SKILL.md`，本节不重复。

---

## 🔴 9. 测试数据自包含

E2E 测试应在 `test` / `beforeAll` 中创建全部所需数据库记录，**不依赖任何预存数据**。

### 规则

- 使用 `INSERT IGNORE` 而非 `INSERT`，避免重复运行时主键冲突
- 使用 `Date.now().toString(36)` 生成唯一测试标识（标题、用户名等）
- 显式提供所有时间戳字段——部分表 `create_time` / `update_time` 无默认值
- 清理：`afterEach` / `afterAll` 中删除测试数据

```sql
INSERT IGNORE INTO some_table (id, tenant_id, name, create_time, update_time)
VALUES (2001, 'tenant_id', 'E2E·测试数据', 1748000000, 1748000000);
```

### ID 类型匹配注意事项

- 主键 `bigint` 与 `VARCHAR` 外键之间的类型转换（如某些 API 内部做 `Long.parseLong(id.trim())`）
- 使用已知区间的高位数值（如 2001、2002），避免与生产/开发数据冲突

---

## 🔴 10. 调试排查顺序

测试失败时按此顺序排查（与 `docs/E2E_AGENT_GUIDE.md` §3 一致）：

1. **截图** —— `page.screenshot({ path: "debug.png" })`
2. **页面文本** —— `page.locator("body").innerText()`
3. **Console 错误** —— `page.context().on("pageerror", (err) => console.log(err))`
4. **Network** —— `curl -v <url>` 直接测试 API
5. **对比 error code** —— 检查响应 body 中的 error code，定位拦截点
6. **后端日志** —— 用 requestId 对齐请求：`packages/backend/luban-backend/logs/luban-local.log`
7. **编译状态** —— 确认 class 文件包含最新改动（`ls -la` 看时间戳）

---

## 🔴 11. Playwright 超时约定

| 场景 | 超时 | 说明 |
|------|------|------|
| 页面导航 | 15-20s | `goto()` 等待 `networkidle` |
| 元素可见 | 5-10s | `toBeVisible()` 断言 |
| API 响应 | 10-15s | `waitForResponse()` |
| 异步加载 | 1-3s | 仅当无法等待确切条件时用 `waitForTimeout` 作 fallback |

**优先使用具体条件等待，而不是 `waitForTimeout`**。仅在 JS 异步调用未 `await`（§7）时使用短时 fallback。

---

## 🔴 12. 缺陷定级与测试报告

### 12.1 缺陷严重程度定义

| 级别 | 定义 | 响应时间 | 示例 |
|------|------|---------|------|
| **P0 🔴 阻塞** | 核心功能不可用、用户完全无法完成任务 | 立即修复 | 页面白屏、引擎渲染崩溃、登录失败 |
| **P1 🟠 严重** | 主要功能异常、有绕行方案但影响体验 | 24h 内 | 数据不一致、权限错乱、操作无响应 |
| **P2 🟡 一般** | 次要功能异常、绕行方案简单 | 下一迭代 | 文案错误、样式异常、非主流路径错误 |
| **P3 🔵 建议** | 体验优化、非功能性问题 | 排期 | 交互不够流畅、提示不明确 |

### 12.2 测试报告输出格式

每次手工测试完成后，必须输出标准格式报告：

```markdown
# 手工测试报告 — {模块名}
- 测试时间: {yyyy-mm-dd}
- 测试人员: Agent
- 测试范围: {哪些功能/页面}
- 测试类型: [核心路径] / [全量]

## 测试结果
- 冒烟阶段: ✅ / ❌
- 深度阶段: ✅ / ❌
- 边界阶段: ✅ / ❌
- 总用例数: {n}
- 通过: {n}
- 失败: {n}
- 跳过(已知问题): {n}

## 缺陷清单
| ID | 级别 | 模块 | 描述 | 状态 |
|----|------|------|------|------|
| 1 | P1 | 商品列表 | 搜索后分页未重置为第1页 | 新建 |

## 死数据发现
| 表名 | 问题类型 | 影响 | 建议 |
|------|---------|------|------|
| tenant_policy | 悬挂状态 | 3条PROCESSING超30分钟 | 检查定时任务 |

## 未覆盖功能
| 功能 | 原因 | 建议 |
|------|------|------|
| 批量删除 | 无UI入口 | 确认设计是否已完成 |
```

### 12.3 缺陷流转

1. 每轮测试结束后输出缺陷清单
2. P0/P1 缺陷必须立即同步给用户
3. 所有缺陷记录到测试报告
4. 下次测试前先验证上次缺陷是否修复

---

## 🔴 13. 手测→自动化转换路径

### 13.1 转换决策树

```
这个操作是否频繁回归？
  ├─ 是 → 是否已有 E2E 覆盖？
  │     ├─ 是 → 检查 E2E 是否覆盖了这次发现的场景
  │     │     ├─ 已覆盖 → 更新断言使之能捕获该问题
  │     │     └─ 未覆盖 → 在现有 spec 中追加测试
  │     └─ 否 → 是否需要 UI 交互？
  │           ├─ 是（点击/输入/导航）→ 创建 Playwright E2E
  │           └─ 否（纯 API 验证）→ 创建 Vitest / Jest 单元测试
  └─ 否 → 保持手工测试，标记为 [MANUAL]
        └─ 每季度评审一次，决定是否自动化
```

### 13.2 转换优先级

| 优先级 | 适合自动化的场景 | 例子 |
|--------|----------------|------|
| **P0** | P0 核心流程、每次发版必测 | 登录、下单、引擎渲染 |
| **P1** | 高频回归、多组合参数 | 搜索筛选、列表排序、状态流转 |
| **P2** | 数据验证、死数据检测 | 孤立记录检查、聚合一致性 |
| **P3** | 低频操作、一次性验证 | 配置变更、系统设置 |

### 13.3 标准路径

```
手测发现 BUG → 输出缺陷报告 → 开发修复
  → 手测验证修复 → 将修复验证步骤转为 Playwright E2E
    → 运行覆盖率门禁（make journey-coverage）确认通过
```

> 自动化 E2E 的执行纪律（禁假绿、禁降级、会话内冻结）见 `.agents/rules/luban-e2e-execution-contract.md`，本 skill 不重复。

---

## 🔴 14. 测试历史与上下文传递

### 14.1 历史记录格式

每次手工测试结束时，在**项目根 `.agent-hand-testing/`** 下创建测试记录：

```markdown
# {yyyy-mm-dd} {模块名}
- 测试类型: [核心路径] / [全量]
- 测试结果: [通过] / [有条件通过] / [阻塞]
- 发现问题: {n} 个 (P0: {n}, P1: {n}, P2: {n})
- 遗留已知问题: {n} 个
- 测试时间: {n} 分钟

## 与上次测试的差异
- 新增覆盖: {功能列表}
- 修复验证: {BUG ID 列表}
- 新增已知问题: {BUG ID 列表}
```

### 14.2 回归基线

- 上次全量测试的结果作为本次回归的**对照基线**
- 本次测试重点：上次未覆盖的部分 + 修复的部分
- 如果连续 3 次回归无新增缺陷，该模块降级为"按需测试"

---

## 附录：迁移说明

本 skill 从 kangdou-fullstack 项目的 `agent-hand-testing`（全局 `~/.agents/skills/agent-hand-testing/SKILL.md`）迁移而来，做了以下 luban 适配：

| kangdou 原文 | luban 版改为 |
|---|---|
| `H5 Playwright → 运营后台 → 微信小程序 automator` 三层 | **web → SSR → engine → client** 四层（引用 `docs/E2E_AGENT_GUIDE.md`） |
| 后端 health `http://127.0.0.1:8080/actuator/health` | `http://localhost:8080/backend/ping`（luban 未引入 actuator，PingController 提供健康端点） |
| `local` profile + `DevAuthController` + mock-login API | **default profile**（luban 无 application-local.yml） |
| `192.168.100.67` 内网 IP + 具体口令 | 删除；改为 `.env` / `application.yml` 为 SSOT |
| `TenantMiniAppMerchantAuthFilter` 等具体类名 | 通用套路（luban 目前无自定义 Filter） |
| uni-app H5 DOM（`<uni-input>` 包裹） | Vue3 + Element Plus 怪癖（引用 `docs/E2E_AGENT_GUIDE.md`） |
| `KD_MINIAPP_SESSION` storage key + `t_eb78751bae84` 租户 | 删除；引用 `e2e-testing/SKILL.md` 的 auth.setup storageState |
| `operation-backend pnpm run test:e2e` | luban 的 `make e2e-cross` + 各包 playwright.config.ts |
| kd-review 关联 | 改引用 `.agents/commands/luban-review.md` + `.agents/commands/engine-e2e.md` |

**所有通用精华（角色预设 / 元素穷尽清单 / CRUD 闭环 / 死数据检测 / 用户旅程优先 / API≠E2E / 缺陷定级 / curl 冒烟 / 异步竞态 / 定位策略 / 报告格式）原样保留**，因为这些是与具体技术栈无关的测试 craft。

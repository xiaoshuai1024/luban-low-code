# 修复剩余 lead/website 问题（website SSR 404 + merge 合并）

> taskGraph: `docs/superpowers/tasks/residual-lead-website.json`（5 tasks）
> 工作流：/plan-template（Superpowers）；本文为定稿，实现阶段建议新会话 `/jx` 续跑。
> 已加载契约：PLAN_WRITING_CONTRACT §0-9、luban-e2e-execution-contract、AGENT_WORKFLOW_CONSTRAINTS。

## §0 范围 + 不涉及

**本期范围**：修复 hand-testing 发现的 2 个剩余问题，使 e2e ssr-deep(SSR3/4/5) + lead-variants(LV4 merge) 转绿。

**明确不做（防膨胀）**：
- 不重构 website routing（仅 usePageByPath 路径 1 行）
- 不改 nuxt `app.baseURL`（项目主页子路径，有意）
- 不实现其他 dedup 策略（MARK/OVERWRITE，仅 MERGE）
- Go 后端不实现（已废弃，单 Java 权威）
- 不加 FeatureGate（缺陷修复 + 功能补齐，用户确认无需开关）
- 不动已归档的 5 个 openspec change + change A/B(formId/createError 已 apply)

## §1 背景

- **问题1 website SSR 404**（e2e ssr-deep SSR3/4 fail）：
  - nuxt.config production `app.baseURL=/luban-low-code/`（项目主页子路径，有意）→ e2e `WEBSITE_BASE` 不含 basePath 必 302
  - `usePageByPath` 调 BFF `/api/public/sites/:slug/pages/by-path?path=`，但后端 `PublicController` 是 `/public/sites/:slug/pages?path=`（路径不一致，by-path 段多余）→ usePageByPath 不触发 error
  - `DynamicPage` createError 404 已 apply（openspec change B），但因 usePageByPath 路径错未生效
- **问题2 merge 留资重复提交 500**（功能 gap）：
  - `DedupService.decide(MERGE)→ACCEPT`，但 `LeadService.submit` 仍 insert → `leads.uk_form_dedup (form_id, dedup_hash)` 唯一约束冲突 500
  - merge 语义应 update 合并现有 lead 的 contact（非 insert）

## §4 页面结构

**无前端页面新增**（纯 API/路径修复 + 后端 merge 逻辑）。
- website DynamicPage 渲染逻辑不变，仅 usePageByPath 端点路径修正 + createError 404（已 apply）。
- 无新增物料/路由/表单。

## §6 实现（T1-T4）

### T1: usePageByPath 端点路径对齐（website）
- 文件：`apps/website/composables/usePageByPath.ts`
- 改：`${bffBase}/api/public/sites/${slug}/pages/by-path?path=` → `${bffBase}/api/public/sites/${slug}/pages?path=`
- 验证门：`curl BFF /api/public/sites/default/pages?path=/` 返回 page 或 404（非 404 by-path 路由错）

### T2: e2e WEBSITE_BASE 加 basePath（e2e）
- 文件：`e2e/.env`（测试环境实例）
- 改：`LUBAN_E2E_WEBSITE_URL=http://192.168.100.248:3001/luban-low-code`
- 验证门：e2e ssr-deep 不再 302（访问 /luban-low-code/{slug}/{path}）

### T3: createError 404 production 生效验证（website，依赖 T1）
- 文件：`apps/website/views/DynamicPage.vue`（createError 已 apply，change B）
- T1 修后 usePageByPath error（page 不存在）触发 → DynamicPage watch error → createError({statusCode:404, fatal:true})
- 验证门：`curl /luban-low-code/{不存在 slug}/{path}` → 404；e2e ssr-deep SSR3/4 转绿

### T4: LeadService merge → update 合并（backend-java）
- 文件：`apps/backend-java/.../service/LeadService.java`、`mapper/LeadMapper.java`
- LeadService.submit：`existsInWindow && policy==MERGE` 分支 → 查现有 lead（formId+dedupHash）→ 解密 contact_json + 合并新 contact 字段 → updateContactByDedup（乐观锁：WHERE updated_at = 原值，影响 0 行则重试/返回当前态）
- LeadMapper 新增 `updateContactByDedup(formId, hash, contactJson, updatedAt)`：`UPDATE leads SET contact_json=?, updated_at=? WHERE form_id=? AND dedup_hash=? AND updated_at=?`
- merge 合并语义：新 contact 字段覆盖旧同名字段，旧独有字段保留（深度合并）
- 验证门：`mvn -q test`（LeadServiceTest merge 用例）+ merge API r2 重复 < 300

## §7 E2E 用例

| 场景 | 前置 | 操作与断言 | 清理 |
|------|------|-----------|------|
| SSR3 不存在路径 404 | website rebuild（T1+T3） | `GET /luban-low-code/{slug}/__non_existent__` → 404 | 无 |
| SSR4 不存在 slug 404 | 同上 | `GET /luban-low-code/__no_slug__/any` → 404 | 无 |
| SSR5 公开页 by-path | T1 + 发布页 | `GET BFF /api/public/sites/{slug}/pages?path=` → 200 published（注：e2e 原用 by-path，需同步改 e2e spec 或 T1 后端 alias） | 删 site |
| LV4 merge 合并 | T4 + merge form | r1 提交 → r2 重复（merge）→ r2 < 300，contact 合并 | 删 site |

**注**：SSR5 e2e 原用 `/pages/by-path`，T1 改 usePageByPath 后，e2e ssr-deep SSR5 也需改 `/pages?path=`（或 BFF 加 by-path alias 兼容）。实现时确认 e2e spec。

## §8 验收门禁（分级）

| 级别 | 验证 | 通过条件 |
|------|------|---------|
| 1 代码审查 | `/luban-review` 全自动 | 🔴🟡🔵 清零 |
| 2 编译+单测 | website: `pnpm --filter apps/website build`；backend: `mvn -q test -Dtest=LeadServiceTest`（Java17） | 0 fail |
| 3 部署+e2e | 测试机 rebuild website+backend + e2e ssr-deep + lead-variants | SSR3/4 + LV4 转绿 |
| 4 安全 | merge update 乐观锁（并发安全）；SSR 404 不泄露内部 | 无数据竞争/泄露 |

## 声明

- **双后端**：Go 已废弃（单 Java 权威），本轮不涉及 Go parity。
- **多端渲染**：无物料/引擎变更，多端渲染一致（不涉及）。
- **FeatureGate**：用户确认无需开关（缺陷修复 + 功能补齐）。
- **乐观锁**：merge update 用 `updated_at` 乐观锁，并发重复提交安全（影响 0 行返回当前态，不抛 500）。
- **敏感字段**：contact_json 加密（LeadCryptoService），merge 合并后重新加密；脱敏规则不变（phone 138****）。

## §9 文件映射 + 派发（简版，主 agent 直列；token 所限未派 subagent）

| Task | 文件 | 新建/修改 | 摘要 |
|------|------|----------|------|
| T1 | `apps/website/composables/usePageByPath.ts` | 修改 | `/pages/by-path?path=` → `/pages?path=` |
| T2 | `e2e/.env` | 修改 | WEBSITE_URL 加 `/luban-low-code` |
| T3 | `apps/website/views/DynamicPage.vue` | 已 apply | createError 404（change B，T1 后验证） |
| T4 | `apps/backend-java/.../service/LeadService.java` | 修改 | merge 分支 update 合并（乐观锁） |
| T4 | `apps/backend-java/.../mapper/LeadMapper.java` | 修改 | +updateContactByDedup |
| T4 | `apps/backend-java/.../service/LeadServiceTest.java` | 修改 | +merge 用例 |
| T5 | （验证） | — | website+backend rebuild + e2e |

**并行派发**：T1/T2（website+e2e，无依赖）并行；T4（backend，无依赖）并行；T3 依赖 T1；T5 依赖全部。3 条线可并行（website / e2e-config / backend）。

## Post-Development Workflow

代码提交 → `/luban-review` 清零 → website `pnpm build` + backend `mvn test`（Java17）→ 测试机 rebuild website+backend → 询问用户后 e2e(ssr-deep + lead-variants)→ 全绿 → 完成汇报。
**实现会话须一次推进至验证全绿后收口**（禁主路径收口即完成）。

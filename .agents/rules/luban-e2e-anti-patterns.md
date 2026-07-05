---
description: luban E2E 常见反模式与修复（Playwright hover-show 按钮 / vite watch 死循环 / DDD 事件字段遗漏 / BFF 路由缺失）
globs: packages/engine/luban/e2e/**,packages/bff/luban-bff/src/app/api/**,packages/backend/luban-backend/src/main/java/**/eventhandler/**,packages/engine/luban/vite.config.ts
alwaysApply: false
---

# luban E2E 常见反模式与修复

记录在 /hand-testing 多轮 E2E 中反复出现的反模式，写新 spec / 改既有代码前对照检查。

## 1. Playwright hover-show 按钮：必须先 hover 触发显示

**反模式**：直接 `await page.locator('button[title*="克隆"]').click()` —— 60s 超时 element not visible。

**根因**：UI 组件常用 CSS `display:none` + `:hover { display:flex }` 节省视觉空间（如 OutlineTree 的 actions 按钮 `.lb-outline-node__actions`，MaterialCard 的快捷操作）。Playwright `click()` 自动等 visible，但 hover-show 按钮需先触发父级 hover。

**修复**：
```ts
const row = page.locator('.lb-outline-node__row').first();
await row.hover();                         // 先触发父级 hover
const btn = page.locator('button[title*="克隆"]').first();
await expect(btn).toBeVisible({ timeout: 5000 });  // 显式断言已显示
await btn.click();
```

**适用场景**：任何 CSS 控制 `:hover` 显示的按钮（grep `:hover` + `display` 在 .vue 文件可定位）。

---

## 2. vite watch 死循环：测试产物触发 reload

**反模式**：vite dev 默认 watch 整个项目目录，E2E 跑生成 `test-results/` / `playwright-report/` → vite reload → 触发更多 reload → 占满 CPU。

**根因**：vite 默认 `server.watch.ignored` 只排除 `node_modules`，不排除测试产物。

**修复**（`vite.config.ts`）：
```ts
server: {
  watch: {
    ignored: [
      '**/test-results/**',
      '**/playwright-report/**',
      '**/e2e/.auth/**',
      '**/node_modules/**',
    ],
  },
}
```

---

## 3. vite host 默认绑 IPv6：Playwright 用 IPv4 拒绝

**反模式**：vite 6+ 默认监听 `::1`（IPv6 localhost），不监听 `127.0.0.1`（IPv4）。`curl localhost` ✅ 但 `curl 127.0.0.1` ❌，Playwright baseURL 用 `127.0.0.1` 直接 `ERR_CONNECTION_REFUSED`。

**修复**（`vite.config.ts`）：
```ts
server: {
  host: '127.0.0.1',   // 显式绑 IPv4，与 playwright.config.ts baseURL 对齐
}
```

---

## 4. DDD 事件字段遗漏：聚合根方法签名收参但不用

**反模式**：`Aggregate.install(... int version)` 收 version 参数，但创建 Event 时**不传 version**。Handler 消费 event 时取不到 version → 写 audit 表 NULL → DB NOT NULL 约束违反 → 整个 `REQUIRES_NEW` 事务回滚 → **业务上 page 创建被静默吞掉**（主事务已提交）。

**症状**：API 同步响应 200/201（主事务成功），但异步副作用（建 page）从未发生。日志在 ERROR 级别才有记录（如果你日志了）。

**根因**：DDD 重构把"直接调用"改为"事件解耦"时，聚合根方法签名沿用旧参数列表，但 Event record 漏字段，handler 也漏 setter。

**修复 checklist**（DDD 重构引入事件时 MUST）：
- [ ] Event record 字段 = 聚合根方法的所有参数 + occurredAt
- [ ] 聚合根创建 Event 时**逐参数对照**，不能少
- [ ] Handler 消费 Event 时**逐字段写入** Entity/Repository
- [ ] 单测断言 Event → Entity 的**全部字段透传**（不只是 id/name）

**反例（已修）**：`TemplateInstalledEvent` 漏 `version` 字段（BUG-H，2026-07-05），单测 `TemplateInstallHandlerTest` 存在但只断言了 templateId/siteId/pageId，没断言 version → 测试通过但生产阻断。

---

## 5. BFF 路由缺失：后端有但 BFF 没代理

**反模式**：后端 Controller 实现了端点（如 `POST /templates/{id}/publish`），但 BFF `src/app/api/templates/[id]/` 目录下没有对应 `publish/route.ts`。前端调 BFF → Next.js 404 fallback 到默认页 → 看似"接口 404"实则是路由缺失。

**根因**：BFF 是手写代理，每个端点都需要单独建 route 文件。后端加端点时容易忘 BFF 同步。

**修复 checklist**（后端新增 `@*Mapping` 时 MUST）：
- [ ] 检查 BFF `src/app/api/<resource>/` 下是否有对应 route 文件
- [ ] 没有 → 按 install/route.ts 同模式新建（纯代理 + authHeaders + callBackend）
- [ ] 跑契约测试 `bulk-routes.spec.ts` 确认 BFF 全路由对齐后端

**反例（已修）**：BFF 缺 `templates/[id]/publish/route.ts`（BUG-G，2026-07-05）。

---

## 6. E2E 端口默认值：必须对齐 Makefile dev-* target

**反模式**：spec / helpers.ts 里硬编码端口默认值，多人多文件各写各的（helpers=3000, ai.spec=3100, leads.spec=3100），跑时一半失败。

**根因**：BFF 实际跑 :3100（Makefile dev-bff 显式指定），但早期代码默认 3000（Next.js 默认），重构后未同步。

**修复**（已完成）：
- helpers.ts `BFF_BASE` / `BACKEND_BASE` 默认值对齐 Makefile（3100/8080）
- env 名统一为 `LUBAN_E2E_BFF_URL` / `LUBAN_E2E_BACKEND_URL`
- 其它 spec 复用 helpers，禁止内联默认值

---

## 检查时机

- 写新 E2E spec 前：扫描上面 6 条，确认 spec 不会触发已知反模式
- 改聚合根 / 事件 / Handler 时：跑 §4 checklist
- 后端加端点时：跑 §5 checklist
- 启动 engine 5173 时：确认 vite.config.ts 已配 §2 + §3

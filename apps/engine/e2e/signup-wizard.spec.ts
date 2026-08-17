import { test, expect, request } from '@playwright/test';

/**
 * 注册开通向导（UI 全链）@J-signup-onboarding（plan §7.3 engine UI E2E）
 *
 * /register 两步表单 → OTP 激活自动登录 → /onboarding 三步向导
 *   （选套餐 0 元开通 → 建首站 → 模板建首页）→ 落 /designer/sites/:sid/pages/:pid
 *   且设计器主体渲染、全链零新增 console error（引擎交付门槛，CLAUDE.md 硬约束 2）。
 *
 * 全新用户流：不使用 storageState（先例 login.spec.ts 的「无 token 上下文」），
 * 显式 test.use({ storageState: undefined }) 隔离预置登录态（已登录访问 /register 会被
 * 路由守卫重定向 /dashboard）。
 *
 * devCode 通道：page.waitForResponse 监听 POST /api/auth/register 响应体（MAIL_DEV_ECHO=true
 * 的 e2e 环境才回显；缺失即 throw 明确报错，禁 skip）。resend 不在本用例触发（60s 冷却期内
 * 不可重发），devCode 以 register 响应为唯一来源。
 *
 * 选择器：优先 data-testid（SiteForm 提供 site-name/site-slug）；Register/PlanPicker/
 * TemplateSelect 无 testid → 用可读角色/文案/aria-label 选择器（OTP 格 aria-label=
 * 「验证码第 N 位」）。不改 engine 源码补 testid（W5 只交付 spec）。
 *
 * 清理：站点经 engine 同源 /api 代理用注册用户 token 删站（afterAll best-effort）；
 * 用户行由 e2e 环境重置/SQL 清理（plan §9.0 裁定 #6），本 spec 不做。
 */

// 全新用户流：禁用预置 storageState（等价 login.spec.ts 的 storageState: undefined 上下文）
test.use({ storageState: undefined });

let authToken = '';
let createdSiteSlug = '';

test.afterAll(async () => {
  // 站点清理：经 engine 同源 /api 代理（vite proxy → BFF）用注册用户 token 删站，幂等 best-effort。
  // 用户行由 e2e 环境重置/SQL 清理（plan §9.0 裁定 #6：无 DELETE /users API），本 spec 不做。
  if (!authToken || !createdSiteSlug) return;
  const ctx = await request.newContext({
    baseURL: process.env.LUBAN_E2E_BASE_URL ?? 'http://127.0.0.1:4200',
  });
  try {
    const res = await ctx.get('/api/sites', { headers: { Authorization: `Bearer ${authToken}` } });
    const sites = (await res.json().catch(() => [])) as Array<{ id?: string; slug?: string }>;
    const own = sites.find((s) => s.slug === createdSiteSlug);
    if (own?.id) {
      await ctx
        .delete(`/api/sites/${own.id}`, { headers: { Authorization: `Bearer ${authToken}` } })
        .catch(() => {});
    }
  } finally {
    await ctx.dispose().catch(() => {});
  }
});

test.describe('注册开通向导 @J-signup-onboarding', () => {
  // 单条完整旅程（注册→OTP→0元开通→建站→模板→设计器），超全局 60s（多步向导含 1.5s 成功反馈 + slug 防抖）
  test(
    '注册 → 验证码激活 → 0 元开通 → 建站 → 模板首页 → 进设计器（零新增 console error）',
    { timeout: 120_000 },
    async ({ page }) => {
      // 引擎交付门槛：全链路收集 error 级输出（console.error + 页面未捕获异常）
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
      });
      page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

      const RUN_ID = `e2e-wiz-${Date.now()}`;
      const username = RUN_ID; // e2e-wiz-<ts> 满足 [a-z0-9_-]{3,32}
      const email = `${RUN_ID}@e2e.luban.test`;
      const password = 'E2eWizard123'; // ≥8 位且含字母+数字
      const siteName = `${RUN_ID} site`;
      createdSiteSlug = `${RUN_ID}-site`;

      // ===== Step1：注册表单（Placeholder 选择器，Register.vue 无 testid）=====
      const registerRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/register'
      );
      await page.goto('/register');
      await expect(page.getByText('创建账号')).toBeVisible();
      await page.getByPlaceholder('3-32 位小写字母、数字、下划线或短横线').fill(username);
      await page.getByPlaceholder('用于接收验证码，如 name@example.com').fill(email);
      await page.getByPlaceholder('至少 8 位，且同时包含字母和数字').fill(password);
      await page.getByPlaceholder('再次输入密码').fill(password);
      await page.getByRole('button', { name: /注\s*册/ }).click();

      const registerResp = await registerRespPromise;
      expect(registerResp.status(), `注册须 201，实际 ${registerResp.status()}`).toBe(201);
      const registerBody = (await registerResp.json()) as { devCode?: string };
      if (!registerBody.devCode) {
        throw new Error(
          `[signup-wizard] register 响应缺少 devCode（MAIL_DEV_ECHO 通道未开）。` +
            'e2e 环境须为 backend-java 配置 MAIL_DEV_ECHO=true（docker-compose.e2e.yml，plan §7.2）；禁止 skip。'
        );
      }

      // ===== Step2：OTP 六格（aria-label「验证码第 N 位」）=====
      await expect(page.getByText(/验证码已发送至/)).toBeVisible();
      const digits = registerBody.devCode.split('');
      for (let i = 0; i < digits.length; i++) {
        await page.getByLabel(`验证码第 ${i + 1} 位`).fill(digits[i]!);
      }

      // 验证成功 → setToken → 跳 /onboarding（FeatureGate onboarding 默认 true）
      const verifyRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/register/verify'
      );
      const plansRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/billing/plans'
      );
      await page.getByRole('button', { name: '验证并登录' }).click();

      const verifyResp = await verifyRespPromise;
      expect(verifyResp.status(), `验证码激活须 200，实际 ${verifyResp.status()}`).toBe(200);
      authToken = ((await verifyResp.json()) as { token?: string }).token ?? '';
      expect(authToken, 'verify 须返回 token（自动登录）').toBeTruthy();

      await expect(page).toHaveURL(/\/onboarding/);

      const plansResp = await plansRespPromise;
      expect(plansResp.ok(), `向导套餐加载须 ok，实际 ${plansResp.status()}`).toBe(true);

      // ===== 向导 Step1：选套餐 → 0 元订单（PlanPicker 无 testid → 卡片角色+文案）=====
      await expect(page.getByRole('button', { name: /Starter/ })).toBeVisible();
      await page.getByRole('button', { name: /Starter/ }).click();
      await expect(page.getByRole('button', { name: /Starter/ })).toContainText('已选择');

      const orderRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/billing/orders'
      );
      await page.getByRole('button', { name: /立即开通/ }).click();
      const orderResp = await orderRespPromise;
      expect(orderResp.status(), `0 元下单须 200（自动支付成功），实际 ${orderResp.status()}`).toBe(200);

      // ElResult 支付成功反馈（1.5s 后自动进 Step2）
      await expect(page.getByText('支付成功 · 套餐已开通')).toBeVisible();

      // ===== 向导 Step2：建首站（SiteForm 提供 data-testid）=====
      await expect(page.getByTestId('site-name')).toBeVisible();
      await page.getByTestId('site-name').fill(siteName);
      await page.getByTestId('site-slug').fill(createdSiteSlug);
      // slug 防抖 500ms 预检 → 绿色「该地址可用」（等可用态再提交）
      await expect(page.getByText('该地址可用')).toBeVisible({ timeout: 15_000 });

      const siteRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/sites'
      );
      await page.getByRole('button', { name: '创建站点' }).click();
      const siteResp = await siteRespPromise;
      expect(siteResp.status(), `建站须 201，实际 ${siteResp.status()}`).toBe(201);

      // ===== 向导 Step3：选模板（TemplateSelect 无 testid → 卡片文案，选「空白页」模板）=====
      await expect(page.getByRole('button', { name: /空白页/ })).toBeVisible();
      await page.getByRole('button', { name: /空白页/ }).click();

      // 详情监听须在点击前装好（设计器挂载即拉页面详情，装晚了会错过响应）
      const pageRespPromise = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/api\/sites\/[^/]+\/pages$/.test(new URL(r.url()).pathname)
      );
      const detailRespPromise = page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' && /\/api\/sites\/[^/]+\/pages\/[^/]+$/.test(new URL(r.url()).pathname)
      );
      await page.getByRole('button', { name: '开始编辑' }).click();

      const pageResp = await pageRespPromise;
      expect(pageResp.status(), `模板建首页须 201，实际 ${pageResp.status()}`).toBe(201);

      // ===== 设计器落位 + 主体渲染 =====
      await expect(page).toHaveURL(/\/designer\/sites\/[^/]+\/pages\/[^/]+/, { timeout: 30_000 });
      const detailResp = await detailRespPromise;
      expect(detailResp.ok(), `设计器页面详情加载须 ok，实际 ${detailResp.status()}`).toBe(true);

      // 主体渲染：页面容器 + 物料面板 + 保存按钮（PageEditor 无 testid → 文案/结构选择器；
      // .page-editor 为页面根容器，CSS 仅作存在性锚点）
      await expect(page.locator('.page-editor')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('物料', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /保\s*存/ })).toBeVisible();

      // ===== 引擎交付门槛：零新增 console error =====
      expect(consoleErrors, `全链路出现 console error：\n${consoleErrors.join('\n')}`).toEqual([]);
    }
  );
});

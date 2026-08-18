import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * 用量上报与套餐超限拦截 @J-quota-enforcement
 *
 * 覆盖 QuotaService 拦截链路的可观测部分：
 *   1. billing plans 端点返回含 quota 字段（quota_leads/pages/visits）
 *   2. billing usage 端点返回当前用量结构（可用于进度条）
 *   3. subscribe 端点可切换套餐（quota 拦截的前提）
 *   4. 公开 lead submit 端点可达（拦截发生点）
 *
 * 注：完整"超额→429"需要 seed 一个 quota_leads=1 的 plan 并订阅，
 * 由 signup-billing-onboarding plan §7.3 S6 落地：e2e-tiny fixture
 * （E2EBillingPlanBootstrap 注入，hidden，quota_leads=1/quota_pages=1）
 * → 见本文件下方「quota 完整超限」describe（QE5/QE6）。
 */

const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT ?? 'admin';
const PASSWORD = process.env.LUBAN_E2E_PASSWORD ?? 'admin123';
const RUN_ID = `e2e-${Date.now()}`;

async function login(ctx: APIRequestContext): Promise<string> {
  const r = await ctx.post(`${BFF_BASE}/api/auth/login`, { data: { username: ACCOUNT, password: PASSWORD } });
  const body = await r.json();
  return body.token ?? body.accessToken ?? '';
}
function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

let apiCtx: APIRequestContext;
let token: string;
let siteId: string;
let pageId: string;
let formId: string;

test.beforeAll(async () => {
  apiCtx = await request.newContext();
  token = await login(apiCtx);
  const siteRes = await apiCtx.post(`${BFF_BASE}/api/sites`, {
    headers: authHeaders(token),
    data: { name: `${RUN_ID}-quota`, slug: `${RUN_ID}-quota`, status: 'active' },
  });
  siteId = (await siteRes.json()).id;
  const pageRes = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
    headers: authHeaders(token),
    data: { name: 'quota-page', path: `/q-${Date.now()}` },
  });
  pageId = (await pageRes.json()).id;
  const formRes = await apiCtx.post(`${BFF_BASE}/api/forms?siteId=${siteId}`, {
    headers: authHeaders(token),
    data: { siteId, pageId, name: 'quota-form', dedupPolicy: 'reject' },
  });
  formId = (await formRes.json()).id;
});

test.afterAll(async () => {
  if (siteId && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: authHeaders(token) }).catch(() => {});
  }
  await apiCtx?.dispose().catch(() => {});
});

test.describe('用量上报与套餐超限拦截 @J-quota-enforcement', () => {
  test('QE1: billing plans 返回套餐列表（含 quota 字段）', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/billing/plans`, { headers: authHeaders(token) });
    expect(r.status()).toBe(200);
    const plans = await r.json();
    expect(Array.isArray(plans)).toBe(true);
    // 若有 plan，每个含 planCode + quota_* 字段
    if (plans.length > 0) {
      const p = plans[0];
      expect(p.planCode || p.plan_code).toBeTruthy();
      // quota 字段存在（值可能 0=无限制）
      expect('quotaLeads' in p || 'quota_leads' in p).toBe(true);
    }
  });

  test('QE2: billing usage 返回当前用量结构', async () => {
    const r = await apiCtx.get(`${BFF_BASE}/api/billing/usage`, { headers: authHeaders(token) });
    expect(r.status()).toBeLessThan(300);
    const usage = await r.json();
    // 用量结构须是对象（非空）
    expect(typeof usage).toBe('object');
    expect(usage).not.toBeNull();
  });

  test('QE3: 公开 lead submit 端点可达（quota 拦截发生点）', async () => {
    // 提交一条线索（走公开端点，触发 QuotaService.checkAndIncrement）
    const r = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '配额测试', phone: `139${Date.now().toString().slice(-8)}` } },
    });
    // 成功 2xx 或被 quota 拦截 429 都是合法行为（取决于当前 plan quota）
    const status = r.status();
    expect(status < 300 || status === 429, `submit 应返回 2xx 或 429，实际 ${status}`).toBe(true);
  });

  test('QE4: 重复提交相同手机号被去重（dedup 与 quota 独立工作）', async () => {
    const phone = `138${Date.now().toString().slice(-8)}`;
    const r1 = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '去重测试', phone } },
    });
    expect(r1.status()).toBeLessThan(300);
    const r2 = await apiCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '去重测试', phone } },
    });
    // dedup 策略 reject → 409 LEAD_DUPLICATE（与 quota 拦截 429 区分）
    expect([409, 429].includes(r2.status()), `重复提交应被去重(409)或限流(429)，实际 ${r2.status()}`).toBe(true);
  });
});

// ---------- quota 完整超限（plan §7.3 S6，signup-billing-onboarding）----------
// 旅程标签：本文件已在上方 describe 绑定 @J-quota-enforcement，此处不重复。

/**
 * 完整超限链路：新注册用户 → 订阅 e2e-tiny（quota_leads=1 / quota_pages=1，hidden）
 *   → 建站 → 第 2 个页面 429 QUOTA_EXCEEDED(details.metric=pages)
 *   → 建表单提交 2 条 lead，第 2 条 429 QUOTA_EXCEEDED(details.metric=leads, details.limit=1)。
 *
 * e2e-tiny 由 backend-java E2EBillingPlanBootstrap 注入（env E2E_BILLING_BOOTSTRAP=true，
 * docker-compose.e2e.yml，plan 裁定 #5），status=hidden 不出现在 GET /billing/plans；
 * 订阅直接走 POST /billing/orders {planCode:'e2e-tiny'}——依据源码：
 *   - BillingController.plans()（BillingController.java L51-54）仅返回 planService.listVisible()
 *     → plans 端点 visible 过滤；
 *   - OrderService.createOrder（OrderService.java L48-52）用 planMapper.getByCode(planCode)
 *     仅校验套餐存在性，不过滤 status → hidden 的 e2e-tiny 可下单；
 *   - SubscriptionService.applyPlan（SubscriptionService.java L52-56）同口径（javadoc 明示
 *     「hidden 亦可订，e2e fixture 通道」）。
 */
let tinyCtx: APIRequestContext;
let tinyToken = '';
let tinySiteId = '';
let tinyPageId = '';

test.describe('quota 完整超限（e2e-tiny fixture） @J-quota-enforcement', () => {
  test.beforeAll(async () => {
    tinyCtx = await request.newContext();
    // 1) 新注册用户（devCode 经 MAIL_DEV_ECHO 通道；缺失即 throw，禁 skip）
    const username = `${RUN_ID}-tiny`;
    const email = `${RUN_ID}-tiny@e2e.luban.test`;
    const reg = await tinyCtx.post(`${BFF_BASE}/api/auth/register`, {
      data: { username, email, password: 'E2eQuota123' },
    });
    const regBody = (await reg.json().catch(() => null)) as { devCode?: string } | null;
    if (reg.status() !== 201 || !regBody?.devCode) {
      throw new Error(
        `[quota-e2e-tiny] 注册失败/缺 devCode（status=${reg.status()}，body=${JSON.stringify(regBody)}）。` +
          'e2e 环境须为 backend-java 开启 MAIL_DEV_ECHO=true（docker-compose.e2e.yml，plan §7.2）；禁止 skip。'
      );
    }
    const verify = await tinyCtx.post(`${BFF_BASE}/api/auth/register/verify`, {
      data: { email, code: regBody.devCode },
    });
    expect(verify.status(), `tiny 用户激活须 200，实际 ${verify.status()}`).toBe(200);
    tinyToken = ((await verify.json()) as { token?: string }).token ?? '';
    expect(tinyToken, 'tiny 用户须取得 token').toBeTruthy();

    // 2) 订阅 e2e-tiny（orders 校验不过滤 visible，见上方源码依据）
    const order = await tinyCtx.post(`${BFF_BASE}/api/billing/orders`, {
      headers: authHeaders(tinyToken),
      data: { planCode: 'e2e-tiny' },
    });
    expect(order.status(), `订阅 e2e-tiny 须 200，实际 ${order.status()}`).toBe(200);
    const orderBody = (await order.json()) as { subscription?: { planCode?: string } };
    expect(orderBody.subscription?.planCode, '订阅档须为 e2e-tiny').toBe('e2e-tiny');

    // 3) 建站（pages/leads 配额按 site owner 计量，owner=tiny 用户）
    const siteRes = await tinyCtx.post(`${BFF_BASE}/api/sites`, {
      headers: authHeaders(tinyToken),
      data: { name: `${RUN_ID}-tiny-site`, slug: `${RUN_ID}-tiny`, status: 'active' },
    });
    expect(siteRes.status(), `tiny 建站须 201，实际 ${siteRes.status()}`).toBe(201);
    tinySiteId = ((await siteRes.json()) as { id?: string }).id ?? '';
    expect(tinySiteId, 'tiny 站点 id 须非空').toBeTruthy();
  });

  test('QE5: e2e-tiny(quota_pages=1) 下第 2 个页面 → 429 QUOTA_EXCEEDED(metric=pages)', async () => {
    // 第 1 个页面：配额内（1/1）须 201
    const first = await tinyCtx.post(`${BFF_BASE}/api/sites/${tinySiteId}/pages`, {
      headers: authHeaders(tinyToken),
      data: { name: 'tiny-page-1', path: `/tiny-1-${Date.now()}` },
    });
    expect(first.status(), `第 1 个页面须 201（quota_pages=1），实际 ${first.status()}`).toBe(201);
    tinyPageId = ((await first.json()) as { id?: string }).id ?? '';
    expect(tinyPageId, '第 1 个页面 id 须非空').toBeTruthy();

    // 第 2 个页面：超限 429
    const second = await tinyCtx.post(`${BFF_BASE}/api/sites/${tinySiteId}/pages`, {
      headers: authHeaders(tinyToken),
      data: { name: 'tiny-page-2', path: `/tiny-2-${Date.now()}` },
    });
    expect(second.status(), `第 2 个页面须 429，实际 ${second.status()}`).toBe(429);
    const body = (await second.json()) as {
      code?: string;
      details?: { metric?: string; limit?: number; used?: number };
    };
    expect(body.code, '错误码须为 QUOTA_EXCEEDED').toBe('QUOTA_EXCEEDED');
    expect(body.details?.metric, 'details.metric 须为 pages').toBe('pages');
    expect(body.details?.limit, 'details.limit 须为 1（quota_pages=1）').toBe(1);
    expect(typeof body.details?.used, 'details.used 须为数字').toBe('number');
  });

  test('QE6: e2e-tiny(quota_leads=1) 下第 2 条 lead → 429 QUOTA_EXCEEDED(metric=leads, limit=1)', async () => {
    // 发布页面（对齐 plan §7.3 S6「建站+发布页+表单」字面；lead 计量本身不校验发布态）
    const pubRes = await tinyCtx.post(`${BFF_BASE}/api/sites/${tinySiteId}/pages/${tinyPageId}/publish`, {
      headers: authHeaders(tinyToken),
    });
    expect(pubRes.status(), `发布页须 2xx，实际 ${pubRes.status()}`).toBeLessThan(300);

    // 建表单（既有 /api/forms，参考本文件契约层 beforeAll 的建法）
    const formRes = await tinyCtx.post(`${BFF_BASE}/api/forms?siteId=${tinySiteId}`, {
      headers: authHeaders(tinyToken),
      data: { siteId: tinySiteId, pageId: tinyPageId, name: 'tiny-form', dedupPolicy: 'reject' },
    });
    expect(formRes.status(), `建表单须 2xx，实际 ${formRes.status()}`).toBeLessThan(300);
    const formId = ((await formRes.json()) as { id?: string }).id ?? '';
    expect(formId, '表单 id 须非空').toBeTruthy();

    // 第 1 条 lead：配额内（1/1）须 2xx（公开提交端点，QuotaService 按 site owner 计量）
    const first = await tinyCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '配额首条', phone: `137${Date.now().toString().slice(-8)}` } },
    });
    expect(first.status(), `第 1 条 lead 须 2xx，实际 ${first.status()}`).toBeLessThan(300);

    // 第 2 条 lead（手机号不同，避开 dedup 409 → 命中配额 429）
    const second = await tinyCtx.post(`${BFF_BASE}/api/forms/${formId}/submit`, {
      data: { contact: { name: '配额超限', phone: `136${Date.now().toString().slice(-8)}` } },
    });
    expect(second.status(), `第 2 条 lead 须 429，实际 ${second.status()}`).toBe(429);
    const body = (await second.json()) as {
      code?: string;
      details?: { metric?: string; limit?: number; used?: number };
    };
    expect(body.code, '错误码须为 QUOTA_EXCEEDED').toBe('QUOTA_EXCEEDED');
    expect(body.details?.metric, 'details.metric 须为 leads').toBe('leads');
    expect(body.details?.limit, 'details.limit 须为 1（quota_leads=1）').toBe(1);
    expect(typeof body.details?.used, 'details.used 须为数字').toBe('number');
  });

  test.afterAll(async () => {
    // 清理：tiny 用户删自己的站点（幂等 best-effort）；用户行由 e2e 环境重置/SQL 清理（plan 裁定 #6）
    if (tinySiteId && tinyToken && tinyCtx) {
      await tinyCtx.delete(`${BFF_BASE}/api/sites/${tinySiteId}`, { headers: authHeaders(tinyToken) }).catch(() => {});
    }
    if (tinyCtx) {
      await tinyCtx.dispose().catch(() => {});
    }
  });
});

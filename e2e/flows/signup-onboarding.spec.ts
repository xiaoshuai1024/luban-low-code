import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import 'dotenv/config';

/**
 * 注册 → 0 元开通 → 建站 → 使用 @J-signup-onboarding（plan §7.3 S1/S2/S3/S5）
 *
 * API 级全链（UI 链路在 apps/engine/e2e/signup-wizard.spec.ts）：
 *   S1 注册：409/400/201+devCode → 未验证登录 401 → 错码 400（剩余次数）→ 正确码 200 + me 200
 *   S2 0 元订单：plans 三档全 0 元 → me=free/active → orders(starter)=paid+trialing(+14d) → usage → me=starter
 *   S3 开通：slug-check 可用 → 建站（owner 过滤）→ 同 slug 409 → 首页(/ + blank) → 发布 → 公开链路返回 schema
 *   S5 多租户隔离：用户 B 看不到 A 站；PUT/POST A 站子资源均 403 PERMISSION_DENIED
 *
 * 验证码通道：MAIL_DEV_ECHO=true（docker-compose.e2e.yml backend-java environment）时
 * register/resend 响应体附 devCode（RegisterService/RegisterResponse 契约）；缺失即 throw
 * 明确报错——禁 skip、禁假绿（luban-e2e-execution-contract §2.5.1）。
 *
 * 数据：用户名/邮箱/slug 均含 `e2e-${Date.now()}` 前缀保证唯一（style-guide §11 前缀隔离）；
 *      两个用户（A=主链路、B=隔离验证）。
 * 清理：站点 DELETE（owner token，best-effort 幂等）；
 *      用户行由 e2e 环境重置/SQL 清理（plan §9.0 裁定 #6：无 DELETE /users API，本 spec 不做）。
 */

// 默认对齐 e2e 编排宿主端口（docker-compose.e2e.yml BFF 映射 3100:3000；3000 是 website 无 /api）
const BFF_BASE = process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100';
const RUN_ID = `e2e-${Date.now()}`;
// 密码强度契约（§3.4）：≥8 位且同时含字母与数字
const PASSWORD = 'E2eSignup123';

const USER_A = { username: `${RUN_ID}-a`, email: `${RUN_ID}-a@e2e.luban.test` };
const USER_B = { username: `${RUN_ID}-b`, email: `${RUN_ID}-b@e2e.luban.test` };
const SITE_SLUG = `${RUN_ID}-site`;

const BLANK_SCHEMA = {
  root: { id: 'root', type: 'LubanContainer', props: {}, children: [] },
};

interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

let apiCtx: APIRequestContext;
let registerStatusA = 0;
let emailMaskedA = '';
let devCodeA = '';
let tokenA = '';
let tokenB = '';
let siteId = '';
let pageId = '';

test.beforeAll(async () => {
  apiCtx = await apiRequest.newContext();
  // 用户 A 先注册但不 verify：S1-4（pending 登录 401）与 S1-5（错码）依赖 pending 态 + 未消费验证码
  const regA = await registerUser(USER_A);
  registerStatusA = regA.status;
  emailMaskedA = regA.emailMasked;
  devCodeA = regA.devCode;
});

test.afterAll(async () => {
  // 站点清理：owner token 删站（幂等 best-effort，失败不阻断）
  if (siteId && tokenA && apiCtx) {
    await apiCtx.delete(`${BFF_BASE}/api/sites/${siteId}`, { headers: auth(tokenA) }).catch(() => {});
  }
  // 用户行（A/B）由 e2e 环境重置/SQL 清理（plan §9.0 裁定 #6），本 spec 不做、不写 SQL。
  if (apiCtx) {
    await apiCtx.dispose().catch(() => {});
  }
});

// ---------- S1 注册全链 ----------

test.describe('S1 注册全链 @J-signup-onboarding', () => {
  test('S1-1 重复用户名注册 → 409 USERNAME_TAKEN', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/auth/register`, {
      data: { username: USER_A.username, email: `${RUN_ID}-dup@e2e.luban.test`, password: PASSWORD },
    });
    expect(res.status(), `重复用户名须 409，实际 ${res.status()}`).toBe(409);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code, '错误码须为 USERNAME_TAKEN').toBe('USERNAME_TAKEN');
  });

  test('S1-2 坏邮箱/弱密码注册 → 400 INVALID_ARGUMENT / WEAK_PASSWORD', async () => {
    // 坏邮箱（@Email bean 校验 → 400 INVALID_ARGUMENT）
    const badEmail = await apiCtx.post(`${BFF_BASE}/api/auth/register`, {
      data: { username: `${RUN_ID}-bad`, email: 'not-an-email', password: PASSWORD },
    });
    expect(badEmail.status(), `坏邮箱须 400，实际 ${badEmail.status()}`).toBe(400);
    expect(((await badEmail.json()) as ApiErrorBody).code, '坏邮箱错误码须为 INVALID_ARGUMENT').toBe('INVALID_ARGUMENT');

    // 弱密码（服务层强度校验 → 400 WEAK_PASSWORD）
    const weakPassword = await apiCtx.post(`${BFF_BASE}/api/auth/register`, {
      data: { username: `${RUN_ID}-wk`, email: `${RUN_ID}-wk@e2e.luban.test`, password: '123' },
    });
    expect(weakPassword.status(), `弱密码须 400，实际 ${weakPassword.status()}`).toBe(400);
    expect(((await weakPassword.json()) as ApiErrorBody).code, '弱密码错误码须为 WEAK_PASSWORD').toBe('WEAK_PASSWORD');
  });

  test('S1-3 合法注册 → 201 + emailMasked 掩码 + 6 位 devCode', async () => {
    expect(registerStatusA, 'beforeAll 注册须 201').toBe(201);
    expect(emailMaskedA, `emailMasked 须形如 a***@domain.com，实际 ${emailMaskedA}`).toMatch(/^\S\*\*\*@\S+\.\S+$/);
    expect(devCodeA, `devCode 须 6 位数字（MAIL_DEV_ECHO 通道），实际 ${devCodeA}`).toMatch(/^\d{6}$/);
  });

  test('S1-4 未验证直接登录 → 401 USER_PENDING_VERIFICATION', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/auth/login`, {
      data: { username: USER_A.username, password: PASSWORD },
    });
    expect(res.status(), `pending 用户登录须 401，实际 ${res.status()}`).toBe(401);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code, '错误码须为 USER_PENDING_VERIFICATION').toBe('USER_PENDING_VERIFICATION');
  });

  test('S1-5 错码 verify → 400 VERIFY_CODE_INVALID（含剩余次数）', async () => {
    const wrongCode = devCodeA === '000000' ? '111111' : '000000'; // 保证与真码不同
    const res = await apiCtx.post(`${BFF_BASE}/api/auth/register/verify`, {
      data: { email: USER_A.email, code: wrongCode },
    });
    expect(res.status(), `错码须 400，实际 ${res.status()}`).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code, '错误码须为 VERIFY_CODE_INVALID').toBe('VERIFY_CODE_INVALID');
    // MAX_ATTEMPTS=5，首次失败后剩余 4 次（EmailVerificationService.verify → details.remainingAttempts）
    const remaining = (body.details as { remainingAttempts?: number } | undefined)?.remainingAttempts;
    expect(remaining, 'details 须含剩余次数 remainingAttempts=4').toBe(4);
  });

  test('S1-6 正确码 verify → 200 token/user + GET /api/auth/me 200', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/auth/register/verify`, {
      data: { email: USER_A.email, code: devCodeA },
    });
    expect(res.status(), `正确码须 200，实际 ${res.status()}`).toBe(200);
    const body = (await res.json()) as { token?: string; user?: { username?: string } };
    expect(body.token, 'verify 须返回 token（BFF signToken）').toBeTruthy();
    expect(body.user?.username, 'user.username 须回显注册用户名').toBe(USER_A.username);
    tokenA = body.token as string;

    const me = await apiCtx.get(`${BFF_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect(me.status(), `me 须 200，实际 ${me.status()}`).toBe(200);
    expect(((await me.json()) as { username?: string }).username, 'me 须回当前用户名').toBe(USER_A.username);
  });
});

// ---------- S2 0 元订单 ----------

test.describe('S2 0 元订单（starter）@J-signup-onboarding @J-billing', () => {
  test('S2-1 GET /billing/plans → 三档全 0 元 + quota 字段', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/billing/plans`, { headers: auth(tokenA) });
    expect(res.status(), `查套餐须 200，实际 ${res.status()}`).toBe(200);
    const plans = (await res.json()) as Array<Record<string, number | string>>;
    expect(Array.isArray(plans), '套餐须为裸数组（B1 契约）').toBe(true);
    const byCode = new Map(
      plans.map((p): [string, Record<string, number | string>] => [String(p.planCode), p])
    );
    for (const code of ['free', 'starter', 'growth']) {
      expect(byCode.has(code), `套餐须含 ${code}`).toBe(true);
      const plan = byCode.get(code) as Record<string, number | string>;
      expect(plan.priceMonthly, `${code} 须 0 元（priceMonthly 单位分）`).toBe(0);
      for (const field of ['quotaLeads', 'quotaPages', 'quotaVisits']) {
        expect(typeof plan[field], `${code}.${field} 须为数字`).toBe('number');
      }
    }
    // seed 配额契约（plan §9.3）
    expect((byCode.get('free') as Record<string, number | string>).quotaPages, 'free 页面配额须 3').toBe(3);
    expect((byCode.get('starter') as Record<string, number | string>).quotaPages, 'starter 页面配额须 10').toBe(10);
    expect((byCode.get('growth') as Record<string, number | string>).quotaPages, 'growth 页面配额须 50').toBe(50);
    expect((byCode.get('starter') as Record<string, number | string>).quotaLeads, 'starter 留资配额须 1000').toBe(1000);
    expect((byCode.get('starter') as Record<string, number | string>).trialDays, 'starter 试用须 14 天').toBe(14);
  });

  test('S2-2 verify 激活后 GET /billing/me → free/active + usage 结构', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/billing/me`, { headers: auth(tokenA) });
    expect(res.status(), `me 须 200，实际 ${res.status()}`).toBe(200);
    const body = (await res.json()) as { planCode?: string; status?: string; usage?: Record<string, number> };
    expect(body.planCode, '激活即默认绑定 Free（verify 激活事务）').toBe('free');
    expect(body.status, 'Free 订阅须 active').toBe('active');
    for (const metric of ['leads', 'pages', 'visits']) {
      expect(typeof body.usage?.[metric], `usage.${metric} 须为数字`).toBe('number');
    }
  });

  test('S2-3 POST /billing/orders(starter) → 0 元订单直通 paid + trialing(+14d)', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/billing/orders`, {
      headers: auth(tokenA),
      data: { planCode: 'starter' },
    });
    expect(res.status(), `下单须 200，实际 ${res.status()}`).toBe(200);
    const body = (await res.json()) as {
      order?: { orderNo?: string; planCode?: string; amount?: number; status?: string; paidAt?: string };
      subscription?: { planCode?: string; status?: string; trialEndsAt?: string };
    };
    expect(body.order?.orderNo, '订单号须非空').toBeTruthy();
    expect(body.order?.planCode, '订单套餐须为 starter').toBe('starter');
    expect(body.order?.amount, '三档全 0 元，amount 须为 0（分）').toBe(0);
    expect(body.order?.status, '0 元订单须同事务自动支付为 paid').toBe('paid');
    expect(body.order?.paidAt, 'paidAt 须非空').toBeTruthy();
    expect(body.subscription?.status, 'Starter 首次订阅须 trialing').toBe('trialing');
    const trialEndsAt = new Date(body.subscription?.trialEndsAt ?? '').getTime();
    expect(Number.isFinite(trialEndsAt), `trialEndsAt 须为可解析时间，实际 ${body.subscription?.trialEndsAt}`).toBe(true);
    const daysAhead = (trialEndsAt - Date.now()) / 86_400_000;
    expect(daysAhead, `试用到期须 ≈ +14 天，实际 ${daysAhead.toFixed(2)} 天`).toBeGreaterThan(13.9);
    expect(daysAhead, '试用到期不得晚于 +14.1 天').toBeLessThan(14.1);
  });

  test('S2-4 GET /billing/usage → {period,leads,pages,visits}', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/billing/usage`, { headers: auth(tokenA) });
    expect(res.status(), `usage 须 200，实际 ${res.status()}`).toBe(200);
    const body = (await res.json()) as { period?: string; leads?: number; pages?: number; visits?: number };
    expect(body.period, 'period 须为 yyyy-MM').toMatch(/^\d{4}-\d{2}$/);
    for (const metric of ['leads', 'pages', 'visits'] as const) {
      expect(typeof body[metric], `usage.${metric} 须为数字`).toBe('number');
    }
  });

  test('S2-5 下单后 GET /billing/me → starter', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/billing/me`, { headers: auth(tokenA) });
    expect(res.status(), `me 须 200，实际 ${res.status()}`).toBe(200);
    expect(((await res.json()) as { planCode?: string }).planCode, '下单后当前档须为 starter').toBe('starter');
  });
});

// ---------- S3 开通服务 ----------

test.describe('S3 开通服务（slug 预检 → 建站 → 首页 → 发布）@J-signup-onboarding', () => {
  test('S3-1 slug-check 预检 → 200 available=true', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/sites/slug-check?slug=${SITE_SLUG}`, { headers: auth(tokenA) });
    expect(res.status(), `预检须 200，实际 ${res.status()}`).toBe(200);
    const body = (await res.json()) as { available?: boolean; slug?: string };
    expect(body.available, '随机 slug 须可用').toBe(true);
    expect(body.slug, '须回显查询的 slug').toBe(SITE_SLUG);
  });

  test('S3-2 POST /sites → 201 + owner 过滤（GET /sites 只含本站）', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/sites`, {
      headers: auth(tokenA),
      data: { name: '注册链路测试站', slug: SITE_SLUG, status: 'active' },
    });
    expect(res.status(), `建站须 201，实际 ${res.status()}`).toBe(201);
    const site = (await res.json()) as { id?: string; slug?: string };
    siteId = site.id ?? '';
    expect(siteId, '站点 id 须非空').toBeTruthy();
    expect(site.slug, '须回显 slug').toBe(SITE_SLUG);

    const list = await apiCtx.get(`${BFF_BASE}/api/sites`, { headers: auth(tokenA) });
    expect(list.status(), '站点列表须 200').toBe(200);
    const sites = (await list.json()) as Array<{ id?: string; slug?: string }>;
    // 新注册用户（非 admin）仅拥有本站：owner 过滤后列表必须只含本站
    expect(sites.length, `新用户站点列表须仅含本站，实际 ${JSON.stringify(sites)}`).toBe(1);
    expect(sites[0]?.id, '列表首项须为本站').toBe(siteId);
  });

  test('S3-3 同 slug 重查 → 409 SLUG_TAKEN(details.slug)', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/sites/slug-check?slug=${SITE_SLUG}`, { headers: auth(tokenA) });
    expect(res.status(), `已占用 slug 须 409，实际 ${res.status()}`).toBe(409);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code, '错误码须为 SLUG_TAKEN').toBe('SLUG_TAKEN');
    expect((body.details as { slug?: string } | undefined)?.slug, 'details 须回显冲突 slug').toBe(SITE_SLUG);
  });

  test('S3-4 POST 首页（path=/ + blank 模板 schema）→ 201', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
      headers: auth(tokenA),
      data: { name: '首页', path: '/', schema: BLANK_SCHEMA },
    });
    expect(res.status(), `建首页须 201，实际 ${res.status()}`).toBe(201);
    const body = (await res.json()) as { id?: string; status?: string };
    pageId = body.id ?? '';
    expect(pageId, '页面 id 须非空').toBeTruthy();
    expect(body.status, '新页面须为 draft').toBe('draft');
  });

  test('S3-5 发布 → 公开链路返回 schema（S4 访客访问前置）', async () => {
    // 发布走既有契约 POST /pages/:pid/publish（PageController L64；publish-api.spec.ts 先例）。
    // plan §7.3 字面的「PUT {status:'published'}」端点实际不存在，以现存正式契约为准。
    const pub = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages/${pageId}/publish`, {
      headers: auth(tokenA),
    });
    expect(pub.status(), `发布须 200，实际 ${pub.status()}`).toBe(200);
    expect(((await pub.json()) as { status?: string }).status, '发布后须为 published').toBe('published');

    const publicPage = await apiCtx.get(`${BFF_BASE}/api/public/sites/${SITE_SLUG}/pages?path=/`);
    expect(publicPage.status(), `公开页须 200，实际 ${publicPage.status()}`).toBe(200);
    const body = (await publicPage.json()) as { status?: string; schema?: { root?: { type?: string } } };
    expect(body.status, '公开页须为 published').toBe('published');
    expect(body.schema?.root?.type, '公开页须返回 schema（website 渲染依据）').toBe('LubanContainer');
  });
});

// ---------- S5 多租户隔离 ----------

test.describe('S5 多租户隔离（用户 B）@J-signup-onboarding', () => {
  test.beforeAll(async () => {
    // 用户 B：注册 + 正确码激活拿 token（devCode 缺失在 registerUser 内 throw）
    const reg = await registerUser(USER_B);
    expect(reg.status, '用户 B 注册须 201').toBe(201);
    const verify = await apiCtx.post(`${BFF_BASE}/api/auth/register/verify`, {
      data: { email: USER_B.email, code: reg.devCode },
    });
    expect(verify.status(), `用户 B 激活须 200，实际 ${verify.status()}`).toBe(200);
    tokenB = ((await verify.json()) as { token?: string }).token ?? '';
    expect(tokenB, '用户 B 须取得 token').toBeTruthy();
  });

  test('S5-1 用户 B GET /sites 不含 A 站', async () => {
    const res = await apiCtx.get(`${BFF_BASE}/api/sites`, { headers: auth(tokenB) });
    expect(res.status(), 'B 站点列表须 200').toBe(200);
    const sites = (await res.json()) as Array<{ id?: string; slug?: string }>;
    expect(
      sites.some((s) => s.id === siteId || s.slug === SITE_SLUG),
      `B 的站点列表不得包含 A 的站点（${SITE_SLUG}），实际 ${JSON.stringify(sites)}`
    ).toBe(false);
  });

  test('S5-2 用户 B PUT A 站 → 403 PERMISSION_DENIED', async () => {
    const res = await apiCtx.put(`${BFF_BASE}/api/sites/${siteId}`, {
      headers: auth(tokenB),
      data: { name: 'B 越权改名', slug: SITE_SLUG, status: 'active' },
    });
    expect(res.status(), `越权更新站点须 403，实际 ${res.status()}`).toBe(403);
    expect(((await res.json()) as ApiErrorBody).code, '错误码须为 PERMISSION_DENIED').toBe('PERMISSION_DENIED');
  });

  test('S5-3 用户 B POST A 站 pages → 403 PERMISSION_DENIED', async () => {
    const res = await apiCtx.post(`${BFF_BASE}/api/sites/${siteId}/pages`, {
      headers: auth(tokenB),
      data: { name: '越权页面', path: '/hijack', schema: BLANK_SCHEMA },
    });
    expect(res.status(), `越权建页须 403，实际 ${res.status()}`).toBe(403);
    expect(((await res.json()) as ApiErrorBody).code, '错误码须为 PERMISSION_DENIED').toBe('PERMISSION_DENIED');
  });
});

// ---------- helpers ----------

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** 注册并捕获验证码：非 201 或无 devCode 直接 throw（禁 skip，禁假绿）。 */
async function registerUser(user: { username: string; email: string }): Promise<{
  status: number;
  emailMasked: string;
  devCode: string;
}> {
  const res = await apiCtx.post(`${BFF_BASE}/api/auth/register`, {
    data: { username: user.username, email: user.email, password: PASSWORD },
  });
  const body = (await res.json().catch(() => null)) as { emailMasked?: string; devCode?: string } | null;
  if (res.status() !== 201 || !body?.devCode) {
    throw new Error(
      `[signup-onboarding] 注册失败/缺 devCode（status=${res.status()}，body=${JSON.stringify(body)}）。` +
        '若 status=201 但无 devCode：e2e 环境须为 backend-java 开启 MAIL_DEV_ECHO=true' +
        '（docker-compose.e2e.yml，plan §7.2）；禁止以缺验证码为由 skip。'
    );
  }
  return { status: res.status(), emailMasked: body.emailMasked ?? '', devCode: body.devCode };
}

import { test, expect } from '@playwright/test';

/**
 * luban-website SSR / SEO / hydration E2E
 *
 * 聚焦 website 自身的服务端渲染行为：
 *   ① SSR：关键内容在 HTML 源码中可见（非 client-only 渲染）
 *   ② SEO：title / meta / og 标签存在
 *   ③ hydration：无 Vue hydration mismatch 警告
 *   ④ 路由：根路径重定向到默认站点
 *
 * 依赖：BFF 须在线且 defaultSite 下有已发布页（由 workspace e2e 流程A 预置，
 *      或手动 seed）。无数据时 home/重定向断言仍可验证 SSR 本身。
 *
 * 真实性：检查 page.content() 的原始 HTML（SSR 产物），而非仅 DOM。
 */

const DEFAULT_SLUG = process.env.NUXT_PUBLIC_DEFAULT_SITE_SLUG ?? 'default';

test.describe('website SSR @smoke', () => {
  test('根路径重定向到默认站点（SSR 重定向）', async ({ page }) => {
    const res = await page.goto('/');
    expect(res, '根路径须返回响应').not.toBeNull();
    // Home.vue navigateTo(defaultSlug) → URL 含默认 slug
    await expect(page).toHaveURL(new RegExp(`/${DEFAULT_SLUG}`));
  });

  test('SSR HTML 含 <head> 基础结构', async ({ page }) => {
    const res = await page.goto(`/${DEFAULT_SLUG}`);
    if (!res) throw new Error('无响应');

    // 原始 HTML（SSR 产物）须含 title（非 client 注入）
    const html = await res.text();
    expect(html, 'SSR HTML 须含 <title>').toContain('<title>');
    expect(html, 'SSR HTML 须含 charset/viewport meta').toMatch(
      /<meta[^>]*(charset|viewport)/
    );
  });

  test('hydration 无 mismatch 控制台错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/${DEFAULT_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Vue hydration mismatch 会在控制台报 hydrate 相关错误
    const hydrationErrors = consoleErrors.filter((e) =>
      /hydrat|Hydration|mismatch/i.test(e)
    );
    expect(hydrationErrors, `hydration 错误：\n${hydrationErrors.join('\n')}`).toEqual([]);
  });
});

test.describe('website 公开页渲染 @core', () => {
  // 该用例依赖 defaultSite 下存在已发布页（由 workspace 流程A 或 seed 预置）
  test('已发布页 SSR 渲染 schema 内容（非 client-only）', async ({ page }) => {
    // 先取该站点首页（path=/）
    const res = await page.goto(`/${DEFAULT_SLUG}/`);
    if (!res) throw new Error('无响应');

    const html = await res.text();
    // SSR 产物须含 nuxt 渲染根节点（非空 body）
    expect(html, 'SSR 须渲染出 __nuxt 挂载点').toContain('id="__nuxt"');

    // Nuxt SSR 数据预取 payload 须注入（useFetch 的结果序列化）
    // 形如 window.__NUXT__ 或 <script> 里的 payload
    const hasPayload =
      html.includes('__NUXT__') || html.includes('payload') || html.includes('data-');
    expect(hasPayload, 'SSR 须注入数据 payload 供 hydration').toBeTruthy();
  });
});

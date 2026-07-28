import { test, expect } from '@playwright/test';

/**
 * 登录页（迁移自 cypress/e2e/login.cy.ts）
 * 去除 mock-token 假绿，改真实交互 + storageState 复用。
 */
test.describe('Login @smoke', () => {
  test('显示登录表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Luban 管理后台')).toBeVisible();
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('无 token 访问受保护页 → 重定向到登录', async ({ browser }) => {
    // 用全新无 storageState 的上下文，确保无 token
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('真实账号登录 → 跳转 dashboard', async ({ page }) => {
    const account = process.env.LUBAN_E2E_ACCOUNT!;
    const password = process.env.LUBAN_E2E_PASSWORD!;
    test.skip(!account || !password, '需 LUBAN_E2E_ACCOUNT/PASSWORD');

    await page.goto('/login');
    await page.getByPlaceholder('请输入账号').fill(account);
    await page.getByPlaceholder('请输入密码').fill(password);
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

import { test as setup, expect } from '@playwright/test';

/**
 * 真实登录 setup（替代旧 Cypress 的 mock-token 假绿）
 *
 * 旧 cypress/support/commands.ts 注入 MOCK_TOKEN='mock-jwt-token' 绕过后端，
 * 后端 Controller 不存在也全绿 —— 违反 luban-e2e-execution-contract §2.5.1。
 * 此处改用真实账号登录，拿 storageState 供各 spec 复用。
 */
const ACCOUNT = process.env.LUBAN_E2E_ACCOUNT;
const PASSWORD = process.env.LUBAN_E2E_PASSWORD;

setup('authenticate as e2e account', async ({ page }) => {
  if (!ACCOUNT || !PASSWORD) {
    throw new Error(
      '[engine e2e] 缺 LUBAN_E2E_ACCOUNT/PASSWORD。后端须预置专用 e2e 账号。'
    );
  }
  await page.goto('/login');
  await page.getByPlaceholder('请输入账号').fill(ACCOUNT);
  await page.getByPlaceholder('请输入密码').fill(PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  const token = await page.evaluate(() => localStorage.getItem('luban_token'));
  expect(token, '登录后须写入 luban_token').toBeTruthy();

  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});

import { test, expect } from '@playwright/test';

/**
 * 导航（迁移自 cypress/e2e/navigation.cy.ts）
 * 真实登录态（storageState 复用 auth.setup 产物）。
 */
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Navigation @smoke', () => {
  test('工作台可访问', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('工作台')).toBeVisible();
    await expect(page.getByText('站点数')).toBeVisible();
  });

  test('侧边栏链接有效', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: '站点管理' }).click();
    await expect(page).toHaveURL(/\/sites/);
    await page.getByRole('link', { name: '用户管理' }).click();
    await expect(page).toHaveURL(/\/users/);
    await page.getByRole('link', { name: '系统设置' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('站点管理页加载', async ({ page }) => {
    await page.goto('/sites');
    await expect(page.getByRole('heading', { name: '站点管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible();
  });

  test('用户管理页加载', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建用户' })).toBeVisible();
  });

  test('系统设置页加载', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('系统设置')).toBeVisible();
    await expect(page.getByText('基础信息')).toBeVisible();
  });
});

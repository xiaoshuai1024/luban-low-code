import { test, expect } from '@playwright/test';

/**
 * 站点管理（迁移自 cypress/e2e/sites.cy.ts）
 * 真实数据：依赖后端存在至少一个站点（由 dev DB 或 e2e seed 提供）。
 * 真实登录态。
 */
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Sites management @smoke', () => {
  test('加载站点列表与工具栏', async ({ page }) => {
    await page.goto('/sites');
    await expect(page.getByRole('heading', { name: '站点管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible();
  });

  test('从列表进入站点详情', async ({ page }) => {
    await page.goto('/sites');
    await page.locator('table tbody tr').first().getByRole('button', { name: '详情' }).click();
    await expect(page).toHaveURL(/\/sites\/[^/]+$/);
    await expect(page.getByText('站点信息')).toBeVisible();
  });

  test('从列表进入站点页面列表', async ({ page }) => {
    await page.goto('/sites');
    await page.locator('table tbody tr').first().getByRole('button', { name: '页面' }).click();
    await expect(page).toHaveURL(/\/sites\/[^/]+\/pages$/);
    await expect(page.getByText('站点：')).toBeVisible();
    await expect(page.getByRole('button', { name: '新建页面' })).toBeVisible();
  });
});

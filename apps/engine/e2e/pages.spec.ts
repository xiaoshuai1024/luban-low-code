import { test, expect } from '@playwright/test';

/**
 * 页面管理（迁移自 cypress/e2e/pages.cy.ts）
 * 依赖：至少一个站点存在。
 */
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Pages management @smoke', () => {
  test('加载站点页面列表', async ({ page }) => {
    await page.goto('/sites');
    await page.locator('table tbody tr').first().getByRole('button', { name: '页面' }).click();
    await expect(page).toHaveURL(/\/sites\/[^/]+\/pages$/);
    await expect(page.getByText('站点：')).toBeVisible();
    await expect(page.getByRole('button', { name: '新建页面' })).toBeVisible();
  });

  test('新建页面弹出模板选择器', async ({ page }) => {
    await page.goto('/sites');
    await page.locator('table tbody tr').first().getByRole('button', { name: '页面' }).click();
    await page.getByRole('button', { name: '新建页面' }).click();
    // V2-T3 FeatureGate templates 开启时弹模板选择器
    await expect(page.getByRole('dialog')).toContainText('选择模板');
  });
});

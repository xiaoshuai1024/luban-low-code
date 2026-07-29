import { test, expect } from '@playwright/test';

/**
 * 导航（迁移自 cypress/e2e/navigation.cy.ts）
 * 真实登录态（storageState 复用 auth.setup 产物）。
 */
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Navigation @smoke', () => {
  test('工作台可访问', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('工作台').first()).toBeVisible();
    await expect(page.getByText('站点数')).toBeVisible();
  });

  test('侧边栏导航到各页面', async ({ page }) => {
    // 侧边栏 ElMenuItem 渲染为 <a>，用 text 定位后取父级可点击元素
    async function clickNav(title: string) {
      const navItem = page.locator('.el-menu-item').filter({ hasText: title });
      await navItem.click();
    }

    await page.goto('/dashboard');

    await clickNav('站点管理');
    await expect(page).toHaveURL(/\/sites/);

    await clickNav('用户管理');
    await expect(page).toHaveURL(/\/users/);

    await clickNav('系统设置');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('站点管理页加载', async ({ page }) => {
    await page.goto('/sites');
    await expect(page.getByText('站点管理').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '新建站点' })).toBeVisible();
  });

  test('用户管理页加载', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByText('用户管理').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '新建用户' })).toBeVisible();
  });

  test('系统设置页加载', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('系统设置').first()).toBeVisible();
    await expect(page.getByText('基础信息')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Users CRUD @core', () => {
  test('创建用户并验证列表', async ({ page }) => {
    const USERNAME = `e2e-${Date.now()}`;
    await page.goto('/users');
    await expect(page.getByText('用户管理').first()).toBeVisible();

    // Create user
    await page.getByRole('button', { name: '新建用户' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog = page.locator('.el-dialog');
    await dialog.getByPlaceholder('账号').fill(USERNAME);
    await dialog.getByPlaceholder('密码').fill('e2epass123');
    await dialog.getByPlaceholder('姓名').fill('E2E Test');
    await page.locator('.el-dialog .el-button--primary').click();

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Reload to ensure table reflects the new user
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify user appears in table
    await expect(page.locator('body')).toContainText(USERNAME, { timeout: 10000 });
  });
});

import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

const SITE_NAME = `e2e-site-${Date.now()}`;
const SITE_SLUG = `e2e-slug-${Date.now()}`;

test.describe('Sites CRUD @core', () => {
  test('创建→编辑→删除（取消）站点', async ({ page }) => {
    // 1. Create site
    await page.goto('/sites');
    await expect(page.getByText('站点管理').first()).toBeVisible();

    await page.getByRole('button', { name: '新建站点' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const inputs = page.locator('.el-dialog input');
    await inputs.first().fill(SITE_NAME);
    await inputs.nth(1).fill(SITE_SLUG);
    await inputs.nth(2).fill('https://e2e-test.local');
    await inputs.nth(3).fill('active');

    await page.locator('.el-dialog .el-button--primary').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(SITE_NAME)).toBeVisible({ timeout: 5000 });

    // 2. Edit site: change name
    const row = page.locator('table tbody tr', { hasText: SITE_NAME });
    await row.getByRole('button', { name: '编辑' }).click();
    await expect(page.locator('.el-dialog__title', { hasText: '编辑站点' })).toBeVisible();

    const editInput = page.locator('.el-dialog input').first();
    await editInput.clear();
    await editInput.fill(`${SITE_NAME}-v2`);
    await page.locator('.el-dialog .el-button--primary').click();
    await expect(page.getByText(`${SITE_NAME}-v2`)).toBeVisible({ timeout: 5000 });

    // 3. Delete: confirm dialog appears, then cancel
    const v2Row = page.locator('table tbody tr', { hasText: `${SITE_NAME}-v2` });
    await v2Row.getByRole('button', { name: '删除' }).click();
    // Verify MessageBox appears with site name
    await expect(page.locator('.el-message-box')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.el-message-box')).toContainText(`${SITE_NAME}-v2`);
    // Cancel the delete by clicking the non-primary button
    await page.locator('.el-message-box__btns button').last().click();
    // MessageBox should close — verify by checking dialog is gone
    await expect(page.locator('.el-message-box')).not.toBeVisible({ timeout: 5000 });
    // Site should still be in the table
    await expect(page.locator('.el-table__body')).toContainText(`${SITE_NAME}-v2`);
  });

  test('站点详情页加载', async ({ page }) => {
    await page.goto('/sites');
    await page.locator('table tbody tr').first().getByRole('button', { name: '详情' }).click();
    await expect(page).toHaveURL(/\/sites\/[^/]+$/);
    await expect(page.getByText('站点信息')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '进入页面列表' })).toBeVisible();
  });
});

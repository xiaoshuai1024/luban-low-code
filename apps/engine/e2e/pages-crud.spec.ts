import { test, expect } from '@playwright/test';

/**
 * 页面 CRUD E2E — 创建/删除页面（编辑在 ai.spec.ts 已有）
 */
test.use({ storageState: 'e2e/.auth/user.json' });

let siteId = '';

test.beforeAll(async ({ request }) => {
  const token = (await import('fs')).readFileSync('e2e/.auth/user.json', 'utf8');
  const s = JSON.parse(token);
  const t = s.origins?.[0]?.localStorage?.find((i: any) => i.name === 'luban_token')?.value ?? '';

  const res = await request.get(
    `${process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100'}/api/sites`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  const sites = await res.json().catch(() => []);
  siteId = Array.isArray(sites) && sites.length ? sites[0].id : '';
});

test.describe('Pages CRUD @core', () => {
  test('创建页面（空白直接进设计器）', async ({ page }) => {
    test.skip(!siteId, '须有至少一个站点');
    await page.goto(`/sites/${siteId}/pages`);
    await expect(page.getByText('站点：')).toBeVisible({ timeout: 10000 });

    // Click 新建页面 → opens template picker
    await page.getByRole('button', { name: '新建页面' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Templates enabled → pick "空白页" (first template or empty)
    // Click any template card to select
    const firstCard = page.locator('.template-picker__card').first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
    } else {
      // If no template picker, directly navigated to designer
      // (FeatureGate templates=false path)
    }

    // Should be on the designer page (either /designer/sites/:id/pages/new or /sites/:id/pages/new)
    await expect(page).toHaveURL(/\/pages\//, { timeout: 10000 });
  });

  test('删除页面（确认取消）', async ({ page }) => {
    test.skip(!siteId, '须有至少一个站点');
    await page.goto(`/sites/${siteId}/pages`);
    await expect(page.getByText('站点：')).toBeVisible({ timeout: 10000 });

    // Click delete on first row and cancel
    const deleteBtn = page.locator('table tbody tr').first().getByRole('button', { name: '删除' });
    if (!(await deleteBtn.isVisible().catch(() => false))) return;
    await deleteBtn.click();

    // Cancel
    const cancelBtn = page.getByRole('button', { name: '取消' });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
    // Page should still be visible
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from '@playwright/test';

/**
 * 线索中心 E2E — 空数据下列表加载 + 404 提示
 * 种子数据需要先创建页面→表单→提交，此处只验证 UI 骨架和错误路径。
 */
test.use({ storageState: 'e2e/.auth/user.json' });

let siteId = '';

test.beforeAll(async ({ request }) => {
  const fs = await import('fs');
  const s = JSON.parse(fs.readFileSync('e2e/.auth/user.json', 'utf8'));
  const t = s.origins?.[0]?.localStorage?.find(
    (i: any) => i.name === 'luban_token'
  )?.value ?? '';
  const res = await request.get(
    `${process.env.LUBAN_E2E_BFF_URL ?? 'http://127.0.0.1:3100'}/api/sites`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  const sites = await res.json().catch(() => []);
  siteId = Array.isArray(sites) && sites.length ? sites[0].id : '';
});

test.describe('Lead Center @core', () => {
  test('加载线索列表页面（含工具栏+表格）', async ({ page }) => {
    test.skip(!siteId, '须有站点');
    await page.goto(`/sites/${siteId}/leads`);
    await expect(page.getByText('线索中心').first()).toBeVisible({ timeout: 10000 });
    // 工具栏按钮可见
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '导出 CSV' })).toBeVisible({ timeout: 5000 });
    // 表格渲染（可能为空）
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 5000 });
  });

  test('访问不存在线索不崩溃', async ({ page }) => {
    test.skip(!siteId, '须有站点');
    await page.goto(`/sites/${siteId}/leads/non-existent-e2e-id`);
    // 页面不空白/不白屏（el-table 或 el-alert 至少有一者在）
    await expect(page.locator('.el-alert, .el-table, .el-empty, .el-result').first()).toBeVisible({ timeout: 10000 });
  });
});

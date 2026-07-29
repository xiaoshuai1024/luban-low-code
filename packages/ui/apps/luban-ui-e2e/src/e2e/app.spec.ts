import { test, expect } from '@playwright/test';
import { po } from '../support/app.po';

/**
 * designer 渲染骨架（迁移自 app.cy.ts）
 * 断言 designer 三件套（root/palette/drop-zone）渲染 + palette 分组存在。
 */
test.describe('@luban-ui/luban-ui-e2e @smoke', () => {
  test('渲染 designer 调色板与拖放区', async ({ page }) => {
    await page.goto('/');
    const p = po(page);
    await expect(p.designerRoot()).toBeVisible();
    await expect(p.designerPalette()).toBeVisible();
    await expect(p.designerDropZone()).toBeVisible();
    await expect(p.paletteGroups().first()).toBeVisible();
  });
});

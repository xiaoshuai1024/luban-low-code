import type { Page, Locator } from '@playwright/test';

/** Page Object for designer（迁移自 cypress 版，data-cy 选择器不变） */
export const po = (page: Page) => ({
  designerRoot: (): Locator => page.locator('[data-cy="designer-root"]'),
  designerPalette: (): Locator => page.locator('[data-cy="designer-palette"]'),
  designerDropZone: (): Locator => page.locator('[data-cy="designer-drop-zone"]'),
  paletteGroups: (): Locator => page.locator('[data-cy^="designer-palette-group-"]'),
});

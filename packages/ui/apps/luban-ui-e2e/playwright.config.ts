import { defineConfig } from '@playwright/test';

/**
 * @luban-ui/luban-ui-e2e（Playwright）
 *
 * 物料库 / designer 的浏览器级 e2e。迁移自 nx-cypress。
 * webServer 起 @luban-ui/luban-ui 的 dev（端口 4200）。
 *
 * 与 vitest 的「component 测」（luban-base/low-code 的 test/component）分工：
 * 本目录跑真实浏览器渲染 designer 物料交互；component 测只 mount 单组件。
 */
export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  maxFailures: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.LUBAN_E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 使用 Playwright 内置 Chromium（系统无 Chrome 时的回退）
    channel: process.env.LUBAN_E2E_USE_CHROME ? 'chrome' : undefined,
  },

  webServer: process.env.SKIP_LUBAN_E2E_SERVER
    ? undefined
    : {
        // 起 luban-ui 物料库 dev server
        command: 'npx nx run @luban-ui/luban-ui:dev',
        url: 'http://127.0.0.1:4200',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});

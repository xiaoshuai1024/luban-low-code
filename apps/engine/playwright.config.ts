import { defineConfig, devices } from '@playwright/test';

/**
 * luban engine 单仓 E2E（Playwright）
 *
 * 覆盖管理后台：登录鉴权跳转、站点/页面/线索 UI 交互。
 * 真实登录（去 mock-token 假绿），账号 env 注入。
 *
 * 与 workspace 根 e2e/ 的分工：本目录测 engine 自身 UI/路由；
 * 跨项目流程（发布/线索闭环）在根 e2e/flows/。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  maxFailures: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.LUBAN_E2E_BASE_URL ?? 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    channel: process.env.LUBAN_E2E_USE_PLAYWRIGHT_CHROMIUM ? undefined : 'chrome',
  },

  webServer: process.env.SKIP_LUBAN_E2E_SERVER
    ? undefined
    : {
        command: 'vite --port 4200',
        url: 'http://127.0.0.1:4200',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

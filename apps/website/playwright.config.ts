import { defineConfig, devices } from '@playwright/test';

/**
 * luban-website 单仓 E2E（聚焦 SSR/SEO/hydration/公开页渲染）
 *
 * webServer 自动起 nuxt dev（端口 3000）。
 * BFF/后端需在测试前手动启动（或由 workspace docker-compose 编排）。
 *
 * 与 workspace 根 e2e/ 的分工：本目录只测 website 自身的 SSR 行为；
 * 跨项目流程（engine→website）在根 e2e/flows/。
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
    baseURL: process.env.LUBAN_E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 使用 Playwright 内置 Chromium（系统无 Chrome 时的回退）
    // 如需使用系统 Chrome，设置 LUBAN_E2E_USE_CHROME=1
    channel: process.env.LUBAN_E2E_USE_CHROME ? 'chrome' : undefined,
  },

  webServer: process.env.SKIP_LUBAN_E2E_SERVER
    ? undefined
    : {
        command: 'nuxt dev --port 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NUXT_PUBLIC_BFF_BASE_URL: process.env.NUXT_PUBLIC_BFF_BASE_URL ?? 'http://127.0.0.1:3100',
          NUXT_PUBLIC_DEFAULT_SITE_SLUG: process.env.NUXT_PUBLIC_DEFAULT_SITE_SLUG ?? 'default',
        },
      },
});

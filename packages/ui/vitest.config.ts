import { defineConfig } from 'vitest/config';

// vitest 4 已移除 vitest.workspace.ts（v3 起废弃），原 workspace 文件在 vitest 4 下被静默忽略
// （表现为根目录裸跑 vitest 时各包 jsdom 测试报 document is not defined）。本配置以
// test.projects 显式引用各组件库包的 vite/vitest 配置，恢复 workspace 语义。
//
// 覆盖率门禁链路（make test-coverage → scripts/coverage/coverage-summary.sh）：
//   pnpm run test:coverage → vitest run --coverage → 根 coverage/coverage-summary.json
// 只纳入组件库三包（luban-base / luban-low-code / luban-utils），对应 CLAUDE.md
// 「UI 组件库 90%」目标；apps/luban-ui 为演示应用（仅 App.spec.ts），不纳入组件库门禁。
export default defineConfig({
  test: {
    projects: [
      'packages/luban-base/vite.config.mts',
      'packages/luban-low-code/vite.config.mts',
      'packages/luban-utils/vitest.config.mts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**'],
    },
  },
});

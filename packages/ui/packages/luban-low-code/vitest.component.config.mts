import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// 组件级测试配置（jsdom mount 单组件，非浏览器 e2e）。
// 2026-06-19 正名：原 test/e2e/ 误用 e2e 命名，实为组件 mount 测；
// 浏览器级 e2e 在 apps/luban-ui-e2e（Playwright）。
export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'luban-low-code-component',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['test/component/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      enabled: false,
    },
  },
});

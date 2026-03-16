import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// 专用于 luban-low-code e2e 风格测试的 Vitest 配置，只跑 test/e2e 下的用例
export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'luban-low-code-e2e',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['test/e2e/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      enabled: false,
    },
  },
});


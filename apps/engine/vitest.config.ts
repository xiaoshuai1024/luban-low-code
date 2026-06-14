import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 测试专用：engine node_modules 中 luban-low-code 是指向源码包的 symlink，
      // dist 未构建导致 vitest 无法解析。这里 alias 到本地 stub（仅测试用，
      // 生产 build 走 vite.config.ts，不经此 alias）。
      'luban-low-code': fileURLToPath(
        new URL('./src/test/lubanLowCodeStub.ts', import.meta.url),
      ),
    },
  },
})

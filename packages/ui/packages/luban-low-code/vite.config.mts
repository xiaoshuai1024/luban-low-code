/// <reference types='vitest' />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/luban-low-code',
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  // 测试期将 luban-base 别名指向其 dist（构建产物），而非 @luban-ui/source
  // 条件解析的 src。原因：vitest 源码模式下经 src barrel 再导出 .vue 时，
  // 部分 marketing 物料 component 静默为 undefined（monorepo 源码条件解析
  // 与 vitest vue 插件交互的边缘情况）。dist 是真实发布产物，组件完整。
  // 仅影响测试解析，不影响构建（build.rollupOptions.external 仍排除 luban-base）。
  resolve: {
    alias: {
      'luban-base': path.resolve(import.meta.dirname, '../luban-base/dist/index.js'),
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'luban-low-code',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rollupOptions: {
      // 将 vue 和 luban-base 作为外部依赖，由使用方或 workspace 提供
      external: ['vue', 'luban-base'],
    },
  },
  test: {
    name: 'luban-low-code',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // 单元测试和 e2e 测试都放在 packages/luban-low-code/test 下
    include: ['{src,test}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));

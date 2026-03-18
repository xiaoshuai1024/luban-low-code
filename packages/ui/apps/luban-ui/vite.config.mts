/// <reference types='vitest' />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/luban-ui',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  resolve: {
    alias: {
      '@luban-ui/luban-base': path.resolve(
        import.meta.dirname,
        '../../packages/luban-base/src/index.ts',
      ),
      '@luban-ui/luban-low-code': path.resolve(
        import.meta.dirname,
        '../../packages/luban-low-code/src/index.ts',
      ),
      '@luban-ui/luban-utils': path.resolve(
        import.meta.dirname,
        '../../packages/luban-utils/src/index.ts',
      ),
    },
  },
  plugins: [vue()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@luban-ui/luban-ui',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));

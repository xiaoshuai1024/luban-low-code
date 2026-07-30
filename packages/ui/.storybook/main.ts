import type { StorybookConfig } from '@storybook/vue3-vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';

const config: StorybookConfig = {
  stories: [
    '../packages/luban-base/src/**/*.stories.@(ts|js)',
    '../packages/luban-low-code/src/**/*.stories.@(ts|js)',
  ],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  // GitHub Pages 静态部署子路径
  managerHead: process.env.NODE_ENV === 'production' ? [
    (process.env.STORYBOOK_BASE_HREF || '/luban-low-code/storybook/')
  ].map(() => '') : [],
  viteFinal(config) {
    const pluginNames = new Set(
      (config.plugins ?? []).map((p) => p && typeof p === 'object' && 'name' in p ? (p as { name?: string }).name : '')
    );
    if (!pluginNames.has('vite:vue')) {
      config.plugins = config.plugins ?? [];
      config.plugins.unshift(vue());
    }
    config.server = config.server ?? {};
    config.server.fs = config.server.fs ?? {};
    const projectRoot = path.resolve(__dirname, '..');
    config.server.fs.allow = [
      ...(Array.isArray(config.server.fs.allow) ? config.server.fs.allow : []),
      path.resolve(projectRoot, 'packages'),
      path.resolve(projectRoot, 'apps'),
    ];
    // 静态构建时设置 base path
    const base = process.env.NODE_ENV === 'production' ? '/luban-low-code/storybook/' : '/';
    config.base = base;
    return config;
  },
};

export default config;


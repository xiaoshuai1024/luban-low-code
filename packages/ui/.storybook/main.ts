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
  viteFinal(config) {
    // Ensure Vue plugin runs so .vue files in packages are compiled (framework may not cover them)
    const pluginNames = new Set(
      (config.plugins ?? []).map((p) => p && typeof p === 'object' && 'name' in p ? (p as { name?: string }).name : '')
    );
    if (!pluginNames.has('vite:vue')) {
      config.plugins = config.plugins ?? [];
      config.plugins.unshift(vue());
    }
    // Allow resolving workspace packages and app assets (e.g. preview.ts imports apps/luban-ui/src/styles.scss)
    config.server = config.server ?? {};
    config.server.fs = config.server.fs ?? {};
    const projectRoot = path.resolve(__dirname, '..');
    config.server.fs.allow = [
      ...(Array.isArray(config.server.fs.allow) ? config.server.fs.allow : []),
      path.resolve(projectRoot, 'packages'),
      path.resolve(projectRoot, 'apps'),
    ];
    return config;
  },
};

export default config;


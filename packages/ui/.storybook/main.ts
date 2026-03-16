import type { StorybookConfig } from '@storybook/vue3-vite';

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
};

export default config;


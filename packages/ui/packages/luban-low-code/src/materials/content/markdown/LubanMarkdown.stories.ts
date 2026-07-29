import type { Meta, StoryObj } from '@storybook/vue3';
import LubanMarkdown from './LubanMarkdown.vue';

const meta: Meta<typeof LubanMarkdown> = { title: 'Content/Markdown', component: LubanMarkdown };
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = { args: { content: '# Hello Luban\n\nThis is a **markdown** component with `code` support.\n\n## Code Block\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\n> A blockquote\n\n- Item 1\n- Item 2' } };

export const Table: Story = { args: { content: '# Table Example\n\n| Name | Type | Default |\n|------|------|--------|\n| content | string | "" |\n| theme | string | "github" |\n| highlight | boolean | true |' } };

export const VuepressTheme: Story = { args: { content: '# VuePress Style', theme: 'vuepress' } };

export const SimpleTheme: Story = { args: { content: '# Simple Dark Style', theme: 'simple' } };

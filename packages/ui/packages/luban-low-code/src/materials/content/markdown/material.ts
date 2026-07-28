import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanMarkdown from './LubanMarkdown.vue';

export const markdownMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanMarkdown',
  version: '1.0.0',
  category: 'content',
  description: 'Markdown 渲染器，支持 CommonMark + 代码高亮（highlight.js）',
  component: LubanMarkdown,
  propsSchema: {
    type: 'object',
    description: 'LubanMarkdown props',
    properties: {
      content:   { type: 'string',  description: 'Markdown 原文', default: '', label: '内容' },
      theme:     { type: 'string',  enum: ['github', 'vuepress', 'simple'], default: 'github', label: '主题' },
      highlight: { type: 'boolean', default: true,  label: '代码高亮' },
      breaks:    { type: 'boolean', default: true,  label: '换行转 <br>' },
      linkify:   { type: 'boolean', default: true,  label: '自动链接' },
    },
  },
});

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanFooter } from 'luban-base';

export const footerMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanFooter',
  version: '1.0.0',
  category: 'marketing',
  description: '站点页脚，展示多列链接与版权信息',
  component: LubanFooter,
  propsSchema: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        label: '页脚列',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', label: '列标题' },
            links: {
              type: 'array',
              label: '链接',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', label: '文字' },
                  url: { type: 'string', label: '链接' },
                },
              },
            },
          },
        },
      },
      copyright: { type: 'string', default: '© 2026', label: '版权文字' },
      backgroundColor: { type: 'string', default: '#1a1a2e', label: '背景色' },
      textColor: { type: 'string', default: '#ffffff', label: '文字颜色' },
    },
  },
});

export default footerMaterial;

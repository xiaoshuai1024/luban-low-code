import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanStats } from 'luban-base';

export const statsMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanStats',
  version: '1.0.0',
  category: 'marketing',
  description: 'KPI 数据统计区，展示数值、单位与标签',
  component: LubanStats,
  propsSchema: {
    type: 'object',
    properties: {
      stats: {
        type: 'array',
        label: '统计数据',
        items: {
          type: 'object',
          properties: {
            value: { type: 'string', label: '数值' },
            label: { type: 'string', label: '标签' },
            suffix: { type: 'string', label: '后缀' },
          },
        },
      },
      backgroundColor: { type: 'string', default: '#f9fafb', label: '背景色' },
      textColor: { type: 'string', default: '#111827', label: '文字颜色' },
    },
  },
});

export default statsMaterial;

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanFeatureGrid } from 'luban-base';

export const featureGridMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanFeatureGrid',
  version: '1.0.0',
  category: 'marketing',
  description: '特性卡片网格，展示图标、标题与描述',
  component: LubanFeatureGrid,
  propsSchema: {
    type: 'object',
    properties: {
      heading: { type: 'string', default: '核心特性', label: '标题' },
      columns: { type: 'number', default: 3, label: '列数' },
      features: {
        type: 'array',
        label: '特性列表',
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string', label: '图标' },
            title: { type: 'string', label: '标题' },
            description: { type: 'string', label: '描述' },
          },
        },
      },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
    },
  },
});

export default featureGridMaterial;

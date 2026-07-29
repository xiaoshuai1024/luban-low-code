import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanSteps from './LubanSteps.vue';

export const stepsMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanSteps',
  version: '1.0.0',
  category: 'content',
  description: '步骤流程（水平或垂直展示），每步含数字/标题/描述',
  component: LubanSteps,
  propsSchema: {
    type: 'object',
    description: 'LubanSteps props',
    properties: {
      direction: { type: 'string',  enum: ['horizontal','vertical'], default: 'horizontal', label: '方向' },
      current:   { type: 'integer', minimum: 0, default: 0, label: '当前步（0-based）' },
      items:     {
        type: 'array',
        description: '步骤列表',
        items: {
          type: 'object',
          properties: {
            title:       { type: 'string', label: '步骤标题' },
            description: { type: 'string', label: '步骤描述' },
            icon:        { type: 'string', label: '图标名（可选）' },
          },
        },
        label: '步骤',
      },
    },
  },
});

/**
 * LubanCTA 物料定义（marketing/cta）。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanCTA.vue
 *   - heading: string（必填）
 *   - description?: string
 *   - buttonText?: string，默认 '立即行动'
 *   - buttonUrl?: string
 *   - backgroundColor?: string，默认 '#4361ee'
 *   - textColor?: string，默认 '#ffffff'
 *   - buttonVariant?: 'primary' | 'outline' | 'ghost'，默认 'primary'
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanCTA } from 'luban-base';

export const ctaMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanCTA',
  version: '1.1.0',
  category: 'marketing',
  description: 'CTA 行动号召横幅，带标题、描述、主/次按钮',
  component: LubanCTA,
  propsSchema: {
    type: 'object',
    required: ['heading'],
    properties: {
      heading: { type: 'string', default: '立即开始', label: '标题' },
      description: { type: 'string', default: '', label: '描述' },
      buttonText: { type: 'string', default: '立即行动', label: '主按钮文字' },
      buttonUrl: { type: 'string', default: '', label: '主按钮链接' },
      secondaryButtonText: { type: 'string', default: '', label: '次按钮文字' },
      secondaryButtonUrl: { type: 'string', default: '', label: '次按钮链接' },
      backgroundColor: { type: 'string', default: '#4361ee', label: '背景色' },
      textColor: { type: 'string', default: '#ffffff', label: '文字颜色' },
      buttonVariant: {
        type: 'string',
        enum: ['primary', 'outline', 'ghost'],
        default: 'primary',
        label: '主按钮样式',
      },
      fullWidth: { type: 'boolean', default: false, label: '占满宽度' },
    },
  },
  capabilities: {
    animationTriggers: ['in-view', 'load'],
  },
});

export default ctaMaterial;

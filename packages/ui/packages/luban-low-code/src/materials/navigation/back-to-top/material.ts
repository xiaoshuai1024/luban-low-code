import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanBackToTop from './LubanBackToTop.vue';

export const backToTopMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanBackToTop',
  version: '1.0.0',
  category: 'navigation',
  description: '页面滚动后显示回到顶部浮动按钮（Material Design FAB 风格）',
  component: LubanBackToTop,
  propsSchema: {
    type: 'object',
    description: 'LubanBackToTop props',
    properties: {
      visibilityHeight: { type: 'integer', minimum: 0, default: 300, label: '滚动显示阈值（px）' },
      right:            { type: 'string',  default: '40px', label: '距右侧' },
      bottom:           { type: 'string',  default: '40px', label: '距底部' },
      duration:         { type: 'integer', minimum: 0, default: 300, label: '动画时长（ms）' },
    },
  },
});

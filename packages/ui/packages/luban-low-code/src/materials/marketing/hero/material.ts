/**
 * LubanHero 物料定义（marketing/hero）。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanHero.vue
 *   - title: string（必填）
 *   - subtitle?: string
 *   - ctaText?: string，默认 '了解更多'
 *   - ctaUrl?: string
 *   - backgroundImage?: string
 *   - backgroundColor?: string，默认 '#1a1a2e'
 *   - textColor?: string，默认 '#ffffff'
 *   - height?: string，默认 '400px'
 *   - align?: 'left' | 'center' | 'right'，默认 'center'
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanHero } from 'luban-base';

export const heroMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanHero',
  version: '1.1.0',
  category: 'marketing',
  description: 'Hero 区块，展示眉标、大标题、副标题、主/次 CTA 与背景图',
  component: LubanHero,
  propsSchema: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', default: '欢迎访问', label: '主标题' },
      subtitle: { type: 'string', default: '', label: '副标题' },
      eyebrow: { type: 'string', default: '', label: '眉标（标题上方小标签）' },
      ctaText: { type: 'string', default: '了解更多', label: '主按钮文字' },
      ctaUrl: { type: 'string', default: '', label: '主按钮链接' },
      secondaryCtaText: { type: 'string', default: '', label: '次按钮文字' },
      secondaryCtaUrl: { type: 'string', default: '', label: '次按钮链接' },
      backgroundImage: { type: 'string', default: '', label: '背景图片' },
      backgroundColor: { type: 'string', default: '#1a1a2e', label: '背景色' },
      textColor: { type: 'string', default: '#ffffff', label: '文字颜色' },
      height: { type: 'string', default: '400px', label: '高度' },
      align: {
        type: 'string',
        enum: ['left', 'center', 'right'],
        default: 'center',
        label: '对齐方式',
      },
      layout: {
        type: 'string',
        enum: ['centered', 'split'],
        default: 'centered',
        label: '布局（split=左文右图）',
      },
      sideImage: { type: 'string', default: '', label: 'split 布局右侧图' },
    },
  },
  capabilities: {
    animationTriggers: ['in-view', 'load', 'hover'],
  },
});

export default heroMaterial;

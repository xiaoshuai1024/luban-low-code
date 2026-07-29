/**
 * LubanTestimonial 物料定义（marketing/testimonial）。
 *
 * Vue 来源：packages/luban-base/src/lib/content/LubanTestimonial.vue
 *   - quote: string（必填）
 *   - author?: string
 *   - role?: string
 *   - avatarUrl?: string
 *   - rating?: number，0-5，默认 0（不显示）
 *   - backgroundColor?: string，默认 '#ffffff'
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanTestimonial } from 'luban-base';

export const testimonialMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanTestimonial',
  version: '1.1.0',
  category: 'marketing',
  description: '评价/社交证明卡片，展示引用、评分与作者信息',
  component: LubanTestimonial,
  propsSchema: {
    type: 'object',
    required: ['quote'],
    properties: {
      quote: { type: 'string', default: '非常好用！推荐给所有人。', label: '引用内容' },
      author: { type: 'string', default: '', label: '作者姓名' },
      role: { type: 'string', default: '', label: '头衔/职务' },
      avatarUrl: { type: 'string', default: '', label: '头像地址' },
      rating: { type: 'number', default: 0, label: '评分', minimum: 0, maximum: 5 },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
    },
  },
});

export default testimonialMaterial;

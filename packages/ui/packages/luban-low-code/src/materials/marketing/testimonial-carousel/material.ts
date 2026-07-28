import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanTestimonialCarousel } from 'luban-base';

export const testimonialCarouselMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanTestimonialCarousel',
  version: '1.0.0',
  category: 'marketing',
  description: '客户评价轮播，自动播放与分页切换',
  component: LubanTestimonialCarousel,
  propsSchema: {
    type: 'object',
    properties: {
      testimonials: {
        type: 'array',
        label: '评价列表',
        items: {
          type: 'object',
          properties: {
            quote: { type: 'string', label: '评价内容' },
            author: { type: 'string', label: '作者' },
            role: { type: 'string', label: '职位' },
            avatarUrl: { type: 'string', label: '头像' },
            rating: { type: 'number', label: '评分(1-5)' },
          },
        },
      },
      interval: { type: 'number', default: 5000, label: '切换间隔(ms)' },
      autoplay: { type: 'boolean', default: true, label: '自动播放' },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
    },
  },
});

export default testimonialCarouselMaterial;

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanPricing } from 'luban-base';

export const pricingMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanPricing',
  version: '1.0.0',
  category: 'marketing',
  description: '定价方案卡片，支持高亮套餐与功能清单',
  component: LubanPricing,
  propsSchema: {
    type: 'object',
    properties: {
      heading: { type: 'string', default: '选择方案', label: '标题' },
      plans: {
        type: 'array',
        label: '套餐列表',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', label: '名称' },
            price: { type: 'string', label: '价格' },
            period: { type: 'string', label: '周期' },
            features: {
              type: 'array',
              label: '功能',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', label: '文字' },
                  included: { type: 'boolean', label: '是否包含' },
                },
              },
            },
            ctaText: { type: 'string', label: '按钮文字' },
            ctaUrl: { type: 'string', label: '按钮链接' },
          },
        },
      },
      highlightIndex: { type: 'number', default: -1, label: '高亮索引' },
      backgroundColor: { type: 'string', default: '#f9fafb', label: '背景色' },
    },
  },
});

export default pricingMaterial;

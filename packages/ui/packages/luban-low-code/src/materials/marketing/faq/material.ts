import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanFAQ } from 'luban-base';

export const faqMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanFAQ',
  version: '1.0.0',
  category: 'marketing',
  description: '常见问题手风琴，支持默认展开项',
  component: LubanFAQ,
  propsSchema: {
    type: 'object',
    properties: {
      heading: { type: 'string', default: '常见问题', label: '标题' },
      items: {
        type: 'array',
        label: '问答列表',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', label: '问题' },
            answer: { type: 'string', label: '答案' },
          },
        },
      },
      defaultOpenIndex: { type: 'number', default: -1, label: '默认展开索引' },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
    },
  },
});

export default faqMaterial;

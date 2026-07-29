import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanGallery } from 'luban-base';

export const galleryMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanGallery',
  version: '1.0.0',
  category: 'marketing',
  description: '图片画廊网格，支持列数、间距与说明',
  component: LubanGallery,
  propsSchema: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        label: '图片列表',
        items: {
          type: 'object',
          properties: {
            src: { type: 'string', label: '图片地址' },
            alt: { type: 'string', label: '替代文字' },
            caption: { type: 'string', label: '说明' },
          },
        },
      },
      columns: { type: 'number', default: 3, label: '列数' },
      gap: { type: 'string', default: '16px', label: '间距' },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
    },
  },
});

export default galleryMaterial;

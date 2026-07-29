import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanLogoCloud } from 'luban-base';

export const logoCloudMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanLogoCloud',
  version: '1.0.0',
  category: 'marketing',
  description: '客户/合作品牌 Logo 展示条，支持灰度处理',
  component: LubanLogoCloud,
  propsSchema: {
    type: 'object',
    properties: {
      heading: { type: 'string', default: '他们都在使用', label: '标题' },
      logos: {
        type: 'array',
        label: 'Logo 列表',
        items: {
          type: 'object',
          properties: {
            src: { type: 'string', label: '图片地址' },
            alt: { type: 'string', label: '替代文字' },
            url: { type: 'string', label: '链接' },
          },
        },
      },
      grayscale: { type: 'boolean', default: true, label: '灰度' },
      backgroundColor: { type: 'string', default: '#f9fafb', label: '背景色' },
    },
  },
});

export default logoCloudMaterial;

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanNavbar } from 'luban-base';

export const navbarMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanNavbar',
  version: '1.0.0',
  category: 'marketing',
  description: '顶部导航栏，展示品牌名称与导航链接',
  component: LubanNavbar,
  propsSchema: {
    type: 'object',
    properties: {
      brand: { type: 'string', default: 'Luban', label: '品牌名称' },
      links: {
        type: 'array',
        label: '导航链接',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: '文字' },
            url: { type: 'string', label: '链接' },
          },
        },
      },
      backgroundColor: { type: 'string', default: '#ffffff', label: '背景色' },
      textColor: { type: 'string', default: '#1a1a2e', label: '文字颜色' },
      sticky: { type: 'boolean', default: true, label: '吸顶' },
    },
  },
});

export default navbarMaterial;

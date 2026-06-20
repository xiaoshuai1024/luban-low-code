/**
 * LubanMenu 物料定义（navigation/menu）。
 *
 * 导航菜单：items 定义层级（label/key/children?），mode 控制 horizontal/
 * vertical 排列，activeKey 受控高亮。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - items:    array<{ label:string, key:string, children?:items }>（默认 []）
 *  - mode:     enum 'horizontal' | 'vertical'（默认 'horizontal'）
 *  - activeKey: string（默认 ''）
 * events: select(key)
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanMenu from './LubanMenu.vue';

export const menuMaterial = defineMaterial({
  name: 'LubanMenu',
  version: '1.0.0',
  category: 'navigation',
  description: '导航菜单：支持横向/纵向模式与子菜单',
  component: LubanMenu,
  propsSchema: {
    type: 'object',
    description: 'LubanMenu 导航菜单属性',
    properties: {
      items: {
        type: 'array',
        label: '菜单项',
        description: '菜单项集合，每项 { label, key, children? }',
        default: [],
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: '文案', default: '' },
            key: { type: 'string', label: '唯一标识', default: '' },
            children: {
              type: 'array',
              label: '子菜单',
              default: [],
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', default: '' },
                  key: { type: 'string', default: '' },
                },
              },
            },
          },
        },
      },
      mode: {
        type: 'string',
        label: '排列模式',
        description: 'horizontal 横向 / vertical 纵向',
        enum: ['horizontal', 'vertical'],
        default: 'horizontal',
      },
      activeKey: {
        type: 'string',
        label: '激活项',
        description: '当前激活菜单项的 key',
        default: '',
      },
    },
  },
  events: [
    {
      name: 'select',
      description: '选中菜单项（参数：item.key）',
    },
  ],
});

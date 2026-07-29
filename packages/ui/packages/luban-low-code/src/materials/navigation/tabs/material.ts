/**
 * LubanTabs 物料定义（navigation/tabs）。
 *
 * 标签页：tabs 定义标签集合（label/key），activeKey 受控切换，type 控制视觉
 * 变体（'' / 'card' / 'border-card'）。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - tabs:     array<{ label:string, key:string }>（默认 []）
 *  - activeKey: string（默认 ''）
 *  - type:     enum '' | 'card' | 'border-card'（默认 ''）
 * events: change(key)
 * slots:  default（作用域插槽，提供 activeKey）
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanTabs from './LubanTabs.vue';

export const tabsMaterial = defineMaterial({
  name: 'LubanTabs',
  version: '1.0.0',
  category: 'navigation',
  description: '标签页：支持 line/card/border-card 三种视觉变体',
  component: LubanTabs,
  propsSchema: {
    type: 'object',
    description: 'LubanTabs 标签页属性',
    properties: {
      tabs: {
        type: 'array',
        label: '标签列表',
        description: '标签页集合，每项 { label, key }',
        default: [],
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: '文案', default: '' },
            key: { type: 'string', label: '唯一标识', default: '' },
          },
        },
      },
      activeKey: {
        type: 'string',
        label: '激活项',
        description: '当前激活标签的 key',
        default: '',
      },
      type: {
        type: 'string',
        label: '样式类型',
        description: '空字符串=下划线，card=卡片，border-card=带边框卡片',
        enum: ['', 'card', 'border-card'],
        default: '',
      },
    },
  },
  events: [
    {
      name: 'change',
      description: '切换标签页（参数：tab.key）',
    },
  ],
  slots: [
    {
      name: 'default',
      description: '标签页内容区（作用域插槽，参数 activeKey）',
    },
  ],
});

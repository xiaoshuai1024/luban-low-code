/**
 * LubanDrawer 物料定义（feedback/drawer）。
 *
 * 抽屉：visible 受控（v-model:visible），placement 控制滑出方向
 * （left/right/top/bottom），size 表示尺寸（横向=宽，纵向=高）。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - title:    string（默认 ''）
 *  - visible:  boolean（默认 false）
 *  - placement: enum 'left' | 'right' | 'top' | 'bottom'（默认 'right'）
 *  - size:     string（默认 '30%'）
 * events: open / close / update:visible
 * slots:  default（内容）
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanDrawer from './LubanDrawer.vue';

export const drawerMaterial = defineMaterial({
  name: 'LubanDrawer',
  version: '1.0.0',
  category: 'feedback',
  description: '抽屉：四向滑出面板，visible 受控',
  component: LubanDrawer,
  propsSchema: {
    type: 'object',
    description: 'LubanDrawer 抽屉属性',
    properties: {
      title: {
        type: 'string',
        label: '标题',
        default: '',
      },
      visible: {
        type: 'boolean',
        label: '是否显示',
        description: '受控显隐（v-model:visible）',
        default: false,
      },
      placement: {
        type: 'string',
        label: '滑出方向',
        description: 'left/right/top/bottom',
        enum: ['left', 'right', 'top', 'bottom'],
        default: 'right',
      },
      size: {
        type: 'string',
        label: '尺寸',
        description: '横向=宽度，纵向=高度，如 "30%" / "320px"',
        default: '30%',
      },
    },
  },
  events: [
    {
      name: 'open',
      description: '抽屉打开后触发',
    },
    {
      name: 'close',
      description: '抽屉关闭后触发',
    },
    {
      name: 'update:visible',
      description: 'visible 变更（v-model:visible；参数 boolean）',
    },
  ],
  slots: [
    {
      name: 'default',
      description: '抽屉主体内容',
    },
  ],
});

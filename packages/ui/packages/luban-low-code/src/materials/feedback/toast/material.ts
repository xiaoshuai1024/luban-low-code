/**
 * LubanToast 物料定义（feedback/toast）。
 *
 * 全局提示：message 文案、type 视觉类型（success/warning/info/error）、
 * duration 自动消失毫秒数。
 *
 * 组件双形态：
 *  - 物料态：受控 props 渲染静态预览（画布可见当前文案/类型）；
 *  - 运行时命令式：组件实例暴露 show(msg?,type?,duration?)，由事件动作触发。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - message:  string（默认 ''）
 *  - type:     enum 'success' | 'warning' | 'info' | 'error'（默认 'info'）
 *  - duration: number（默认 3000；<=0 表示不自动消失）
 * events: 无（命令式触发，无声明事件）
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanToast from './LubanToast.vue';

export const toastMaterial = defineMaterial({
  name: 'LubanToast',
  version: '1.0.0',
  category: 'feedback',
  description: '全局提示：message/type/duration，命令式触发',
  component: LubanToast,
  propsSchema: {
    type: 'object',
    description: 'LubanToast 全局提示属性',
    properties: {
      message: {
        type: 'string',
        label: '提示文案',
        default: '',
      },
      type: {
        type: 'string',
        label: '类型',
        description: 'success/warning/info/error',
        enum: ['success', 'warning', 'info', 'error'],
        default: 'info',
      },
      duration: {
        type: 'number',
        label: '持续时间',
        description: '自动消失毫秒数；<=0 表示不自动消失',
        default: 3000,
      },
    },
  },
  events: [],
});

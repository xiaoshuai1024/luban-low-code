/**
 * LubanModal 物料定义（feedback/modal）。
 *
 * 模态对话框：visible 受控（v-model:visible），title 标题，width CSS 宽度。
 *
 * propsSchema 字段（全字段声明 default）：
 *  - title:   string（默认 ''）
 *  - visible: boolean（默认 false）
 *  - width:   string（默认 '50%'）
 * events: open / close / update:visible
 * slots:  default（内容）/ footer（底部操作区）
 *
 * @since 1.0.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import LubanModal from './LubanModal.vue';

export const modalMaterial = defineMaterial({
  name: 'LubanModal',
  version: '1.0.0',
  category: 'feedback',
  description: '模态对话框：标题 + 内容 + 底部操作，visible 受控',
  component: LubanModal,
  propsSchema: {
    type: 'object',
    description: 'LubanModal 模态对话框属性',
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
      width: {
        type: 'string',
        label: '宽度',
        description: 'CSS 宽度，如 "50%" / "480px"',
        default: '50%',
      },
    },
  },
  events: [
    {
      name: 'open',
      description: '对话框打开后触发',
    },
    {
      name: 'close',
      description: '对话框关闭后触发',
    },
    {
      name: 'update:visible',
      description: 'visible 变更（v-model:visible；参数 boolean）',
    },
  ],
  slots: [
    {
      name: 'default',
      description: '对话框主体内容',
    },
    {
      name: 'footer',
      description: '底部操作区（如确认/取消按钮）',
    },
  ],
});

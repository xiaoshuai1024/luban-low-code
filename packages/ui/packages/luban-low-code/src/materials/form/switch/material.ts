/**
 * LubanSwitch 物料定义（form/switch）。
 *
 * 受控开关：通过 modelValue（boolean）+ update:modelValue 双向绑定。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanSwitch.vue
 *  - modelValue?: boolean（默认 false）
 *  - label?:     string
 *  - name?:      string（渲染为 hidden input，用于表单提交）
 *  - disabled?:  boolean（默认 false）
 * emits: 'update:modelValue': [value: boolean]
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

export const switchMaterial = defineMaterial({
  name: 'LubanSwitch',
  version: '0.1.0',
  category: 'form',
  description: '开关',
  component: getComponent('LubanSwitch')!,
  propsSchema: {
    type: 'object',
    properties: {
      modelValue: {
        type: 'boolean',
        label: '值',
        description: '开关状态（v-model）',
        default: false,
      },
      label: {
        type: 'string',
        label: '标签',
        description: '开关文本标签',
      },
      name: {
        type: 'string',
        label: '字段名',
        description: '渲染为 hidden input name，用于表单提交',
      },
      disabled: {
        type: 'boolean',
        label: '禁用',
        default: false,
      },
    },
  },
  events: [
    {
      name: 'update:modelValue',
      description: '开关状态变化（参数：boolean）',
    },
  ],
});

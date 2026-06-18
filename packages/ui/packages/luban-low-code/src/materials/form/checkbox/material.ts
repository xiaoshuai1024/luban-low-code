/**
 * LubanCheckbox 物料定义（form/checkbox）。
 *
 * 受控复选框：通过 modelValue（boolean）+ update:modelValue 双向绑定。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanCheckbox.vue
 *  - modelValue?: boolean（默认 false）
 *  - label?:    string
 *  - name?:     string（原生 input name）
 *  - required?: boolean（默认 false）
 *  - disabled?: boolean（默认 false）
 * emits: 'update:modelValue': [value: boolean]
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

export const checkboxMaterial = defineMaterial({
  name: 'LubanCheckbox',
  version: '0.1.0',
  category: 'form',
  description: '复选框',
  component: getComponent('LubanCheckbox')!,
  propsSchema: {
    type: 'object',
    properties: {
      modelValue: {
        type: 'boolean',
        label: '值',
        description: '是否勾选（v-model）',
        default: false,
      },
      label: {
        type: 'string',
        label: '标签',
        description: '复选框文本标签',
      },
      name: {
        type: 'string',
        label: '字段名',
        description: '原生 input name，用于表单提交',
      },
      required: {
        type: 'boolean',
        label: '必填',
        default: false,
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
      description: '勾选状态变化（参数：boolean）',
    },
  ],
});

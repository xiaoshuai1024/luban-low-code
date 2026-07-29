/**
 * LubanRadioGroup 物料定义（form/radio-group）。
 *
 * 受控单选组：通过 modelValue + update:modelValue 双向绑定；
 * options 为 { label, value }[]（见 luban-base form-types LubanRadioOption）。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanRadioGroup.vue
 *  - modelValue?: string | number | null（默认 null）
 *  - label?:     string
 *  - name?:      string
 *  - options?:   LubanRadioOption[]（默认 () => []）
 *  - required?:  boolean（默认 false）
 *  - disabled?:  boolean（默认 false）
 * emits: 'update:modelValue': [value: string | number | null]
 *
 * options 用 JSON Schema array + items.object 描述：
 *   items: { type:'object', properties:{ label:string, value:string|number } }
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

export const radioGroupMaterial = defineMaterial({
  name: 'LubanRadioGroup',
  version: '0.1.0',
  category: 'form',
  description: '单选',
  component: getComponent('LubanRadioGroup')!,
  propsSchema: {
    type: 'object',
    properties: {
      modelValue: {
        type: 'string',
        label: '值',
        description: '当前选中值（v-model；可为 string | number | null）',
        default: null,
      },
      label: {
        type: 'string',
        label: '标签',
        description: '单选组外层文本标签',
      },
      name: {
        type: 'string',
        label: '字段名',
        description: '原生 radio name，用于表单提交',
      },
      options: {
        type: 'array',
        label: '选项',
        description: '单选项集合，每项 { label, value }',
        default: [],
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', label: '文案' },
            value: { type: 'string', label: '值（可为 string | number）' },
          },
        },
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
      description: '选中项变化（参数：string | number | null）',
    },
  ],
});

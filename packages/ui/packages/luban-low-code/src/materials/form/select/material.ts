/**
 * LubanSelect 物料定义（form/select）。
 *
 * 受控下拉选择：通过 modelValue（string | number | null）+ update:modelValue
 * 双向绑定；options 为 { label, value }[]（见 luban-base form-types LubanSelectOption）。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanSelect.vue
 *  - modelValue?:    string | number | null（默认 null）
 *  - label?:         string
 *  - name?:          string（原生 select name，用于表单提交）
 *  - placeholder?:   string
 *  - options?:       LubanSelectOption[]（默认 () => []）
 *  - required?:      boolean（默认 false）
 *  - disabled?:      boolean（默认 false）
 *  - helperText?:    string  ← 修漂移（旧 componentMeta 缺失）
 *  - error?:         boolean（默认 false）  ← 修漂移（旧 componentMeta 缺失）
 *  - errorMessage?:  string  ← 修漂移（旧 componentMeta 缺失）
 * emits: 'update:modelValue': [value: string | number | null]
 *         blur: [event: FocusEvent]
 *         focus: [event: FocusEvent]
 *
 * options 用 JSON Schema array + items.object 描述：
 *   items: { type:'object', properties:{ label:string, value:string|number } }
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

export const selectMaterial = defineMaterial({
  name: 'LubanSelect',
  version: '0.1.0',
  category: 'form',
  description: '选择',
  component: getComponent('LubanSelect')!,
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
        description: '选择框文本标签',
      },
      name: {
        type: 'string',
        label: '字段名',
        description: '原生 select name，用于表单提交',
      },
      placeholder: {
        type: 'string',
        label: '占位',
        description: '占位提示文本（渲染为 value 为空且 disabled 的 option）',
      },
      options: {
        type: 'array',
        label: '选项',
        description: '下拉项集合，每项 { label, value }',
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
      helperText: {
        type: 'string',
        label: '帮助文本',
        description: '字段下方的辅助说明；仅在 error 为 false 时显示',
      },
      error: {
        type: 'boolean',
        label: '错误',
        description: '是否处于错误态（aria-invalid + 错误样式）',
        default: false,
      },
      errorMessage: {
        type: 'string',
        label: '错误信息',
        description: '错误态下显示的错误提示文本（error 为 true 时展示）',
      },
    },
  },
  events: [
    {
      name: 'update:modelValue',
      description: '选中项变化（参数：string | number | null）',
    },
    {
      name: 'blur',
      description: '失焦（参数：FocusEvent）',
    },
    {
      name: 'focus',
      description: '聚焦（参数：FocusEvent）',
    },
  ],
});

/**
 * LubanTextArea 物料定义（form/textarea）。
 *
 * 受控多行文本框：通过 modelValue（string）+ update:modelValue 双向绑定；
 * 字段集与 LubanInput 一致（去掉 type，新增 rows）。
 *
 * propsSchema 来源：packages/luban-base/src/lib/form/LubanTextArea.vue
 *  - modelValue?:    string（默认 ''）
 *  - label?:         string
 *  - name?:          string（原生 textarea name，用于表单提交）
 *  - placeholder?:   string
 *  - required?:      boolean（默认 false）
 *  - disabled?:      boolean（默认 false）
 *  - rows?:          number（默认 3）
 *  - helperText?:    string  ← 修漂移（旧 componentMeta 缺失）
 *  - error?:         boolean（默认 false）  ← 修漂移（旧 componentMeta 缺失）
 *  - errorMessage?:  string  ← 修漂移（旧 componentMeta 缺失）
 * emits: 'update:modelValue': [value: string]
 *         blur: [event: FocusEvent]
 *         focus: [event: FocusEvent]
 *
 * @since 0.1.0
 */

import { defineMaterial } from '../../../lib/material/defineMaterial';
import { getComponent } from '../../../lib/registry';

export const textAreaMaterial = defineMaterial({
  name: 'LubanTextArea',
  version: '0.1.0',
  category: 'form',
  description: '多行文本',
  component: getComponent('LubanTextArea')!,
  propsSchema: {
    type: 'object',
    properties: {
      modelValue: {
        type: 'string',
        label: '值',
        description: '当前输入值（v-model）',
        default: '',
      },
      label: {
        type: 'string',
        label: '标签',
        description: '文本框文本标签',
      },
      name: {
        type: 'string',
        label: '字段名',
        description: '原生 textarea name，用于表单提交',
      },
      placeholder: {
        type: 'string',
        label: '占位',
        description: '占位提示文本',
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
      rows: {
        type: 'number',
        label: '行数',
        description: '可见行数（textarea rows）',
        default: 3,
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
      description: '输入值变化（参数：string）',
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

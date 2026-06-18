/**
 * LubanButton 物料定义（general/button）。
 *
 * propsSchema 与 luban-base 的 LubanButton.vue defineProps + withDefaults
 * 逐字段对齐，作为单一事实来源（反漂移）。请勿手改本文件字段而不改 Vue 组件。
 *
 * Vue 来源：packages/luban-base/src/lib/button/LubanButton.vue
 * 类型来源：packages/luban-base/src/lib/button/button-types.ts
 *   - ButtonVariant = 'contained' | 'outlined' | 'text'
 *   - ButtonColor   = 'primary' | 'secondary' | 'surface'
 *
 * @since 0.1.0
 */

import type { MaterialDefinition } from '../../../lib/material/defineMaterial';
import { defineMaterial } from '../../../lib/material/defineMaterial';
import { LubanButton } from 'luban-base';

/**
 * 按钮物料。
 *
 * 注意 default 对齐 Vue 组件 withDefaults（content 默认 '' 而非 '按钮'）；
 * 旧 componentMeta 的 defaultProps.content='按钮' 属于设计期默认值，
 * 由 registry/palette 层负责覆盖，本 propsSchema 仅描述组件 prop 默认值。
 */
export const buttonMaterial: MaterialDefinition = defineMaterial({
  name: 'LubanButton',
  version: '1.0.0',
  category: 'general',
  description: '通用按钮，支持实心/描边/文本三种变体与主/次/表面三种颜色',
  component: LubanButton,
  propsSchema: {
    type: 'object',
    description: 'LubanButton 按钮组件属性',
    properties: {
      content: {
        type: 'string',
        description: '按钮文案；当未传入默认插槽时作为文本内容展示',
        default: '',
        label: '文案',
      },
      variant: {
        type: 'string',
        description: '视觉变体：contained 实心 / outlined 描边 / text 文本',
        enum: ['contained', 'outlined', 'text'],
        default: 'contained',
        label: '变体',
      },
      color: {
        type: 'string',
        description: '颜色主题：primary 主色 / secondary 次色 / surface 表面',
        enum: ['primary', 'secondary', 'surface'],
        default: 'primary',
        label: '颜色',
      },
      disabled: {
        type: 'boolean',
        description: '是否禁用',
        default: false,
        label: '禁用',
      },
      block: {
        type: 'boolean',
        description: '是否块级（宽度 100%）',
        default: false,
        label: '块级',
      },
      type: {
        type: 'string',
        description: '原生 button 的 type 属性',
        enum: ['button', 'submit', 'reset'],
        default: 'button',
        label: '按钮类型',
      },
    },
  },
  events: [
    {
      name: 'click',
      description: '点击事件（参数：原生 MouseEvent）',
    },
  ],
  slots: [
    {
      name: 'default',
      description: '默认插槽，覆盖 content 文案；未传入时回退到 content',
    },
  ],
});
